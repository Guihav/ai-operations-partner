import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useWorkspace } from "@/lib/workspace-context";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getWhatsAppIntegration,
  upsertWhatsAppIntegration,
  deleteWhatsAppIntegration,
  listWhatsAppMessages,
  sendWhatsAppMessage,
} from "@/lib/whatsapp.functions";
import { toast } from "sonner";
import {
  Copy,
  Loader2,
  MessageCircle,
  Plug,
  Send,
  Shield,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/integrations")({
  head: () => ({ meta: [{ title: "Integrações — AI Workforce" }] }),
  component: IntegrationsPage,
});

function getWebhookUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/api/public/whatsapp/webhook`;
}

function randomToken(len = 24): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  const arr = new Uint32Array(len);
  if (typeof crypto !== "undefined") crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

function IntegrationsPage() {
  const { currentWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const getIntegFn = useServerFn(getWhatsAppIntegration);
  const upsertFn = useServerFn(upsertWhatsAppIntegration);
  const deleteFn = useServerFn(deleteWhatsAppIntegration);
  const listMsgsFn = useServerFn(listWhatsAppMessages);
  const sendFn = useServerFn(sendWhatsAppMessage);

  const { data: integ, isLoading } = useQuery({
    queryKey: ["whatsapp-integration", currentWorkspaceId],
    enabled: !!currentWorkspaceId,
    queryFn: () => getIntegFn({ data: { workspaceId: currentWorkspaceId! } }),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents", currentWorkspaceId, "select"],
    enabled: !!currentWorkspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("id, name")
        .eq("workspace_id", currentWorkspaceId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["whatsapp-messages", currentWorkspaceId],
    enabled: !!currentWorkspaceId && !!integ,
    queryFn: () =>
      listMsgsFn({ data: { workspaceId: currentWorkspaceId!, limit: 30 } }),
  });

  const [form, setForm] = useState({
    phoneNumberId: "",
    businessAccountId: "",
    displayPhoneNumber: "",
    accessToken: "",
    verifyToken: "",
    defaultAgentId: "",
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (integ) {
      setForm((f) => ({
        ...f,
        phoneNumberId: integ.phone_number_id ?? "",
        businessAccountId: integ.business_account_id ?? "",
        displayPhoneNumber: integ.display_phone_number ?? "",
        verifyToken: integ.verify_token ?? "",
        defaultAgentId: integ.default_agent_id ?? "",
        isActive: integ.is_active,
        accessToken: "",
      }));
    } else {
      setForm((f) => ({ ...f, verifyToken: f.verifyToken || randomToken() }));
    }
  }, [integ]);

  const webhookUrl = useMemo(getWebhookUrl, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!currentWorkspaceId) return;
    if (!integ && !form.accessToken) {
      toast.error("Cole o Access Token do WhatsApp Business.");
      return;
    }
    setSaving(true);
    try {
      await upsertFn({
        data: {
          workspaceId: currentWorkspaceId,
          phoneNumberId: form.phoneNumberId.trim(),
          businessAccountId: form.businessAccountId.trim() || null,
          displayPhoneNumber: form.displayPhoneNumber.trim() || null,
          // se editar e não digitar nada, mantemos o token salvo
          accessToken: form.accessToken || integ ? form.accessToken || "__keep__" : form.accessToken,
          verifyToken: form.verifyToken.trim(),
          defaultAgentId: form.defaultAgentId || null,
          isActive: form.isActive,
        } as Parameters<typeof upsertFn>[0]["data"],
      });
      toast.success("Integração com WhatsApp salva.");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-integration"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!currentWorkspaceId) return;
    if (!confirm("Remover credenciais do WhatsApp deste workspace?")) return;
    await deleteFn({ data: { workspaceId: currentWorkspaceId } });
    toast.success("Integração removida.");
    queryClient.invalidateQueries({ queryKey: ["whatsapp-integration"] });
  }

  const [testPhone, setTestPhone] = useState("");
  const [testMsg, setTestMsg] = useState("Olá! Esta é uma mensagem de teste do AI Workforce.");
  const [sending, setSending] = useState(false);

  async function handleSendTest(e: React.FormEvent) {
    e.preventDefault();
    if (!currentWorkspaceId) return;
    setSending(true);
    try {
      await sendFn({
        data: {
          workspaceId: currentWorkspaceId,
          toPhone: testPhone,
          body: testMsg,
        },
      });
      toast.success("Mensagem enviada.");
      setTestPhone("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar.");
    } finally {
      setSending(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success("Copiado"));
  }

  return (
    <AppShell>
      <div className="border-b border-border bg-surface/60 px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Plug className="h-4 w-4" /> Integrações
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Integrações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Conecte canais para que seus agentes atendam clientes onde eles estão.
          </p>
        </header>

        <section className="rounded-lg border border-border bg-surface">
          <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-emerald-500/10 text-emerald-600">
                <MessageCircle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">WhatsApp Business</p>
                <p className="text-xs text-muted-foreground">
                  Receba e responda mensagens via Meta Cloud API.
                </p>
              </div>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                integ?.is_active
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {integ?.is_active ? "Ativo" : "Não conectado"}
            </span>
          </header>

          <div className="space-y-5 p-5">
            <div className="rounded-md border border-border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Webhook URL (configure no painel Meta)
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs">
                  {webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={() => copy(webhookUrl)}
                  className="grid h-7 w-7 place-items-center rounded border border-border hover:bg-accent"
                  aria-label="Copiar webhook"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Use o mesmo <strong>Verify Token</strong> abaixo no painel Meta
                ao assinar o webhook. Inscreva os eventos <code>messages</code>.
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            ) : (
              <form onSubmit={handleSave} className="grid gap-4 md:grid-cols-2">
                <Field label="Phone Number ID *">
                  <input
                    required
                    value={form.phoneNumberId}
                    onChange={(e) =>
                      setForm({ ...form, phoneNumberId: e.target.value })
                    }
                    className="input"
                    placeholder="ex.: 1234567890"
                  />
                </Field>
                <Field label="WhatsApp Business Account ID">
                  <input
                    value={form.businessAccountId}
                    onChange={(e) =>
                      setForm({ ...form, businessAccountId: e.target.value })
                    }
                    className="input"
                  />
                </Field>
                <Field label="Número exibido (opcional)">
                  <input
                    value={form.displayPhoneNumber}
                    onChange={(e) =>
                      setForm({ ...form, displayPhoneNumber: e.target.value })
                    }
                    className="input"
                    placeholder="+55 11 99999-9999"
                  />
                </Field>
                <Field label="Verify Token *">
                  <input
                    required
                    value={form.verifyToken}
                    onChange={(e) =>
                      setForm({ ...form, verifyToken: e.target.value })
                    }
                    className="input font-mono text-xs"
                  />
                </Field>
                <Field
                  label={
                    integ
                      ? "Access Token (deixe vazio para manter o atual)"
                      : "Access Token permanente *"
                  }
                  className="md:col-span-2"
                >
                  <input
                    required={!integ}
                    type="password"
                    value={form.accessToken}
                    onChange={(e) =>
                      setForm({ ...form, accessToken: e.target.value })
                    }
                    className="input font-mono text-xs"
                    placeholder="EAAG..."
                  />
                </Field>
                <Field label="Agente padrão (futuro auto-reply)">
                  <select
                    value={form.defaultAgentId}
                    onChange={(e) =>
                      setForm({ ...form, defaultAgentId: e.target.value })
                    }
                    className="input"
                  >
                    <option value="">— Nenhum —</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <label className="flex items-center gap-2 pt-7 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm({ ...form, isActive: e.target.checked })
                    }
                  />
                  Integração ativa
                </label>

                <div className="md:col-span-2 flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Salvar integração
                  </button>
                  {integ && (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Desconectar
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </section>

        {integ && (
          <section className="rounded-lg border border-border bg-surface">
            <header className="border-b border-border px-5 py-4">
              <p className="text-sm font-semibold">Enviar mensagem de teste</p>
              <p className="text-xs text-muted-foreground">
                Use o formato internacional (ex.: 5511999998888).
              </p>
            </header>
            <form
              onSubmit={handleSendTest}
              className="grid gap-3 p-5 md:grid-cols-[200px_1fr_auto]"
            >
              <input
                required
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="input"
                placeholder="5511999998888"
              />
              <input
                required
                value={testMsg}
                onChange={(e) => setTestMsg(e.target.value)}
                className="input"
              />
              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Enviar
              </button>
            </form>
          </section>
        )}

        {integ && messages.length > 0 && (
          <section className="rounded-lg border border-border bg-surface">
            <header className="border-b border-border px-5 py-4">
              <p className="text-sm font-semibold">Últimas mensagens</p>
            </header>
            <ul className="divide-y divide-border">
              {messages.map((m) => (
                <li key={m.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                  <span
                    className={`mt-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                      m.direction === "inbound"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {m.direction === "inbound" ? "in" : "out"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      <span className="text-muted-foreground">
                        {m.direction === "inbound" ? m.from_phone : m.to_phone}
                      </span>
                      <span className="mx-2 text-muted-foreground">·</span>
                      {m.body}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleString("pt-BR")}
                      {m.status ? ` · ${m.status}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          padding: 0.5rem 0.625rem;
          font-size: 0.875rem;
        }
        .input:focus { outline: 2px solid hsl(var(--primary) / 0.3); }
      `}</style>
    </AppShell>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm ${className ?? ""}`}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
