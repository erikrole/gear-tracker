"use client";

import { ArrowRight, CircleAlert, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BulkSkuDetail } from "./types";

const STATUS_META = {
  available: { label: "Available", tone: "text-[var(--green-text)]", dot: "bg-[var(--green)]" },
  checkedOut: { label: "Checked out", tone: "text-[var(--blue-text)]", dot: "bg-[var(--blue)]" },
  lost: { label: "Missing", tone: "text-destructive", dot: "bg-destructive" },
  retired: { label: "Retired records", tone: "text-muted-foreground", dot: "bg-muted-foreground" },
} as const;

export function BulkSkuOverviewCard({
  sku,
  onOpenUnits,
}: {
  sku: BulkSkuDetail;
  onOpenUnits?: () => void;
}) {
  const unitCounts = sku.trackByNumber ? {
    available: sku.units.filter((unit) => unit.status === "AVAILABLE").length,
    checkedOut: sku.units.filter((unit) => unit.status === "CHECKED_OUT").length,
    lost: sku.units.filter((unit) => unit.status === "LOST").length,
    retired: sku.units.filter((unit) => unit.status === "RETIRED").length,
  } : null;
  const activeUnits = sku.trackByNumber
    ? sku.units.filter((unit) => unit.status !== "RETIRED")
    : [];
  const activeTotal = unitCounts
    ? unitCounts.available + unitCounts.checkedOut + unitCounts.lost
    : sku.onHand;
  const availableQuantity = unitCounts?.available ?? sku.availableQuantity;
  const labeledActive = activeUnits.filter((unit) => unit.labelPrintedAt).length;
  const labelsNeeded = activeUnits.length - labeledActive;
  const isLow = availableQuantity <= sku.minThreshold && sku.minThreshold > 0;

  return (
    <Card className="border-border/40 shadow-none">
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Inventory</CardTitle>
            <CardDescription className="mt-1 text-pretty">
              Active stock and the unit records that need attention.
            </CardDescription>
          </div>
          {isLow ? <Badge variant="orange">Low stock</Badge> : <Badge variant="green">Stocked</Badge>}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 pt-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-5xl font-black leading-none tabular-nums ${isLow ? "text-destructive" : ""}`}
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {availableQuantity}
              </span>
              <span className="text-sm font-medium text-muted-foreground">available now</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {sku.trackByNumber ? (
                <>of <span className="font-semibold tabular-nums text-foreground">{activeTotal}</span> active units</>
              ) : (
                <><span className="font-semibold tabular-nums text-foreground">{activeTotal}</span> {sku.unit} on hand</>
              )}
            </p>
          </div>
          {sku.trackByNumber && onOpenUnits ? (
            <Button variant="outline" className="h-10 active:scale-[0.96] transition-transform" onClick={onOpenUnits}>
              Manage units
              <ArrowRight className="size-4" />
            </Button>
          ) : null}
        </div>

        {unitCounts ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(unitCounts) as Array<keyof typeof unitCounts>).map((key) => {
              const meta = STATUS_META[key];
              const count = unitCounts?.[key] ?? 0;
              return (
                <div key={key} className="rounded-md bg-muted/45 px-3 py-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`size-1.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </div>
                  <div className={`mt-1.5 text-xl font-semibold tabular-nums ${meta.tone}`}>
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {sku.trackByNumber ? (
          <div className="grid gap-3 border-t border-border/40 pt-4 sm:grid-cols-2">
            <div className="flex items-start gap-2.5">
              <Tag className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Labels</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {labelsNeeded === 0
                    ? `All ${activeTotal} active units are labeled.`
                    : `${labelsNeeded} active ${labelsNeeded === 1 ? "unit needs" : "units need"} a label.`}
                </div>
              </div>
            </div>
            {(unitCounts?.retired ?? 0) > 0 ? (
              <div className="flex items-start gap-2.5">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Retired records stay numbered</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Kept for labels and audit, but excluded from active inventory.
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {sku.minThreshold > 0 ? (
          <div className="border-t border-border/40 pt-3 text-xs text-muted-foreground">
            Low-stock warning starts at {sku.minThreshold} available.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
