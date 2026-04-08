"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, Bell, CircleIcon, ShirtIcon, WifiOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/Toast";
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

function notifIcon(type: string) {
  switch (type) {
    case "checkout_due_reminder":
    case "checkout_due_now":
    case "checkout_overdue_2h":
    case "checkout_overdue_24h":
      return <AlertTriangle className="size-4" />;
    case "shift_gear_up":
      return <ShirtIcon className="size-4" />;
    default:
      return <CircleIcon className="size-4" />;
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

  const queryClient = useQueryClient();
  const queryKey = ["fetch", fetchUrl];

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
        toast("Failed to mark notifications as read. Please try again.", "error");
      }
    } catch {
      // Rollback on network error
      if (prevData) queryClient.setQueryData(queryKey, prevData);
      toast("Failed to mark notifications as read. Please try again.", "error");
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
        toast("Failed to mark notification as read. Please try again.", "error");
      }
    } catch {
      // Rollback on network error
      if (prevData) queryClient.setQueryData(queryKey, prevData);
      toast("Failed to mark notification as read. Please try again.", "error");
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
    <FadeUp>
      <PageHeader title={unreadCount > 0 ? `Notifications (${unreadCount})` : "Notifications"}>
        <Button variant="outline" size="sm" onClick={runProcessing} disabled={processing}>
          {processing ? "Processing..." : "Check overdue"}
        </Button>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} disabled={markingAll}>
            {markingAll ? "Marking..." : "Mark all read"}
          </Button>
        )}
      </PageHeader>

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
                  <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                    {group.label}
                  </div>
                  {group.items.map((n) => (
                    <Item
                      key={n.id}
                      size="sm"
                      className={
                        n.readAt
                          ? "bg-background"
                          : "bg-primary/5 dark:bg-primary/10"
                      }
                    >
                      <ItemMedia variant="icon" className={notifIconBg(n.type)}>
                        {notifIcon(n.type)}
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle
                          className={
                            n.readAt
                              ? "text-muted-foreground font-normal"
                              : "font-semibold text-foreground"
                          }
                        >
                          {n.title}
                          <span className="text-xs text-muted-foreground whitespace-nowrap font-normal ml-auto">
                            {formatTime(n.sentAt)}
                          </span>
                        </ItemTitle>
                        <ItemDescription>{n.body}</ItemDescription>
                      </ItemContent>
                      <ItemActions>
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
                      </ItemActions>
                    </Item>
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
