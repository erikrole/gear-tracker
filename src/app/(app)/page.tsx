"use client";

import { useEffect, useState } from "react";
import DonutChart from "@/components/DonutChart";

type DashboardData = {
  items: {
    available: number;
    checkedOut: number;
    maintenance: number;
    retired: number;
    total: number;
  };
  reservations: { booked: number; overdue: number };
  checkouts: { open: number; overdue: number };
  recentReservations: Array<{
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    status: string;
    requester: { name: string };
    location: { name: string };
    _count: { serializedItems: number; bulkItems: number };
  }>;
  recentCheckouts: Array<{
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    status: string;
    requester: { name: string };
    location: { name: string };
    _count: { serializedItems: number; bulkItems: number };
  }>;
  itemsByLocation: Array<{ location: string; count: number }>;
  itemsByType: Array<{ type: string; count: number }>;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((json) => setData(json.data));
  }, []);

  if (!data) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  const itemSegments = [
    { label: "Available", value: data.items.available, color: "#22c55e" },
    { label: "Checked out", value: data.items.checkedOut, color: "#3b82f6" },
    { label: "Maintenance", value: data.items.maintenance, color: "#f59e0b" },
    { label: "Retired", value: data.items.retired, color: "#6b7280" },
  ];

  const typeColors = ["#8b5cf6", "#ec4899", "#3b82f6", "#f59e0b", "#22c55e", "#ef4444"];
  const typeSegments = data.itemsByType.map((t, i) => ({
    label: t.type,
    value: t.count,
    color: typeColors[i % typeColors.length],
  }));

  const locationColors = ["#0ea5c8", "#8b5cf6", "#f59e0b", "#22c55e", "#ec4899"];
  const locationSegments = data.itemsByLocation.map((l, i) => ({
    label: l.location,
    value: l.count,
    color: locationColors[i % locationColors.length],
  }));

  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="dashboard-grid">
        {/* Items by status */}
        <div className="card">
          <div className="card-header">
            <h2>Items by status</h2>
          </div>
          <div className="card-body">
            <DonutChart segments={itemSegments} />
          </div>
        </div>

        {/* Reservations */}
        <div className="card">
          <div className="card-header">
            <h2>Reservations</h2>
          </div>
          <div className="stat-pair">
            <div className="stat-item">
              <div className={`stat-number ${data.reservations.overdue > 0 ? "warn" : ""}`}>
                {data.reservations.overdue}
              </div>
              <div className="stat-label">Overdue</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{data.reservations.booked}</div>
              <div className="stat-label">Booked</div>
            </div>
          </div>
        </div>

        {/* Check-outs */}
        <div className="card">
          <div className="card-header">
            <h2>Check-outs</h2>
          </div>
          <div className="stat-pair">
            <div className="stat-item">
              <div className={`stat-number ${data.checkouts.overdue > 0 ? "warn" : ""}`}>
                {data.checkouts.overdue}
              </div>
              <div className="stat-label">Overdue</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{data.checkouts.open}</div>
              <div className="stat-label">Open</div>
            </div>
          </div>
        </div>

        {/* Open Reservations */}
        <div className="card span-2">
          <div className="card-header">
            <h2>Open reservations</h2>
          </div>
          {data.recentReservations.length === 0 ? (
            <div className="empty-state">No open reservations</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Requester</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentReservations.map((r) => (
                  <tr key={r.id}>
                    <td>{r.title}</td>
                    <td>{r.requester.name}</td>
                    <td>{formatDate(r.startsAt)}</td>
                    <td>{r._count.serializedItems + r._count.bulkItems}</td>
                    <td>
                      <span className={`badge ${r.status === "BOOKED" ? "badge-blue" : "badge-gray"}`}>
                        {r.status.toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Items by location */}
        <div className="card">
          <div className="card-header">
            <h2>Items by location</h2>
          </div>
          <div className="card-body">
            {locationSegments.length > 0 ? (
              <DonutChart segments={locationSegments} />
            ) : (
              <div className="empty-state">No data</div>
            )}
          </div>
        </div>

        {/* Open Check-outs */}
        <div className="card span-2">
          <div className="card-header">
            <h2>Open check-outs</h2>
          </div>
          {data.recentCheckouts.length === 0 ? (
            <div className="empty-state">No open check-outs</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Requester</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentCheckouts.map((c) => (
                  <tr key={c.id}>
                    <td>{c.title}</td>
                    <td>{c.requester.name}</td>
                    <td>{formatDate(c.startsAt)}</td>
                    <td>{c._count.serializedItems + c._count.bulkItems}</td>
                    <td>
                      <span className="badge badge-green">
                        {c.status.toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Items by category/type */}
        <div className="card">
          <div className="card-header">
            <h2>Items by category</h2>
          </div>
          <div className="card-body">
            {typeSegments.length > 0 ? (
              <DonutChart segments={typeSegments} />
            ) : (
              <div className="empty-state">No data</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
