"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Bell, WifiOff } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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

function notifIconBg(type: string) {
  switch (type) {
    case "checkout_due_reminder":
    case "checkout_due_now":
    case "checkout_overdue_2h":
    case "checkout_overdue_24h":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400";
    case "shift_gear_up":
      return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400";
    default:
      return "bg-muted text-muted-foreground";
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

function NotificationsSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

const LIMIT = 20;

export default function NotificationsPage() {
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

  const { data, loading, error, reload } = useFetch<NotificationsData>({
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
      if (!res.ok) {
        const { toast } = await import("sonner");
        toast.error("Failed to mark notifications as read");
      }
      reload();
    } catch {
      const { toast } = await import("sonner");
      toast.error("Network error");
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
      if (!res.ok) {
        const { toast } = await import("sonner");
        toast.error("Failed to mark notification as read");
      }
      reload();
    } catch {
      const { toast } = await import("sonner");
      toast.error("Network error");
    }
    setMarkingId(null);
  }

  async function runProcessing() {
    setProcessing(true);
    try {
      const res = await fetch("/api/notifications/process", {
        method: "POST",
      });
      const { toast } = await import("sonner");
      if (res.ok) {
        toast.success("Overdue check complete");
        reload();
      } else {
        toast.error("Failed to process overdue notifications");
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
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-8">
        <h1 className="flex items-center gap-2">
          Notifications
          {unreadCount > 0 && (
            <Badge variant="blue" className="ml-1">
              {unreadCount}
            </Badge>
          )}
        </h1>
        <div className="flex gap-2">
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
        <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
          <div className="flex items-center gap-2">
            <Switch
              id="unread-filter"
              checked={unreadOnly}
              onCheckedChange={(checked) => {
                setUnreadOnly(checked);
                setPage(0);
              }}
              className="scale-75"
            />
            <Label htmlFor="unread-filter" className="text-sm cursor-pointer">
              Unread only
            </Label>
          </div>
          <span className="text-sm text-muted-foreground">
            {total} notification{total !== 1 ? "s" : ""}
          </span>
        </CardHeader>

        <CardContent className="p-0">
          {loading && !data ? (
            <NotificationsSkeleton />
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              {error === "network" ? (
                <WifiOff className="size-8 text-muted-foreground" />
              ) : (
                <AlertTriangle className="size-8 text-muted-foreground" />
              )}
              <p className="text-sm text-muted-foreground">
                {error === "network"
                  ? "Could not reach the server. Check your connection."
                  : "Something went wrong loading notifications."}
              </p>
              <Button variant="outline" size="sm" onClick={reload}>
                Try again
              </Button>
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
            <div className="divide-y">
              {grouped.map((group) => (
                <div key={group.label}>
                  <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                    {group.label}
                  </div>
                  {group.items.map((n) => (
                    <div
                      key={n.id}
                      className={`flex gap-3 px-4 py-3 transition-colors ${
                        n.readAt
                          ? "bg-background"
                          : "bg-primary/5 dark:bg-primary/10"
                      }`}
                    >
                      <div
                        className={`flex items-center justify-center size-9 rounded-full text-sm shrink-0 ${notifIconBg(n.type)}`}
                      >
                        {notifIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`text-sm leading-tight ${
                              n.readAt
                                ? "text-muted-foreground"
                                : "font-semibold text-foreground"
                            }`}
                          >
                            {n.title}
                          </span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                            {formatTime(n.sentAt)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                          {n.body}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
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
                                  className="h-7 text-xs"
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
                              className="h-7 text-xs text-muted-foreground"
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
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>
            Showing {page * LIMIT + 1}–
            {Math.min((page + 1) * LIMIT, total)} of {total}
          </span>
          <div className="flex gap-2">
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
  );
}
