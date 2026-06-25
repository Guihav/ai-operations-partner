import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type ChartBarDatum = {
  date: string; // ISO yyyy-mm-dd
  execucoes: number;
  horas: number;
};

const chartConfig = {
  views: { label: "Atividade" },
  execucoes: {
    label: "Execuções",
    color: "hsl(var(--primary))",
  },
  horas: {
    label: "Horas economizadas",
    color: "hsl(var(--chart-2, var(--primary)))",
  },
} satisfies ChartConfig;

export function ChartBarInteractive({ data }: { data: ChartBarDatum[] }) {
  const [activeChart, setActiveChart] =
    React.useState<"execucoes" | "horas">("execucoes");

  const total = React.useMemo(
    () => ({
      execucoes: data.reduce((acc, c) => acc + c.execucoes, 0),
      horas: data.reduce((acc, c) => acc + c.horas, 0),
    }),
    [data],
  );

  return (
    <Card className="py-0">
      <CardHeader className="flex flex-col items-stretch border-b !p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3 sm:!py-5">
          <CardTitle className="text-sm font-semibold">
            Atividade detalhada
          </CardTitle>
          <CardDescription className="text-xs">
            Compare execuções e horas economizadas nos últimos 30 dias
          </CardDescription>
        </div>
        <div className="flex">
          {(["execucoes", "horas"] as const).map((key) => (
            <button
              key={key}
              data-active={activeChart === key}
              className="relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l data-[active=true]:bg-muted/50 sm:border-t-0 sm:border-l sm:px-8 sm:py-5"
              onClick={() => setActiveChart(key)}
            >
              <span className="text-xs text-muted-foreground">
                {chartConfig[key].label}
              </span>
              <span className="text-lg leading-none font-bold sm:text-2xl">
                {key === "horas"
                  ? `${total.horas.toFixed(1)}h`
                  : total.execucoes.toLocaleString("pt-BR")}
              </span>
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <BarChart
            accessibilityLayer
            data={data}
            margin={{ left: 12, right: 12 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const d = new Date(value);
                return d.toLocaleDateString("pt-BR", {
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[170px]"
                  nameKey="views"
                  labelFormatter={(value) =>
                    new Date(value as string).toLocaleDateString("pt-BR", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  }
                />
              }
            />
            <Bar
              dataKey={activeChart}
              fill={`var(--color-${activeChart})`}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
