"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDateFull } from "@/lib/format";

type UtilizationData = {
  totalAssets: number;
  statusCounts: Record<string, number>;
  byLocation: { location: string; count: number }[];
  byType: { type: string; count: number }[];
  byDepartment: { department: string; count: number }[];
};

type CheckoutData = {
  days: number;
  totalCheckouts: number;
  overdueCheckouts: number;
  recentCheckouts: {
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
  }[];
  topRequesters: { name: string; count: number }[];
};

type AuditData = {
  data: {
    id: string;
    actor: string;
    entityType: string;
    entityId: string;
    action: string;
    createdAt: string;
  }[];
  total: number;
  limit: number;
  offset: number;
};

type ReportTab = "utilization" | "checkouts" | "audit";

const statusLabel: Record<string, string> = {
  AVAILABLE: "Available",
  CHECKED_OUT: "Checked out",
  RESERVED: "Reserved",
  MAINTENANCE: "Maintenance",
  RETIRED: "Retired",
};

const statusBadge: Record<string, string> = {
  AVAILABLE: "badge-green",
  CHECKED_OUT: "badge-blue",
  RESERVED: "badge-purple",
  MAINTENANCE: "badge-orange",
  RETIRED: "badge-gray",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>("utilization");
  const [utilization, setUtilization] = useState<UtilizationData | null>(null);
  const [checkouts, setCheckouts] = useState<CheckoutData | null>(null);
  const [audit, setAudit] = useState<AuditData | null>(null);
  const [days, setDays] = useState(30);
  const [auditPage, setAuditPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const auditLimit = 25;

  useEffect(() => {
    setLoading(true);
    const load = async () => {
      try {
        let url = "/api/reports?type=utilization";
        if (tab === "checkouts") url = `/api/reports?type=checkouts&days=${days}`;
        else if (tab === "audit") url = `/api/reports?type=audit&limit=${auditLimit}&offset=${auditPage * auditLimit}`;
        const r = await fetch(url);
        if (!r.ok) { setLoading(false); return; }
        const json = await r.json();
        if (tab === "utilization") setUtilization(json.data ?? null);
        else if (tab === "checkouts") setCheckouts(json.data ?? null);
        else if (tab === "audit") setAudit(json.data ?? null);
      } catch { /* network error */ }
      setLoading(false);
    };
    load();
  }, [tab, days, auditPage]);

  return (
    <>
      <div className="page-header">
        <h1>Reports</h1>
      </div>

      <div className="flex gap-8 mb-16">
        {(["utilization", "checkouts", "audit"] as ReportTab[]).map((t) => (
          <button
            key={t}
            className={`btn btn-sm${tab === t ? " btn-primary" : ""}`}
            onClick={() => { setTab(t); setLoading(true); }}
          >
            {t === "utilization" ? "Equipment Utilization" : t === "checkouts" ? "Checkout Activity" : "Audit Trail"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : tab === "utilization" && utilization ? (
        <UtilizationReport data={utilization} />
      ) : tab === "checkouts" && checkouts ? (
        <CheckoutReport data={checkouts} days={days} onDaysChange={setDays} />
      ) : tab === "audit" && audit ? (
        <AuditReport data={audit} page={auditPage} limit={auditLimit} onPageChange={setAuditPage} />
      ) : null}
    </>
  );
}

function UtilizationReport({ data }: { data: UtilizationData }) {
  return (
    <>
      <div className="stat-grid mb-16">
        {Object.entries(data.statusCounts).map(([status, count]) => (
          <div key={status} className="card stat-card">
            <div className="stat-card-value">{count}</div>
            <div className="stat-card-label">
              <span className={`badge ${statusBadge[status] || "badge-gray"}`}>
                {statusLabel[status] || status}
              </span>
            </div>
          </div>
        ))}
        <div className="card stat-card">
          <div className="stat-card-value">{data.totalAssets}</div>
          <div className="stat-card-label">Total assets</div>
        </div>
      </div>

      <div className="report-grid">
        <div className="card">
          <div className="card-header"><h2>By location</h2></div>
          {data.byLocation.length === 0 ? (
            <div className="empty-state">No data</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Location</th><th className="text-right">Count</th></tr></thead>
              <tbody>
                {data.byLocation.map((r) => (
                  <tr key={r.location}><td>{r.location}</td><td className="text-right">{r.count}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-header"><h2>By type</h2></div>
          {data.byType.length === 0 ? (
            <div className="empty-state">No data</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Type</th><th className="text-right">Count</th></tr></thead>
              <tbody>
                {data.byType.map((r) => (
                  <tr key={r.type}><td>{r.type}</td><td className="text-right">{r.count}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {data.byDepartment.length > 0 && (
          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <div className="card-header"><h2>By department</h2></div>
            <table className="data-table">
              <thead><tr><th>Department</th><th className="text-right">Count</th></tr></thead>
              <tbody>
                {data.byDepartment.map((r) => (
                  <tr key={r.department}><td>{r.department}</td><td className="text-right">{r.count}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function CheckoutReport({ data, days, onDaysChange }: { data: CheckoutData; days: number; onDaysChange: (d: number) => void }) {
  return (
    <>
      <div className="flex-center gap-12 mb-16">
        <span className="count-label" style={{ marginLeft: 0 }}>Period:</span>
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            className={`btn btn-sm${days === d ? " btn-primary" : ""}`}
            onClick={() => onDaysChange(d)}
          >
            {d}d
          </button>
        ))}
      </div>

      <div className="stat-grid mb-16">
        <div className="card stat-card">
          <div className="stat-card-value">{data.totalCheckouts}</div>
          <div className="stat-card-label">Checkouts ({days}d)</div>
        </div>
        <div className="card stat-card">
          <div className={`stat-card-value${data.overdueCheckouts > 0 ? " text-red" : ""}`}>
            {data.overdueCheckouts}
          </div>
          <div className="stat-card-label">Currently overdue</div>
        </div>
      </div>

      <div className="report-grid-wide">
        <div className="card">
          <div className="card-header"><h2>Recent checkouts</h2></div>
          {data.recentCheckouts.length === 0 ? (
            <div className="empty-state">No checkouts in this period</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Requester</th>
                  <th>Due</th>
                  <th>Items</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentCheckouts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/checkouts/${c.id}`} className="row-link">
                        {c.title}
                      </Link>
                    </td>
                    <td>{c.requester}</td>
                    <td>{formatDateFull(c.endsAt)}</td>
                    <td>{c.itemCount}</td>
                    <td>
                      <span className={`badge ${c.isOverdue ? "badge-red" : c.status === "OPEN" ? "badge-green" : "badge-gray"}`}>
                        {c.isOverdue ? "overdue" : c.status.toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-header"><h2>Top requesters</h2></div>
          {data.topRequesters.length === 0 ? (
            <div className="empty-state">No data</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Name</th><th className="text-right">Checkouts</th></tr></thead>
              <tbody>
                {data.topRequesters.map((r) => (
                  <tr key={r.name}><td>{r.name}</td><td className="text-right">{r.count}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

function AuditReport({ data, page, limit, onPageChange }: { data: AuditData; page: number; limit: number; onPageChange: (p: number) => void }) {
  const totalPages = Math.ceil(data.total / limit);

  return (
    <div className="card">
      <div className="card-header">
        <h2>Audit trail</h2>
        <span className="count-label">{data.total} entries</span>
      </div>
      {data.data.length === 0 ? (
        <div className="empty-state">No audit log entries</div>
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((entry) => (
                <tr key={entry.id}>
                  <td className="text-xs" style={{ whiteSpace: "nowrap" }}>{formatDateTime(entry.createdAt)}</td>
                  <td>{entry.actor}</td>
                  <td>
                    <span className="badge badge-gray">{entry.action}</span>
                  </td>
                  <td className="text-xs font-mono">
                    {entry.entityType}:{entry.entityId.slice(0, 8)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="pagination">
              <span>Page {page + 1} of {totalPages}</span>
              <div className="pagination-btns">
                <button className="btn btn-sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}>Previous</button>
                <button className="btn btn-sm" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
