import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const CHAT_MODEL = "google/gemini-3-flash-preview";
const EMBED_MODEL = "openai/text-embedding-3-small";

function getKey() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente");
  return key;
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
      .select("id, agent_id, owner_id")
      .eq("id", documentId)
      .maybeSingle();
    if (docErr || !doc) throw new Error("Documento não encontrado");

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

    const { data: agent, error: aErr } = await context.supabase
      .from("agents")
      .select("id, name, objective")
      .eq("id", agentId)
      .maybeSingle();
    if (aErr || !agent) throw new Error("Agente não encontrado");

    // Ensure conversation
    let conversationId = data.conversationId;
    if (!conversationId) {
      const { data: conv, error: cErr } = await context.supabase
        .from("conversations")
        .insert({ agent_id: agentId, owner_id: context.userId, title: message.slice(0, 60) })
        .select("id")
        .single();
      if (cErr) throw cErr;
      conversationId = conv.id;
    }

    // Save user message
    await context.supabase.from("messages").insert({
      conversation_id: conversationId,
      owner_id: context.userId,
      role: "user",
      content: message,
    });

    // RAG retrieve
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

    const systemPrompt = `Você é o ${agent.name}, um assistente de IA operacional para uma empresa.
Objetivo do agente: ${agent.objective}

Regras:
- Sempre que possível, baseie suas respostas no conhecimento da empresa (fontes abaixo).
- Se as fontes não cobrirem a pergunta, diga isso claramente e responda com cautela.
- Seja direto, profissional e objetivo. Use português do Brasil.
- Quando útil, organize a resposta em tópicos curtos.

${contextBlock ? `Conhecimento da empresa:\n${contextBlock}` : "Nenhuma fonte interna disponível para esta pergunta."}`;

    // Load short history
    const { data: history } = await context.supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
    ];

    const aiRes = await fetch(`${GATEWAY_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": getKey(),
      },
      body: JSON.stringify({ model: CHAT_MODEL, messages: chatMessages }),
    });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      if (aiRes.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
      if (aiRes.status === 402) throw new Error("Créditos de IA esgotados. Atualize seu plano.");
      throw new Error(`IA falhou: ${t}`);
    }
    const aiJson = (await aiRes.json()) as { choices: { message: { content: string } }[] };
    const reply = aiJson.choices[0]?.message?.content ?? "(sem resposta)";

    // Save assistant message
    await context.supabase.from("messages").insert({
      conversation_id: conversationId,
      owner_id: context.userId,
      role: "assistant",
      content: reply,
    });

    // ROI: rough estimate — 0.3h per chat execution, more if RAG used
    const hoursSaved = Math.max(0.25, Math.min(1.5, 0.3 + usedChunks * 0.1));
    await context.supabase.from("executions").insert({
      agent_id: agentId,
      owner_id: context.userId,
      prompt: message,
      response: reply,
      status: "completed",
      hours_saved: hoursSaved,
    });

    return {
      conversationId,
      reply,
      usedChunks,
      tookMs: Date.now() - startedAt,
    };
  });
