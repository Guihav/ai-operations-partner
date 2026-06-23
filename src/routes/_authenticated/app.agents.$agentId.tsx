import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { sendChatMessage } from "@/lib/ai.functions";
import { useEffect, useRef, useState } from "react";
import { Bot, FileText, Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/agents/$agentId")({
  head: () => ({ meta: [{ title: "Agente — AI Workforce" }] }),
  component: AgentPage,
});

function AgentPage() {
  const { agentId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sendFn = useServerFn(sendChatMessage);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pendingUser, setPendingUser] = useState<string | null>(null);

  const { data: agent, isLoading: agentLoading } = useQuery({
    queryKey: ["agent", agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("id, name, objective, schedule, created_at")
        .eq("id", agentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["agent", agentId, "docs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_documents")
        .select("id, file_name, status, size_bytes")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ["conversation", conversationId, "messages"],
    enabled: !!conversationId,
    queryFn: async () => {
      if (!conversationId) return [];
      const { data } = await supabase
        .from("messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (message: string) =>
      await sendFn({ data: { agentId, conversationId, message } }),
    onMutate: (message) => setPendingUser(message),
    onSuccess: async (res) => {
      if (!conversationId) setConversationId(res.conversationId);
      setPendingUser(null);
      await refetchMessages();
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => {
      setPendingUser(null);
      toast.error(e instanceof Error ? e.message : "Falha ao enviar mensagem");
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, pendingUser, sendMutation.isPending]);

  async function handleDelete() {
    if (!confirm("Excluir este agente e todos os seus dados?")) return;
    const { error } = await supabase.from("agents").delete().eq("id", agentId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Agente excluído");
    queryClient.invalidateQueries({ queryKey: ["agents"] });
    navigate({ to: "/app" });
  }

  if (agentLoading) {
    return (
      <AppShell>
        <div className="grid flex-1 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!agent) {
    return (
      <AppShell>
        <div className="grid flex-1 place-items-center p-10 text-center">
          <p className="text-sm text-muted-foreground">Agente não encontrado.</p>
          <Link to="/app" className="mt-3 text-sm text-primary hover:underline">
            Voltar ao painel
          </Link>
        </div>
      </AppShell>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sendMutation.isPending) return;
    setInput("");
    sendMutation.mutate(trimmed);
  }

  return (
    <AppShell>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-background px-6 py-3 sm:flex sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{agent.name}</h1>
            <p className="truncate text-xs text-muted-foreground">{agent.objective}</p>
          </div>
        </div>
        <button
          onClick={handleDelete}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
          aria-label="Excluir"
          title="Excluir agente"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_280px]">
        <div className="flex min-h-0 flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <div className="mx-auto max-w-2xl space-y-5">
              {messages.length === 0 && !pendingUser && (
                <EmptyState agentName={agent.name} onPick={(p) => setInput(p)} />
              )}
              {messages.map((m) => (
                <Bubble key={m.id} role={m.role} content={m.content} />
              ))}
              {pendingUser && <Bubble role="user" content={pendingUser} />}
              {sendMutation.isPending && (
                <div className="flex">
                  <div className="rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-2.5 text-sm text-muted-foreground">
                    <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> Pensando…
                  </div>
                </div>
              )}
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t border-border bg-background px-4 py-3 sm:px-8"
          >
            <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-xl border border-border bg-background p-2 shadow-soft focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder={`Pergunte ao ${agent.name}…`}
                rows={1}
                className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                disabled={!input.trim() || sendMutation.isPending}
                className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
                aria-label="Enviar"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>

        <aside className="hidden border-l border-border bg-surface p-5 lg:block">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Conhecimento
            </p>
            <div className="mt-3 space-y-2">
              {docs.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum documento adicionado.</p>
              )}
              {docs.map((d) => (
                <div
                  key={d.id}
                  className="flex items-start gap-2 rounded-md border border-border bg-background p-2.5 text-xs"
                >
                  <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{d.file_name}</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {d.status === "ready"
                        ? "Indexado"
                        : d.status === "processing"
                          ? "Processando…"
                          : "Falhou"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sobre</p>
            <p className="mt-2 text-xs text-muted-foreground">{agent.objective}</p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function Bubble({ role, content }: { role: string; content: string }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-2.5 text-sm">
        {content}
      </div>
    </div>
  );
}

function EmptyState({ agentName, onPick }: { agentName: string; onPick: (s: string) => void }) {
  const examples = [
    "Resuma os documentos que adicionei.",
    "Quais pontos de atenção você identifica?",
    "Gere um relatório executivo curto.",
  ];
  return (
    <div className="grid place-items-center py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary">
        <Bot className="h-5 w-5" />
      </div>
      <h2 className="mt-4 font-display text-2xl">Converse com {agentName}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Faça perguntas, peça relatórios ou execute tarefas. O agente usa seus documentos como contexto.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {examples.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onPick(e)}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
