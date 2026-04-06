"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const scanConfig: ChartConfig = {
  success: { label: "Success", color: "hsl(142 60% 45%)" },
  fail: { label: "Failed", color: "hsl(0 72% 51%)" },
};

function formatDateLabel(dateStr: unknown) {
  if (typeof dateStr !== "string") return String(dateStr);
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function DailyScanVolumeChart({
  dailyScans,
}: {
  dailyScans: { date: string; success: number; fail: number }[];
}) {
  if (dailyScans.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily scan volume</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={scanConfig} className="w-full h-[220px]">
          <BarChart
            data={dailyScans}
            margin={{ left: 0, right: 12, top: 4, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-border"
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              className="text-xs"
              tickFormatter={formatDateLabel}
              interval={Math.max(
                0,
                Math.floor(dailyScans.length / 7) - 1
              )}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              className="text-xs"
              width={30}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="success"
              name="Success"
              stackId="scans"
              fill="hsl(142 60% 45%)"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="fail"
              name="Failed"
              stackId="scans"
              fill="hsl(0 72% 51%)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
