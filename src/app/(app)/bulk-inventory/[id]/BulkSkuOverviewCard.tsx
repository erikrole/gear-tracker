"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StatusIndicator from "@/components/ui/status-indicator";
import type { BulkSkuDetail } from "./types";

const STATUS_KEY_MAP: Record<string, "available" | "checkedOut" | "missing" | "retired"> = {
  AVAILABLE: "available",
  CHECKED_OUT: "checkedOut",
  LOST: "missing",
  RETIRED: "retired",
};

export function BulkSkuOverviewCard({ sku }: { sku: BulkSkuDetail }) {
  const unitCounts = sku.trackByNumber ? {
    available: sku.units.filter((u) => u.status === "AVAILABLE").length,
    checkedOut: sku.units.filter((u) => u.status === "CHECKED_OUT").length,
    lost: sku.units.filter((u) => u.status === "LOST").length,
    retired: sku.units.filter((u) => u.status === "RETIRED").length,
  } : null;
  const availableQuantity = unitCounts ? unitCounts.available : sku.availableQuantity;
  const totalQuantity = unitCounts ? sku.units.length : sku.onHand;
  const isLow = availableQuantity <= sku.minThreshold && sku.minThreshold > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Availability</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Big count */}
        <div className="flex items-baseline gap-1.5">
          <span
            className={`text-4xl font-black tabular-nums leading-none ${isLow ? "text-destructive" : ""}`}
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {availableQuantity}
          </span>
          <span className="text-muted-foreground text-sm">/ {totalQuantity}</span>
          <span className="text-muted-foreground text-xs ml-1">{sku.unit}</span>
        </div>
        {isLow && <Badge variant="orange" className="text-xs">Low stock</Badge>}

        {/* Unit breakdown */}
        {unitCounts && (
          <div className="space-y-1.5 pt-1 border-t border-border/40">
            {(["available", "checkedOut", "lost", "retired"] as const).map((key) => {
              const count = unitCounts[key];
              if (count === 0) return null;
              const statusKey = key === "checkedOut" ? "CHECKED_OUT" : key.toUpperCase();
              const label = key === "checkedOut" ? "Checked out" : key === "lost" ? "Missing" : key.charAt(0).toUpperCase() + key.slice(1);
              return (
                <div key={key} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5">
                    <StatusIndicator state={STATUS_KEY_MAP[statusKey] ?? "inactive"} size="sm" aria-hidden={true} />
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                  <span className="tabular-nums font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Threshold */}
        {sku.minThreshold > 0 && (
          <div className="text-xs text-muted-foreground pt-1 border-t border-border/40">
            Low-stock threshold: {sku.minThreshold}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
