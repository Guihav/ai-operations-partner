import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Clock, FileText, MessageSquare, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Workforce — Funcionários digitais para PMEs" },
      {
        name: "description",
        content:
          "Crie agentes de IA que leem seus documentos, executam tarefas operacionais e devolvem horas para o seu time.",
      },
      { property: "og:title", content: "AI Workforce" },
      {
        property: "og:description",
        content:
          "Agentes de IA que leem seus documentos, executam tarefas e geram relatórios automaticamente.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
            <span className="text-sm font-semibold tracking-tight">AI Workforce</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#how" className="hover:text-foreground">Como funciona</a>
            <a href="#use-cases" className="hover:text-foreground">Casos de uso</a>
            <a href="#roi" className="hover:text-foreground">ROI</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="hidden rounded-md px-3 py-1.5 text-sm text-foreground hover:bg-accent sm:inline-flex"
            >
              Entrar
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Começar grátis <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Para diretores de operação de PMEs
          </div>
          <h1 className="mt-6 font-display text-balance text-6xl leading-[1.05] text-foreground md:text-7xl">
            O <em className="not-italic text-primary">funcionário digital</em> que sua operação precisava.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-base text-muted-foreground md:text-lg">
            Conecte seus documentos, descreva o processo e deixe um agente de IA executar tarefas operacionais
            todos os dias — relatórios, follow-ups e análises sem trabalho manual.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-90"
            >
              Criar meu primeiro agente <ArrowUpRight className="h-4 w-4" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center rounded-md border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
            >
              Ver como funciona
            </a>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Sem cartão de crédito · Configuração em minutos
          </p>
        </div>

        {/* Visual */}
        <div className="mx-auto mt-16 max-w-4xl">
          <div className="surface-card overflow-hidden shadow-elevated">
            <div className="flex items-center gap-1.5 border-b border-border bg-surface px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
              <span className="ml-3 text-xs text-muted-foreground">
                aiworkforce.app / agentes / assistente-financeiro
              </span>
            </div>
            <div className="grid gap-0 md:grid-cols-[220px_1fr]">
              <div className="hidden border-r border-border bg-sidebar p-4 text-sm md:block">
                <p className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Seus agentes
                </p>
                <div className="mt-3 space-y-1">
                  <div className="flex items-center gap-2 rounded-md bg-accent px-2 py-1.5 text-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" /> Assistente Financeiro
                  </div>
                  <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" /> Relatórios de vendas
                  </div>
                  <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" /> Follow-ups RH
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                      Qual foi o faturamento desta semana?
                    </div>
                  </div>
                  <div className="flex">
                    <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-2.5 text-sm">
                      <p>
                        Esta semana o faturamento foi de <strong>R$ 184.230</strong> (+12% vs. semana anterior).
                      </p>
                      <p className="mt-2 text-muted-foreground">
                        Principais alertas: 3 clientes com pagamento atrasado, ticket médio caiu 4% em SP.
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="h-3 w-3" /> 4 documentos consultados
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border/60 bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-wider text-primary">Como funciona</p>
            <h2 className="mt-2 font-display text-4xl text-foreground md:text-5xl">
              Três passos para seu primeiro agente
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Descreva o processo",
                body: "Conte para o agente o que ele precisa fazer — em linguagem natural, sem código.",
              },
              {
                step: "02",
                title: "Suba seus documentos",
                body: "PDFs, planilhas e relatórios viram a memória do agente. Tudo privado, só sua empresa acessa.",
              },
              {
                step: "03",
                title: "Defina a frequência",
                body: "Execução manual, diária ou semanal. O agente entrega relatórios e alertas sozinho.",
              },
            ].map((it) => (
              <div key={it.step} className="surface-card p-6">
                <div className="font-mono text-xs text-primary">{it.step}</div>
                <h3 className="mt-3 text-lg font-semibold tracking-tight">{it.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{it.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="use-cases" className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs font-medium uppercase tracking-wider text-primary">Casos de uso</p>
          <h2 className="mt-2 max-w-2xl font-display text-4xl text-foreground md:text-5xl">
            O que seu agente pode automatizar hoje
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Sparkles, title: "Relatórios semanais", body: "Resumo de vendas, financeiro ou operacional toda segunda às 8h." },
              { icon: MessageSquare, title: "Follow-ups", body: "Acompanha tarefas atrasadas e envia lembretes ao responsável." },
              { icon: FileText, title: "Análise de documentos", body: "Resume contratos, propostas e atas em segundos." },
              { icon: Clock, title: "Alertas de exceção", body: "Avisa quando algo foge do padrão — atrasos, quedas, picos." },
              { icon: Sparkles, title: "Respostas repetitivas", body: "Responde dúvidas internas usando a base de conhecimento da empresa." },
              { icon: FileText, title: "Organização de dados", body: "Consolida planilhas dispersas em um único panorama." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="surface-card p-5">
                <Icon className="h-4 w-4 text-primary" />
                <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI */}
      <section id="roi" className="border-t border-border/60 bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-primary">ROI mensurável</p>
              <h2 className="mt-2 font-display text-4xl text-foreground md:text-5xl">
                Cada execução vira <em className="not-italic text-primary">horas economizadas</em>.
              </h2>
              <p className="mt-4 text-muted-foreground">
                A plataforma calcula automaticamente quanto tempo manual seu agente substituiu — você sabe
                exatamente o retorno do investimento todo mês.
              </p>
            </div>
            <div className="surface-card p-6">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Este mês</p>
              <p className="mt-2 font-display text-6xl text-foreground">37,5h</p>
              <p className="text-sm text-muted-foreground">economizadas pelos seus agentes</p>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="font-display text-2xl text-foreground">82</p>
                  <p className="text-xs text-muted-foreground">execuções</p>
                </div>
                <div>
                  <p className="font-display text-2xl text-foreground">3</p>
                  <p className="text-xs text-muted-foreground">agentes ativos</p>
                </div>
                <div>
                  <p className="font-display text-2xl text-foreground">99%</p>
                  <p className="text-xs text-muted-foreground">taxa de sucesso</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h2 className="font-display text-5xl text-foreground md:text-6xl">
            Pronto para contratar seu primeiro funcionário digital?
          </h2>
          <div className="mt-8">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-90"
            >
              Criar conta gratuita <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Logo small /> <span>© {new Date().getFullYear()} AI Workforce</span>
          </div>
          <span>Feito para PMEs brasileiras</span>
        </div>
      </footer>
    </div>
  );
}

function Logo({ small = false }: { small?: boolean }) {
  const size = small ? "h-5 w-5" : "h-6 w-6";
  return (
    <div className={`${size} grid place-items-center rounded-md bg-primary text-primary-foreground`}>
      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
        <path d="M4 14L9 4L14 14M11 11H7M16 4V14M16 14L20 10M16 14L20 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
