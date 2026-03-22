"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import EmptyState from "@/components/EmptyState";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";

/* ── Types ─────────────────────────────────────────────── */

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
  createdAt: string;
  actor: { name: string; email: string } | null;
};

const ACTION_LABELS: Record<string, string> = {
  created: "Account created",
  updated: "Profile updated",
  role_changed: "Role changed",
  // Booking actions by user
  "booking.created": "Created a booking",
  cancelled: "Cancelled a booking",
  extended: "Extended a checkout",
  items_returned: "Returned all items",
  items_returned_partial: "Returned some items",
  checkout_completed: "Completed a checkout",
  checkout_scan_completed: "Completed checkout scan",
  scan_completed: "Completed a scan",
  admin_override: "Admin override",
};

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  role: "Role",
  primaryArea: "Primary area",
  locationId: "Location",
};

/* ── Helpers ───────────────────────────────────────────── */

function describeFieldChange(key: string, before: unknown, after: unknown): string {
  const label = FIELD_LABELS[key] || key;
  const from = before == null || before === "" ? "empty" : String(before);
  const to = after == null || after === "" ? "empty" : String(after);
  return `${label}: ${from} \u2192 ${to}`;
}

/* ── Component ─────────────────────────────────────────── */

export default function UserActivityTab({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const loadActivity = useCallback(() => {
    setLoading(true);
    setFetchError(false);
    const controller = new AbortController();
    fetch(`/api/users/${userId}/activity`, { signal: controller.signal })
      .then((res) => {
        if (res.status === 401) { window.location.href = "/login"; return null; }
        if (!res.ok) { setFetchError(true); return null; }
        return res.json();
      })
      .then((json) => { if (json?.data) setEntries(json.data); })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setFetchError(true);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return controller;
  }, [userId]);

  useEffect(() => {
    const controller = loadActivity();
    return () => { controller?.abort(); };
  }, [loadActivity]);

  if (loading) {
    return (
      <div className="mt-6 space-y-4">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="grid grid-cols-[28px_1fr] gap-3 items-start">
            <Skeleton className="size-7 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4" style={{ width: `${50 + (i % 3) * 15}%` }} />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="py-10 px-5 flex justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="size-4" />
          <AlertTitle>Failed to load activity</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-3">Something went wrong loading the activity history.</p>
            <Button variant="outline" size="sm" onClick={() => loadActivity()}>Retry</Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (entries.length === 0) {
    return <EmptyState icon="clipboard" title="No activity recorded yet" description="Activity will appear here as changes are made to this user." />;
  }

  return (
    <div className="mt-6 grid gap-3.5">
      {entries.map((entry) => {
        const actorName = entry.actor?.name || "System";
        const initial = actorName.slice(0, 1).toUpperCase();
        const actionLabel = ACTION_LABELS[entry.action] || entry.action;
        const isBooking = entry.entityType === "booking";

        const isUpdate =
          (entry.action === "updated" || entry.action === "role_changed") &&
          entry.beforeJson &&
          entry.afterJson;

        const changes = isUpdate
          ? Object.keys(entry.afterJson!).filter((k) => {
              if (k.startsWith("_")) return false; // skip internal fields like _actorRole
              const b = entry.beforeJson?.[k];
              const a = entry.afterJson?.[k];
              return String(b ?? "") !== String(a ?? "");
            })
          : [];

        // Contextual description for booking actions
        const bookingTitle =
          entry.entityType === "booking" &&
          entry.afterJson &&
          typeof entry.afterJson === "object" &&
          "title" in entry.afterJson
            ? String(entry.afterJson.title)
            : null;

        return (
          <div className="grid grid-cols-[28px_1fr] gap-3 items-start" key={entry.id}>
            <Avatar className="size-7 text-[10px]">
              <AvatarFallback className={isBooking ? "bg-blue-500 text-white" : "bg-secondary text-secondary-foreground"}>
                {initial}
              </AvatarFallback>
            </Avatar>
            <div>
              <div>
                <strong>{actorName}</strong>{" "}
                <span>{actionLabel}</span>
                {bookingTitle && (
                  <> &mdash; <em>{bookingTitle}</em></>
                )}
              </div>
              {isUpdate && changes.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {changes.map((key) => (
                    <div key={key} className="py-1">
                      {describeFieldChange(
                        key,
                        entry.beforeJson?.[key],
                        entry.afterJson?.[key],
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="text-muted-foreground text-xs mt-2">{formatDateTime(entry.createdAt)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
