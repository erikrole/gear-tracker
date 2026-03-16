"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

export default function OverdueLeaderboardPage() {
  const [data, setData] = useState<OverdueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/reports?type=overdue")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setData(json?.data ?? null))
      .finally(() => setLoading(false));
  }, []);

  function toggleExpand(userId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!data) return <div className="empty-state">Failed to load report. Please try refreshing the page.</div>;

  return (
    <>
      <div className="summary-grid mb-16">
        <div className="card p-16 text-center">
          <div className="metric-value" style={{ color: data.totalOverdueBookings > 0 ? "var(--red)" : undefined }}>
            {data.totalOverdueBookings}
          </div>
          <div className="text-sm text-muted">Overdue checkouts</div>
        </div>
        <div className="card p-16 text-center">
          <div className="metric-value">{data.leaderboard.length}</div>
          <div className="text-sm text-muted">People with overdue gear</div>
        </div>
      </div>

      {data.leaderboard.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 40 }}>
            No overdue checkouts right now
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h2>Overdue by person</h2>
            <span className="text-sm text-muted">Sorted by total overdue time</span>
          </div>
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
                <>
                  <tr
                    key={entry.userId}
                    style={{ cursor: "pointer" }}
                    onClick={() => toggleExpand(entry.userId)}
                  >
                    <td className="text-muted">{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{entry.name}</td>
                    <td className="text-right">
                      <span className="badge badge-red">{entry.overdueCount}</span>
                    </td>
                    <td className="text-right" style={{ color: "var(--red)", fontWeight: 600 }}>
                      {formatOverdue(entry.totalOverdueHours)}
                    </td>
                    <td className="text-center text-muted">
                      {expanded.has(entry.userId) ? "\u25B2" : "\u25BC"}
                    </td>
                  </tr>
                  {expanded.has(entry.userId) &&
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
