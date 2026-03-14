"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";

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
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const limit = 20;

  async function reload() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));
    if (unreadOnly) params.set("unread", "true");

    try {
      const res = await fetch(`/api/notifications?${params}`);
      if (res.ok) {
        const json: NotificationsResponse = await res.json();
        setNotifications(json.data ?? []);
        setTotal(json.total ?? 0);
        setUnreadCount(json.unreadCount ?? 0);
      }
    } catch { /* network error */ }
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [page, unreadOnly]);

  async function markAllRead() {
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" })
      });
      if (!res.ok) toast("Failed to mark notifications as read", "error");
      await reload();
    } catch {
      toast("Network error", "error");
    }
    setMarkingAll(false);
  }

  async function markRead(id: string) {
    setMarkingId(id);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", id })
      });
      if (!res.ok) toast("Failed to mark notification as read", "error");
      await reload();
    } catch {
      toast("Network error", "error");
    }
    setMarkingId(null);
  }

  async function runProcessing() {
    setProcessing(true);
    try {
      const res = await fetch("/api/notifications/process", { method: "POST" });
      if (res.ok) {
        toast("Overdue check complete", "success");
        await reload();
      } else {
        toast("Failed to process overdue notifications", "error");
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
            <span className="badge badge-blue ml-8">{unreadCount} unread</span>
          )}
        </h1>
        <div className="notif-actions">
          <button
            className="btn btn-sm"
            onClick={runProcessing}
            disabled={processing}
          >
            {processing ? "Processing..." : "Check overdue"}
          </button>
          {unreadCount > 0 && (
            <button className="btn btn-sm" onClick={markAllRead} disabled={markingAll}>
              {markingAll ? "Marking..." : "Mark all read"}
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <label className="filter-label">
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
          <span className="count-label">
            {total} notification{total !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="loading-spinner">
            <div className="spinner" />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon="bell"
            title={unreadOnly ? "No unread notifications" : "No notifications yet"}
            description={unreadOnly ? "All caught up!" : "You'll see overdue alerts and booking updates here."}
          />
        ) : (
          <>
            <div className="notif-list">
              {notifications.map((n) => (
                <div key={n.id} className={`notif-item${n.readAt ? "" : " unread"}`}>
                  <div className={`notif-dot${n.readAt ? "" : " unread"}`} />
                  <div className="notif-content">
                    <div className="notif-header">
                      <span className={`notif-title${n.readAt ? "" : " unread"}`}>
                        {n.title}
                      </span>
                      <span className="notif-time">
                        {formatTime(n.sentAt)}
                      </span>
                    </div>
                    <div className="notif-body">{n.body}</div>
                    <div className="notif-actions">
                      {n.payload?.bookingId && (() => {
                        const kind = n.payload?.bookingKind;
                        const href = kind === "RESERVATION"
                          ? `/reservations/${n.payload.bookingId}`
                          : `/checkouts/${n.payload.bookingId}`;
                        const label = kind === "RESERVATION" ? "View reservation" : "View checkout";
                        return <Link href={href} className="btn btn-sm">{label}</Link>;
                      })()}
                      {!n.readAt && (
                        <button
                          className="btn btn-sm"
                          onClick={() => markRead(n.id)}
                          disabled={markingId === n.id}
                        >
                          {markingId === n.id ? "..." : "Mark read"}
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
