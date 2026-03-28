"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  RadialBarChart, RadialBar, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { InsightsData, WindowKey } from "./types";

/* ── Chart Configs ──────────────────────────────────────── */

const monthlyConfig: ChartConfig = {
  checkouts: { label: "Checkouts", color: "hsl(220 70% 55%)" },
  reservations: { label: "Reservations", color: "hsl(270 60% 60%)" },
};

const kindConfig: ChartConfig = {
  CHECKOUT: { label: "Checkouts", color: "hsl(220 70% 55%)" },
  RESERVATION: { label: "Reservations", color: "hsl(270 60% 60%)" },
};

const punctualityConfig: ChartConfig = {
  onTime: { label: "On Time", color: "hsl(142 60% 45%)" },
  late: { label: "Late", color: "hsl(25 90% 55%)" },
};

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SPORT_COLORS = [
  "hsl(220 70% 55%)",
  "hsl(270 60% 60%)",
  "hsl(142 60% 45%)",
  "hsl(25 90% 55%)",
  "hsl(340 70% 55%)",
  "hsl(180 50% 45%)",
  "hsl(45 80% 50%)",
];

const KIND_COLORS = { CHECKOUT: "hsl(220 70% 55%)", RESERVATION: "hsl(270 60% 60%)" };

/* ── Utility ────────────────────────────────────────────── */

