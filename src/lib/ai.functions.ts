import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const CHAT_MODEL = "google/gemini-3-flash-preview";
const EMBED_MODEL = "openai/text-embedding-3-small";
const MAX_TOKENS = 600;

function getKey() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente");
  return key;
}

/* ---------------- CRM tool calling ---------------- */

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type ChatMsg =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

function buildCrmTools() {
  return [
    {
      type: "function",
      function: {
        name: "search_contacts",
        description: "Busca contatos/leads do workspace por nome, email ou empresa. Use antes de criar duplicados.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Termo de busca parcial (nome, email ou empresa)" },
            limit: { type: "number", description: "Máximo de resultados (1-20)", default: 10 },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_contact",
        description: "Cria um novo contato/lead no CRM. Sempre confirme o nome antes de criar.",
        parameters: {
          type: "object",
          properties: {
            full_name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            company: { type: "string" },
            job_title: { type: "string" },
            status: { type: "string", enum: ["lead", "qualified", "customer", "lost"] },
            notes: { type: "string" },
          },
          required: ["full_name"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "add_activity",
        description: "Registra uma atividade (nota/ligação/email/reunião) vinculada a um contato.",
        parameters: {
          type: "object",
          properties: {
            contact_id: { type: "string", description: "UUID do contato. Obtenha via search_contacts." },
            type: { type: "string", enum: ["note", "call", "email", "meeting", "task"] },
            title: { type: "string" },
            body: { type: "string" },
          },
          required: ["contact_id", "title"],
        },
      },
    },
  ];
}

async function runCrmTool(
  call: ToolCall,
  ctx: {
    supabase: { from: (t: string) => unknown };
    workspaceId: string;
    userId: string;
    agentId: string;
  },
): Promise<unknown> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.function.arguments || "{}");
  } catch {
    return { error: "invalid_arguments" };
  }
  const sb = ctx.supabase as unknown as {
    from: (t: string) => {
      select: (...a: unknown[]) => unknown;
      insert: (r: unknown) => unknown;
    };
  };

  if (call.function.name === "search_contacts") {
    const query = String(args.query ?? "").trim();
    const limit = Math.min(Math.max(Number(args.limit ?? 10), 1), 20);
    if (!query) return { results: [] };
    const builder = sb.from("crm_contacts") as unknown as {
      select: (s: string) => {
        eq: (c: string, v: string) => {
          or: (f: string) => { limit: (n: number) => Promise<{ data: unknown[]; error: unknown }> };
        };
      };
    };
    const { data, error } = await builder
      .select("id, full_name, email, phone, company, job_title, status")
      .eq("workspace_id", ctx.workspaceId)
      .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%`)
      .limit(limit);
    if (error) return { error: String(error) };
    return { results: data ?? [] };
  }

  if (call.function.name === "create_contact") {
    const fullName = String(args.full_name ?? "").trim();
    if (!fullName) return { error: "full_name é obrigatório" };
    const status = ["lead", "qualified", "customer", "lost"].includes(String(args.status))
      ? String(args.status)
      : "lead";
    const ins = sb.from("crm_contacts") as unknown as {
      insert: (r: unknown) => {
        select: (s: string) => { single: () => Promise<{ data: { id: string } | null; error: unknown }> };
      };
    };
    const { data, error } = await ins
      .insert({
        workspace_id: ctx.workspaceId,
        created_by: ctx.userId,
        full_name: fullName,
        email: args.email ?? null,
        phone: args.phone ?? null,
        company: args.company ?? null,
        job_title: args.job_title ?? null,
        status,
        notes: args.notes ?? null,
        source: "agent",
      })
      .select("id")
      .single();
    if (error || !data) return { error: String(error ?? "fail") };
    return { id: data.id, ok: true };
  }

  if (call.function.name === "add_activity") {
    const contactId = String(args.contact_id ?? "").trim();
    const title = String(args.title ?? "").trim();
    if (!contactId || !title) return { error: "contact_id e title obrigatórios" };
    const type = ["note", "call", "email", "meeting", "task"].includes(String(args.type))
      ? String(args.type)
      : "note";
    const ins = sb.from("crm_activities") as unknown as {
      insert: (r: unknown) => Promise<{ error: unknown }>;
    };
    const { error } = await ins.insert({
      workspace_id: ctx.workspaceId,
      contact_id: contactId,
      user_id: ctx.userId,
      agent_id: ctx.agentId,
      type,
      title,
      body: args.body ?? null,
    });
    if (error) return { error: String(error) };
    return { ok: true };
  }

  return { error: "unknown_tool" };
}

async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${GATEWAY_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": getKey(),
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text, dimensions: 1536 }),
  });
  if (!res.ok) throw new Error(`Embed falhou (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data[0].embedding;
}

function chunkText(text: string, target = 900, overlap = 120): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + target, clean.length);
    let slice = clean.slice(i, end);
    if (end < clean.length) {
      const lastBreak = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "), slice.lastIndexOf("\n"));
      if (lastBreak > target * 0.5) slice = slice.slice(0, lastBreak + 1);
    }
    chunks.push(slice.trim());
    i += slice.length - overlap;
    if (slice.length <= overlap) i = end;
  }
  return chunks.filter((c) => c.length > 30);
}

