"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BatteryCharging, CircleAlert, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

type UnitStatus = "AVAILABLE" | "CHECKED_OUT" | "LOST" | "RETIRED";

type BatteryUnit = {
  id: string;
  unitNumber: number;
  status: UnitStatus;
  notes: string | null;
  checkedOutAt: string | null;
  checkedOutDays: number | null;
  booking: {
    id: string;
    title: string;
    refNumber: string | null;
    endsAt: string;
    requesterName: string;
  } | null;
};

type BatterySku = {
  id: string;
  name: string;
  category: string;
  location: { id: string; name: string };
  minThreshold: number;
  threshold: number;
  binQrCodeValue: string;
  counts: {
    total: number;
    available: number;
    checkedOut: number;
    lost: number;
    retired: number;
  };
  isLow: boolean;
  units: BatteryUnit[];
};

type BatteryCockpitData = {
  totals: {
    total: number;
    available: number;
    checkedOut: number;
    lost: number;
    retired: number;
    lowSkus: number;
    agingCheckedOut: number;
  };
  skus: BatterySku[];
  compatibility: BatteryCompatibility[];
};

type BatteryCompatibility = {
  ruleId: string;
  label: string;
  cameraModels: string[];
  cameraCount: number;
  batterySkuIds: string[];
  batterySkuNames: string[];
  availableQuantity: number;
  threshold: number;
  isLow: boolean;
};

type PendingAction = {
  skuId: string;
  skuName: string;
  unitNumber: number;
  status: Exclude<UnitStatus, "CHECKED_OUT">;
} | null;

const STATUS_META: Record<UnitStatus, { label: string; className: string; dot: string }> = {
  AVAILABLE: {
    label: "Available",
    className: "bg-[var(--green-bg)] text-[var(--green-text)] hover:bg-[var(--green-bg)]",
    dot: "bg-[var(--green)]",
  },
  CHECKED_OUT: {
    label: "Checked out",
    className: "bg-[var(--blue-bg)] text-[var(--blue-text)] hover:bg-[var(--blue-bg)]",
    dot: "bg-[var(--blue)]",
  },
  LOST: {
    label: "Lost",
    className: "bg-[var(--red-bg)] text-[var(--red-text)] hover:bg-[var(--red-bg)]",
    dot: "bg-destructive",
  },
  RETIRED: {
    label: "Retired",
    className: "bg-muted text-muted-foreground hover:bg-muted",
    dot: "bg-muted-foreground",
  },
};

function metricLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatDue(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

export default function BatteryCockpitPage() {
  const [data, setData] = useState<BatteryCockpitData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  async function load({ refresh = false } = {}) {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/bulk-skus/batteries");
      if (handleAuthRedirect(res, "/bulk-inventory/batteries")) return;
      if (!res.ok) {
        const message = await parseErrorMessage(res, "Failed to load batteries");
        if (!refresh) setError(message);
        else toast.error(message);
        return;
      }
      const json = await res.json();
      setData(json.data);
      setError(null);
    } catch {
      if (refresh) toast.error("Network error — battery data may be stale.");
      else setError("Network error — try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const checkedOutUnits = useMemo(() => {
    return (data?.skus ?? [])
      .flatMap((sku) =>
        sku.units
          .filter((unit) => unit.status === "CHECKED_OUT")
          .map((unit) => ({ ...unit, skuId: sku.id, skuName: sku.name, locationName: sku.location.name })),
      )
      .sort((a, b) => (b.checkedOutDays ?? -1) - (a.checkedOutDays ?? -1));
  }, [data]);

  async function applyStatusChange(action: NonNullable<PendingAction>) {
    if (busyRef.current) return;
    busyRef.current = true;
    const key = `${action.skuId}-${action.unitNumber}`;
    setBusyKey(key);

    try {
      const res = await fetch(`/api/bulk-skus/${action.skuId}/units/${action.unitNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action.status }),
      });
      if (handleAuthRedirect(res, "/bulk-inventory/batteries")) return;
      if (!res.ok) {
        toast.error(await parseErrorMessage(res, "Failed to update unit"));
        return;
      }

      toast.success(`#${action.unitNumber} marked ${STATUS_META[action.status].label.toLowerCase()}`);
      setData((prev) => updateUnitStatus(prev, action));
    } catch {
      toast.error("Network error — unit was not updated.");
    } finally {
      busyRef.current = false;
      setBusyKey(null);
      setPendingAction(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <EmptyState
        icon="wifi-off"
        title="Battery cockpit unavailable"
        description={error}
        actionLabel="Retry"
        onAction={() => void load()}
      />
    );
  }

  const totals = data?.totals;

  return (
    <div className="space-y-5">
      <PageHeader title="Battery Cockpit">
        <Button variant="outline" size="sm" onClick={() => void load({ refresh: true })} disabled={refreshing}>
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </PageHeader>

      {totals && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricCard label="Available" value={totals.available} tone="green" />
          <MetricCard label="Checked out" value={totals.checkedOut} tone="blue" />
          <MetricCard label="Lost" value={totals.lost} tone="red" />
          <MetricCard label="Retired" value={totals.retired} tone="muted" />
          <MetricCard label="Low SKUs" value={totals.lowSkus} tone={totals.lowSkus ? "red" : "muted"} />
        </div>
      )}

      {data && data.compatibility.length > 0 && (
        <Card className="border-orange-200/70 bg-orange-50/40 shadow-none dark:border-orange-900/50 dark:bg-orange-950/10">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CircleAlert className="size-4 text-[var(--orange-text)]" />
                Compatible battery lows
              </CardTitle>
              <Badge variant="orange">{metricLabel(data.compatibility.length, "family", "families")}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 lg:grid-cols-2">
              {data.compatibility.map((item) => (
                <CompatibilityRow key={item.ruleId} item={item} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data && data.skus.length === 0 ? (
        <EmptyState
          icon="box"
          title="No numbered batteries found"
          description="Battery SKUs appear here when they are active, numbered bulk inventory."
          actionLabel="Back to Items"
          actionHref="/items"
        />
      ) : (
        <>
          <Card className="border-border/40 shadow-none">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Checked-out units</CardTitle>
                {totals && totals.agingCheckedOut > 0 && (
                  <Badge variant="orange" className="gap-1">
                    <CircleAlert className="size-3" />
                    {metricLabel(totals.agingCheckedOut, "unit")} out 7d+
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {checkedOutUnits.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No battery units are currently checked out.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Unit</TableHead>
                        <TableHead>Battery</TableHead>
                        <TableHead>Holder</TableHead>
                        <TableHead>Booking</TableHead>
                        <TableHead className="text-right">Age</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {checkedOutUnits.map((unit) => (
                        <TableRow key={unit.id}>
                          <TableCell className="font-mono tabular-nums">#{unit.unitNumber}</TableCell>
                          <TableCell>
                            <Link href={`/bulk-inventory/${unit.skuId}`} className="font-medium hover:underline">
                              {unit.skuName}
                            </Link>
                            <div className="text-xs text-muted-foreground">{unit.locationName}</div>
                          </TableCell>
                          <TableCell>{unit.booking?.requesterName ?? "Unknown"}</TableCell>
                          <TableCell>
                            {unit.booking ? (
                              <Link href={`/bookings?highlight=${unit.booking.id}`} className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
                                {unit.booking.refNumber ?? unit.booking.title}
                                <ExternalLink className="size-3" />
                              </Link>
                            ) : (
                              <span className="text-sm text-muted-foreground">No booking context</span>
                            )}
                            {unit.booking && (
                              <div className="text-xs text-muted-foreground">Due {formatDue(unit.booking.endsAt)}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {unit.checkedOutDays === null ? "n/a" : `${unit.checkedOutDays}d`}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            {data?.skus.map((sku) => (
              <Card key={sku.id} className="border-border/40 shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <BatteryCharging className="size-4 text-muted-foreground" />
                        <Link href={`/bulk-inventory/${sku.id}`} className="truncate hover:underline">
                          {sku.name}
                        </Link>
                      </CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">{sku.location.name} / {sku.category}</p>
                    </div>
                    {sku.isLow && (
                      <Badge variant="orange" className="shrink-0">Low stock</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-4 gap-2 text-sm">
                    <Count label="Avail" value={sku.counts.available} dot={STATUS_META.AVAILABLE.dot} />
                    <Count label="Out" value={sku.counts.checkedOut} dot={STATUS_META.CHECKED_OUT.dot} />
                    <Count label="Lost" value={sku.counts.lost} dot={STATUS_META.LOST.dot} />
                    <Count label="Retired" value={sku.counts.retired} dot={STATUS_META.RETIRED.dot} />
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(74px,1fr))] gap-2">
                    {sku.units.map((unit) => (
                      <UnitMenu
                        key={unit.id}
                        sku={sku}
                        unit={unit}
                        busy={busyKey === `${sku.id}-${unit.unitNumber}`}
                        onPendingAction={setPendingAction}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <AlertDialog open={!!pendingAction} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Mark unit {pendingAction ? `#${pendingAction.unitNumber}` : ""} {pendingAction ? STATUS_META[pendingAction.status].label.toLowerCase() : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This updates stock availability and writes an audit entry for {pendingAction?.skuName}. Checked-out units still need to be returned through check-in before their status can change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingAction && void applyStatusChange(pendingAction)}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: "green" | "blue" | "red" | "muted" }) {
  const toneClass = {
    green: "text-[var(--green-text)]",
    blue: "text-[var(--blue-text)]",
    red: "text-destructive",
    muted: "text-foreground",
  }[tone];

  return (
    <Card className="border-border/40 shadow-none">
      <CardContent className="p-4">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={cn("mt-1 text-2xl font-black tabular-nums", toneClass)} style={{ fontFamily: "var(--font-heading)" }}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function Count({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={cn("size-1.5 rounded-full", dot)} />
        {label}
      </div>
      <div className="mt-1 font-mono text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function CompatibilityRow({ item }: { item: BatteryCompatibility }) {
  const shortage = Math.max(0, item.threshold - item.availableQuantity);
  const models = item.cameraModels.length > 0 ? item.cameraModels.join(", ") : "Matched camera inventory";
  const batteries = item.batterySkuNames.join(", ");

  return (
    <div className="rounded-md border border-orange-200/70 bg-background/80 p-3 dark:border-orange-900/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">{item.label}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {models} / {metricLabel(item.cameraCount, "camera")} matched
          </div>
        </div>
        <Badge variant="orange" className="shrink-0">{shortage} short</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-md bg-muted px-2 py-1 tabular-nums">
          {item.availableQuantity} available / {item.threshold} threshold
        </span>
        {batteries && <span className="rounded-md bg-muted px-2 py-1">{batteries}</span>}
      </div>
    </div>
  );
}

function UnitMenu({
  sku,
  unit,
  busy,
  onPendingAction,
}: {
  sku: BatterySku;
  unit: BatteryUnit;
  busy: boolean;
  onPendingAction: (action: PendingAction) => void;
}) {
  const meta = STATUS_META[unit.status];
  const content = (
    <div
      className={cn(
        "flex min-h-12 flex-col items-start justify-center rounded-md px-2.5 py-2 text-left transition-[background-color,scale] active:scale-[0.96]",
        meta.className,
        unit.status === "CHECKED_OUT" ? "cursor-default opacity-80" : "cursor-pointer",
      )}
    >
      <span className="font-mono text-sm font-semibold tabular-nums">#{unit.unitNumber}</span>
      <span className="text-[10px] leading-tight">{busy ? "Updating..." : meta.label}</span>
    </div>
  );

  if (unit.status === "CHECKED_OUT") {
    return content;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" disabled={busy} className="text-left disabled:pointer-events-none disabled:opacity-60">
          {content}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          disabled={unit.status === "AVAILABLE"}
          onClick={() => onPendingAction({ skuId: sku.id, skuName: sku.name, unitNumber: unit.unitNumber, status: "AVAILABLE" })}
        >
          Release to available
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={unit.status === "LOST"}
          className="text-destructive focus:text-destructive"
          onClick={() => onPendingAction({ skuId: sku.id, skuName: sku.name, unitNumber: unit.unitNumber, status: "LOST" })}
        >
          Mark lost
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={unit.status === "RETIRED"}
          onClick={() => onPendingAction({ skuId: sku.id, skuName: sku.name, unitNumber: unit.unitNumber, status: "RETIRED" })}
        >
          Retire unit
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function updateUnitStatus(data: BatteryCockpitData | null, action: NonNullable<PendingAction>): BatteryCockpitData | null {
  if (!data) return data;

  let availableDelta = 0;
  const skus = data.skus.map((sku) => {
    if (sku.id !== action.skuId) return sku;
    const units = sku.units.map((unit) => {
      if (unit.unitNumber !== action.unitNumber) return unit;
      if (unit.status === "AVAILABLE" && action.status !== "AVAILABLE") availableDelta -= 1;
      if (unit.status !== "AVAILABLE" && action.status === "AVAILABLE") availableDelta += 1;
      return { ...unit, status: action.status, checkedOutAt: null, checkedOutDays: null, booking: null };
    });
    const counts = {
      total: units.length,
      available: units.filter((unit) => unit.status === "AVAILABLE").length,
      checkedOut: units.filter((unit) => unit.status === "CHECKED_OUT").length,
      lost: units.filter((unit) => unit.status === "LOST").length,
      retired: units.filter((unit) => unit.status === "RETIRED").length,
    };
    return { ...sku, units, counts, isLow: counts.available < sku.threshold };
  });

  const totals = skus.reduce(
    (acc, sku) => {
      acc.total += sku.counts.total;
      acc.available += sku.counts.available;
      acc.checkedOut += sku.counts.checkedOut;
      acc.lost += sku.counts.lost;
      acc.retired += sku.counts.retired;
      if (sku.isLow) acc.lowSkus += 1;
      acc.agingCheckedOut += sku.units.filter(
        (unit) => unit.status === "CHECKED_OUT" && (unit.checkedOutDays ?? 0) >= 7,
      ).length;
      return acc;
    },
    { total: 0, available: 0, checkedOut: 0, lost: 0, retired: 0, lowSkus: 0, agingCheckedOut: 0 },
  );

  const compatibility = availableDelta === 0
    ? data.compatibility
    : data.compatibility.map((item) =>
        item.batterySkuIds.includes(action.skuId)
          ? {
              ...item,
              availableQuantity: item.availableQuantity + availableDelta,
              isLow: item.availableQuantity + availableDelta < item.threshold,
            }
          : item,
      ).filter((item) => item.isLow);

  return { totals, skus, compatibility };
}
