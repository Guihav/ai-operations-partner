import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { useServerFn } from "@tanstack/react-start";
import { verifyTurnstile } from "@/lib/captcha.functions";
import { logAuditEvent } from "@/lib/audit.functions";

const searchSchema = z.object({
  mode: z.enum(["login", "signup", "reset"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app" });
  },
  head: () => ({
    meta: [{ title: "Entrar — AI Workforce" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode = "login" } = Route.useSearch();
  const navigate = useNavigate();
  const verifyFn = useServerFn(verifyTurnstile);
  const auditFn = useServerFn(logAuditEvent);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const isSignup = mode === "signup";
  const isReset = mode === "reset";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!captchaToken) {
      toast.error("Aguarde a verificação anti-bot.");
      return;
    }
    setLoading(true);
    try {
      const verify = await verifyFn({ data: { token: captchaToken } });
      if (!verify.success) {
        toast.error("Verificação anti-bot falhou. Recarregue a página e tente novamente.");
        return;
      }

      if (isReset) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Enviamos um link de recuperação para seu email.");
        return;
      }
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, company_name: companyName },
          },
        });
        if (error) throw error;
        toast.success("Conta criada. Bem-vindo(a).");
        try {
          await auditFn({ data: { action: "auth.login.success", workspaceId: null, metadata: { signup: true } } });
        } catch {/* noop */}
        navigate({ to: "/app" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        try {
          await auditFn({ data: { action: "auth.login.success", workspaceId: null } });
        } catch {/* noop */}
        navigate({ to: "/app" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo deu errado");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Não foi possível entrar com Google");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/app" });
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between border-r border-border bg-surface p-12 lg:flex">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-6 w-6 place-items-center rounded-md bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
              <path d="M4 14L9 4L14 14M11 11H7M16 4V14M16 14L20 10M16 14L20 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-sm font-semibold">AI Workforce</span>
        </Link>
        <div>
          <p className="font-display text-5xl leading-tight text-foreground">
            "Em quatro semanas, nosso agente economizou <em className="not-italic text-primary">62 horas</em> da equipe de operações."
          </p>
          <p className="mt-6 text-sm text-muted-foreground">
            — Diretora de Operações, e-commerce com 45 colaboradores
          </p>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} AI Workforce</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 inline-flex items-center gap-2 lg:hidden">
            <div className="grid h-6 w-6 place-items-center rounded-md bg-primary text-primary-foreground text-xs">
              AW
            </div>
            <span className="text-sm font-semibold">AI Workforce</span>
          </Link>

          <h1 className="font-display text-4xl text-foreground">
            {isReset ? "Recuperar acesso" : isSignup ? "Crie sua conta" : "Bem-vindo de volta"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isReset
              ? "Enviaremos um link de recuperação para o seu email."
              : isSignup
                ? "Comece grátis. Sem cartão de crédito."
                : "Entre para acessar seus agentes."}
          </p>

          {!isReset && (
            <>
              <button
                onClick={handleGoogle}
                disabled={googleLoading}
                className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-background text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                {googleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GoogleIcon className="h-4 w-4" />
                )}
                Continuar com Google
              </button>

              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> ou com email <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <>
                <Field label="Seu nome" id="fullName" value={fullName} onChange={setFullName} required />
                <Field label="Nome da empresa" id="companyName" value={companyName} onChange={setCompanyName} required />
              </>
            )}
            <Field label="Email corporativo" id="email" type="email" value={email} onChange={setEmail} required />
            {!isReset && (
              <Field
                label="Senha"
                id="password"
                type="password"
                value={password}
                onChange={setPassword}
                required
                hint={isSignup ? "Mínimo de 8 caracteres" : undefined}
                minLength={isSignup ? 8 : undefined}
              />
            )}

            <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span>Verificação anti-bot ativa</span>
            </div>
            <TurnstileWidget onToken={setCaptchaToken} onError={() => setCaptchaToken(null)} />

            <button
              type="submit"
              disabled={loading || !captchaToken}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isReset ? "Enviar link" : isSignup ? "Criar conta" : "Entrar"}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
            {isSignup ? (
              <Link to="/auth" search={{ mode: "login" }} className="hover:text-foreground">
                Já tenho conta
              </Link>
            ) : (
              <Link to="/auth" search={{ mode: "signup" }} className="hover:text-foreground">
                Criar conta
              </Link>
            )}
            {!isReset && (
              <Link to="/auth" search={{ mode: "reset" }} className="hover:text-foreground">
                Esqueci minha senha
              </Link>
            )}
            {isReset && (
              <Link to="/auth" search={{ mode: "login" }} className="hover:text-foreground">
                Voltar para entrar
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  type = "text",
  required,
  hint,
  minLength,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  hint?: string;
  minLength?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        className="mt-1.5 block h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