function formatMonthLabel(ym: unknown) {
  if (typeof ym !== "string") return String(ym);
  const [year, month] = ym.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

/* ── Big Number Card ────────────────────────────────────── */

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-6">
        <div className="text-4xl font-bold tabular-nums">{value}</div>
        {subtitle && <div className="text-sm text-muted-foreground mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}

/* ── Main Component ─────────────────────────────────────── */

export default function ItemInsightsTab({ assetId }: { assetId: string }) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [window, setWindow] = useState<WindowKey>("90d");

  const loadInsights = useCallback(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/assets/${assetId}/insights`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((json) => { if (json?.data) setData(json.data); else setError(true); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [assetId]);

  useEffect(() => { loadInsights(); }, [loadInsights]);

  if (loading) {
    return <div className="flex items-center justify-center py-10"><Spinner className="size-8" /></div>;
  }

  if (error || !data) {
    return (
      <Empty className="py-8 mt-3.5">
        <AlertTriangle className="size-8 text-muted-foreground opacity-50 mx-auto mb-2" />
        <EmptyDescription>Failed to load insights.</EmptyDescription>
        <Button variant="outline" size="sm" className="mt-3" onClick={loadInsights}>
          Retry
        </Button>
      </Empty>
    );
  }

  const stats = data[window];

  const allHasData = data.all.totalBookings > 0;

  if (!allHasData) {
    return (
      <div className="mt-3.5">
        <Empty className="py-3">
          <EmptyDescription>No booking history yet. Insights will appear after this item is checked out or reserved.</EmptyDescription>
        </Empty>
      </div>
    );
  }

  if (stats.totalBookings === 0) {
    return (
      <div className="mt-3.5">
        {/* Time window toggle */}
        <div className="flex justify-end mb-1">
          <ToggleGroup type="single" value={window} onValueChange={(v) => v && setWindow(v as WindowKey)}>
            <ToggleGroupItem value="30d">30d</ToggleGroupItem>
            <ToggleGroupItem value="90d">90d</ToggleGroupItem>
            <ToggleGroupItem value="1yr">1yr</ToggleGroupItem>
            <ToggleGroupItem value="all">All</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <Empty className="py-3">
          <EmptyDescription>No bookings in this time window. Try a longer period or switch to &ldquo;All&rdquo;.</EmptyDescription>
        </Empty>
      </div>
    );
  }

  // Prepare chart data
  const dayOfWeekData = stats.byDayOfWeek.map((count, i) => ({
    day: dayLabels[i],
    count,
  }));

  const kindData = [
    { name: "CHECKOUT", value: stats.byKind.CHECKOUT },
    { name: "RESERVATION", value: stats.byKind.RESERVATION },
  ].filter((d) => d.value > 0);

  const punctualityData = [
    { name: "onTime", value: stats.punctuality.onTime },
    { name: "late", value: stats.punctuality.late },
  ];
  const punctualityTotal = stats.punctuality.onTime + stats.punctuality.late;

  const sportConfig: ChartConfig = Object.fromEntries(
    stats.bySport.map((s, i) => [s.sport, { label: s.sport, color: SPORT_COLORS[i % SPORT_COLORS.length] }])
  );

  const borrowerConfig: ChartConfig = Object.fromEntries(
    stats.topBorrowers.map((b, i) => [b.name, { label: b.name, color: SPORT_COLORS[i % SPORT_COLORS.length] }])
  );

  const gaugeData = [{ name: "utilization", value: stats.utilizationPct, fill: "hsl(220 70% 55%)" }];

  const dayOfWeekConfig: ChartConfig = {
    count: { label: "Bookings", color: "hsl(220 70% 55%)" },
  };

  return (
    <div className="mt-3.5">
      {/* Time window toggle */}
      <div className="flex justify-end mb-1">
        <ToggleGroup type="single" value={window} onValueChange={(v) => v && setWindow(v as WindowKey)}>
          <ToggleGroupItem value="30d">30d</ToggleGroupItem>
          <ToggleGroupItem value="90d">90d</ToggleGroupItem>
          <ToggleGroupItem value="1yr">1yr</ToggleGroupItem>
          <ToggleGroupItem value="all">All</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-1">

        {/* 1. Utilization Rate — Radial Gauge */}
        <Card>
          <CardHeader><CardTitle>Utilization Rate</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={{ utilization: { label: "Utilization", color: "hsl(220 70% 55%)" } }} className="mx-auto aspect-square max-h-[200px]">
              <RadialBarChart
                data={gaugeData}
                startAngle={180}
                endAngle={0}
                innerRadius="60%"
                outerRadius="90%"
              >
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar dataKey="value" cornerRadius={6} background angleAxisId={0} />
              </RadialBarChart>
            </ChartContainer>
            <div className="text-center -mt-2">
              <div className="text-3xl font-bold tabular-nums">{stats.utilizationPct}%</div>
              <div className="text-sm text-muted-foreground">
                {stats.totalBookings} booking{stats.totalBookings !== 1 ? "s" : ""} in period
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Bookings by Month — Area Chart */}
        <Card>
          <CardHeader><CardTitle>Bookings by Month</CardTitle></CardHeader>
          <CardContent>
            {stats.monthly.length > 0 ? (
              <ChartContainer config={monthlyConfig} className="min-h-[200px]">
                <AreaChart data={stats.monthly}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickFormatter={formatMonthLabel} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={formatMonthLabel} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Area type="monotone" dataKey="checkouts" stackId="1" stroke="var(--color-checkouts)" fill="var(--color-checkouts)" fillOpacity={0.4} />
                  <Area type="monotone" dataKey="reservations" stackId="1" stroke="var(--color-reservations)" fill="var(--color-reservations)" fillOpacity={0.4} />
                </AreaChart>
              </ChartContainer>
            ) : (
              <Empty className="py-8 border-0"><EmptyDescription>No data in this period</EmptyDescription></Empty>
            )}
          </CardContent>
        </Card>

        {/* 3. By Sport — Horizontal Bar */}
        <Card>
          <CardHeader><CardTitle>Usage by Sport</CardTitle></CardHeader>
          <CardContent>
            {stats.bySport.length > 0 ? (
              <ChartContainer config={sportConfig} className="min-h-[200px]">
                <BarChart data={stats.bySport} layout="vertical">
                  <CartesianGrid horizontal={false} />
                  <YAxis dataKey="sport" type="category" tickLine={false} axisLine={false} width={80} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent nameKey="sport" />} />
                  <Bar dataKey="days" radius={[0, 4, 4, 0]}>
                    {stats.bySport.map((entry, i) => (
                      <Cell key={entry.sport} fill={SPORT_COLORS[i % SPORT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <Empty className="py-8 border-0"><EmptyDescription>No sport data</EmptyDescription></Empty>
            )}
          </CardContent>
        </Card>

        {/* 4. Top Borrowers — Horizontal Bar */}
        <Card>
          <CardHeader><CardTitle>Top Borrowers</CardTitle></CardHeader>
          <CardContent>
            {stats.topBorrowers.length > 0 ? (
              <ChartContainer config={borrowerConfig} className="min-h-[200px]">
                <BarChart data={stats.topBorrowers} layout="vertical">
                  <CartesianGrid horizontal={false} />
                  <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={90} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {stats.topBorrowers.map((entry, i) => (
                      <Cell key={entry.name} fill={SPORT_COLORS[i % SPORT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <Empty className="py-8 border-0"><EmptyDescription>No data</EmptyDescription></Empty>
            )}
          </CardContent>
        </Card>

        {/* 5. Checkout vs Reservation — Donut */}
        <Card>
          <CardHeader><CardTitle>Checkout vs Reservation</CardTitle></CardHeader>
          <CardContent>
            {kindData.length > 0 ? (
              <ChartContainer config={kindConfig} className="mx-auto aspect-square max-h-[200px]">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                  <Pie data={kindData} dataKey="value" nameKey="name" innerRadius="50%" outerRadius="80%" paddingAngle={3}>
                    {kindData.map((d) => (
                      <Cell key={d.name} fill={KIND_COLORS[d.name as keyof typeof KIND_COLORS]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : (
              <Empty className="py-8 border-0"><EmptyDescription>No data</EmptyDescription></Empty>
            )}
          </CardContent>
        </Card>

        {/* 6. Day-of-Week Demand — Vertical Bar */}
        <Card>
          <CardHeader><CardTitle>Day-of-Week Demand</CardTitle></CardHeader>
          <CardContent>
            {stats.totalBookings > 0 ? (
              <ChartContainer config={dayOfWeekConfig} className="min-h-[200px]">
                <BarChart data={dayOfWeekData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <Empty className="py-8 border-0"><EmptyDescription>No data</EmptyDescription></Empty>
            )}
          </CardContent>
        </Card>

        {/* 7. Return Punctuality — Stacked Bar */}
        <Card>
          <CardHeader><CardTitle>Return Punctuality</CardTitle></CardHeader>
          <CardContent>
            {punctualityTotal > 0 ? (
              <>
                <ChartContainer config={punctualityConfig} className="min-h-[100px] max-h-[100px]">
                  <BarChart data={[{ name: "Returns", ...stats.punctuality }]} layout="vertical">
                    <YAxis dataKey="name" type="category" hide />
                    <XAxis type="number" hide />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="onTime" stackId="a" fill="var(--color-onTime)" radius={[4, 0, 0, 4]} />
                    <Bar dataKey="late" stackId="a" fill="var(--color-late)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
                <div className="text-center text-sm text-muted-foreground mt-2">
                  {stats.punctuality.onTime} on time · {stats.punctuality.late} late
                  {punctualityTotal > 0 && (
                    <> · {Math.round((stats.punctuality.onTime / punctualityTotal) * 100)}% on-time rate</>
                  )}
                </div>
              </>
            ) : (
              <Empty className="py-8 border-0"><EmptyDescription>No completed checkouts</EmptyDescription></Empty>
            )}
          </CardContent>
        </Card>

        {/* 8. Avg Checkout Duration — Big Number */}
        <StatCard
          title="Avg Checkout Duration"
          value={stats.avgDurationDays > 0 ? `${stats.avgDurationDays}d` : "\u2014"}
          subtitle={stats.longestDurationDays > 0 ? `Longest: ${stats.longestDurationDays}d` : undefined}
        />

        {/* 9. Cost Per Use — Big Number */}
        <StatCard
          title="Cost Per Use"
          value={stats.costPerUse != null ? `$${stats.costPerUse.toFixed(2)}` : "\u2014"}
          subtitle={stats.costPerUse != null ? `${data.all.totalBookings} total uses` : "No purchase price set"}
        />

        {/* 10. Idle Streak & Age — Big Number Pair */}
        <Card>
          <CardHeader><CardTitle>Item Health</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-1 text-center py-4">
              <div>
                <div className="text-3xl font-bold tabular-nums">
                  {stats.idleStreakDays != null ? `${stats.idleStreakDays}d` : "\u2014"}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Idle streak</div>
              </div>
              <div>
                <div className="text-3xl font-bold tabular-nums">
                  {stats.ageDays != null ? `${stats.ageDays}d` : "\u2014"}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Item age</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