/* ---------------- Index a document into chunks ---------------- */

export const indexDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ documentId: z.string().uuid(), text: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { documentId, text } = data;

    const { data: doc, error: docErr } = await context.supabase
      .from("agent_documents")
      .select("id, agent_id, owner_id, workspace_id")
      .eq("id", documentId)
      .maybeSingle();
    if (docErr || !doc) throw new Error("Documento não encontrado");
    if (!doc.workspace_id) throw new Error("Documento sem workspace");

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      await context.supabase
        .from("agent_documents")
        .update({ status: "failed" })
        .eq("id", documentId);
      return { chunks: 0 };
    }

    const rows: {
      document_id: string;
      agent_id: string;
      owner_id: string;
      workspace_id: string;
      content: string;
      chunk_index: number;
      embedding: string;
    }[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const vec = await embed(chunks[i]);
      rows.push({
        document_id: doc.id,
        agent_id: doc.agent_id,
        owner_id: doc.owner_id,
        workspace_id: doc.workspace_id,
        content: chunks[i],
        chunk_index: i,
        embedding: `[${vec.join(",")}]`,
      });
    }

    const { error: insErr } = await context.supabase.from("document_chunks").insert(rows);
    if (insErr) {
      await context.supabase
        .from("agent_documents")
        .update({ status: "failed" })
        .eq("id", documentId);
      throw insErr;
    }

    await context.supabase
      .from("agent_documents")
      .update({ status: "ready" })
      .eq("id", documentId);

    return { chunks: rows.length };
  });

