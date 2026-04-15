"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, MapPin, Package } from "lucide-react";
import { FadeUp } from "@/components/ui/motion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";

/* ── Types ──────────────────────────────────────────────────── */

type BulkUnit = {
  id: string;
  unitNumber: number;
  status: "AVAILABLE" | "CHECKED_OUT" | "LOST" | "RETIRED";
  notes: string | null;
  allocations?: Array<{
    bookingBulkItem: {
      booking: { refNumber: string | null; title: string; requester: { name: string } };
    };
  }>;
};

type BulkSkuDetail = {
  id: string;
  name: string;
  category: string;
  unit: string;
  binQrCodeValue: string;
  minThreshold: number;
  trackByNumber: boolean;
  active: boolean;
  onHand: number;
  availableQuantity: number;
  location: { id: string; name: string };
  categoryRel: { id: string; name: string } | null;
  balances: Array<{ onHandQuantity: number }>;
  units: BulkUnit[];
};

/* ── Unit grid status config ─────────────────────────────────── */

const UNIT_STYLES: Record<string, { bg: string; dot: string; label: string }> = {
  AVAILABLE:   { bg: "bg-[var(--green-bg)]",  dot: "bg-[var(--green)]",       label: "Available" },
  CHECKED_OUT: { bg: "bg-[var(--blue-bg)]",   dot: "bg-[var(--blue)]",        label: "Checked out" },
  LOST:        { bg: "bg-[var(--red-bg)]",    dot: "bg-destructive",           label: "Lost" },
  RETIRED:     { bg: "bg-muted",              dot: "bg-muted-foreground",      label: "Retired" },
};

/* ── Main Page ───────────────────────────────────────────────── */

export default function BulkSkuDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [sku, setSku] = useState<BulkSkuDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [updatingUnit, setUpdatingUnit] = useState<number | null>(null);

  const loadSku = useCallback(() => {
    setLoading(true);
    fetch(`/api/bulk-skus/${id}`)
      .then((res) => {
        if (handleAuthRedirect(res)) return null;
        if (res.status === 404) { setNotFound(true); return null; }
        if (!res.ok) throw new Error("server");
        return res.json();
      })
      .then((json) => { if (json?.data) setSku(json.data); })
      .catch(() => toast.error("Failed to load SKU"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadSku(); }, [loadSku]);

  async function handleUnitStatusChange(unitNumber: number, currentStatus: string) {
    if (currentStatus === "CHECKED_OUT") return;
    const next =
      currentStatus === "AVAILABLE" ? "LOST" :
      currentStatus === "LOST" ? "RETIRED" : "AVAILABLE";

    setUpdatingUnit(unitNumber);
    try {
      const res = await fetch(`/api/bulk-skus/${id}/units/${unitNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) { toast.error(await parseErrorMessage(res, "Failed to update unit")); return; }
      loadSku();
    } catch {
      toast.error("Network error — try again");
    } finally {
      setUpdatingUnit(null);
    }
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (notFound || !sku) {
    return (
      <EmptyState
        icon="box"
        title="SKU not found"
        description="This bulk SKU may have been deleted."
        actionLabel="Back to Bulk Inventory"
        actionHref="/bulk-inventory"
      />
    );
  }

  const categoryName = sku.categoryRel?.name || sku.category;
  const available = sku.availableQuantity;
  const onHand = sku.onHand;
  const isLow = available <= sku.minThreshold && sku.minThreshold > 0;

  /* ── Unit grid summary ── */
  const unitCounts = sku.trackByNumber ? {
    available: sku.units.filter((u) => u.status === "AVAILABLE").length,
    checkedOut: sku.units.filter((u) => u.status === "CHECKED_OUT").length,
    lost: sku.units.filter((u) => u.status === "LOST").length,
    retired: sku.units.filter((u) => u.status === "RETIRED").length,
  } : null;

  return (
    <FadeUp>
      {/* Back link */}
      <Link
        href="/bulk-inventory"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
      >
        <ChevronLeft className="size-3.5" />
        Bulk Inventory
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
              {sku.name}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {sku.location.name}
              </span>
              <span className="flex items-center gap-1">
                <Package className="size-3.5" />
                {categoryName}
              </span>
              <span className="tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
                {sku.unit}
              </span>
            </div>
          </div>

          {/* Availability badge */}
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-3xl font-black tabular-nums leading-none ${isLow ? "text-destructive" : ""}`}
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {available}
            </span>
            <span className="text-muted-foreground text-sm">
              / {onHand} available
            </span>
            {isLow && <Badge variant="orange" className="ml-1">low stock</Badge>}
          </div>
        </div>
      </div>

      {/* Numbered unit grid */}
      {sku.trackByNumber && sku.units.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-card">
          {/* Grid header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm font-semibold">Units</span>
              {unitCounts && (
                <>
                  {unitCounts.available > 0 && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-[var(--green)] shrink-0" />
                      {unitCounts.available} available
                    </span>
                  )}
                  {unitCounts.checkedOut > 0 && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-[var(--blue)] shrink-0" />
                      {unitCounts.checkedOut} out
                    </span>
                  )}
                  {unitCounts.lost > 0 && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-destructive shrink-0" />
                      {unitCounts.lost} lost
                    </span>
                  )}
                  {unitCounts.retired > 0 && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-muted-foreground shrink-0" />
                      {unitCounts.retired} retired
                    </span>
                  )}
                </>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground/50 hidden sm:block" style={{ fontFamily: "var(--font-mono)" }}>
              click to cycle: available → lost → retired
            </span>
          </div>

          {/* Grid */}
          <div className="p-4">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1.5">
              {sku.units.map((u) => {
                const style = UNIT_STYLES[u.status];
                const lastAlloc = u.allocations?.[0]?.bookingBulkItem?.booking;
                const lastUser = lastAlloc?.requester?.name;
                const lastRef = lastAlloc?.refNumber || lastAlloc?.title;
                const isUpdating = updatingUnit === u.unitNumber;
                const isClickable = u.status !== "CHECKED_OUT";

                return (
                  <button
                    key={u.id}
                    type="button"
                    title={[
                      `#${u.unitNumber} — ${style.label}`,
                      lastUser && `Last: ${lastUser}${lastRef ? ` (${lastRef})` : ""}`,
                      u.notes,
                    ].filter(Boolean).join(" · ")}
                    disabled={!isClickable || isUpdating}
                    onClick={() => handleUnitStatusChange(u.unitNumber, u.status)}
                    className={[
                      "flex flex-col items-center justify-center gap-0 px-1 py-1.5 rounded-md text-sm font-semibold",
                      style.bg,
                      isClickable && !isUpdating ? "cursor-pointer hover:opacity-80 transition-opacity" : "cursor-default",
                      isUpdating ? "opacity-50" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-1">
                      <div className={`size-1.5 rounded-full shrink-0 ${style.dot}`} />
                      <span style={{ fontFamily: "var(--font-mono)" }}>{u.unitNumber}</span>
                    </div>
                    {u.status === "LOST" && lastUser && (
                      <div className="text-[9px] font-normal text-muted-foreground truncate max-w-full leading-tight">
                        {lastUser.split(" ")[0]}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Non-numbered quantity view */}
      {!sku.trackByNumber && (
        <div className="rounded-lg border border-border/60 bg-card p-6">
          <div className="text-sm text-muted-foreground mb-1">On hand quantity</div>
          <div className="text-4xl font-black tabular-nums" style={{ fontFamily: "var(--font-heading)" }}>
            {onHand}
          </div>
          <div className="text-sm text-muted-foreground mt-1">{sku.unit}</div>
        </div>
      )}
    </FadeUp>
  );
}
