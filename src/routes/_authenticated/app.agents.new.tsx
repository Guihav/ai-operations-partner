import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { indexDocument } from "@/lib/ai.functions";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Calendar, Check, FileText, Loader2, Upload, X } from "lucide-react";
import { extractTextFromFile, isSupportedFile, MAX_BYTES } from "@/lib/text-extract";

export const Route = createFileRoute("/_authenticated/app/agents/new")({
  head: () => ({ meta: [{ title: "Criar agente — AI Workforce" }] }),
  component: NewAgentPage,
});

type Schedule = "manual" | "daily" | "weekly";
type StagedFile = { id: string; file: File; status: "pending" | "uploading" | "ready" | "failed"; error?: string };

function NewAgentPage() {
  const navigate = useNavigate();
  const indexFn = useServerFn(indexDocument);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [schedule, setSchedule] = useState<Schedule>("manual");
  const [submitting, setSubmitting] = useState(false);

  const canNext = [
    () => name.trim().length >= 3,
    () => objective.trim().length >= 10,
    () => true,
    () => true,
  ][step]();

  function addFiles(list: FileList | null) {
    if (!list) return;
    const additions: StagedFile[] = [];
    Array.from(list).forEach((f) => {
      if (!isSupportedFile(f)) {
        toast.error(`Formato não suportado: ${f.name}`);
        return;
      }
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name} excede 10 MB`);
        return;
      }
      additions.push({ id: crypto.randomUUID(), file: f, status: "pending" });
    });
    setFiles((prev) => [...prev, ...additions]);
  }

  async function createAgent() {
    setSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");

      const { data: agent, error } = await supabase
        .from("agents")
        .insert({
          owner_id: u.user.id,
          name: name.trim(),
          objective: objective.trim(),
          schedule,
        })
        .select("id")
        .single();
      if (error) throw error;

      for (const f of files) {
        try {
          setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: "uploading" } : x)));
          const path = `${u.user.id}/${agent.id}/${Date.now()}-${f.file.name}`;
          const { error: upErr } = await supabase.storage
            .from("agent-documents")
            .upload(path, f.file, { contentType: f.file.type });
          if (upErr) throw upErr;

          const { data: doc, error: docErr } = await supabase
            .from("agent_documents")
            .insert({
              agent_id: agent.id,
              owner_id: u.user.id,
              file_name: f.file.name,
              file_path: path,
              mime_type: f.file.type,
              size_bytes: f.file.size,
              status: "processing",
            })
            .select("id")
            .single();
          if (docErr) throw docErr;

          const text = await extractTextFromFile(f.file);
          await indexFn({ data: { documentId: doc.id, text } });

          setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: "ready" } : x)));
        } catch (e) {
          console.error(e);
          setFiles((prev) =>
            prev.map((x) =>
              x.id === f.id
                ? { ...x, status: "failed", error: e instanceof Error ? e.message : "Falhou" }
                : x,
            ),
          );
        }
      }

      toast.success(`Agente "${name}" criado.`);
      navigate({ to: "/app/agents/$agentId", params: { agentId: agent.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar agente");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="border-b border-border bg-background px-6 py-4">
        <button
          onClick={() => navigate({ to: "/app" })}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </button>
      </div>

      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <div className="mb-8 flex items-center gap-2">
          {["Nome", "Objetivo", "Conhecimento", "Execução"].map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={`grid h-7 w-7 place-items-center rounded-full border text-xs font-medium ${
                  i < step
                    ? "border-primary bg-primary text-primary-foreground"
                    : i === step
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={`hidden text-xs sm:inline ${i === step ? "text-foreground" : "text-muted-foreground"}`}
              >
                {label}
              </span>
              {i < 3 && <div className="h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>

        <div className="surface-card p-6 md:p-8">
          {step === 0 && (
            <Step
              title="Como seu agente se chama?"
              subtitle="Dê um nome curto. Ex: 'Assistente Financeiro' ou 'Relatórios de Vendas'."
            >
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Assistente Financeiro"
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </Step>
          )}

          {step === 1 && (
            <Step
              title="O que você quer automatizar?"
              subtitle="Explique em linguagem natural. Quanto mais específico, melhor o resultado."
            >
              <textarea
                autoFocus
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Ex: Acompanhar minhas vendas semanais, identificar quedas e gerar um resumo toda segunda às 8h."
                rows={5}
                className="w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </Step>
          )}

          {step === 2 && (
            <Step
              title="Adicione conhecimento (opcional)"
              subtitle="Suba documentos da empresa. Eles viram a memória do agente — privados, só você acessa."
            >
              <label
                htmlFor="files"
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-surface p-8 text-center transition hover:border-primary/40"
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium">Arraste ou clique para enviar</p>
                <p className="text-xs text-muted-foreground">.txt .md .csv .json .pdf .docx — até 10 MB cada</p>
              </label>
              <input
                id="files"
                type="file"
                multiple
                accept=".txt,.md,.csv,.json,.pdf,.docx,text/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
              {files.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {files.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{f.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(f.file.size / 1024).toFixed(1)} KB ·{" "}
                            {f.status === "pending" ? "pronto para enviar" : f.status}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remover"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Step>
          )}

          {step === 3 && (
            <Step
              title="Quando o agente deve executar?"
              subtitle="Comece manual e ative automação quando estiver confiante."
            >
              <div className="grid gap-3">
                {[
                  { id: "manual", title: "Manual", desc: "Você executa quando precisar, pelo chat." },
                  { id: "daily", title: "Diariamente", desc: "Toda manhã às 8h o agente roda automaticamente." },
                  { id: "weekly", title: "Semanalmente", desc: "Toda segunda às 8h o agente envia um resumo." },
                ].map((opt) => {
                  const active = schedule === opt.id;
                  return (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => setSchedule(opt.id as Schedule)}
                      className={`flex items-start gap-3 rounded-md border p-4 text-left transition ${
                        active
                          ? "border-primary bg-primary-soft"
                          : "border-border bg-background hover:bg-accent"
                      }`}
                    >
                      <Calendar
                        className={`mt-0.5 h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`}
                      />
                      <div>
                        <p className="text-sm font-semibold">{opt.title}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                A execução agendada estará disponível em breve. O chat manual já funciona normalmente.
              </p>
            </Step>
          )}

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || submitting}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            {step < 3 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                Continuar <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={createAgent}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Criar agente
              </button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Step({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-3xl text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}
