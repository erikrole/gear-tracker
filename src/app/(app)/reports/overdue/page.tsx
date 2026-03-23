"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import EmptyState from "@/components/EmptyState";
import MetricCard from "../MetricCard";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

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
    <div className="report-mobile-card" style={{ flexDirection: "column", gap: 8, cursor: "pointer" }} onClick={onToggle}>
      <div className="report-mobile-top">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="text-muted text-sm">#{rank}</span>
          <span style={{ fontWeight: 600 }}>{entry.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Badge variant="red">{entry.overdueCount}</Badge>
          <span className="text-muted">{expanded ? "\u25B2" : "\u25BC"}</span>
        </div>
      </div>
      <div className="text-sm" style={{ color: "var(--red)", fontWeight: 600 }}>
        {formatOverdue(entry.totalOverdueHours)} total
      </div>
      {expanded && (
        <div style={{ paddingTop: 4 }}>
          {entry.bookings.map((b) => (
            <Link
              key={b.id}
              href={`/checkouts/${b.id}`}
              className="report-mobile-card no-underline"
              style={{ paddingLeft: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <span className="row-link text-sm">{b.title}</span>
                <div className="text-xs text-muted">
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
    `"${e.name}",${e.overdueCount},${e.totalOverdueHours},"${e.bookings.map((b) => b.title).join("; ")}"`
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
  const [data, setData] = useState<OverdueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function loadData() {
    setLoading(true);
    setError(false);
    fetch("/api/reports?type=overdue")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => setData(json ?? null))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  function toggleExpand(userId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  if (loading) {
    return (
      <>
        <div className="summary-grid mb-1">
          {[0, 1].map((i) => (
            <Card key={i} className="p-4 text-center">
              <Skeleton className="skeleton-text-lg mx-auto mb-2 w-[40px]" />
              <Skeleton className="skeleton-text-sm mx-auto w-[100px]" />
            </Card>
          ))}
        </div>
        <Card>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton-row" style={{ padding: "12px 16px" }}>
              <div className="skeleton-lines flex-1">
                <Skeleton className="skeleton-text" style={{ width: `${60 - i * 8}%` }} />
              </div>
            </div>
          ))}
        </Card>
      </>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-4 text-center">
        <p className="text-secondary mb-2">Failed to load overdue report.</p>
        <Button variant="outline" size="sm" onClick={loadData}>Retry</Button>
      </Card>
    );
  }

  return (
    <>
      {data.leaderboard.length > 0 && (
        <div className="flex-center mb-1" style={{ justifyContent: "flex-end" }}>
          <Button variant="outline" size="sm" onClick={() => downloadCsv(data.leaderboard)}>
            Export CSV
          </Button>
        </div>
      )}
      <div className="summary-grid mb-1">
        <MetricCard
          value={data.totalOverdueBookings}
          label="Overdue checkouts"
          color={data.totalOverdueBookings > 0 ? "var(--red)" : undefined}
        />
        <MetricCard value={data.leaderboard.length} label="People with overdue gear" />
      </div>

      {data.leaderboard.length === 0 ? (
        <Card>
          <EmptyState icon="clipboard" title="No overdue checkouts right now" />
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Overdue by person</CardTitle>
            <span className="text-sm text-muted">Sorted by total overdue time</span>
          </CardHeader>

          {/* Desktop table */}
          <div className="hide-mobile-only">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Person</th>
                  <th className="text-right">Overdue checkouts</th>
                  <th className="text-right">Total overdue</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {data.leaderboard.map((entry, i) => (
                  <OverdueTableRows
                    key={entry.userId}
                    entry={entry}
                    rank={i + 1}
                    expanded={expanded.has(entry.userId)}
                    onToggle={() => toggleExpand(entry.userId)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="show-mobile-only">
            {data.leaderboard.map((entry, i) => (
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
    </>
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
      <tr style={{ cursor: "pointer" }} onClick={onToggle}>
        <td className="text-muted">{rank}</td>
        <td style={{ fontWeight: 600 }}>{entry.name}</td>
        <td className="text-right">
          <Badge variant="red">{entry.overdueCount}</Badge>
        </td>
        <td className="text-right" style={{ color: "var(--red)", fontWeight: 600 }}>
          {formatOverdue(entry.totalOverdueHours)}
        </td>
        <td className="text-center text-muted">
          {expanded ? "\u25B2" : "\u25BC"}
        </td>
      </tr>
      {expanded &&
        entry.bookings.map((b) => (
          <tr key={b.id} style={{ background: "var(--bg)" }}>
            <td></td>
            <td colSpan={2} style={{ paddingLeft: 24 }}>
              <Link href={`/checkouts/${b.id}`} className="row-link">
                {b.title}
              </Link>
              <div className="text-sm text-muted">
                {b.location} &middot; {b.itemCount} item{b.itemCount !== 1 ? "s" : ""}
                {b.items.length > 0 && `: ${b.items.join(", ")}`}
              </div>
            </td>
            <td className="text-right text-sm" style={{ color: "var(--red)" }}>
              {formatOverdue(b.overdueHours)} overdue
            </td>
            <td></td>
          </tr>
        ))}
    </>
  );
}
