import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ClipboardList, Filter } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/audit")({
  head: () => ({ meta: [{ title: "Auditoria — AI Workforce" }] }),
  component: AuditPage,
});

const ACTION_LABELS: Record<string, string> = {
  "auth.login.success": "Login realizado",
  "auth.logout": "Logout",
  "auth.password_updated": "Senha atualizada",
  "auth.captcha_failed": "Captcha falhou",
  "agent.created": "Agente criado",
  "agent.updated": "Agente atualizado",
  "agent.deleted": "Agente excluído",
  "agent.executed": "Execução de agente",
  "document.uploaded": "Documento enviado",
  "document.deleted": "Documento removido",
  "workspace.created": "Workspace criado",
  "workspace.updated": "Workspace atualizado",
  "member.invited": "Convite enviado",
  "member.joined": "Membro entrou",
  "member.removed": "Membro removido",
  "member.role_changed": "Papel alterado",
};

const ACTION_COLOR: Record<string, string> = {
  auth: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
  agent: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  document: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
  member: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-200",
  workspace: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200",
};

function AuditPage() {
  const { currentWorkspaceId } = useWorkspace();
  const [filter, setFilter] = useState<string>("all");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["audit", currentWorkspaceId, filter],
    enabled: !!currentWorkspaceId,
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("id, action, actor_user_id, actor_email, resource_type, resource_id, metadata, ip, created_at")
        .eq("workspace_id", currentWorkspaceId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter !== "all") q = q.like("action", `${filter}.%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const categories = ["all", "auth", "agent", "document", "member", "workspace"];

  return (
    <AppShell>
      <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
        <div className="text-sm font-medium text-muted-foreground">Trilha de auditoria</div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ClipboardList className="h-3.5 w-3.5 text-primary" /> {events.length} eventos
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <h1 className="font-display text-4xl text-foreground">Auditoria</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Histórico completo de ações no workspace. Tudo o que acontece fica registrado para conformidade e segurança.
        </p>

        <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs capitalize ${
                filter === c
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-accent"
              }`}
            >
              {c === "all" ? "Tudo" : c}
            </button>
          ))}
        </div>

        <div className="surface-card mt-6 divide-y divide-border">
          {isLoading && <p className="p-6 text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && events.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">Sem eventos registrados ainda.</p>
          )}
          {events.map((e) => {
            const category = e.action.split(".")[0];
            return (
              <div key={e.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 p-4">
                <span
                  className={`rounded px-2 py-1 text-[10px] font-medium uppercase tracking-wider ${
                    ACTION_COLOR[category] ?? "bg-surface text-muted-foreground"
                  }`}
                >
                  {category}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {ACTION_LABELS[e.action] ?? e.action}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.actor_email ?? e.actor_user_id?.slice(0, 8) ?? "sistema"}
                    {e.resource_id && ` · ${e.resource_type ?? "recurso"} ${e.resource_id.slice(0, 8)}`}
                    {e.ip && ` · ${e.ip}`}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(e.created_at), { locale: ptBR, addSuffix: true })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
