import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useServerFn } from "@tanstack/react-start";
import { upsertDeal, moveDealStage, deleteDeal } from "@/lib/crm.functions";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { KanbanSquare, Loader2, Plus, Trash2, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/crm/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline — AI Workforce" }] }),
  component: PipelinePage,
});

function PipelinePage() {
  const { currentWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const upsertFn = useServerFn(upsertDeal);
  const moveFn = useServerFn(moveDealStage);
  const deleteFn = useServerFn(deleteDeal);

  const [creating, setCreating] = useState<null | { stageId: string }>(null);
  const [title, setTitle] = useState("");
  const [value, setValue] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);

  const { data: stages = [] } = useQuery({
    queryKey: ["crm", "stages", currentWorkspaceId],
    enabled: !!currentWorkspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_pipeline_stages")
        .select("id, name, color, position, is_won, is_lost")
        .eq("workspace_id", currentWorkspaceId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: deals = [] } = useQuery({
    queryKey: ["crm", "deals", currentWorkspaceId],
    enabled: !!currentWorkspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_deals")
        .select("id, title, value, currency, stage_id, contact_id, status, probability")
        .eq("workspace_id", currentWorkspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const dealsByStage = useMemo(() => {
    const map = new Map<string, typeof deals>();
    stages.forEach((s) => map.set(s.id, []));
    deals.forEach((d) => {
      if (d.stage_id && map.has(d.stage_id)) map.get(d.stage_id)!.push(d);
    });
    return map;
  }, [stages, deals]);

  async function handleCreateDeal() {
    if (!creating || !currentWorkspaceId || !title.trim()) return;
    try {
      await upsertFn({
        data: {
          workspaceId: currentWorkspaceId,
          stageId: creating.stageId,
          title: title.trim(),
          value,
          currency: "BRL",
          probability: 50,
          status: "open",
        },
      });
      setTitle("");
      setValue(0);
      setCreating(null);
      queryClient.invalidateQueries({ queryKey: ["crm", "deals"] });
      toast.success("Oportunidade criada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  async function handleDrop(stageId: string) {
    if (!dragId || !currentWorkspaceId) return;
    const id = dragId;
    setDragId(null);
    const deal = deals.find((d) => d.id === id);
    if (!deal || deal.stage_id === stageId) return;
    try {
      await moveFn({ data: { dealId: id, workspaceId: currentWorkspaceId, stageId } });
      queryClient.invalidateQueries({ queryKey: ["crm", "deals"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao mover");
    }
  }

  async function handleDelete(id: string) {
    if (!currentWorkspaceId) return;
    if (!confirm("Remover esta oportunidade?")) return;
    try {
      await deleteFn({ data: { id, workspaceId: currentWorkspaceId } });
      queryClient.invalidateQueries({ queryKey: ["crm", "deals"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  const totalOpen = deals
    .filter((d) => d.status === "open")
    .reduce((s, d) => s + Number(d.value ?? 0), 0);

  return (
    <AppShell>
      <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
        <div className="flex items-center gap-3 text-sm">
          <KanbanSquare className="h-4 w-4 text-primary" />
          <span className="font-medium">Pipeline de vendas</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="hidden sm:inline">
            Em aberto: <strong className="text-foreground">R$ {totalOpen.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
          </span>
          <Link
            to="/app/crm"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 font-medium hover:bg-accent"
          >
            <Users className="h-3.5 w-3.5" />
            Contatos
          </Link>
        </div>
      </header>

      <div className="px-6 py-6">
        {stages.length === 0 ? (
          <div className="grid h-40 place-items-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {stages.map((stage) => {
              const items = dealsByStage.get(stage.id) ?? [];
              const total = items.reduce((s, d) => s + Number(d.value ?? 0), 0);
              return (
                <div
                  key={stage.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(stage.id)}
                  className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-surface/40"
                >
                  <header className="flex items-center justify-between border-b border-border px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: stage.color }}
                      />
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        {stage.name}
                      </span>
                      <span className="text-xs text-muted-foreground">{items.length}</span>
                    </div>
                    <button
                      onClick={() => setCreating({ stageId: stage.id })}
                      className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label="Adicionar"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </header>
                  <div className="px-3 pb-1 pt-2 text-xs text-muted-foreground">
                    R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="flex min-h-[200px] flex-1 flex-col gap-2 p-2">
                    {creating?.stageId === stage.id && (
                      <div className="rounded-md border border-primary/40 bg-background p-2">
                        <input
                          autoFocus
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Título da oportunidade"
                          className="h-8 w-full rounded border border-input bg-background px-2 text-xs outline-none focus:border-primary"
                        />
                        <input
                          type="number"
                          value={value}
                          onChange={(e) => setValue(Number(e.target.value))}
                          placeholder="Valor (R$)"
                          className="mt-1 h-8 w-full rounded border border-input bg-background px-2 text-xs outline-none focus:border-primary"
                        />
                        <div className="mt-2 flex justify-end gap-1">
                          <button
                            onClick={() => {
                              setCreating(null);
                              setTitle("");
                              setValue(0);
                            }}
                            className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={handleCreateDeal}
                            className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
                          >
                            Adicionar
                          </button>
                        </div>
                      </div>
                    )}
                    {items.map((d) => (
                      <div
                        key={d.id}
                        draggable
                        onDragStart={() => setDragId(d.id)}
                        onDragEnd={() => setDragId(null)}
                        className="group cursor-grab rounded-md border border-border bg-background p-2.5 text-sm shadow-sm hover:border-primary/40 active:cursor-grabbing"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium leading-tight">{d.title}</div>
                          <button
                            onClick={() => handleDelete(d.id)}
                            className="invisible grid h-5 w-5 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-destructive group-hover:visible"
                            aria-label="Remover"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          R$ {Number(d.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          {" · "}
                          {d.probability}%
                        </div>
                      </div>
                    ))}
                    {items.length === 0 && creating?.stageId !== stage.id && (
                      <div className="grid h-20 place-items-center rounded-md border border-dashed border-border/60 text-xs text-muted-foreground">
                        Arraste aqui
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
