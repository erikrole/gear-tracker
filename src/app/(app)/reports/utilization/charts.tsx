"use client";

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { statusLabelEquipment } from "@/lib/status-colors";
import {
  REPORT_CHART_COLORS,
  REPORT_SEMANTIC_CHART_COLORS,
  ReportChartCard,
} from "../report-ui";

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: REPORT_SEMANTIC_CHART_COLORS.available,
  CHECKED_OUT: REPORT_SEMANTIC_CHART_COLORS.active,
  PENDING_PICKUP: REPORT_SEMANTIC_CHART_COLORS.waiting,
  RESERVED: REPORT_SEMANTIC_CHART_COLORS.reserved,
  MAINTENANCE: REPORT_SEMANTIC_CHART_COLORS.waiting,
  RETIRED: REPORT_SEMANTIC_CHART_COLORS.neutral,
};

export function StatusDonut({ statusCounts }: { statusCounts: Record<string, number> }) {
  const chartData = Object.entries(statusCounts)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      status: statusLabelEquipment(status),
      count,
      fill: STATUS_COLORS[status] ?? REPORT_SEMANTIC_CHART_COLORS.neutral,
    }));

  if (chartData.length === 0) return null;

  const config: ChartConfig = Object.fromEntries(
    chartData.map((d) => [d.status, { label: d.status, color: d.fill }])
  );

  return (
    <ReportChartCard title="Status distribution">
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
            <div key={d.status} className="flex items-center gap-1.5 text-xs tabular-nums">
              <span className="size-2.5 rounded-full" style={{ background: d.fill }} />
              {d.status} ({d.count})
            </div>
          ))}
        </div>
    </ReportChartCard>
  );
}

export function TopBreakdownChart({ title, data, labelKey }: { title: string; data: { label: string; count: number }[]; labelKey: string }) {
  if (data.length === 0) return null;
  const top = [...data].sort((a, b) => b.count - a.count).slice(0, 8);

  const config: ChartConfig = Object.fromEntries(
    top.map((d, i) => [d.label, { label: d.label, color: REPORT_CHART_COLORS[i % REPORT_CHART_COLORS.length] }])
  );

  return (
    <ReportChartCard title={title}>
        <ChartContainer config={config} className="w-full" style={{ height: Math.max(150, top.length * 36) }}>
          <BarChart data={top} layout="vertical" margin={{ left: 0, right: 12 }}>
            <YAxis dataKey="label" type="category" width={100} tickLine={false} axisLine={false} className="text-xs" />
            <XAxis type="number" hide />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" name={labelKey} radius={[0, 4, 4, 0]}>
              {top.map((_, i) => (
                <Cell key={i} fill={REPORT_CHART_COLORS[i % REPORT_CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
    </ReportChartCard>
  );
}
