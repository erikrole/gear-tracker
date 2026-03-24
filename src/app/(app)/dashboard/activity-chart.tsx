"use client";

import { PieChart, Pie, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const activityChartConfig = {
  overdue: { label: "Overdue", color: "var(--wi-red)" },
  dueToday: { label: "Due Today", color: "var(--orange)" },
  checkedOut: { label: "Active Checkouts", color: "var(--blue)" },
  reserved: { label: "Reserved", color: "var(--purple)" },
} satisfies ChartConfig;

type Stats = { overdue: number; dueToday: number; checkedOut: number; reserved: number };

export function ActivityChart({ stats }: { stats: Stats }) {
  const total = stats.overdue + stats.dueToday + stats.checkedOut + stats.reserved;
  if (total === 0) return null;

  const chartData = [
    { name: "overdue", label: "Overdue", value: stats.overdue, fill: "var(--wi-red)" },
    { name: "dueToday", label: "Due Today", value: stats.dueToday, fill: "var(--orange)" },
    { name: "checkedOut", label: "Active Checkouts", value: stats.checkedOut, fill: "var(--blue)" },
    { name: "reserved", label: "Reserved", value: stats.reserved, fill: "var(--purple)" },
  ].filter((d) => d.value > 0);

  return (
    <div className="activity-chart-row">
      <div className="activity-chart-wrap">
        <ChartContainer config={activityChartConfig} className="h-[80px] w-[80px]">
          <PieChart accessibilityLayer>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={22}
              outerRadius={36}
              strokeWidth={0}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <ChartTooltip
              content={<ChartTooltipContent hideLabel />}
              cursor={false}
            />
          </PieChart>
        </ChartContainer>
      </div>
      <div className="activity-chart-legend">
        {chartData.map((entry) => (
          <div key={entry.name} className="activity-chart-legend-item">
            <span className="activity-chart-legend-dot" style={{ background: entry.fill }} />
            <span className="activity-chart-legend-label">{entry.label}</span>
            <span className="activity-chart-legend-count">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
