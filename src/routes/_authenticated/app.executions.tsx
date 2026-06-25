import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bot, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/executions")({
  head: () => ({ meta: [{ title: "Execuções — AI Workforce" }] }),
  component: ExecutionsPage,
});

function ExecutionsPage() {
  const { currentWorkspaceId } = useWorkspace();
  const { data = [], isLoading } = useQuery({
    queryKey: ["executions", "all", currentWorkspaceId],
    enabled: !!currentWorkspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("executions")
        .select("id, prompt, response, hours_saved, status, created_at, agent_id, agents(name)")
        .eq("workspace_id", currentWorkspaceId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalHours = data.reduce(
    (s, e: { hours_saved: number | string }) => s + Number(e.hours_saved ?? 0),
    0,
  );

  return (
    <AppShell>
      <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
        <div className="text-sm font-medium text-muted-foreground">Execuções</div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium text-foreground">{totalHours.toFixed(1)}h</span> economizadas
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <div>
          <h1 className="font-display text-4xl text-foreground">Histórico de execuções</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tudo que seus agentes fizeram. Auditoria completa, com fontes e tempo economizado.
          </p>
        </div>

        <div className="surface-card mt-8 divide-y divide-border">
          {isLoading && <p className="p-6 text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && data.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">
              Nenhuma execução ainda. Converse com um agente para começar.
            </p>
          )}
          {data.map((e) => (
            <Link
              key={e.id}
              to="/app/agents/$agentId"
              params={{ agentId: e.agent_id }}
              className="block p-5 transition hover:bg-surface"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5" />
                  <span className="font-medium text-foreground">{e.agents?.name ?? "Agente"}</span>
                </div>
                <span>
                  {formatDistanceToNow(new Date(e.created_at), { locale: ptBR, addSuffix: true })}
                </span>
              </div>
              <p className="mt-2 line-clamp-1 text-sm font-medium text-foreground">{e.prompt}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{e.response}</p>
              <p className="mt-2 text-xs text-primary">
                +{Number(e.hours_saved).toFixed(2)}h economizadas
              </p>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
