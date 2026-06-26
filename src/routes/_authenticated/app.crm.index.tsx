import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useServerFn } from "@tanstack/react-start";
import { upsertContact, deleteContact } from "@/lib/crm.functions";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Phone, Plus, Search, Trash2, Users, KanbanSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/crm/")({
  head: () => ({ meta: [{ title: "CRM — AI Workforce" }] }),
  component: CrmContactsPage,
});

type Status = "lead" | "qualified" | "customer" | "lost";

const STATUS_LABEL: Record<Status, string> = {
  lead: "Lead",
  qualified: "Qualificado",
  customer: "Cliente",
  lost: "Perdido",
};

const STATUS_BADGE: Record<Status, string> = {
  lead: "bg-surface text-foreground",
  qualified: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  customer: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  lost: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

function CrmContactsPage() {
  const { currentWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const upsertFn = useServerFn(upsertContact);
  const deleteFn = useServerFn(deleteContact);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<null | {
    id?: string;
    fullName: string;
    email: string;
    phone: string;
    company: string;
    jobTitle: string;
    source: string;
    status: Status;
    score: number;
    notes: string;
  }>(null);
  const [saving, setSaving] = useState(false);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["crm", "contacts", currentWorkspaceId, statusFilter, query],
    enabled: !!currentWorkspaceId,
    queryFn: async () => {
      let q = supabase
        .from("crm_contacts")
        .select("id, full_name, email, phone, company, job_title, status, score, source, tags, created_at")
        .eq("workspace_id", currentWorkspaceId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (query.trim()) q = q.ilike("full_name", `%${query.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  function openNew() {
    setEditing({
      fullName: "",
      email: "",
      phone: "",
      company: "",
      jobTitle: "",
      source: "manual",
      status: "lead",
      score: 0,
      notes: "",
    });
    setDrawerOpen(true);
  }

  function openEdit(c: (typeof contacts)[number]) {
    setEditing({
      id: c.id,
      fullName: c.full_name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      company: c.company ?? "",
      jobTitle: c.job_title ?? "",
      source: c.source ?? "",
      status: (c.status as Status) ?? "lead",
      score: c.score ?? 0,
      notes: "",
    });
    setDrawerOpen(true);
  }

  async function handleSave() {
    if (!editing || !currentWorkspaceId) return;
    setSaving(true);
    try {
      await upsertFn({
        data: {
          id: editing.id,
          workspaceId: currentWorkspaceId,
          fullName: editing.fullName,
          email: editing.email || null,
          phone: editing.phone || null,
          company: editing.company || null,
          jobTitle: editing.jobTitle || null,
          source: editing.source || null,
          status: editing.status,
          score: editing.score,
          tags: [],
          notes: editing.notes || null,
        },
      });
      toast.success(editing.id ? "Contato atualizado" : "Contato criado");
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ["crm", "contacts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!currentWorkspaceId) return;
    if (!confirm("Remover este contato?")) return;
    try {
      await deleteFn({ data: { id, workspaceId: currentWorkspaceId } });
      queryClient.invalidateQueries({ queryKey: ["crm", "contacts"] });
      toast.success("Contato removido");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  return (
    <AppShell>
      <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
        <div className="flex items-center gap-3 text-sm">
          <Users className="h-4 w-4 text-primary" />
          <span className="font-medium">CRM — Contatos</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/app/crm/pipeline"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-accent"
          >
            <KanbanSquare className="h-3.5 w-3.5" />
            Pipeline
          </Link>
          <button
            onClick={openNew}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo contato
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <h1 className="font-display text-4xl text-foreground">Contatos & Leads</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Centralize todos os contatos da empresa. Seus agentes de IA podem consultar e atualizar registros aqui.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome…"
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="all">Todos status</option>
            <option value="lead">Lead</option>
            <option value="qualified">Qualificado</option>
            <option value="customer">Cliente</option>
            <option value="lost">Perdido</option>
          </select>
        </div>

        <div className="surface-card mt-6 overflow-hidden">
          {isLoading ? (
            <div className="grid h-40 place-items-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="grid h-40 place-items-center px-6 text-center text-sm text-muted-foreground">
              Nenhum contato ainda. Clique em <strong className="mx-1 text-foreground">Novo contato</strong> para começar.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Nome</th>
                  <th className="px-4 py-2 text-left font-medium">Empresa</th>
                  <th className="px-4 py-2 text-left font-medium">Contato</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Score</th>
                  <th className="px-4 py-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contacts.map((c) => {
                  const status = (c.status as Status) ?? "lead";
                  return (
                    <tr
                      key={c.id}
                      className="cursor-pointer hover:bg-accent/40"
                      onClick={() => openEdit(c)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{c.full_name}</div>
                        {c.job_title && (
                          <div className="text-xs text-muted-foreground">{c.job_title}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.company ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {c.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {c.email}
                          </div>
                        )}
                        {c.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {c.phone}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}>
                          {STATUS_LABEL[status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{c.score ?? 0}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(c.id);
                          }}
                          className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-destructive"
                          aria-label="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {drawerOpen && editing && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          <div className="flex-1 bg-foreground/30 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-elevated">
            <header className="flex h-14 items-center justify-between border-b border-border px-6">
              <h2 className="text-sm font-semibold">
                {editing.id ? "Editar contato" : "Novo contato"}
              </h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Fechar
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3 text-sm">
                <Field label="Nome completo *">
                  <input
                    value={editing.fullName}
                    onChange={(e) => setEditing({ ...editing, fullName: e.target.value })}
                    className="inp"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email">
                    <input
                      type="email"
                      value={editing.email}
                      onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                      className="inp"
                    />
                  </Field>
                  <Field label="Telefone">
                    <input
                      value={editing.phone}
                      onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                      className="inp"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Empresa">
                    <input
                      value={editing.company}
                      onChange={(e) => setEditing({ ...editing, company: e.target.value })}
                      className="inp"
                    />
                  </Field>
                  <Field label="Cargo">
                    <input
                      value={editing.jobTitle}
                      onChange={(e) => setEditing({ ...editing, jobTitle: e.target.value })}
                      className="inp"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Status">
                    <select
                      value={editing.status}
                      onChange={(e) => setEditing({ ...editing, status: e.target.value as Status })}
                      className="inp"
                    >
                      <option value="lead">Lead</option>
                      <option value="qualified">Qualificado</option>
                      <option value="customer">Cliente</option>
                      <option value="lost">Perdido</option>
                    </select>
                  </Field>
                  <Field label="Origem">
                    <input
                      value={editing.source}
                      onChange={(e) => setEditing({ ...editing, source: e.target.value })}
                      className="inp"
                    />
                  </Field>
                  <Field label="Score">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={editing.score}
                      onChange={(e) => setEditing({ ...editing, score: Number(e.target.value) })}
                      className="inp"
                    />
                  </Field>
                </div>
                <Field label="Notas">
                  <textarea
                    value={editing.notes}
                    onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                    rows={6}
                    className="inp resize-none"
                  />
                </Field>
              </div>
            </div>
            <footer className="flex items-center justify-end gap-2 border-t border-border p-4">
              <button
                onClick={() => setDrawerOpen(false)}
                className="h-9 rounded-md border border-border bg-background px-3 text-sm hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editing.fullName.trim()}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
              </button>
            </footer>
          </aside>
        </div>
      )}

      <style>{`.inp { width:100%; height:36px; padding:0 10px; border-radius:6px; border:1px solid hsl(var(--input)); background: hsl(var(--background)); font-size:13px; outline:none; }
.inp:focus { border-color: hsl(var(--primary)); box-shadow: 0 0 0 2px hsl(var(--primary) / 0.15); }
textarea.inp { height:auto; padding:8px 10px; line-height:1.4; }`}</style>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
