"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { useFetch } from "@/hooks/use-fetch";
import EmptyState from "@/components/EmptyState";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { handleAuthRedirect } from "@/lib/errors";

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
  updated: "Updated profile",
  profile_update: "Updated profile",
  role_changed: "Changed role",
  password_change: "Changed password",
  avatar_updated: "Updated avatar",
  avatar_removed: "Removed avatar",
  // Booking actions
  "booking.created": "Created a booking",
  cancelled: "Cancelled a booking",
  extended: "Extended a checkout",
  items_returned: "Returned all items",
  items_returned_partial: "Returned some items",
  checkout_completed: "Completed a checkout",
  checkout_scan_completed: "Completed checkout scan",
  scan_completed: "Completed a scan",
  admin_override: "Admin override",
  // Assignment actions
  roster_added: "Added to sport roster",
  roster_removed: "Removed from sport roster",
  roster_bulk_added: "Bulk added to sport roster",
  area_assigned: "Assigned to area",
  area_removed: "Removed from area",
};

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  role: "Role",
  primaryArea: "Primary area",
  locationId: "Location",
};

/** Fields whose values are not human-readable and should be hidden from change display */
const HIDDEN_FIELDS = new Set(["notes", "passwordHash", "_actorRole"]);

/** Fields that contain raw IDs we can't resolve — show just the label */
const ID_FIELDS = new Set(["categoryId", "locationId"]);

/* ── Helpers ───────────────────────────────────────────── */

function formatValue(key: string, val: unknown): string {
  if (val == null || val === "") return "empty";

  // Don't try to display complex objects
  if (typeof val === "object") return "(complex value)";

  const str = String(val);

  // Format ISO dates
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    try {
      return formatDateTime(str);
    } catch {
      return str;
    }
  }

  // Format role values
  if (key === "role") {
    const roles: Record<string, string> = { ADMIN: "Admin", STAFF: "Staff", STUDENT: "Student" };
    return roles[str] || str;
  }

  // Format area values
  if (key === "primaryArea" || key === "area") {
    const areas: Record<string, string> = { VIDEO: "Video", PHOTO: "Photo", GRAPHICS: "Graphics", COMMS: "Communications" };
    return areas[str] || str;
  }

  // For ID fields, just show "changed" rather than a raw CUID
  if (ID_FIELDS.has(key) && /^c[a-z0-9]{20,}$/.test(str)) {
    return "(updated)";
  }

  return str;
}

function describeFieldChange(key: string, before: unknown, after: unknown): string {
  const label = FIELD_LABELS[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
  const from = formatValue(key, before);
  const to = formatValue(key, after);
  return `${label}: ${from} \u2192 ${to}`;
}

function actionColor(entityType: string): string {
  switch (entityType) {
    case "booking": return "bg-blue-500 text-white";
    case "student_sport_assignment": return "bg-green-500 text-white";
    case "student_area_assignment": return "bg-purple-500 text-white";
    default: return "bg-secondary text-secondary-foreground";
  }
}

/* ── Component ─────────────────────────────────────────── */

export default function UserActivityTab({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [loadingMore, setLoadingMore] = useState(false);
  const [extraEntries, setExtraEntries] = useState<AuditEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  type ActivityResponse = { data: AuditEntry[]; nextCursor: string | null };

  const {
    data: initialData,
    loading,
    error: fetchError,
    reload: loadActivity,
  } = useFetch<ActivityResponse>({
    url: `/api/users/${userId}/activity`,
    transform: (json) => ({
      data: (json as unknown as ActivityResponse).data ?? [],
      nextCursor: (json as unknown as ActivityResponse).nextCursor ?? null,
    }),
  });

  // When initial data loads, sync the cursor (reset extras on reload)
  const entries = [...(initialData?.data ?? []), ...extraEntries];
  const effectiveCursor = extraEntries.length > 0 ? nextCursor : (initialData?.nextCursor ?? null);

  async function loadMore() {
    if (!effectiveCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/users/${userId}/activity?cursor=${effectiveCursor}`);
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        toast("Failed to load more activity", "error");
        return;
      }
      const json = await res.json();
      if (json?.data) setExtraEntries((prev) => [...prev, ...json.data]);
      setNextCursor(json?.nextCursor ?? null);
    } catch {
      toast("Network error", "error");
    } finally {
      setLoadingMore(false);
    }
  }

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
            <Button variant="outline" size="sm" onClick={loadActivity}>Retry</Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (entries.length === 0) {
    return <EmptyState icon="clipboard" title="No activity recorded yet" description="Activity will appear here as changes are made to this user." />;
  }

  return (
    <div className="mt-6 grid gap-1">
      {entries.map((entry) => {
        const actorName = entry.actor?.name || "System";
        const initial = actorName.slice(0, 1).toUpperCase();
        const actionLabel = ACTION_LABELS[entry.action] || entry.action;
        const avatarColor = actionColor(entry.entityType);

        const isUpdate =
          (entry.action === "updated" || entry.action === "role_changed" || entry.action === "profile_update") &&
          entry.beforeJson &&
          entry.afterJson;

        const changes = isUpdate
          ? Object.keys(entry.afterJson!).filter((k) => {
              if (k.startsWith("_")) return false;
              if (HIDDEN_FIELDS.has(k)) return false;
              const b = entry.beforeJson?.[k];
              const a = entry.afterJson?.[k];
              // Skip complex objects (like notes JSON)
              if (typeof a === "object" || typeof b === "object") return false;
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
          <div className="grid grid-cols-[28px_1fr] gap-3 items-start py-2.5 border-b border-border/50 last:border-0" key={entry.id}>
            <Avatar className="size-7 text-[10px]">
              <AvatarFallback className={avatarColor}>
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="text-sm">
                <span className="font-medium">{actorName}</span>{" "}
                <span className="text-muted-foreground">{actionLabel}</span>
                {bookingTitle && (
                  <span className="text-muted-foreground"> &mdash; {bookingTitle}</span>
                )}
              </div>
              {isUpdate && changes.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  {changes.map((key) => (
                    <div key={key}>
                      {describeFieldChange(
                        key,
                        entry.beforeJson?.[key],
                        entry.afterJson?.[key],
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="text-muted-foreground text-xs mt-1">{formatDateTime(entry.createdAt)}</div>
            </div>
          </div>
        );
      })}
      {effectiveCursor && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? <><Spinner data-icon="inline-start" />Loading...</> : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
