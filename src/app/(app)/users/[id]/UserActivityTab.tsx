"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { Spinner } from "@/components/ui/spinner";

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

  useEffect(() => {
    fetch(`/api/users/${userId}/activity`)
      .then((res) => {
        if (!res.ok) { setFetchError(true); return null; }
        return res.json();
      })
      .then((json) => { if (json?.data) setEntries(json.data); })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="flex items-center justify-center py-10"><Spinner className="size-8" /></div>;

  if (fetchError) {
    return <div className="py-10 px-5 text-center text-muted-foreground">Failed to load activity history.</div>;
  }

  if (entries.length === 0) {
    return <div className="py-10 px-5 text-center text-muted-foreground">No activity recorded yet.</div>;
  }

  return (
    <div className="history-feed mt-14">
      {entries.map((entry) => {
        const actorName = entry.actor?.name || "System";
        const initial = actorName.slice(0, 1).toUpperCase();
        const actionLabel = ACTION_LABELS[entry.action] || entry.action;

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
          <div className="history-row" key={entry.id}>
            <div className={`history-dot${entry.entityType === "booking" ? " history-dot-booking" : ""}`}>
              {initial}
            </div>
            <div>
              <div>
                <strong>{actorName}</strong>{" "}
                <span>{actionLabel}</span>
                {bookingTitle && (
                  <> &mdash; <em>{bookingTitle}</em></>
                )}
              </div>
              {isUpdate && changes.length > 0 && (
                <div className="text-xs text-secondary mt-4">
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
              <div className="muted mt-2">{formatDateTime(entry.createdAt)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
