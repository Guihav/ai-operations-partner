import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bot,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const NAV = [
  { to: "/app", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { to: "/app/templates", label: "Templates", icon: Sparkles },
  { to: "/app/executions", label: "Execuções", icon: History },
  { to: "/app/settings", label: "Configurações", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("id, name, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, company_name")
        .eq("id", u.user.id)
        .maybeSingle();
      return { email: u.user.email, ...data };
    },
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
    toast.success("Sessão encerrada");
  }

  const sidebar = (
    <>
      <div className="flex h-14 items-center justify-between gap-2 border-b border-sidebar-border px-4">
        <Link to="/app" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
          <div className="grid h-6 w-6 place-items-center rounded-md bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
              <path d="M4 14L9 4L14 14M11 11H7M16 4V14M16 14L20 10M16 14L20 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight">AI Workforce</span>
        </Link>
        <button
          className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-sidebar-accent hover:text-foreground md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 text-sm">
        <div className="space-y-0.5">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                icon={item.icon}
                active={active}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </NavLink>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between px-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Agentes
          </p>
          <Link
            to="/app/agents/new"
            onClick={() => setMobileOpen(false)}
            className="grid h-5 w-5 place-items-center rounded text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            aria-label="Criar agente"
          >
            <Plus className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-1 space-y-0.5">
          {agents.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">Nenhum agente ainda.</p>
          )}
          {agents.map((a) => {
            const active = pathname === `/app/agents/${a.id}`;
            return (
              <Link
                key={a.id}
                to="/app/agents/$agentId"
                params={{ agentId: a.id }}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 truncate rounded-md px-2 py-1.5 text-sm ${
                  active
                    ? "bg-sidebar-accent text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                }`}
              >
                <Bot className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{a.name}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-6">
          <Link
            to="/app/agents/new"
            onClick={() => setMobileOpen(false)}
            className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-background/50 px-3 py-2 text-xs font-medium text-foreground hover:bg-accent"
          >
            <Plus className="h-3.5 w-3.5" /> Novo agente
          </Link>
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2 rounded-md p-2">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-xs font-medium text-primary">
            {(profile?.full_name ?? profile?.email ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{profile?.full_name ?? profile?.email}</p>
            <p className="truncate text-xs text-muted-foreground">
              {profile?.company_name ?? "Sua empresa"}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        {sidebar}
      </aside>

      {/* Sidebar — mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-sidebar-border bg-sidebar shadow-elevated">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex h-12 items-center gap-2 border-b border-border bg-background px-3 md:hidden">
          <button
            className="grid h-8 w-8 place-items-center rounded-md text-foreground hover:bg-accent"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5">
            <div className="grid h-5 w-5 place-items-center rounded-md bg-primary text-primary-foreground text-[10px] font-semibold">
              AW
            </div>
            <span className="text-sm font-semibold">AI Workforce</span>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

function NavLink({
  to,
  icon: Icon,
  active,
  children,
  onClick,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
        active
          ? "bg-sidebar-accent text-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}
