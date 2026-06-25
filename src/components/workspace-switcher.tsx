import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { useServerFn } from "@tanstack/react-start";
import { createWorkspace } from "@/lib/teams.functions";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, setCurrentWorkspaceId, refetch } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const createFn = useServerFn(createWorkspace);
  const queryClient = useQueryClient();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return;
    try {
      const ws = await createFn({ data: { name: name.trim() } });
      toast.success(`Workspace "${ws.name}" criado`);
      await refetch();
      setCurrentWorkspaceId(ws.id);
      setName("");
      setCreating(false);
      setOpen(false);
      queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar");
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-xs hover:bg-accent"
      >
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Workspace</p>
          <p className="truncate font-medium text-foreground">
            {currentWorkspace?.name ?? "Carregando…"}
          </p>
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-40 mt-1 rounded-md border border-border bg-background shadow-elevated">
            <div className="max-h-60 overflow-y-auto p-1">
              {workspaces.map((w) => {
                const active = w.id === currentWorkspace?.id;
                return (
                  <button
                    key={w.id}
                    onClick={() => {
                      setCurrentWorkspaceId(w.id);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
                  >
                    <div className="min-w-0 text-left">
                      <p className="truncate font-medium">{w.name}</p>
                      <p className="text-[10px] capitalize text-muted-foreground">{w.role}</p>
                    </div>
                    {active && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-border p-1">
              {creating ? (
                <form onSubmit={handleCreate} className="space-y-1.5 p-1.5">
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome do workspace"
                    maxLength={60}
                    className="h-8 w-full rounded border border-input bg-background px-2 text-xs outline-none focus:border-primary"
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="submit"
                      className="h-7 flex-1 rounded bg-primary text-xs font-medium text-primary-foreground hover:opacity-90"
                    >
                      Criar
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreating(false)}
                      className="h-7 rounded px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> Novo workspace
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
