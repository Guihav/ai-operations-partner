import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useServerFn } from "@tanstack/react-start";
import {
  inviteMember,
  removeMember,
  changeMemberRole,
  revokeInvite,
} from "@/lib/teams.functions";
import { logAuditEvent } from "@/lib/audit.functions";
import { toast } from "sonner";
import { Copy, Loader2, Mail, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/team")({
  head: () => ({ meta: [{ title: "Equipe — AI Workforce" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { currentWorkspace, currentWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const inviteFn = useServerFn(inviteMember);
  const removeFn = useServerFn(removeMember);
  const roleFn = useServerFn(changeMemberRole);
  const revokeFn = useServerFn(revokeInvite);
  const auditFn = useServerFn(logAuditEvent);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [inviting, setInviting] = useState(false);

  const canManage = currentWorkspace?.role === "owner" || currentWorkspace?.role === "admin";

  const { data: members = [] } = useQuery({
    queryKey: ["team", "members", currentWorkspaceId],
    enabled: !!currentWorkspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_members")
        .select("id, user_id, role, created_at, profiles:profiles!workspace_members_user_id_fkey(full_name)")
        .eq("workspace_id", currentWorkspaceId!)
        .order("created_at", { ascending: true });
      if (error) {
        // fallback without join if FK relation not named
        const { data: simple } = await supabase
          .from("workspace_members")
          .select("id, user_id, role, created_at")
          .eq("workspace_id", currentWorkspaceId!)
          .order("created_at", { ascending: true });
        return (simple ?? []).map((m) => ({ ...m, profiles: null as { full_name: string | null } | null }));
      }
      return data ?? [];
    },
  });

  const { data: invites = [] } = useQuery({
    queryKey: ["team", "invites", currentWorkspaceId],
    enabled: !!currentWorkspaceId && canManage,
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_invites")
        .select("id, email, role, token, expires_at, accepted_at, created_at")
        .eq("workspace_id", currentWorkspaceId!)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!currentWorkspaceId || !email.trim()) return;
    setInviting(true);
    try {
      const inv = await inviteFn({
        data: { workspaceId: currentWorkspaceId, email: email.trim(), role },
      });
      const link = `${window.location.origin}/invite/${inv.token}`;
      await navigator.clipboard.writeText(link).catch(() => null);
      toast.success("Convite criado. Link copiado para a área de transferência.");
      setEmail("");
      await auditFn({
        data: {
          action: "member.invited",
          workspaceId: currentWorkspaceId,
          resourceType: "invite",
          resourceId: inv.id,
          metadata: { email: inv.email, role: inv.role },
        },
      });
      queryClient.invalidateQueries({ queryKey: ["team", "invites"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao convidar");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(userId: string) {
    if (!currentWorkspaceId) return;
    if (!confirm("Remover este membro do workspace?")) return;
    try {
      await removeFn({ data: { workspaceId: currentWorkspaceId, userId } });
      await auditFn({
        data: {
          action: "member.removed",
          workspaceId: currentWorkspaceId,
          resourceType: "user",
          resourceId: userId,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["team"] });
      toast.success("Membro removido");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover");
    }
  }

  async function handleRoleChange(userId: string, newRole: "owner" | "admin" | "member") {
    if (!currentWorkspaceId) return;
    try {
      await roleFn({ data: { workspaceId: currentWorkspaceId, userId, role: newRole } });
      await auditFn({
        data: {
          action: "member.role_changed",
          workspaceId: currentWorkspaceId,
          resourceType: "user",
          resourceId: userId,
          metadata: { new_role: newRole },
        },
      });
      queryClient.invalidateQueries({ queryKey: ["team"] });
      toast.success("Papel atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha");
    }
  }

  async function copyLink(token: string) {
    const link = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(link);
    toast.success("Link copiado");
  }

  async function handleRevoke(id: string) {
    try {
      await revokeFn({ data: { inviteId: id } });
      queryClient.invalidateQueries({ queryKey: ["team", "invites"] });
      toast.success("Convite cancelado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha");
    }
  }

  return (
    <AppShell>
      <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
        <div className="text-sm font-medium text-muted-foreground">Equipe</div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5 text-primary" />
          {members.length} membro{members.length === 1 ? "" : "s"}
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <h1 className="font-display text-4xl text-foreground">Equipe de {currentWorkspace?.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Compartilhe agentes e conhecimento com sua equipe. Cada workspace tem seus próprios dados isolados.
        </p>

        {canManage && (
          <section className="surface-card mt-8 p-6">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Convidar pessoa</h2>
            </div>
            <form onSubmit={handleInvite} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@empresa.com"
                className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "member" | "admin")}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              >
                <option value="member">Membro</option>
                <option value="admin">Admin</option>
              </select>
              <button
                type="submit"
                disabled={inviting}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
                Enviar convite
              </button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">
              Geramos um link de convite para você compartilhar manualmente. Válido por 7 dias.
            </p>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-sm font-semibold">Membros</h2>
          <div className="surface-card mt-3 divide-y divide-border">
            {members.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                    {(m.profiles?.full_name ?? m.user_id).slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.profiles?.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">ID {m.user_id.slice(0, 8)}…</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canManage && currentWorkspace?.role === "owner" ? (
                    <select
                      value={m.role}
                      onChange={(e) =>
                        handleRoleChange(m.user_id, e.target.value as "owner" | "admin" | "member")
                      }
                      className="h-8 rounded border border-input bg-background px-2 text-xs outline-none focus:border-primary"
                    >
                      <option value="owner">Dono</option>
                      <option value="admin">Admin</option>
                      <option value="member">Membro</option>
                    </select>
                  ) : (
                    <span className="rounded bg-surface px-2 py-1 text-xs font-medium capitalize">
                      {m.role}
                    </span>
                  )}
                  {canManage && m.role !== "owner" && (
                    <button
                      onClick={() => handleRemove(m.user_id)}
                      className="grid h-8 w-8 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-destructive"
                      aria-label="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {canManage && invites.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold">Convites pendentes</h2>
            <div className="surface-card mt-3 divide-y divide-border">
              {invites.map((inv) => (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-surface text-muted-foreground">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{inv.email}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="capitalize">{inv.role}</span> · expira em{" "}
                        {new Date(inv.expires_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyLink(inv.token)}
                      className="inline-flex items-center gap-1.5 rounded border border-border bg-background px-2.5 py-1 text-xs hover:bg-accent"
                    >
                      <Copy className="h-3 w-3" /> Copiar link
                    </button>
                    <button
                      onClick={() => handleRevoke(inv.id)}
                      className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-destructive"
                      aria-label="Cancelar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!canManage && (
          <p className="mt-8 flex items-center gap-2 rounded-md border border-border bg-surface p-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Apenas administradores podem convidar ou remover pessoas.
          </p>
        )}
      </div>
    </AppShell>
  );
}
