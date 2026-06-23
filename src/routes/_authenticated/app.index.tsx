import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { ArrowUpRight, Bot, Clock, Plus, Sparkles, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Painel — AI Workforce" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(1);
      const [{ count: agentCount }, { count: monthExec }, { data: execs }] = await Promise.all([
        supabase.from("agents").select("id", { count: "exact", head: true }),
        supabase
          .from("executions")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since.toISOString()),
        supabase.from("executions").select("hours_saved").gte("created_at", since.toISOString()),
      ]);
      const hours = (execs ?? []).reduce(
        (sum, e: { hours_saved: number | string }) => sum + Number(e.hours_saved ?? 0),
        0,
      );
      return { agents: agentCount ?? 0, executionsMonth: monthExec ?? 0, hoursSaved: hours };
    },
  });

  const { data: recent = [] } = useQuery({
    queryKey: ["dashboard", "recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("executions")
        .select("id, prompt, response, hours_saved, created_at, agent_id, agents(name)")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["dashboard", "agents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("agents")
        .select("id, name, objective, schedule, created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
        <div className="text-sm font-medium text-muted-foreground">Painel</div>
        <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Powered by Lovable AI
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl text-foreground">Visão geral</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acompanhe seus agentes, execuções e o tempo que você está economizando.
            </p>
          </div>
          <Link
            to="/app/agents/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Novo agente
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Kpi label="Agentes ativos" value={String(stats?.agents ?? 0)} icon={Bot} />
          <Kpi label="Execuções este mês" value={String(stats?.executionsMonth ?? 0)} icon={Zap} />
          <Kpi
            label="Horas economizadas"
            value={`${(stats?.hoursSaved ?? 0).toFixed(1)}h`}
            icon={Clock}
            accent
          />
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">Seus agentes</h2>
              <Link to="/app/agents/new" className="text-xs text-muted-foreground hover:text-foreground">
                Criar novo →
              </Link>
            </div>
            {agents.length === 0 ? (
              <EmptyAgents />
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {agents.map((a) => (
                  <Link
                    key={a.id}
                    to="/app/agents/$agentId"
                    params={{ agentId: a.id }}
                    className="surface-card group p-5 transition hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between">
                      <div className="grid h-9 w-9 place-items-center rounded-md bg-primary-soft text-primary">
                        <Bot className="h-4 w-4" />
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                    </div>
                    <h3 className="mt-3 truncate text-sm font-semibold">{a.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.objective}</p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Execução: <span className="text-foreground">{labelSchedule(a.schedule)}</span>
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold tracking-tight">Últimas execuções</h2>
            <div className="surface-card mt-3 divide-y divide-border">
              {recent.length === 0 && (
                <p className="p-5 text-sm text-muted-foreground">Nenhuma execução ainda.</p>
              )}
              {recent.map((e) => (
                <div key={e.id} className="p-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate">{e.agents?.name ?? "Agente"}</span>
                    <span>
                      {formatDistanceToNow(new Date(e.created_at), { locale: ptBR, addSuffix: true })}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-foreground">{e.prompt}</p>
                  <p className="mt-1 text-xs text-primary">
                    +{Number(e.hours_saved).toFixed(2)}h economizadas
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <div className={`surface-card p-5 ${accent ? "bg-primary-soft" : ""}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <p className={`mt-3 font-display text-4xl ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function EmptyAgents() {
  return (
    <div className="surface-card mt-3 grid place-items-center p-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary">
        <Bot className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold">Crie seu primeiro agente</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Em 3 etapas: nome, objetivo e documentos. Em minutos seu funcionário digital começa a trabalhar.
      </p>
      <Link
        to="/app/agents/new"
        className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> Criar agente
      </Link>
    </div>
  );
}

function labelSchedule(s: string) {
  if (s === "daily") return "Diária";
  if (s === "weekly") return "Semanal";
  return "Manual";
}
