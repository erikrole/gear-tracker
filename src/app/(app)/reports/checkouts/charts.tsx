"use client";

import { AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  REPORT_CHART_COLORS,
  REPORT_SEMANTIC_CHART_COLORS,
  ReportChartCard,
} from "../report-ui";

const trendConfig: ChartConfig = {
  count: { label: "Checkouts", color: REPORT_SEMANTIC_CHART_COLORS.active },
};

function formatDateLabel(dateStr: unknown) {
  if (typeof dateStr !== "string") return String(dateStr);
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function CheckoutTrendChart({ dailyTrend, days }: { dailyTrend: { date: string; count: number }[]; days: number }) {
  if (dailyTrend.length <= 1) return null;

  return (
    <ReportChartCard title={`Checkout trend (${days}d)`}>
        <ChartContainer config={trendConfig} className="w-full h-[200px]">
          <AreaChart data={dailyTrend} margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} className="text-xs" tickFormatter={formatDateLabel}
              interval={Math.max(0, Math.floor(dailyTrend.length / 7) - 1)} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-xs" width={30} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="count"
              name="Checkouts"
              fill={REPORT_SEMANTIC_CHART_COLORS.activeSoft}
              stroke={REPORT_SEMANTIC_CHART_COLORS.active}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
    </ReportChartCard>
  );
}

export function TopRequestersChart({ topRequesters, days }: { topRequesters: { name: string; count: number }[]; days: number }) {
  if (topRequesters.length === 0) return null;

  return (
    <ReportChartCard title={`Top requesters (${days}d)`}>
        <ChartContainer config={{ count: { label: "Checkouts" } }} className="w-full" style={{ height: Math.max(150, topRequesters.length * 36) }}>
          <BarChart data={topRequesters} layout="vertical" margin={{ left: 0, right: 12 }}>
            <YAxis dataKey="name" type="category" width={100} tickLine={false} axisLine={false} className="text-xs" />
            <XAxis type="number" hide />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" name="Checkouts" radius={[0, 4, 4, 0]}>
              {topRequesters.map((_, i) => (
                <Cell key={i} fill={REPORT_CHART_COLORS[i % REPORT_CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
    </ReportChartCard>
  );
}
