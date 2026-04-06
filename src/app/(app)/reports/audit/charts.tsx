"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Bar, Cell, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const BAR_COLORS = [
  "hsl(220 70% 55%)", "hsl(270 60% 60%)", "hsl(142 60% 45%)",
  "hsl(25 90% 55%)", "hsl(340 70% 55%)", "hsl(180 50% 45%)",
  "hsl(45 80% 50%)", "hsl(0 0% 60%)", "hsl(200 60% 50%)", "hsl(120 40% 50%)",
  "hsl(290 50% 55%)", "hsl(30 70% 50%)", "hsl(160 50% 50%)", "hsl(350 60% 50%)", "hsl(240 50% 55%)",
];

function formatAction(action: string) {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/^(.{20}).+$/, "$1\u2026");
}

const chartConfig: ChartConfig = {
  count: { label: "Events" },
};

export function ActionBreakdownChart({
  byAction,
}: {
  byAction: { action: string; count: number }[];
}) {
  if (byAction.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>By action</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="w-full"
          style={{ height: Math.max(150, byAction.length * 32) }}
        >
          <BarChart
            data={byAction}
            layout="vertical"
            margin={{ left: 0, right: 12 }}
          >
            <YAxis
              dataKey="action"
              type="category"
              width={130}
              tickLine={false}
              axisLine={false}
              className="text-xs"
              tickFormatter={formatAction}
            />
            <XAxis type="number" hide />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" name="Events" radius={[0, 4, 4, 0]}>
              {byAction.map((_, i) => (
                <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function EntityTypeBreakdownChart({
  byEntityType,
}: {
  byEntityType: { entityType: string; count: number }[];
}) {
  if (byEntityType.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>By entity type</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="w-full"
          style={{ height: Math.max(150, byEntityType.length * 32) }}
        >
          <BarChart
            data={byEntityType}
            layout="vertical"
            margin={{ left: 0, right: 12 }}
          >
            <YAxis
              dataKey="entityType"
              type="category"
              width={90}
              tickLine={false}
              axisLine={false}
              className="text-xs"
            />
            <XAxis type="number" hide />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" name="Events" radius={[0, 4, 4, 0]}>
              {byEntityType.map((_, i) => (
                <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
