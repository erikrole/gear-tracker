"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDateFull } from "@/lib/format";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import MetricCard from "../MetricCard";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type CheckoutRow = {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  requester: string;
  location: string;
  itemCount: number;
  isOverdue: boolean;
};

type CheckoutData = {
  days: number;
  totalCheckouts: number;
  overdueCheckouts: number;
  recentCheckouts: CheckoutRow[];
  topRequesters: { name: string; count: number }[];
};

function StatusBadge({ status, isOverdue }: { status: string; isOverdue: boolean }) {
  const cls = isOverdue ? "badge-red" : status === "OPEN" ? "badge-green" : "badge-gray";
  return <span className={`badge ${cls}`}>{isOverdue ? "overdue" : status.toLowerCase()}</span>;
}

function CheckoutMobileCard({ c }: { c: CheckoutRow }) {
  return (
    <Link href={`/checkouts/${c.id}`} className="report-mobile-card no-underline">
      <div className="report-mobile-top">
        <span className="row-link">{c.title}</span>
        <StatusBadge status={c.status} isOverdue={c.isOverdue} />
      </div>
      <div className="text-sm text-muted">
        {c.requester} &middot; {c.itemCount} item{c.itemCount !== 1 ? "s" : ""} &middot; Due {formatDateFull(c.endsAt)}
      </div>
    </Link>
  );
}

function downloadCsv(rows: CheckoutRow[]) {
  const header = "Title,Requester,Status,Due,Items,Overdue\n";
  const csv = rows.map((c) =>
    `"${c.title}","${c.requester}","${c.status}","${c.endsAt}",${c.itemCount},${c.isOverdue}`
  ).join("\n");
  const blob = new Blob([header + csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `checkouts-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CheckoutsReportPage() {
  const [data, setData] = useState<CheckoutData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/reports?type=checkouts&days=${days}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => setData(json?.data ?? null))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <>
        <div className="summary-grid mb-16">
          <Card className="p-16 text-center">
            <div className="skeleton skeleton-text-lg" style={{ width: 40, margin: "0 auto 8px" }} />
            <div className="skeleton skeleton-text-sm" style={{ width: 80, margin: "0 auto" }} />
          </Card>
          <Card className="p-16 text-center">
            <div className="skeleton skeleton-text-lg" style={{ width: 40, margin: "0 auto 8px" }} />
            <div className="skeleton skeleton-text-sm" style={{ width: 80, margin: "0 auto" }} />
          </Card>
        </div>
        <div className="grid-2col gap-16">
          <Card><SkeletonTable rows={5} cols={5} /></Card>
          <Card><SkeletonTable rows={5} cols={2} /></Card>
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-16 text-center">
        <p className="text-secondary mb-8">Failed to load checkout report.</p>
        <Button variant="outline" size="sm" onClick={() => { setError(false); setLoading(true); }}>Retry</Button>
      </Card>
    );
  }

  return (
    <>
      {/* Period selector */}
      <div className="flex-center gap-12 mb-16" style={{ flexWrap: "wrap" }}>
        <span className="text-sm text-muted">Period:</span>
        {[7, 30, 90].map((d) => (
          <Button
            key={d}
            variant={days === d ? "default" : "outline"} size="sm"
            onClick={() => setDays(d)}
          >
            {d}d
          </Button>
        ))}
        {data.recentCheckouts.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => downloadCsv(data.recentCheckouts)} style={{ marginLeft: "auto" }}>
            Export CSV
          </Button>
        )}
      </div>

      {/* Summary metrics */}
      <div className="summary-grid mb-16">
        <MetricCard value={data.totalCheckouts} label={`Checkouts (${days}d)`} />
        <MetricCard
          value={data.overdueCheckouts}
          label="Currently overdue"
          color={data.overdueCheckouts > 0 ? "var(--red)" : undefined}
        />
      </div>

      <div className="grid-2col gap-16">
        {/* Recent checkouts */}
        <div className="card">
          <div className="card-header"><h2>Recent checkouts</h2></div>
          {data.recentCheckouts.length === 0 ? (
            <EmptyState icon="clipboard" title="No checkouts in this period" />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hide-mobile-only">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Requester</th>
                      <th className="hide-mobile">Due</th>
                      <th className="hide-mobile">Items</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentCheckouts.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link href={`/checkouts/${c.id}`} className="row-link">{c.title}</Link>
                        </td>
                        <td>{c.requester}</td>
                        <td className="hide-mobile">{formatDateFull(c.endsAt)}</td>
                        <td className="hide-mobile">{c.itemCount}</td>
                        <td><StatusBadge status={c.status} isOverdue={c.isOverdue} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="show-mobile-only">
                {data.recentCheckouts.map((c) => (
                  <CheckoutMobileCard key={c.id} c={c} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Top requesters */}
        <div className="card">
          <div className="card-header"><h2>Top requesters</h2></div>
          {data.topRequesters.length === 0 ? (
            <EmptyState icon="users" title="No data" />
          ) : (
            <>
              <div className="hide-mobile-only">
                <table className="data-table">
                  <thead><tr><th>Name</th><th className="text-right">Checkouts</th></tr></thead>
                  <tbody>
                    {data.topRequesters.map((r) => (
                      <tr key={r.name}>
                        <td>{r.name}</td>
                        <td className="text-right">{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="show-mobile-only">
                {data.topRequesters.map((r) => (
                  <div key={r.name} className="report-mobile-card">
                    <span>{r.name}</span>
                    <span className="text-muted">{r.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
