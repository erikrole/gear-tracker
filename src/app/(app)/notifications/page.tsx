"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRightIcon,
  Bell,
  CheckCircle2,
  CircleIcon,
  ExternalLink,
  RefreshCw,
  ShirtIcon,
  WifiOff,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useFetch } from "@/hooks/use-fetch";
import { handleAuthRedirect } from "@/lib/errors";
import { PageHeader } from "@/components/PageHeader";
import { FadeUp } from "@/components/ui/motion";
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions } from "@/components/ui/item";
import { Pagination, PaginationContent, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
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

type MeData = {
  id: string;
  role: string;
};

type NotificationMeta = {
  icon: typeof AlertTriangle;
  label: string;
  toneClass: string;
};

function notificationMeta(type: string): NotificationMeta {
  switch (type) {
    case "checkout_due_reminder":
    case "checkout_due_now":
    case "checkout_overdue_2h":
    case "checkout_overdue_24h":
      return {
        icon: AlertTriangle,
        label: "Overdue",
        toneClass: "bg-[var(--orange-bg)] text-[var(--orange-text)]",
      };
    case "shift_gear_up":
      return {
        icon: ShirtIcon,
        label: "Shift",
        toneClass: "bg-[var(--green-bg)] text-[var(--green-text)]",
      };
    case "trade_claimed":
    case "trade_approved":
      return {
        icon: ArrowLeftRightIcon,
        label: "Trade",
        toneClass: "bg-[var(--blue-bg)] text-[var(--blue-text)]",
      };
    case "trade_declined":
    case "trade_expired":
      return {
        icon: ArrowLeftRightIcon,
        label: "Trade",
        toneClass: "bg-[var(--red-bg)] text-[var(--red-text)]",
      };
    case "reservation_booked":
    case "reservation_pickup_ready":
    case "reservation_cancelled":
      return {
        icon: Bell,
        label: "Booking",
        toneClass: "bg-[var(--purple-bg)] text-[var(--purple-text)]",
      };
    default:
      return {
        icon: CircleIcon,
        label: "Notice",
        toneClass: "bg-muted text-muted-foreground",
      };
  }
}

function canProcessNotifications(role: string | undefined) {
  return role === "ADMIN" || role === "STAFF";
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
        <div key={i} className="flex gap-3 rounded-lg border border-border/50 p-3">
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

  const fetchUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(LIMIT));
    params.set("offset", String(page * LIMIT));
    if (unreadOnly) params.set("unread", "true");
    return `/api/notifications?${params}`;
  }, [page, unreadOnly]);

  const queryClient = useQueryClient();
  const queryKey = ["fetch", fetchUrl];

  const { data: meData } = useFetch<MeData>({
    url: "/api/me",
    transform: (json) => (json as Record<string, unknown>).user as MeData,
    refetchOnFocus: false,
  });

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
  const readCount = Math.max(total - unreadCount, 0);
  const hasNotifications = total > 0;
  const canProcess = canProcessNotifications(meData?.role);

  /** Optimistically update the raw query cache for notifications */
  const setNotificationsData = useCallback(
    (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => {
      queryClient.setQueryData<Record<string, unknown>>(queryKey, (prev) =>
        prev ? updater(prev) : prev,
      );
    },
    // queryKey changes with fetchUrl which is correct
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fetchUrl, queryClient],
  );

  async function markAllRead() {
    setMarkingAll(true);

    // Save previous state for rollback
    const prevData = queryClient.getQueryData<Record<string, unknown>>(queryKey);

    // Optimistic update: mark all notifications as read
    const now = new Date().toISOString();
    setNotificationsData((prev) => ({
      ...prev,
      unreadCount: 0,
      data: ((prev.data as Notification[]) ?? []).map((n) =>
        n.readAt ? n : { ...n, readAt: now },
      ),
    }));

    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        // Rollback on server error
        if (prevData) queryClient.setQueryData(queryKey, prevData);
        toast.error("Failed to mark notifications as read. Please try again.");
      }
    } catch {
      // Rollback on network error
      if (prevData) queryClient.setQueryData(queryKey, prevData);
      toast.error("Failed to mark notifications as read. Please try again.");
    }
    setMarkingAll(false);
  }

  async function markRead(id: string) {
    setMarkingId(id);

    // Save previous state for rollback
    const prevData = queryClient.getQueryData<Record<string, unknown>>(queryKey);

    // Optimistic update: mark the single notification as read
    const now = new Date().toISOString();
    setNotificationsData((prev) => ({
      ...prev,
      unreadCount: Math.max(0, ((prev.unreadCount as number) ?? 0) - 1),
      data: ((prev.data as Notification[]) ?? []).map((n) =>
        n.id === id ? { ...n, readAt: now } : n,
      ),
    }));

    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", id }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        // Rollback on server error
        if (prevData) queryClient.setQueryData(queryKey, prevData);
        toast.error("Failed to mark notification as read. Please try again.");
      }
    } catch {
      // Rollback on network error
      if (prevData) queryClient.setQueryData(queryKey, prevData);
      toast.error("Failed to mark notification as read. Please try again.");
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
        groups[groups.length - 1]!.items.push(n); // at least one group exists: push happened above when label changed
      }
    }
    return groups;
  }, [notifications]);

  const totalPages = Math.ceil(total / LIMIT);
  const visibleStart = total === 0 ? 0 : page * LIMIT + 1;
  const visibleEnd = Math.min((page + 1) * LIMIT, total);

  return (
    <FadeUp>
      <PageHeader
        title="Notifications"
        description="Action triggers for overdue gear, bookings, shifts, and trades."
      >
        <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : undefined} />
          Refresh
        </Button>
        {canProcess && (
          <Button variant="outline" size="sm" onClick={runProcessing} disabled={processing}>
            {processing ? "Processing..." : "Check overdue"}
          </Button>
        )}
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} disabled={markingAll}>
            {markingAll ? "Marking..." : "Mark all read"}
          </Button>
        )}
      </PageHeader>

      <div className="mb-4 grid gap-2 rounded-lg border border-border/60 bg-muted/20 p-2 sm:grid-cols-3">
        <NotificationMetric label="Unread" value={unreadCount} tone={unreadCount > 0 ? "orange" : "green"} />
        <NotificationMetric label="Read" value={readCount} tone="muted" />
        <NotificationMetric label="Total" value={total} tone="muted" />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Switch
              id="unread-filter"
              checked={unreadOnly}
              onCheckedChange={(checked) => {
                setUnreadOnly(checked);
                setPage(0);
              }}
            />
            <Label htmlFor="unread-filter" className="text-sm cursor-pointer">
              Unread only
            </Label>
            {unreadOnly && (
              <Badge variant="orange" className="tabular-nums">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          <span className="text-sm text-muted-foreground tabular-nums">
            {hasNotifications ? `${visibleStart}-${visibleEnd} of ${total}` : "No notifications"}
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
              icon={unreadOnly ? "check" : "bell"}
              title={
                unreadOnly
                  ? "You're all caught up"
                  : "No notifications yet"
              }
              description={
                unreadOnly
                  ? "Nothing new to see here."
                  : "You'll see overdue alerts and booking updates here."
              }
            />
          ) : (
            <div className="divide-y">
              {grouped.map((group) => (
                <div key={group.label}>
                  <div className="flex items-center justify-between bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>{group.label}</span>
                    <span className="tabular-nums">{group.items.length}</span>
                  </div>
                  {group.items.map((n) => (
                    <NotificationRow
                      key={n.id}
                      marking={markingId === n.id}
                      notification={n}
                      onMarkRead={markRead}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span className="tabular-nums">
            Showing {visibleStart}-{visibleEnd} of {total}
          </span>
          <Pagination>
            <PaginationContent>
              <PaginationPrevious
                onClick={() => setPage(page - 1)}
                aria-disabled={page === 0}
                className={page === 0 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
              <PaginationNext
                onClick={() => setPage(page + 1)}
                aria-disabled={page >= totalPages - 1}
                className={page >= totalPages - 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </FadeUp>
  );
}

function NotificationMetric({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "green" | "orange" | "muted";
  value: number;
}) {
  const toneClass = {
    green: "text-[var(--green-text)]",
    orange: "text-[var(--orange-text)]",
    muted: "text-foreground",
  }[tone];

  return (
    <div className="flex min-h-14 items-center justify-between rounded-md bg-background px-3 shadow-xs">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className={`mt-0.5 text-xl font-bold leading-none tabular-nums ${toneClass}`}>
          {value.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function NotificationRow({
  marking,
  notification,
  onMarkRead,
}: {
  marking: boolean;
  notification: Notification;
  onMarkRead: (id: string) => void;
}) {
  const meta = notificationMeta(notification.type);
  const Icon = meta.icon;
  const href = getNotificationHref(notification);
  const actionLabel = getNotificationActionLabel(notification);
  const unread = !notification.readAt;

  return (
    <Item
      size="sm"
      className={
        unread
          ? "group bg-primary/5 transition-[background-color,box-shadow] hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/15"
          : "group bg-background transition-[background-color] hover:bg-muted/35"
      }
    >
      <ItemMedia variant="icon" className={meta.toneClass}>
        <Icon className="size-4" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle
          className={
            unread
              ? "w-full items-start gap-2 font-semibold text-foreground"
              : "w-full items-start gap-2 font-normal text-muted-foreground"
          }
        >
          <span className="min-w-0 flex-1 text-balance">{notification.title}</span>
          <span className="shrink-0 text-xs font-normal tabular-nums text-muted-foreground">
            {formatTime(notification.sentAt)}
          </span>
        </ItemTitle>
        <ItemDescription className="text-pretty">
          {notification.body}
        </ItemDescription>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline" size="sm">
            {meta.label}
          </Badge>
          {unread ? (
            <Badge variant="blue" size="sm">
              Unread
            </Badge>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3" />
              Read
            </span>
          )}
        </div>
      </ItemContent>
      <ItemActions>
        {href && actionLabel && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            asChild
          >
            <Link href={href}>
              {actionLabel}
              <ExternalLink className="size-3" />
            </Link>
          </Button>
        )}
        {unread && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => onMarkRead(notification.id)}
            disabled={marking}
          >
            {marking ? "Marking..." : "Mark read"}
          </Button>
        )}
      </ItemActions>
    </Item>
  );
}

function getNotificationHref(notification: Notification) {
  if (typeof notification.payload?.href === "string") {
    return notification.payload.href;
  }

  if (notification.payload?.bookingId) {
    return isReservationNotification(notification)
      ? `/reservations/${notification.payload.bookingId}`
      : `/checkouts/${notification.payload.bookingId}`;
  }

  if (notification.payload?.shiftGroupId) {
    return "/schedule";
  }

  return null;
}

function getNotificationActionLabel(notification: Notification) {
  if (notification.type === "badge_awarded") {
    return "Open badges";
  }

  if (notification.payload?.bookingId) {
    return isReservationNotification(notification)
      ? "Open reservation"
      : "Open checkout";
  }

  if (notification.payload?.shiftGroupId) {
    return "Open schedule";
  }

  return null;
}

function isReservationNotification(notification: Notification) {
  return notification.payload?.bookingKind === "RESERVATION"
    || notification.type.startsWith("reservation_");
}
