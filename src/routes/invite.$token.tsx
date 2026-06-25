import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { acceptInvite } from "@/lib/teams.functions";
import { logAuditEvent } from "@/lib/audit.functions";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: "Aceitar convite — AI Workforce" }] }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const acceptFn = useServerFn(acceptInvite);
  const auditFn = useServerFn(logAuditEvent);
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<{
    email: string;
    role: string;
    workspace_id: string;
    workspaces: { name: string } | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      setHasSession(!!sess.session);
      const { data, error } = await supabase
        .from("workspace_invites")
        .select("email, role, workspace_id, expires_at, accepted_at, workspaces(name)")
        .eq("token", token)
        .maybeSingle();
      if (error || !data) {
        setError("Convite não encontrado");
      } else if (data.accepted_at) {
        setError("Este convite já foi utilizado");
      } else if (new Date(data.expires_at) < new Date()) {
        setError("Este convite expirou");
      } else {
        setInvite({
          email: data.email,
          role: data.role,
          workspace_id: data.workspace_id,
          workspaces: data.workspaces,
        });
      }
      setLoading(false);
    })();
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    try {
      const res = await acceptFn({ data: { token } });
      try {
        await auditFn({
          data: {
            action: "member.joined",
            workspaceId: res.workspaceId,
            resourceType: "workspace",
            resourceId: res.workspaceId,
          },
        });
      } catch {/* noop */}
      localStorage.setItem("aw.currentWorkspaceId", res.workspaceId);
      toast.success("Convite aceito");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao aceitar");
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 inline-flex items-center gap-2">
          <div className="grid h-6 w-6 place-items-center rounded-md bg-primary text-primary-foreground text-xs">
            AW
          </div>
          <span className="text-sm font-semibold">AI Workforce</span>
        </Link>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Validando convite...
          </div>
        ) : error ? (
          <div className="surface-card p-6">
            <h1 className="font-display text-2xl">Convite indisponível</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Link
              to="/auth"
              search={{ mode: "login" }}
              className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Ir para entrar
            </Link>
          </div>
        ) : invite ? (
          <div className="surface-card p-6">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary">
              <Mail className="h-5 w-5" />
            </div>
            <h1 className="mt-4 font-display text-3xl">
              Você foi convidado para <em className="not-italic text-primary">{invite.workspaces?.name}</em>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Como <span className="font-medium text-foreground capitalize">{invite.role}</span>. Acesse os agentes,
              documentos e execuções compartilhadas pela equipe.
            </p>
            <div className="mt-4 rounded-md bg-surface p-3 text-xs">
              <p className="text-muted-foreground">Convite para</p>
              <p className="mt-0.5 font-medium">{invite.email}</p>
            </div>

            {hasSession ? (
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {accepting && <Loader2 className="h-4 w-4 animate-spin" />}
                Aceitar convite
              </button>
            ) : (
              <div className="mt-6 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Entre ou crie conta com o e-mail <span className="font-medium">{invite.email}</span> para aceitar.
                </p>
                <Link
                  to="/auth"
                  search={{ mode: "login" }}
                  className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  Entrar
                </Link>
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className="inline-flex h-10 w-full items-center justify-center rounded-md border border-border bg-background text-sm font-medium hover:bg-accent"
                >
                  Criar conta
                </Link>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