/* ---------------- Chat with RAG ---------------- */

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        agentId: z.string().uuid(),
        conversationId: z.string().uuid().nullable(),
        message: z.string().min(1).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const startedAt = Date.now();
    const { agentId, message } = data;

    const { data: allowed, error: rlErr } = await context.supabase.rpc(
      "check_and_record_rate_limit",
      { _bucket: "chat", _max: 20, _window_seconds: 60 },
    );
    if (rlErr) throw rlErr;
    if (!allowed) {
      throw new Error("Você atingiu o limite de mensagens por minuto. Aguarde alguns segundos.");
    }

    const { data: agent, error: aErr } = await context.supabase
      .from("agents")
      .select("id, name, objective, workspace_id")
      .eq("id", agentId)
      .maybeSingle();
    if (aErr || !agent) throw new Error("Agente não encontrado");
    if (!agent.workspace_id) throw new Error("Agente sem workspace");

    const wsId = agent.workspace_id;

    let conversationId = data.conversationId;
    if (!conversationId) {
      const { data: conv, error: cErr } = await context.supabase
        .from("conversations")
        .insert({
          agent_id: agentId,
          owner_id: context.userId,
          workspace_id: wsId,
          title: message.slice(0, 60),
        })
        .select("id")
        .single();
      if (cErr) throw cErr;
      conversationId = conv.id;
    }

    await context.supabase.from("messages").insert({
      conversation_id: conversationId,
      owner_id: context.userId,
      workspace_id: wsId,
      role: "user",
      content: message,
    });

    let contextBlock = "";
    let usedChunks = 0;
    try {
      const qVec = await embed(message);
      const { data: matches } = await context.supabase.rpc("match_document_chunks", {
        query_embedding: `[${qVec.join(",")}]` as unknown as string,
        match_agent_id: agentId,
        match_count: 5,
      });
      if (matches && Array.isArray(matches) && matches.length > 0) {
        usedChunks = matches.length;
        contextBlock = matches
          .map((m: { content: string }, i: number) => `[Fonte ${i + 1}]\n${m.content}`)
          .join("\n\n");
      }
    } catch (e) {
      console.error("RAG retrieve failed", e);
    }

    const systemPrompt = `Você é "${agent.name}", agente operacional especializado.
Missão do agente: ${agent.objective}

Estilo de resposta (obrigatório):
- Direto e concreto. Sem rodeios, sem repetir a pergunta, sem encerramentos genéricos.
- Máximo 4 frases curtas OU até 6 bullets objetivos.
- Cada bullet começa com verbo no imperativo ou um número.
- Se faltar contexto, peça em 1 linha exatamente o que precisa.
- Use português do Brasil.
- Cite a fonte ([Fonte N]) quando usar conhecimento da base.

Ferramentas de CRM disponíveis:
- search_contacts: busque leads/contatos por nome, email ou empresa antes de criar duplicados.
- create_contact: cadastre novo lead quando o usuário pedir.
- add_activity: registre uma nota/ligação/email vinculada a um contato.
Use as ferramentas sempre que a tarefa envolver leads, contatos ou histórico de relacionamento.

${contextBlock ? `Conhecimento da empresa:\n${contextBlock}` : "Sem fontes internas para esta pergunta. Responda com cautela e diga se for opinião geral."}`;

    const { data: history } = await context.supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    const tools = buildCrmTools();
    const chatMessages: ChatMsg[] = [
      { role: "system", content: systemPrompt },
      ...((history ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))),
    ];

    let reply = "";
    let toolCallsRun = 0;
    for (let step = 0; step < 4; step++) {
      const aiRes = await fetch(`${GATEWAY_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": getKey() },
        body: JSON.stringify({
          model: CHAT_MODEL,
          messages: chatMessages,
          tools,
          tool_choice: "auto",
          max_tokens: MAX_TOKENS,
        }),
      });
      if (!aiRes.ok) {
        const t = await aiRes.text();
        if (aiRes.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
        if (aiRes.status === 402) throw new Error("Créditos de IA esgotados. Atualize seu plano.");
        throw new Error(`IA falhou: ${t}`);
      }
      const aiJson = (await aiRes.json()) as {
        choices: { message: { content: string | null; tool_calls?: ToolCall[] } }[];
      };
      const msg = aiJson.choices[0]?.message;
      if (!msg) {
        reply = "(sem resposta)";
        break;
      }
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        chatMessages.push({
          role: "assistant",
          content: msg.content ?? "",
          tool_calls: msg.tool_calls,
        });
        for (const call of msg.tool_calls) {
          toolCallsRun++;
          const result = await runCrmTool(call, {
            supabase: context.supabase,
            workspaceId: wsId,
            userId: context.userId,
            agentId,
          });
          chatMessages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result).slice(0, 4000),
          });
        }
        continue;
      }
      reply = msg.content ?? "(sem resposta)";
      break;
    }
    if (!reply) reply = "(sem resposta)";

    await context.supabase.from("messages").insert({
      conversation_id: conversationId,
      owner_id: context.userId,
      workspace_id: wsId,
      role: "assistant",
      content: reply,
    });

    const hoursSaved = Math.max(0.25, Math.min(1.5, 0.3 + usedChunks * 0.1));
    await context.supabase.from("executions").insert({
      agent_id: agentId,
      owner_id: context.userId,
      workspace_id: wsId,
      prompt: message,
      response: reply,
      status: "completed",
      hours_saved: hoursSaved,
    });

    // Audit (non-blocking)
    try {
      await context.supabase.from("audit_logs").insert({
        workspace_id: wsId,
        actor_user_id: context.userId,
        action: "agent.executed",
        resource_type: "agent",
        resource_id: agentId,
        metadata: { used_chunks: usedChunks, hours_saved: hoursSaved } as never,
      });
    } catch (e) {
      console.error("audit insert failed", e);
    }

    return {
      conversationId,
      reply,
      usedChunks,
      tookMs: Date.now() - startedAt,
    };
  });
