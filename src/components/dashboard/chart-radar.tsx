import * as React from "react";
import { TrendingUp } from "lucide-react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type ChartRadarDatum = {
  label: string;
  value: number;
};

const chartConfig = {
  value: {
    label: "Execuções",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export function ChartRadarDefault({ data }: { data: ChartRadarDatum[] }) {
  return (
    <Card className="h-full">
      <CardHeader className="items-center pb-4">
        <CardTitle>Performance por agente</CardTitle>
        <CardDescription>
          Execuções dos principais agentes nos últimos 30 dias
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[250px]"
        >
          <RadarChart data={data}>
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <PolarAngleAxis dataKey="label" />
            <PolarGrid />
            <Radar
              dataKey="value"
              fill="var(--color-value)"
              fillOpacity={0.6}
            />
          </RadarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 leading-none font-medium">
          Distribuição de carga entre agentes <TrendingUp className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-2 leading-none text-muted-foreground">
          Últimos 30 dias
        </div>
      </CardFooter>
    </Card>
  );
}
