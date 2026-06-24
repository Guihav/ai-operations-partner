import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { AGENT_TEMPLATES } from "@/lib/templates";
import { ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/templates")({
  head: () => ({ meta: [{ title: "Templates — AI Workforce" }] }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const categories = Array.from(new Set(AGENT_TEMPLATES.map((t) => t.category)));

  return (
    <AppShell>
      <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
        <div className="text-sm font-medium text-muted-foreground">Templates</div>
        <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> {AGENT_TEMPLATES.length} templates prontos
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <div>
          <h1 className="font-display text-4xl text-foreground">
            Comece com um <em className="not-italic text-primary">template</em>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Modelos pré-configurados de agentes operacionais usados por PMEs reais. Personalize com
            seus documentos depois.
          </p>
        </div>

        {categories.map((cat) => (
          <section key={cat} className="mt-10">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {cat}
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {AGENT_TEMPLATES.filter((t) => t.category === cat).map((t) => {
                const Icon = t.icon;
                return (
                  <Link
                    key={t.id}
                    to="/app/agents/new"
                    search={{ template: t.id }}
                    className="surface-card group flex flex-col p-5 transition hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between">
                      <div className="grid h-9 w-9 place-items-center rounded-md bg-primary-soft text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {t.estimatedHours}
                      </span>
                    </div>
                    <h3 className="mt-4 text-sm font-semibold">{t.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.tagline}</p>
                    <div className="mt-4 flex items-center gap-1 text-xs text-primary opacity-0 transition group-hover:opacity-100">
                      Usar template <ArrowRight className="h-3 w-3" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
