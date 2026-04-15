"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { FilterChip } from "@/components/FilterChip";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { formatDateShort, formatTimeShort } from "@/lib/format";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDaysIcon } from "lucide-react";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";

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
      if (handleAuthRedirect(res)) return;
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
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success("Trade claimed");
        await loadTrades();
      } else {
        const msg = await parseErrorMessage(res, "Failed to claim");
        toast.error(msg);
      }
    } catch { toast.error("Network error"); }
    setActing(null);
  }

  async function handleApprove(tradeId: string) {
    setActing(tradeId);
    try {
      const res = await fetch(`/api/shift-trades/${tradeId}/approve`, { method: "PATCH" });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success("Trade approved — swap executed");
        await loadTrades();
      } else {
        const msg = await parseErrorMessage(res, "Failed to approve");
        toast.error(msg);
      }
    } catch { toast.error("Network error"); }
    setActing(null);
  }

  async function handleDecline(tradeId: string) {
    setActing(tradeId);
    try {
      const res = await fetch(`/api/shift-trades/${tradeId}/decline`, { method: "PATCH" });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success("Trade declined — reopened");
        await loadTrades();
      } else {
        const msg = await parseErrorMessage(res, "Failed to decline");
        toast.error(msg);
      }
    } catch { toast.error("Network error"); }
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
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success("Trade cancelled");
        await loadTrades();
      } else {
        const msg = await parseErrorMessage(res, "Failed to cancel");
        toast.error(msg);
      }
    } catch { toast.error("Network error"); }
    setActing(null);
  }

  const hasFilters = !!(areaFilter || statusFilter);

  return (
    <>
      {/* Student: how to post a trade */}
      {!isStaff && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 mb-3 rounded-md bg-muted/50 border border-border/60 text-sm">
          <CalendarDaysIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-muted-foreground leading-snug">
            To post a shift for trade, open any event you&apos;re scheduled for and tap{" "}
            <span className="font-medium text-foreground">Post for trade</span> on your shift.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-row items-center gap-2.5 flex-nowrap max-md:flex-wrap mb-1">
        <div className="flex gap-2 flex-nowrap items-center shrink-0 max-md:flex-wrap max-md:w-full">
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
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none font-medium whitespace-nowrap"
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
          <div className="p-4 text-center">
            <p className="text-muted-foreground mb-2">Failed to load trades.</p>
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
            <table className="w-full border-collapse max-md:hidden [&_th]:text-left [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground [&_th]:border-b [&_th]:border-border [&_th]:bg-muted/40 [&_th]:whitespace-nowrap [&_td]:px-4 [&_td]:py-3 [&_td]:border-b [&_td]:border-border/40 [&_td]:text-sm [&_td]:align-top [&_tr:last-child_td]:border-b-0 [&_tbody_tr:hover_td]:bg-muted/50">
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
                        <div className="text-xs text-muted-foreground">{formatTimeShort(ev.startsAt)}</div>
                      </td>
                      <td>
                        <Badge variant="gray">{AREA_LABELS[area] ?? area}</Badge>
                      </td>
                      <td>{t.postedBy.name}</td>
                      <td>
                        <Badge variant={(STATUS_BADGES[t.status] ?? "gray") as BadgeProps["variant"]}>
                          {t.status}
                        </Badge>
                        {t.claimedBy && (
                          <div className="text-xs text-muted-foreground mt-2">
                            Claimed by {t.claimedBy.name}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {/* Student can claim open trades (not their own) */}
                          {t.status === "OPEN" && t.postedBy.id !== currentUserId && (
                            <Button
                              size="sm"
                              onClick={() => handleClaim(t.id)}
                              disabled={acting !== null}                            >
                              {acting === t.id ? "..." : "Claim"}
                            </Button>
                          )}

                          {/* Poster can cancel open/claimed trades */}
                          {(t.status === "OPEN" || t.status === "CLAIMED") && t.postedBy.id === currentUserId && (
                            <Button
                              variant="ghost" size="sm"
                              className="text-destructive"
                              onClick={() => handleCancel(t.id)}
                              disabled={acting !== null}                            >
                              Cancel
                            </Button>
                          )}

                          {/* Staff can approve/decline claimed trades */}
                          {isStaff && t.status === "CLAIMED" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(t.id)}
                                disabled={acting !== null}
                                style={{ fontSize: "var(--text-3xs)" }}
                              >
                                {acting === t.id ? "..." : "Approve"}
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                className="text-destructive"
                                onClick={() => handleDecline(t.id)}
                                disabled={acting !== null}
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
            <div className="hidden max-md:flex flex-col">
              {filteredTrades.map((t) => {
                const ev = t.shiftAssignment.shift.shiftGroup.event;
                const area = t.shiftAssignment.shift.area;
                return (
                  <div key={t.id} className="block px-4 py-3 border-b border-border last:border-b-0 no-underline text-inherit active:bg-accent/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">{ev.summary}</span>
                      <Badge variant={(STATUS_BADGES[t.status] ?? "gray") as BadgeProps["variant"]}>
                        {t.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex gap-2 mb-1">
                      <span>{formatDateShort(ev.startsAt)} {formatTimeShort(ev.startsAt)}</span>
                      <Badge variant="gray">{AREA_LABELS[area] ?? area}</Badge>
                    </div>
                    <div className="text-xs mb-1">Posted by {t.postedBy.name}</div>
                    {t.claimedBy && (
                      <div className="text-xs text-muted-foreground mb-1">Claimed by {t.claimedBy.name}</div>
                    )}
                    <div className="flex gap-1">
                      {t.status === "OPEN" && t.postedBy.id !== currentUserId && (
                        <Button
                          size="sm"
                          onClick={() => handleClaim(t.id)}
                          disabled={acting !== null}
                        >
                          {acting === t.id ? "..." : "Claim"}
                        </Button>
                      )}
                      {(t.status === "OPEN" || t.status === "CLAIMED") && t.postedBy.id === currentUserId && (
                        <Button
                          variant="ghost" size="sm"
                          className="text-destructive"
                          onClick={() => handleCancel(t.id)}
                          disabled={acting !== null}
                        >
                          Cancel
                        </Button>
                      )}
                      {isStaff && t.status === "CLAIMED" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(t.id)}
                            disabled={acting !== null}
                          >
                            {acting === t.id ? "..." : "Approve"}
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className="text-destructive"
                            onClick={() => handleDecline(t.id)}
                            disabled={acting !== null}
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
