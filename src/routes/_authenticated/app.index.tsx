import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import {
  ArrowUpRight,
  Bot,
  Clock,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Painel — AI Workforce" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { currentWorkspaceId, currentWorkspace } = useWorkspace();

  const { data: dashboard } = useQuery({
    queryKey: ["dashboard", currentWorkspaceId],
    enabled: !!currentWorkspaceId,
    queryFn: async () => {
      const since30 = new Date();
      since30.setDate(since30.getDate() - 30);
      const sinceIso = since30.toISOString();

      const [
        { count: agentCount },
        { count: monthExec },
        { data: execs },
        { count: memberCount },
        { data: agents },
        { data: recent },
      ] = await Promise.all([
        supabase
          .from("agents")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", currentWorkspaceId!),
        supabase
          .from("executions")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", currentWorkspaceId!)
          .gte("created_at", sinceIso),
        supabase
          .from("executions")
          .select("hours_saved, created_at, agent_id, agents(name)")
          .eq("workspace_id", currentWorkspaceId!)
          .gte("created_at", sinceIso),
        supabase
          .from("workspace_members")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", currentWorkspaceId!),
        supabase
          .from("agents")
          .select("id, name, objective, schedule, created_at")
          .eq("workspace_id", currentWorkspaceId!)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("executions")
          .select("id, prompt, hours_saved, created_at, agent_id, agents(name)")
          .eq("workspace_id", currentWorkspaceId!)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      const totalHours = (execs ?? []).reduce(
        (s, e) => s + Number(e.hours_saved ?? 0),
        0,
      );

      // Series by day
      const byDay: Record<string, { execs: number; hours: number }> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        byDay[key] = { execs: 0, hours: 0 };
      }
      (execs ?? []).forEach((e) => {
        const key = new Date(e.created_at).toISOString().slice(0, 10);
        if (byDay[key]) {
          byDay[key].execs += 1;
          byDay[key].hours += Number(e.hours_saved ?? 0);
        }
      });
      const series = Object.entries(byDay).map(([date, v]) => ({
        date: date.slice(5),
        Execuções: v.execs,
        Horas: Number(v.hours.toFixed(2)),
      }));
      const seriesFull = Object.entries(byDay).map(([date, v]) => ({
        date,
        execucoes: v.execs,
        horas: Number(v.hours.toFixed(2)),
      }));

      // Top agents
      const byAgent: Record<string, { name: string; execs: number; hours: number }> = {};
      (execs ?? []).forEach((e) => {
        const id = e.agent_id;
        const name = e.agents?.name ?? "—";
        if (!byAgent[id]) byAgent[id] = { name, execs: 0, hours: 0 };
        byAgent[id].execs += 1;
        byAgent[id].hours += Number(e.hours_saved ?? 0);
      });
      const topAgents = Object.values(byAgent)
        .sort((a, b) => b.execs - a.execs)
        .slice(0, 5)
        .map((a) => ({ ...a, name: a.name.length > 18 ? a.name.slice(0, 18) + "…" : a.name }));

      // Estimated savings (R$80/h)
      const roi = totalHours * 80;

      return {
        agents: agentCount ?? 0,
        executionsMonth: monthExec ?? 0,
        hoursSaved: totalHours,
        members: memberCount ?? 0,
        series,
        seriesFull,
        topAgents,
        agentsList: agents ?? [],
        recent: recent ?? [],
        roi,
      };
    },
  });

  return (
    <AppShell>
      <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
        <div className="text-sm font-medium text-muted-foreground">{currentWorkspace?.name ?? "Painel"}</div>
        <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Powered by Lovable AI
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl text-foreground">Visão geral</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Últimos 30 dias · acompanhe execuções, horas economizadas e ROI estimado.
            </p>
          </div>
          <Link
            to="/app/agents/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Novo agente
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Agentes ativos" value={String(dashboard?.agents ?? 0)} icon={Bot} />
          <Kpi label="Execuções (30d)" value={String(dashboard?.executionsMonth ?? 0)} icon={Zap} />
          <Kpi
            label="Horas economizadas"
            value={`${(dashboard?.hoursSaved ?? 0).toFixed(1)}h`}
            icon={Clock}
            accent
          />
          <Kpi
            label="ROI estimado"
            value={`R$ ${Math.round(dashboard?.roi ?? 0).toLocaleString("pt-BR")}`}
            icon={TrendingUp}
            hint={`${dashboard?.members ?? 0} membro${dashboard?.members === 1 ? "" : "s"} · R$80/h`}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <section className="surface-card lg:col-span-2 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Execuções por dia</h2>
              <span className="text-xs text-muted-foreground">Últimos 30 dias</span>
            </div>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboard?.series ?? []}>
                  <defs>
                    <linearGradient id="execGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={28} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="Execuções" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#execGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="surface-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Top agentes</h2>
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="mt-4 h-64 w-full">
              {(dashboard?.topAgents ?? []).length === 0 ? (
                <p className="grid h-full place-items-center text-xs text-muted-foreground">
                  Sem dados ainda
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard?.topAgents ?? []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={90} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="execs" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">Seus agentes</h2>
              <Link to="/app/agents/new" className="text-xs text-muted-foreground hover:text-foreground">
                Criar novo →
              </Link>
            </div>
            {(dashboard?.agentsList ?? []).length === 0 ? (
              <EmptyAgents />
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {dashboard!.agentsList.map((a) => (
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
            <h2 className="text-sm font-semibold tracking-tight">Atividade recente</h2>
            <div className="surface-card mt-3 divide-y divide-border">
              {(dashboard?.recent ?? []).length === 0 && (
                <p className="p-5 text-sm text-muted-foreground">Nenhuma execução ainda.</p>
              )}
              {(dashboard?.recent ?? []).map((e) => (
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
  hint,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
  hint?: string;
}) {
  return (
    <div className={`surface-card p-5 ${accent ? "bg-primary-soft" : ""}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <p className={`mt-3 font-display text-3xl lg:text-4xl ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
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
