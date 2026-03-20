"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { FilterChip } from "@/components/FilterChip";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { formatDateShort, formatTimeShort } from "@/lib/format";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

/* ───── Types ───── */

type TradeEvent = {
  id: string;
  summary: string;
  startsAt: string;
  endsAt: string;
  sportCode: string | null;
};

type TradeShift = {
  id: string;
  area: string;
  workerType: string;
  shiftGroup: { event: TradeEvent; isPremier: boolean };
};

type TradeAssignment = {
  id: string;
  shift: TradeShift;
  user: { id: string; name: string; primaryArea: string | null };
};

type Trade = {
  id: string;
  status: string;
  requiresApproval: boolean;
  notes: string | null;
  postedAt: string;
  claimedAt: string | null;
  shiftAssignment: TradeAssignment;
  postedBy: { id: string; name: string };
  claimedBy: { id: string; name: string } | null;
};

type Props = {
  currentUserId: string;
  currentUserRole: string;
};

const AREAS = ["VIDEO", "PHOTO", "GRAPHICS", "COMMS"] as const;
const AREA_LABELS: Record<string, string> = {
  VIDEO: "Video",
  PHOTO: "Photo",
  GRAPHICS: "Graphics",
  COMMS: "Comms",
};

const STATUS_BADGES: Record<string, string> = {
  OPEN: "green",
  CLAIMED: "orange",
  COMPLETED: "gray",
  CANCELLED: "red",
};

