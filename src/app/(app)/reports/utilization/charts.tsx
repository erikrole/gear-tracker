"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const STATUS_META_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  CHECKED_OUT: "Checked out",
  RESERVED: "Reserved",
  MAINTENANCE: "Maintenance",
  RETIRED: "Retired",
};

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "hsl(142 60% 45%)",
  CHECKED_OUT: "hsl(220 70% 55%)",
  RESERVED: "hsl(270 60% 60%)",
  MAINTENANCE: "hsl(25 90% 55%)",
  RETIRED: "hsl(0 0% 60%)",
};

const BAR_COLORS = [
  "hsl(220 70% 55%)", "hsl(270 60% 60%)", "hsl(142 60% 45%)",
  "hsl(25 90% 55%)", "hsl(340 70% 55%)", "hsl(180 50% 45%)",
  "hsl(45 80% 50%)", "hsl(0 0% 60%)",
];

export function StatusDonut({ statusCounts }: { statusCounts: Record<string, number> }) {
  const chartData = Object.entries(statusCounts)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      status: STATUS_META_LABELS[status] ?? status,
      count,
      fill: STATUS_COLORS[status] ?? "hsl(0 0% 50%)",
    }));

  if (chartData.length === 0) return null;

  const config: ChartConfig = Object.fromEntries(
    chartData.map((d) => [d.status, { label: d.status, color: d.fill }])
  );

  return (
    <Card>
      <CardHeader><CardTitle>Status distribution</CardTitle></CardHeader>
      <CardContent>
        <ChartContainer config={config} className="mx-auto aspect-square max-h-[250px]">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent />} />
            <Pie data={chartData} dataKey="count" nameKey="status" innerRadius={60} outerRadius={90} paddingAngle={2}>
              {chartData.map((d) => (
                <Cell key={d.status} fill={d.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="flex flex-wrap justify-center gap-3 mt-2">
          {chartData.map((d) => (
            <div key={d.status} className="flex items-center gap-1.5 text-xs">
              <span className="size-2.5 rounded-full" style={{ background: d.fill }} />
              {d.status} ({d.count})
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function TopBreakdownChart({ title, data, labelKey }: { title: string; data: { label: string; count: number }[]; labelKey: string }) {
  if (data.length === 0) return null;
  const top = data.sort((a, b) => b.count - a.count).slice(0, 8);

  const config: ChartConfig = Object.fromEntries(
    top.map((d, i) => [d.label, { label: d.label, color: BAR_COLORS[i % BAR_COLORS.length] }])
  );

  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <ChartContainer config={config} className="w-full" style={{ height: Math.max(150, top.length * 36) }}>
          <BarChart data={top} layout="vertical" margin={{ left: 0, right: 12 }}>
            <YAxis dataKey="label" type="category" width={100} tickLine={false} axisLine={false} className="text-xs" />
            <XAxis type="number" hide />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" name={labelKey} radius={[0, 4, 4, 0]}>
              {top.map((_, i) => (
                <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
