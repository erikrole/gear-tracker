"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeftRightIcon,
  AlertTriangleIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CheckIcon,
  Clock3Icon,
  ClipboardListIcon,
  ShieldCheckIcon,
  XIcon,
} from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { FilterChip } from "@/components/FilterChip";
import { OperationalActiveFilterChips, type OperationalActiveFilter } from "@/components/OperationalToolbar";
import { OperationalRowActions } from "@/components/OperationalRowActions";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { scheduleEventTitleParts } from "@/app/(app)/schedule/_components/types";
import { AREA_LABELS } from "@/types/areas";
import { formatDateShort, formatTimeShort } from "@/lib/format";
import { handleAuthRedirect, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
import { cn } from "@/lib/utils";

type TradeEvent = {
  id: string;
  summary: string;
  startsAt: string;
  endsAt: string;
  sportCode: string | null;
  opponent?: string | null;
  isHome?: boolean | null;
};

type TradeShift = {
  id: string;
  area: string;
  workerType: string;
  startsAt: string;
  endsAt: string;
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
  initialStatusFilter?: string;
};

type OpenWorkShift = {
  id: string;
  kind: "open_shift";
  action: "claim" | "request" | "none";
  canAct: boolean;
  reason: string;
  score: number | null;
  bucket: string | null;
  advisoryConflict: boolean;
  advisoryConflictNote: string | null;
  warnings: Array<{ code: string; label: string; weight?: number }>;
  ownRequestId: string | null;
  requestCount: number;
  shift: TradeShift & {
    callStartsAt: string | null;
    callEndsAt: string | null;
    shiftGroup: TradeShift["shiftGroup"] & {
      id: string;
      publishedAt: string | null;
    };
  };
};

type PickupRequest = {
  id: string;
  kind: "pickup_request";
  status: string;
  hasConflict: boolean;
  conflictNote: string | null;
  createdAt: string;
  user: { id: string; name: string; primaryArea: string | null; avatarUrl?: string | null };
  shift: OpenWorkShift["shift"];
};

type OpenWorkResponse = {
  openShifts: OpenWorkShift[];
  pickupRequests: PickupRequest[];
};

const AREAS = ["VIDEO", "PHOTO", "GRAPHICS", "COMMS"] as const;
const TRADE_STATUSES = ["OPEN", "CLAIMED", "COMPLETED", "CANCELLED"] as const;

const STATUS_OPTIONS = [
  { value: "OPEN_SHIFT", label: "Open shifts" },
  { value: "REQUESTED", label: "Requests" },
  { value: "OPEN", label: "Open" },
  { value: "CLAIMED", label: "Claimed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const STATUS_META: Record<string, { label: string; variant: BadgeProps["variant"]; helper: string }> = {
  OPEN: {
    label: "Open",
    variant: "green",
    helper: "Available to claim",
  },
  CLAIMED: {
    label: "Claimed",
    variant: "orange",
    helper: "Awaiting staff review",
  },
  COMPLETED: {
    label: "Completed",
    variant: "gray",
    helper: "Swap complete",
  },
  CANCELLED: {
    label: "Cancelled",
    variant: "red",
    helper: "No longer available",
  },
};

function statusMeta(status: string) {
  return STATUS_META[status] ?? {
    label: status,
    variant: "gray" as BadgeProps["variant"],
    helper: "Trade status",
  };
}

function isTradeStatus(value: string): value is typeof TRADE_STATUSES[number] {
  return (TRADE_STATUSES as readonly string[]).includes(value);
}

function formatShiftWindow(shift: Pick<TradeShift, "startsAt" | "endsAt">) {
  const starts = new Date(shift.startsAt);
  const ends = new Date(shift.endsAt);
  const sameDay = starts.toDateString() === ends.toDateString();
  const date = formatDateShort(shift.startsAt);
  const startTime = formatTimeShort(shift.startsAt);
  const endTime = formatTimeShort(shift.endsAt);

  if (sameDay) return `${date}, ${startTime} - ${endTime}`;
  return `${date}, ${startTime} - ${formatDateShort(shift.endsAt)}, ${endTime}`;
}

function tradeCancelContext(trade: Trade) {
  const shift = trade.shiftAssignment.shift;
  const event = shift.shiftGroup.event;
  const titleParts = scheduleEventTitleParts({
    summary: event.summary,
    sportCode: event.sportCode,
    opponent: event.opponent ?? null,
    isHome: event.isHome ?? null,
  });
  return {
    eventLabel: titleParts.detail ? `${titleParts.title} (${titleParts.detail})` : titleParts.title,
    windowLabel: formatShiftWindow(shift),
  };
}

function TradeSkeleton() {
  return (
    <div className="space-y-3 p-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-lg border border-border/50 p-3">
          <div className="flex items-start gap-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TradeBoard({ currentUserId, currentUserRole, initialStatusFilter = "" }: Props) {
  const confirm = useConfirm();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [openWork, setOpenWork] = useState<OpenWorkResponse>({ openShifts: [], pickupRequests: [] });
  const [loading, setLoading] = useState(true);
  const [openWorkLoading, setOpenWorkLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [openWorkError, setOpenWorkError] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const actingRef = useRef<string | null>(null);
  const loadSeqRef = useRef(0);
  const openWorkSeqRef = useRef(0);

  const [areaFilter, setAreaFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [myTradesOnly, setMyTradesOnly] = useState(false);

  const isStaff = currentUserRole === "ADMIN" || currentUserRole === "STAFF";

  useEffect(() => {
    if (initialStatusFilter) setStatusFilter(initialStatusFilter);
  }, [initialStatusFilter]);

  const loadTrades = useCallback(async () => {
    const requestId = loadSeqRef.current + 1;
    loadSeqRef.current = requestId;
    setLoading(true);

    try {
      const params = new URLSearchParams({ limit: "100" });
      if (areaFilter) params.set("area", areaFilter);
      if (isTradeStatus(statusFilter)) params.set("status", statusFilter);

      const res = await fetch(`/api/shift-trades?${params}`);
      if (handleAuthRedirect(res)) return;
      if (requestId !== loadSeqRef.current) return;

      if (res.ok) {
        const json = await parseJsonSafely<{ data?: Trade[] }>(res);
        if (!Array.isArray(json?.data)) {
          setLoadError(true);
          return;
        }
        setTrades(json.data ?? []);
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    } catch {
      if (requestId === loadSeqRef.current) setLoadError(true);
    } finally {
      if (requestId === loadSeqRef.current) setLoading(false);
    }
  }, [areaFilter, statusFilter]);

  const loadOpenWork = useCallback(async () => {
    const requestId = openWorkSeqRef.current + 1;
    openWorkSeqRef.current = requestId;
    setOpenWorkLoading(true);

    try {
      const params = new URLSearchParams();
      if (areaFilter) params.set("area", areaFilter);

      const res = await fetch(`/api/schedule/open-work?${params}`);
      if (handleAuthRedirect(res)) return;
      if (requestId !== openWorkSeqRef.current) return;

      if (res.ok) {
        const json = await parseJsonSafely<{ data?: OpenWorkResponse }>(res);
        if (!Array.isArray(json?.data?.openShifts) || !Array.isArray(json?.data?.pickupRequests)) {
          setOpenWorkError(true);
          return;
        }
        setOpenWork(json.data);
        setOpenWorkError(false);
      } else {
        setOpenWorkError(true);
      }
    } catch {
      if (requestId === openWorkSeqRef.current) setOpenWorkError(true);
    } finally {
      if (requestId === openWorkSeqRef.current) setOpenWorkLoading(false);
    }
  }, [areaFilter]);

  useEffect(() => {
    void loadTrades();
  }, [loadTrades]);

  useEffect(() => {
    void loadOpenWork();
  }, [loadOpenWork]);

  const filteredTrades = useMemo(() => {
    if (statusFilter === "OPEN_SHIFT" || statusFilter === "REQUESTED") return [];
    let result = trades;
    if (myTradesOnly) {
      result = result.filter(
        (trade) => trade.postedBy.id === currentUserId || trade.claimedBy?.id === currentUserId,
      );
    } else if (!statusFilter && !isStaff) {
      result = result.filter(
        (trade) => trade.status === "OPEN" || trade.postedBy.id === currentUserId,
      );
    }
    return result;
  }, [trades, statusFilter, isStaff, currentUserId, myTradesOnly]);

  const filteredOpenShifts = useMemo(() => {
    if (myTradesOnly) return [];
    if (statusFilter && statusFilter !== "OPEN_SHIFT") return [];
    return openWork.openShifts;
  }, [myTradesOnly, openWork.openShifts, statusFilter]);

  const filteredPickupRequests = useMemo(() => {
    if (!isStaff || myTradesOnly) return [];
    if (statusFilter && statusFilter !== "REQUESTED") return [];
    return openWork.pickupRequests;
  }, [isStaff, myTradesOnly, openWork.pickupRequests, statusFilter]);

  const reloadWork = useCallback(async () => {
    await Promise.all([loadTrades(), loadOpenWork()]);
  }, [loadOpenWork, loadTrades]);

  const beginAction = useCallback((tradeId: string) => {
    if (actingRef.current) return false;
    actingRef.current = tradeId;
    setActing(tradeId);
    return true;
  }, []);

  const endAction = useCallback((tradeId: string) => {
    if (actingRef.current !== tradeId) return;
    actingRef.current = null;
    setActing(null);
  }, []);

  const handleClaim = useCallback(async (tradeId: string) => {
    if (!beginAction(tradeId)) return;
    try {
      const res = await fetch(`/api/shift-trades/${tradeId}/claim`, { method: "POST" });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success("Trade claimed");
        await reloadWork();
      } else {
        const msg = await parseErrorMessage(res, "Failed to claim trade");
        toast.error(msg);
      }
    } catch {
      toast.error("Network error: could not claim trade");
    } finally {
      endAction(tradeId);
    }
  }, [beginAction, endAction, reloadWork]);

  const handleApprove = useCallback(async (tradeId: string) => {
    if (!beginAction(tradeId)) return;
    try {
      const res = await fetch(`/api/shift-trades/${tradeId}/approve`, { method: "PATCH" });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success("Trade approved");
        await reloadWork();
      } else {
        const msg = await parseErrorMessage(res, "Failed to approve trade");
        toast.error(msg);
      }
    } catch {
      toast.error("Network error: could not approve trade");
    } finally {
      endAction(tradeId);
    }
  }, [beginAction, endAction, reloadWork]);

  const handleDecline = useCallback(async (tradeId: string) => {
    if (!beginAction(tradeId)) return;
    try {
      const res = await fetch(`/api/shift-trades/${tradeId}/decline`, { method: "PATCH" });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success("Trade declined");
        await reloadWork();
      } else {
        const msg = await parseErrorMessage(res, "Failed to decline trade");
        toast.error(msg);
      }
    } catch {
      toast.error("Network error: could not decline trade");
    } finally {
      endAction(tradeId);
    }
  }, [beginAction, endAction, reloadWork]);

  const handleCancel = useCallback(async (trade: Trade) => {
    const tradeId = trade.id;
    const { eventLabel, windowLabel } = tradeCancelContext(trade);
    const ok = await confirm({
      title: "Cancel trade",
      message: `Cancel the trade posting for ${eventLabel} on ${windowLabel}? The shift stays assigned to ${trade.postedBy.name}.`,
      confirmLabel: "Cancel trade",
      variant: "danger",
    });
    if (!ok || !beginAction(tradeId)) return;

    try {
      const res = await fetch(`/api/shift-trades/${tradeId}/cancel`, { method: "PATCH" });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success(`Trade cancelled for ${eventLabel}`);
        await reloadWork();
      } else {
        const msg = await parseErrorMessage(res, "Failed to cancel trade");
        toast.error(msg);
      }
    } catch {
      toast.error("Network error: could not cancel trade");
    } finally {
      endAction(tradeId);
    }
  }, [beginAction, confirm, endAction, reloadWork]);

  const handlePickup = useCallback(async (shift: OpenWorkShift) => {
    const actionId = `pickup:${shift.id}`;
    if (!beginAction(actionId)) return;
    try {
      const res = await fetch("/api/shift-assignments/pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId: shift.id }),
      });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success(shift.action === "request" ? "Shift requested" : "Shift claimed");
        await reloadWork();
      } else {
        const msg = await parseErrorMessage(res, "Failed to claim shift");
        toast.error(msg);
      }
    } catch {
      toast.error("Network error: could not update shift");
    } finally {
      endAction(actionId);
    }
  }, [beginAction, endAction, reloadWork]);

  const handleApprovePickupRequest = useCallback(async (requestId: string) => {
    const actionId = `request:${requestId}`;
    if (!beginAction(actionId)) return;
    try {
      const res = await fetch(`/api/shift-assignments/${requestId}/approve`, { method: "PATCH" });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success("Pickup request approved");
        await reloadWork();
      } else {
        const msg = await parseErrorMessage(res, "Failed to approve request");
        toast.error(msg);
      }
    } catch {
      toast.error("Network error: could not approve request");
    } finally {
      endAction(actionId);
    }
  }, [beginAction, endAction, reloadWork]);

  const handleDeclinePickupRequest = useCallback(async (requestId: string) => {
    const actionId = `request:${requestId}`;
    if (!beginAction(actionId)) return;
    try {
      const res = await fetch(`/api/shift-assignments/${requestId}/decline`, { method: "PATCH" });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success("Pickup request declined");
        await reloadWork();
      } else {
        const msg = await parseErrorMessage(res, "Failed to decline request");
        toast.error(msg);
      }
    } catch {
      toast.error("Network error: could not decline request");
    } finally {
      endAction(actionId);
    }
  }, [beginAction, endAction, reloadWork]);

  const hasFilters = !!(areaFilter || statusFilter || myTradesOnly);
  const activeFilters: OperationalActiveFilter[] = [
    ...(areaFilter
      ? [{
        key: "area",
        label: `Area: ${AREA_LABELS[areaFilter] ?? areaFilter}`,
        onRemove: () => setAreaFilter(""),
      }]
      : []),
    ...(statusFilter
      ? [{
        key: "status",
        label: `Status: ${STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ?? statusFilter}`,
        onRemove: () => setStatusFilter(""),
      }]
      : []),
    ...(myTradesOnly
      ? [{
        key: "my-trades",
        label: "My trades",
        onRemove: () => setMyTradesOnly(false),
      }]
      : []),
  ];
  const totalRows = filteredOpenShifts.length + filteredPickupRequests.length + filteredTrades.length;
  const isLoadingWork = loading || openWorkLoading;
  const hasLoadError = loadError && openWorkError;
  const countLabel = `${totalRows} ${totalRows === 1 ? "item" : "items"}`;

  return (
    <div className="space-y-3">
      {!isStaff && (
        <div className="flex items-start gap-2.5 rounded-md border border-border/60 bg-muted/50 px-3 py-2.5 text-sm">
          <CalendarDaysIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="leading-snug text-muted-foreground">
            Claim open non-premier shifts here, request premier shifts for staff review, or post a trade from
            an assignment you already own.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            label="Area"
            value={areaFilter}
            displayValue={areaFilter ? AREA_LABELS[areaFilter] ?? areaFilter : ""}
            options={AREAS.map((area) => ({ value: area, label: AREA_LABELS[area] ?? area }))}
            onSelect={(value) => setAreaFilter(value)}
            onClear={() => setAreaFilter("")}
          />
          <FilterChip
            label="Status"
            value={statusFilter}
            displayValue={STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ?? ""}
            options={STATUS_OPTIONS}
            onSelect={(value) => setStatusFilter(value)}
            onClear={() => setStatusFilter("")}
          />
          <FilterChip
            label="My trades"
            value={myTradesOnly ? "mine" : ""}
            displayValue={myTradesOnly ? "My trades" : ""}
            options={[{ value: "mine", label: "My trades" }]}
            onSelect={() => setMyTradesOnly(true)}
            onClear={() => setMyTradesOnly(false)}
          />
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-full px-2.5 text-xs text-muted-foreground"
              onClick={() => {
                setAreaFilter("");
                setStatusFilter("");
                setMyTradesOnly(false);
              }}
            >
              Clear all
            </Button>
          )}
        </div>
        <OperationalActiveFilterChips filters={activeFilters} />
      </div>

      <Card elevation="flat" className="overflow-hidden border-border/60 shadow-sm">
        <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
          <CardTitle className="text-sm">Open Work</CardTitle>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">{countLabel}</span>
        </CardHeader>

        {isLoadingWork ? (
          <TradeSkeleton />
        ) : hasLoadError ? (
          <CardContent className="p-4 text-center">
            <p className="mb-3 text-sm text-muted-foreground">Failed to load open work.</p>
            <Button variant="outline" size="sm" onClick={reloadWork}>
              Retry
            </Button>
          </CardContent>
        ) : totalRows === 0 ? (
          <EmptyState
            icon="clipboard"
            title={hasFilters ? "No matching work" : "No open work"}
            description={
              hasFilters
                ? "Clear or adjust the filters to see more shift and trade activity."
                : "No shifts are currently open for pickup or posted for trade."
            }
            actionLabel={hasFilters ? "Clear filters" : undefined}
            onAction={hasFilters ? () => {
              setAreaFilter("");
              setStatusFilter("");
              setMyTradesOnly(false);
            } : undefined}
            compact
          />
        ) : (
          <div className="divide-y divide-border/50">
            {filteredOpenShifts.map((item) => {
              const shift = item.shift;
              const event = shift.shiftGroup.event;
              const titleParts = scheduleEventTitleParts({
                summary: event.summary,
                sportCode: event.sportCode,
                opponent: event.opponent ?? null,
                isHome: event.isHome ?? null,
              });
              const areaLabel = AREA_LABELS[shift.area] ?? shift.area;
              const isBusy = acting === `pickup:${item.id}`;
              const primaryWarning = item.advisoryConflictNote ?? item.warnings[0]?.label ?? null;

              return (
                <article
                  key={`open-${item.id}`}
                  className="group/open-work px-4 py-3 transition-colors hover:bg-muted/25"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <ClipboardListIcon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold leading-tight">{titleParts.title}</h3>
                          {titleParts.detail && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{titleParts.detail}</p>
                          )}
                        </div>
                        <Badge variant={item.action === "request" ? "orange" : "green"} size="sm">
                          {item.action === "request" ? "Request" : "Open"}
                        </Badge>
                      </div>

                      <div className="grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <CalendarClockIcon className="size-3.5 shrink-0" />
                          <span className="truncate tabular-nums">{formatShiftWindow(shift)}</span>
                        </span>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <ArrowLeftRightIcon className="size-3.5 shrink-0" />
                          <span className="truncate">{areaLabel}</span>
                        </span>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <ShieldCheckIcon className="size-3.5 shrink-0" />
                          <span className="truncate">{item.reason}</span>
                        </span>
                        {item.score !== null && (
                          <span className="flex min-w-0 items-center gap-1.5">
                            <Clock3Icon className="size-3.5 shrink-0" />
                            <span className="truncate tabular-nums">Fit score {item.score}</span>
                          </span>
                        )}
                      </div>

                      {primaryWarning && (
                        <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-2 text-xs leading-relaxed text-amber-800">
                          <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
                          <span>{primaryWarning}</span>
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => void handlePickup(item)}
                          disabled={acting !== null || !item.canAct}
                        >
                          <CheckIcon className="size-3.5" />
                          {isBusy
                            ? item.action === "request" ? "Requesting..." : "Claiming..."
                            : item.action === "request" ? "Request shift" : "Claim shift"}
                        </Button>
                        {item.requestCount > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {item.requestCount} pending {item.requestCount === 1 ? "request" : "requests"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            {filteredPickupRequests.map((request) => {
              const shift = request.shift;
              const event = shift.shiftGroup.event;
              const titleParts = scheduleEventTitleParts({
                summary: event.summary,
                sportCode: event.sportCode,
                opponent: event.opponent ?? null,
                isHome: event.isHome ?? null,
              });
              const isBusy = acting === `request:${request.id}`;

              return (
                <article
                  key={`request-${request.id}`}
                  className="group/open-request px-4 py-3 transition-colors hover:bg-muted/25"
                >
                  <div className="flex items-start gap-3">
                    <UserAvatar name={request.user.name} avatarUrl={request.user.avatarUrl ?? undefined} size="sm" className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold leading-tight">{titleParts.title}</h3>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {request.user.name} requested {AREA_LABELS[shift.area] ?? shift.area}
                          </p>
                        </div>
                        <Badge variant={request.hasConflict ? "orange" : "blue"} size="sm">
                          Request
                        </Badge>
                      </div>

                      <div className="grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <CalendarClockIcon className="size-3.5 shrink-0" />
                          <span className="truncate tabular-nums">{formatShiftWindow(shift)}</span>
                        </span>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Clock3Icon className="size-3.5 shrink-0" />
                          <span className="truncate tabular-nums">Requested {formatDateShort(request.createdAt)}</span>
                        </span>
                      </div>

                      {request.conflictNote && (
                        <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-2 text-xs leading-relaxed text-amber-800">
                          <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
                          <span>{request.conflictNote}</span>
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => void handleApprovePickupRequest(request.id)}
                          disabled={acting !== null}
                        >
                          <CheckIcon className="size-3.5" />
                          {isBusy ? "Approving..." : "Approve"}
                        </Button>
                        <OperationalRowActions label={`Actions for ${request.user.name} request`}>
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={acting !== null}
                            onSelect={() => void handleDeclinePickupRequest(request.id)}
                          >
                            <XIcon className="size-4" />
                            Decline
                          </DropdownMenuItem>
                        </OperationalRowActions>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            {filteredTrades.map((trade) => {
              const shift = trade.shiftAssignment.shift;
              const event = shift.shiftGroup.event;
              const titleParts = scheduleEventTitleParts({
                summary: event.summary,
                sportCode: event.sportCode,
                opponent: event.opponent ?? null,
                isHome: event.isHome ?? null,
              });
              const areaLabel = AREA_LABELS[shift.area] ?? shift.area;
              const meta = statusMeta(trade.status);
              const isOwnTrade = trade.postedBy.id === currentUserId;
              const isBusy = acting === trade.id;
              const canClaim = !isStaff && trade.status === "OPEN" && !isOwnTrade;
              const canCancel = isOwnTrade && (trade.status === "OPEN" || trade.status === "CLAIMED");
              const canReview = isStaff && trade.status === "CLAIMED";

              return (
                <article
                  key={trade.id}
                  className="group/trade px-4 py-3 transition-colors hover:bg-muted/25"
                >
                  <div className="flex items-start gap-3">
                    <UserAvatar name={trade.postedBy.name} size="sm" className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold leading-tight">{titleParts.title}</h3>
                          {titleParts.detail && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{titleParts.detail}</p>
                          )}
                        </div>
                        <Badge variant={meta.variant} size="sm">
                          {meta.label}
                        </Badge>
                      </div>

                      <div className="grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <CalendarClockIcon className="size-3.5 shrink-0" />
                          <span className="truncate tabular-nums">{formatShiftWindow(shift)}</span>
                        </span>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <ArrowLeftRightIcon className="size-3.5 shrink-0" />
                          <span className="truncate">{areaLabel}</span>
                        </span>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <ShieldCheckIcon className="size-3.5 shrink-0" />
                          <span className="truncate">
                            {trade.requiresApproval ? "Staff approval required" : "Instant swap"}
                          </span>
                        </span>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Clock3Icon className="size-3.5 shrink-0" />
                          <span className="truncate tabular-nums">Posted {formatDateShort(trade.postedAt)}</span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          Posted by <span className="font-medium text-foreground">{trade.postedBy.name}</span>
                        </span>
                        {trade.claimedBy && (
                          <span>
                            Claimed by <span className="font-medium text-foreground">{trade.claimedBy.name}</span>
                          </span>
                        )}
                        <span className={cn(
                          "font-medium",
                          trade.status === "OPEN" ? "text-[var(--green-text)]" : "text-muted-foreground",
                        )}>
                          {trade.status === "CLAIMED" && trade.requiresApproval
                            ? "Awaiting staff review"
                            : meta.helper}
                        </span>
                      </div>

                      {trade.notes && (
                        <p className="rounded-md bg-muted/40 px-2.5 py-2 text-xs leading-relaxed text-muted-foreground">
                          {trade.notes}
                        </p>
                      )}

                      {(canClaim || canCancel || canReview) && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {canClaim && (
                            <Button
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => void handleClaim(trade.id)}
                              disabled={acting !== null}
                            >
                              <CheckIcon className="size-3.5" />
                              {isBusy ? "Claiming..." : "Claim"}
                            </Button>
                          )}
                          {canReview && (
                            <Button
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => void handleApprove(trade.id)}
                              disabled={acting !== null}
                            >
                              <CheckIcon className="size-3.5" />
                              {isBusy ? "Approving..." : "Approve"}
                            </Button>
                          )}
                          {(canCancel || canReview) && (
                            <OperationalRowActions
                              label={`Actions for ${titleParts.title} trade`}
                            >
                              {canReview && (
                                <DropdownMenuItem
                                  variant="destructive"
                                  disabled={acting !== null}
                                  onSelect={() => void handleDecline(trade.id)}
                                >
                                  <XIcon className="size-4" />
                                  Decline
                                </DropdownMenuItem>
                              )}
                              {canReview && canCancel && <DropdownMenuSeparator />}
                              {canCancel && (
                                <DropdownMenuItem
                                  variant="destructive"
                                  disabled={acting !== null}
                                  onSelect={() => void handleCancel(trade)}
                                >
                                  <XIcon className="size-4" />
                                  {isBusy ? "Cancelling..." : "Cancel"}
                                </DropdownMenuItem>
                              )}
                            </OperationalRowActions>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
