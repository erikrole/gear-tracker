"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import EmptyState from "@/components/EmptyState";
import MetricCard from "../MetricCard";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";
import { FadeUp } from "@/components/ui/motion";
import { useFetch } from "@/hooks/use-fetch";
import { formatRelativeTime } from "@/lib/format";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BarChart, Bar, Cell, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

type OverdueBooking = {
  id: string;
  title: string;
  endsAt: string;
  overdueHours: number;
  location: string;
  itemCount: number;
  items: string[];
};

type LeaderboardEntry = {
  userId: string;
  name: string;
  overdueCount: number;
  totalOverdueHours: number;
  bookings: OverdueBooking[];
};

type OverdueData = {
  totalOverdueBookings: number;
  leaderboard: LeaderboardEntry[];
};

function formatOverdue(hours: number): string {
  if (hours < 1) return "<1h";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

function LeaderboardMobileCard({
  entry,
  rank,
  expanded,
  onToggle,
}: {
  entry: LeaderboardEntry;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 border-b last:border-b-0 cursor-pointer" onClick={onToggle}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">#{rank}</span>
          <span className="font-semibold">{entry.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="red">{entry.overdueCount}</Badge>
          <span className="text-muted-foreground">{expanded ? "\u25B2" : "\u25BC"}</span>
        </div>
      </div>
      <div className="text-sm font-semibold" style={{ color: "var(--red)" }}>
        {formatOverdue(entry.totalOverdueHours)} total
      </div>
      {expanded && (
        <div className="pt-1">
          {(entry.bookings ?? []).map((b) => (
            <Link
              key={b.id}
              href={`/checkouts/${b.id}`}
              className="flex items-center justify-between py-2 no-underline"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <span className="text-foreground font-medium text-sm hover:underline">{b.title}</span>
                <div className="text-xs text-muted-foreground">
                  {b.location} &middot; {b.itemCount} item{b.itemCount !== 1 ? "s" : ""}
                  {b.items.length > 0 && `: ${b.items.join(", ")}`}
                </div>
              </div>
              <span className="text-xs" style={{ color: "var(--red)" }}>
                {formatOverdue(b.overdueHours)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function downloadCsv(leaderboard: LeaderboardEntry[]) {
  const header = "Person,Overdue Checkouts,Total Overdue Hours,Bookings\n";
  const rows = leaderboard.map((e) =>
    `"${e.name}",${e.overdueCount},${e.totalOverdueHours},"${(e.bookings ?? []).map((b) => b.title).join("; ")}"`
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `overdue-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function OverdueLeaderboardPage() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { data, loading, error, lastRefreshed, reload } = useFetch<OverdueData>({
    url: "/api/reports?type=overdue",
    transform: (json) => json as unknown as OverdueData,
  });

  function toggleExpand(userId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  if (loading && !data) {
    return (
      <>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 mb-1">
          {[0, 1].map((i) => (
            <Card key={i} className="p-4 text-center">
              <Skeleton className="h-8 mx-auto mb-2 w-[40px]" />
              <Skeleton className="h-4 mx-auto w-[100px]" />
            </Card>
          ))}
        </div>
        <Card className="p-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex gap-4 py-3">
              <Skeleton className="h-4" style={{ width: `${60 - i * 8}%` }} />
              <Skeleton className="h-4 w-12 ml-auto" />
            </div>
          ))}
        </Card>
      </>
    );
  }

  if (error && !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Failed to load overdue report</AlertTitle>
        <AlertDescription className="flex items-center gap-3">
          <span>{error === "network" ? "You appear to be offline. Check your connection and try again." : "Unable to load overdue report. Please try again."}</span>
          <Button variant="outline" size="sm" onClick={reload}>Retry</Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  const leaderboard = data.leaderboard ?? [];

  return (
    <FadeUp>
      <div className="flex items-center mb-1 justify-end gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" onClick={reload}>
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {lastRefreshed ? `Updated ${formatRelativeTime(lastRefreshed.toISOString(), now)}` : "Refresh"}
          </TooltipContent>
        </Tooltip>
        {leaderboard.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => downloadCsv(leaderboard)}>
            Export CSV
          </Button>
        )}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 mb-1">
        <MetricCard
          value={data.totalOverdueBookings}
          label="Overdue checkouts"
          color={data.totalOverdueBookings > 0 ? "var(--red)" : undefined}
          tooltip="Checkouts currently past their return date"
          href="/checkouts?status=overdue"
        />
        <MetricCard value={leaderboard.length} label="People with overdue gear" tooltip="Number of people with at least one overdue checkout" href="/users" />
      </div>

      {/* Overdue hours bar chart */}
      {leaderboard.length > 0 && (
        <Card className="mb-2.5">
          <CardHeader><CardTitle>Overdue hours by person</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={{ hours: { label: "Overdue hours", color: "hsl(0 70% 55%)" } }} className="w-full" style={{ height: Math.max(150, leaderboard.length * 36) }}>
              <BarChart data={leaderboard.slice(0, 10).map((e) => ({ name: e.name, hours: e.totalOverdueHours }))} layout="vertical" margin={{ left: 0, right: 12 }}>
                <YAxis dataKey="name" type="category" width={100} tickLine={false} axisLine={false} className="text-xs" />
                <XAxis type="number" hide />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="hours" name="Overdue hours" radius={[0, 4, 4, 0]}>
                  {leaderboard.slice(0, 10).map((_, i) => (
                    <Cell key={i} fill={`hsl(0 ${70 - i * 4}% ${45 + i * 3}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {leaderboard.length === 0 ? (
        <Card>
          <EmptyState icon="clipboard" title="No overdue checkouts right now" />
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Overdue by person</CardTitle>
            <span className="text-sm text-muted-foreground">Sorted by total overdue time</span>
          </CardHeader>

          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Person</TableHead>
                  <TableHead className="text-right">Overdue checkouts</TableHead>
                  <TableHead className="text-right">Total overdue</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((entry, i) => (
                  <OverdueTableRows
                    key={entry.userId}
                    entry={entry}
                    rank={i + 1}
                    expanded={expanded.has(entry.userId)}
                    onToggle={() => toggleExpand(entry.userId)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden">
            {leaderboard.map((entry, i) => (
              <LeaderboardMobileCard
                key={entry.userId}
                entry={entry}
                rank={i + 1}
                expanded={expanded.has(entry.userId)}
                onToggle={() => toggleExpand(entry.userId)}
              />
            ))}
          </div>
        </Card>
      )}
    </FadeUp>
  );
}

function OverdueTableRows({
  entry,
  rank,
  expanded,
  onToggle,
}: {
  entry: LeaderboardEntry;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell className="text-muted-foreground">{rank}</TableCell>
        <TableCell className="font-semibold">{entry.name}</TableCell>
        <TableCell className="text-right">
          <Badge variant="red">{entry.overdueCount}</Badge>
        </TableCell>
        <TableCell className="text-right font-semibold" style={{ color: "var(--red)" }}>
          {formatOverdue(entry.totalOverdueHours)}
        </TableCell>
        <TableCell className="text-center text-muted-foreground">
          {expanded ? "\u25B2" : "\u25BC"}
        </TableCell>
      </TableRow>
      {expanded &&
        (entry.bookings ?? []).map((b) => (
          <TableRow key={b.id} className="bg-muted/30">
            <TableCell></TableCell>
            <TableCell colSpan={2} className="pl-6">
              <Link href={`/checkouts/${b.id}`} className="text-foreground font-medium hover:underline">
                {b.title}
              </Link>
              <div className="text-sm text-muted-foreground">
                {b.location} &middot; {b.itemCount} item{b.itemCount !== 1 ? "s" : ""}
                {b.items.length > 0 && `: ${b.items.join(", ")}`}
              </div>
            </TableCell>
            <TableCell className="text-right text-sm" style={{ color: "var(--red)" }}>
              {formatOverdue(b.overdueHours)} overdue
            </TableCell>
            <TableCell></TableCell>
          </TableRow>
        ))}
    </>
  );
}
