import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member";
};

type Ctx = {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentWorkspaceId: string | null;
  setCurrentWorkspaceId: (id: string) => void;
  loading: boolean;
  refetch: () => void;
};

const WorkspaceCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "aw.currentWorkspaceId";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: workspaces = [], isLoading, refetch } = useQuery<Workspace[]>({
    queryKey: ["workspaces", "mine"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("workspace_members")
        .select("role, workspaces(id, name, slug)")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? [])
        .filter((r) => r.workspaces)
        .map((r) => ({
          id: r.workspaces!.id,
          name: r.workspaces!.name,
          slug: r.workspaces!.slug,
          role: r.role as Workspace["role"],
        }));
    },
  });

  const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  const currentWorkspaceId = useMemo(() => {
    if (workspaces.length === 0) return null;
    if (stored && workspaces.some((w) => w.id === stored)) return stored;
    return workspaces[0].id;
  }, [workspaces, stored]);

  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId) ?? null;

  function setCurrentWorkspaceId(id: string) {
    localStorage.setItem(STORAGE_KEY, id);
    // Invalidate queries scoped to workspace
    queryClient.invalidateQueries();
  }

  // Persist initial pick
  useEffect(() => {
    if (currentWorkspaceId && currentWorkspaceId !== stored) {
      localStorage.setItem(STORAGE_KEY, currentWorkspaceId);
    }
  }, [currentWorkspaceId, stored]);

  return (
    <WorkspaceCtx.Provider
      value={{
        workspaces,
        currentWorkspace,
        currentWorkspaceId,
        setCurrentWorkspaceId,
        loading: isLoading,
        refetch,
      }}
    >
      {children}
    </WorkspaceCtx.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) throw new Error("useWorkspace deve estar dentro de WorkspaceProvider");
  return ctx;
}