export default function TradeBoard({ currentUserId, currentUserRole }: Props) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  // Filters
  const [areaFilter, setAreaFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const isStaff = currentUserRole === "ADMIN" || currentUserRole === "STAFF";

  const loadTrades = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (areaFilter) params.set("area", areaFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/shift-trades?${params}`);
      if (res.ok) {
        const json = await res.json();
        setTrades(json.data ?? []);
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  }, [areaFilter, statusFilter]);

  useEffect(() => { loadTrades(); }, [loadTrades]);

  const filteredTrades = useMemo(() => {
    // Default to showing OPEN trades for students, all for staff
    if (!statusFilter && !isStaff) {
      return trades.filter((t) => t.status === "OPEN" || t.postedBy.id === currentUserId);
    }
    return trades;
  }, [trades, statusFilter, isStaff, currentUserId]);

  async function handleClaim(tradeId: string) {
    setActing(tradeId);
    try {
      const res = await fetch(`/api/shift-trades/${tradeId}/claim`, { method: "POST" });
      if (res.ok) {
        toast("Trade claimed", "success");
        await loadTrades();
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Failed to claim", "error");
      }
    } catch { toast("Network error", "error"); }
    setActing(null);
  }

  async function handleApprove(tradeId: string) {
    setActing(tradeId);
    try {
      const res = await fetch(`/api/shift-trades/${tradeId}/approve`, { method: "PATCH" });
      if (res.ok) {
        toast("Trade approved — swap executed", "success");
        await loadTrades();
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Failed to approve", "error");
      }
    } catch { toast("Network error", "error"); }
    setActing(null);
  }

  async function handleDecline(tradeId: string) {
    setActing(tradeId);
    try {
      const res = await fetch(`/api/shift-trades/${tradeId}/decline`, { method: "PATCH" });
      if (res.ok) {
        toast("Trade declined — reopened", "success");
        await loadTrades();
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Failed to decline", "error");
      }
    } catch { toast("Network error", "error"); }
    setActing(null);
  }

  async function handleCancel(tradeId: string) {
    const ok = await confirm({
      title: "Cancel trade",
      message: "Cancel this trade posting?",
      confirmLabel: "Cancel trade",
      variant: "danger",
    });
    if (!ok) return;
    setActing(tradeId);
    try {
      const res = await fetch(`/api/shift-trades/${tradeId}/cancel`, { method: "PATCH" });
      if (res.ok) {
        toast("Trade cancelled", "success");
        await loadTrades();
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Failed to cancel", "error");
      }
    } catch { toast("Network error", "error"); }
    setActing(null);
  }

  const hasFilters = !!(areaFilter || statusFilter);

  return (
    <>
      {/* Filters */}
      <div className="filter-chip-bar mb-16">
        <div className="filter-chips">
          <FilterChip
            label="Area"
            value={areaFilter}
            displayValue={areaFilter ? AREA_LABELS[areaFilter] ?? areaFilter : ""}
            options={AREAS.map((a) => ({ value: a, label: AREA_LABELS[a] }))}
            onSelect={(v) => setAreaFilter(v)}
            onClear={() => setAreaFilter("")}
          />
          <FilterChip
            label="Status"
            value={statusFilter}
            displayValue={statusFilter || ""}
            options={[
              { value: "OPEN", label: "Open" },
              { value: "CLAIMED", label: "Claimed" },
              { value: "COMPLETED", label: "Completed" },
              { value: "CANCELLED", label: "Cancelled" },
            ]}
            onSelect={(v) => setStatusFilter(v)}
            onClear={() => setStatusFilter("")}
          />
          {hasFilters && (
            <button
              type="button"
              className="filter-chip-clear-all"
              onClick={() => { setAreaFilter(""); setStatusFilter(""); }}
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trade Board ({filteredTrades.length})</CardTitle>
        </CardHeader>

        {loading ? (
          <SkeletonTable rows={4} cols={6} />
        ) : loadError ? (
          <div className="p-16 text-center">
            <p className="text-secondary mb-8">Failed to load trades.</p>
            <Button variant="outline" size="sm" onClick={loadTrades}>Retry</Button>
          </div>
        ) : filteredTrades.length === 0 ? (
          <EmptyState
            icon="clipboard"
            title="No trades found"
            description={hasFilters ? "Try adjusting your filters." : "No shifts are currently posted for trade."}
          />
        ) : (
          <>
            {/* Desktop table */}
            <table className="data-table schedule-table-desktop">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Date</th>
                  <th>Area</th>
                  <th>Posted by</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map((t) => {
                  const ev = t.shiftAssignment.shift.shiftGroup.event;
                  const area = t.shiftAssignment.shift.area;
                  return (
                    <tr key={t.id}>
                      <td className="font-semibold">{ev.summary}</td>
                      <td className="text-nowrap">
                        <div>{formatDateShort(ev.startsAt)}</div>
                        <div className="text-xs text-secondary">{formatTimeShort(ev.startsAt)}</div>
                      </td>
                      <td>
                        <Badge variant="gray">{AREA_LABELS[area] ?? area}</Badge>
                      </td>
                      <td>{t.postedBy.name}</td>
                      <td>
                        <Badge variant={STATUS_BADGES[t.status] ?? "gray"}>
                          {t.status}
                        </Badge>
                        {t.claimedBy && (
                          <div className="text-xs text-secondary mt-2">
                            Claimed by {t.claimedBy.name}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-4">
                          {/* Student can claim open trades (not their own) */}
                          {t.status === "OPEN" && t.postedBy.id !== currentUserId && (
                            <Button
                              size="sm"
                              onClick={() => handleClaim(t.id)}
                              disabled={acting === t.id}
                              style={{ fontSize: "var(--text-3xs)" }}
                            >
                              {acting === t.id ? "..." : "Claim"}
                            </Button>
                          )}

                          {/* Poster can cancel open/claimed trades */}
                          {(t.status === "OPEN" || t.status === "CLAIMED") && t.postedBy.id === currentUserId && (
                            <Button
                              variant="ghost" size="sm"
                              className="text-destructive"
                              onClick={() => handleCancel(t.id)}
                              disabled={acting === t.id}
                              style={{ fontSize: "var(--text-3xs)" }}
                            >
                              Cancel
                            </Button>
                          )}

                          {/* Staff can approve/decline claimed trades */}
                          {isStaff && t.status === "CLAIMED" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(t.id)}
                                disabled={acting === t.id}
                                style={{ fontSize: "var(--text-3xs)" }}
                              >
                                {acting === t.id ? "..." : "Approve"}
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                className="text-destructive"
                                onClick={() => handleDecline(t.id)}
                                disabled={acting === t.id}
                                style={{ fontSize: "var(--text-3xs)" }}
                              >
                                Decline
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="schedule-mobile-list">
              {filteredTrades.map((t) => {
                const ev = t.shiftAssignment.shift.shiftGroup.event;
                const area = t.shiftAssignment.shift.area;
                return (
                  <div key={t.id} className="schedule-mobile-card">
                    <div className="flex-between mb-4">
                      <span className="font-semibold">{ev.summary}</span>
                      <Badge variant={STATUS_BADGES[t.status] ?? "gray"}>
                        {t.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-secondary flex gap-8 mb-4">
                      <span>{formatDateShort(ev.startsAt)} {formatTimeShort(ev.startsAt)}</span>
                      <Badge variant="gray">{AREA_LABELS[area] ?? area}</Badge>
                    </div>
                    <div className="text-xs mb-4">Posted by {t.postedBy.name}</div>
                    {t.claimedBy && (
                      <div className="text-xs text-secondary mb-4">Claimed by {t.claimedBy.name}</div>
                    )}
                    <div className="flex gap-4">
                      {t.status === "OPEN" && t.postedBy.id !== currentUserId && (
                        <Button
                          size="sm"
                          onClick={() => handleClaim(t.id)}
                          disabled={acting === t.id}
                        >
                          {acting === t.id ? "..." : "Claim"}
                        </Button>
                      )}
                      {(t.status === "OPEN" || t.status === "CLAIMED") && t.postedBy.id === currentUserId && (
                        <Button
                          variant="ghost" size="sm"
                          className="text-destructive"
                          onClick={() => handleCancel(t.id)}
                          disabled={acting === t.id}
                        >
                          Cancel
                        </Button>
                      )}
                      {isStaff && t.status === "CLAIMED" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(t.id)}
                            disabled={acting === t.id}
                          >
                            {acting === t.id ? "..." : "Approve"}
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className="text-destructive"
                            onClick={() => handleDecline(t.id)}
                            disabled={acting === t.id}
                          >
                            Decline
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>
    </>
  );
}
