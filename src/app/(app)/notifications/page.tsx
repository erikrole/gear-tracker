"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  channel: string;
  payload: Record<string, string> | null;
  readAt: string | null;
  sentAt: string;
  createdAt: string;
};

type NotificationsResponse = {
  data: Notification[];
  total: number;
  limit: number;
  offset: number;
  unreadCount: number;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const limit = 20;

  async function reload() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));
    if (unreadOnly) params.set("unread", "true");

    const res = await fetch(`/api/notifications?${params}`);
    const json: NotificationsResponse = await res.json();
    setNotifications(json.data);
    setTotal(json.total);
    setUnreadCount(json.unreadCount);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [page, unreadOnly]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" })
    });
    await reload();
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", id })
    });
    await reload();
  }

  async function runProcessing() {
    setProcessing(true);
    try {
      const res = await fetch("/api/notifications/process", { method: "POST" });
      if (res.ok) {
        await reload();
      }
    } finally {
      setProcessing(false);
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const hours = Math.floor(diffMs / 3600_000);
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <div className="page-header">
        <h1>
          Notifications
          {unreadCount > 0 && (
            <span
              className="badge badge-blue"
              style={{ marginLeft: 8, fontSize: 13, verticalAlign: "middle" }}
            >
              {unreadCount} unread
            </span>
          )}
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-sm"
            onClick={runProcessing}
            disabled={processing}
          >
            {processing ? "Processing..." : "Check overdue"}
          </button>
          {unreadCount > 0 && (
            <button className="btn btn-sm" onClick={markAllRead}>
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => {
                setUnreadOnly(e.target.checked);
                setPage(0);
              }}
            />
            Unread only
          </label>
          <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>
            {total} notification{total !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="loading-spinner">
            <div className="spinner" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            {unreadOnly ? "No unread notifications" : "No notifications yet"}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {notifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    background: n.readAt ? "transparent" : "var(--bg-highlight, rgba(59,130,246,0.04))"
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: n.readAt ? "transparent" : "var(--blue, #3b82f6)",
                      marginTop: 6,
                      flexShrink: 0
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: n.readAt ? 400 : 600, fontSize: 14 }}>
                        {n.title}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {formatTime(n.sentAt)}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                      {n.body}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      {n.payload?.bookingId && (
                        <Link
                          href={`/checkouts/${n.payload.bookingId}`}
                          className="btn btn-sm"
                          style={{ fontSize: 12 }}
                        >
                          View checkout
                        </Link>
                      )}
                      {!n.readAt && (
                        <button
                          className="btn btn-sm"
                          style={{ fontSize: 12 }}
                          onClick={() => markRead(n.id)}
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="pagination">
                <span>
                  Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of{" "}
                  {total}
                </span>
                <div className="pagination-btns">
                  <button
                    className="btn btn-sm"
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </button>
                  <button
                    className="btn btn-sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
