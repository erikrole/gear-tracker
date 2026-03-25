"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFetch } from "@/hooks/use-fetch";
import { useUrlState } from "@/hooks/use-url-state";

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

type NotificationsData = {
  notifications: Notification[];
  total: number;
  unreadCount: number;
};

function notifIcon(type: string) {
  switch (type) {
    case "checkout_due_reminder":
    case "checkout_due_now":
    case "checkout_overdue_2h":
    case "checkout_overdue_24h":
      return "⚠";
    case "shift_gear_up":
      return "🎒";
    default:
      return "●";
  }
}

function notifIconClass(type: string) {
  switch (type) {
    case "checkout_due_reminder":
    case "checkout_due_now":
    case "checkout_overdue_2h":
    case "checkout_overdue_24h":
      return "notif-icon-overdue";
    case "shift_gear_up":
      return "notif-icon-success";
    default:
      return "notif-icon-default";
  }
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const notifDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor(
    (today.getTime() - notifDay.getTime()) / 86_400_000,
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This week";
  return notifDay.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
}

const LIMIT = 20;

export default function NotificationsPage() {
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  // URL-synced filters
  const [page, setPage] = useUrlState<number>(
    "page",
    (v) => (v ? Number(v) : 0),
    (v) => (v === 0 ? null : String(v)),
  );
  const [unreadOnly, setUnreadOnly] = useUrlState<boolean>(
    "unread",
    (v) => v === "true",
    (v) => (v ? "true" : null),
  );

  // Build fetch URL from filter state
  const fetchUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(LIMIT));
    params.set("offset", String(page * LIMIT));
    if (unreadOnly) params.set("unread", "true");
    return `/api/notifications?${params}`;
  }, [page, unreadOnly]);

  const { data, loading, reload } = useFetch<NotificationsData>({
    url: fetchUrl,
    transform: (json) => ({
      notifications: (json.data as Notification[]) ?? [],
      total: (json.total as number) ?? 0,
      unreadCount: (json.unreadCount as number) ?? 0,
    }),
  });

  const notifications = data?.notifications ?? [];
  const total = data?.total ?? 0;
  const unreadCount = data?.unreadCount ?? 0;

  async function markAllRead() {
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      if (!res.ok) toast("Failed to mark notifications as read", "error");
      reload();
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
        body: JSON.stringify({ action: "mark_read", id }),
      });
      if (!res.ok) toast("Failed to mark notification as read", "error");
      reload();
    } catch {
      toast("Network error", "error");
    }
    setMarkingId(null);
  }

  async function runProcessing() {
    setProcessing(true);
    try {
      const res = await fetch("/api/notifications/process", {
        method: "POST",
      });
      if (res.ok) {
        toast("Overdue check complete", "success");
        reload();
      } else {
        toast("Failed to process overdue notifications", "error");
      }
    } finally {
      setProcessing(false);
    }
  }

  // Group notifications by day
  const grouped = useMemo(() => {
    const groups: { label: string; items: Notification[] }[] = [];
    let currentLabel = "";
    for (const n of notifications) {
      const label = dayLabel(n.sentAt);
      if (label !== currentLabel) {
        groups.push({ label, items: [n] });
        currentLabel = label;
      } else {
        groups[groups.length - 1].items.push(n);
      }
    }
    return groups;
  }, [notifications]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <>
      <div className="page-header">
        <h1>
          Notifications
          {unreadCount > 0 && (
            <Badge variant="blue" className="notif-badge">
              {unreadCount}
            </Badge>
          )}
        </h1>
        <div className="notif-header-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={runProcessing}
            disabled={processing}
          >
            {processing ? "Processing..." : "Check overdue"}
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllRead}
              disabled={markingAll}
            >
              {markingAll ? "Marking..." : "Mark all read"}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="notif-filter-bar">
          <label className="notif-filter-label">
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
          <span className="notif-count">
            {total} notification{total !== 1 ? "s" : ""}
          </span>
        </CardHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner className="size-8" />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon="bell"
            title={
              unreadOnly
                ? "No unread notifications"
                : "No notifications yet"
            }
            description={
              unreadOnly
                ? "All caught up!"
                : "You'll see overdue alerts and booking updates here."
            }
          />
        ) : (
          <>
            <div className="notif-list">
              {grouped.map((group) => (
                <div key={group.label}>
                  <div className="notif-day-header">{group.label}</div>
                  {group.items.map((n) => (
                    <div
                      key={n.id}
                      className={`notif-card${n.readAt ? "" : " notif-unread"}`}
                    >
                      <div
                        className={`notif-icon ${notifIconClass(n.type)}`}
                      >
                        {notifIcon(n.type)}
                      </div>
                      <div className="notif-content">
                        <div className="notif-title-row">
                          <span
                            className={`notif-title${n.readAt ? "" : " unread"}`}
                          >
                            {n.title}
                          </span>
                          <span className="notif-time">
                            {formatTime(n.sentAt)}
                          </span>
                        </div>
                        <div className="notif-body">{n.body}</div>
                        <div className="notif-actions">
                          {n.payload?.bookingId &&
                            (() => {
                              const kind = n.payload?.bookingKind;
                              const href =
                                kind === "RESERVATION"
                                  ? `/reservations/${n.payload.bookingId}`
                                  : `/checkouts/${n.payload.bookingId}`;
                              const label =
                                kind === "RESERVATION"
                                  ? "View reservation"
                                  : "View checkout";
                              return (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="notif-link-btn"
                                  asChild
                                >
                                  <Link href={href}>{label} →</Link>
                                </Button>
                              );
                            })()}
                          {!n.readAt && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="notif-mark-btn"
                              onClick={() => markRead(n.id)}
                              disabled={markingId === n.id}
                            >
                              {markingId === n.id ? "..." : "Mark read"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="pagination">
                <span>
                  Showing {page * LIMIT + 1}–
                  {Math.min((page + 1) * LIMIT, total)} of {total}
                </span>
                <div className="pagination-btns">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
