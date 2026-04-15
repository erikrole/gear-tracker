"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BulkSkuDetail } from "../types";

export function BulkSkuHeader({
  sku,
  refreshing,
  canEdit,
  onRefresh,
}: {
  sku: BulkSkuDetail;
  refreshing: boolean;
  canEdit: boolean;
  onRefresh: () => void;
}) {
  void canEdit; // reserved for future edit-in-header actions
  const isLow = sku.availableQuantity <= sku.minThreshold && sku.minThreshold > 0;

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between mb-6">
      <div>
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2" aria-label="Breadcrumb">
          <Link href="/items" className="hover:text-foreground transition-colors">Items</Link>
          <span aria-hidden="true">/</span>
          <span className="text-foreground truncate max-w-[240px]">{sku.name}</span>
        </nav>

        {/* Title */}
        <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
          {sku.name}
        </h1>

        {/* Meta line */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <Badge variant="secondary" className="text-xs rounded-sm">Bulk</Badge>
          {sku.categoryRel?.name && (
            <span className="text-sm text-muted-foreground">{sku.categoryRel.name}</span>
          )}
          <span className="text-sm text-muted-foreground">{sku.location.name}</span>
          {!sku.active && (
            <Badge variant="outline" className="text-xs text-muted-foreground">Archived</Badge>
          )}
        </div>

        {/* Availability */}
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-sm font-semibold tabular-nums ${isLow ? "text-destructive" : ""}`}>
            {sku.availableQuantity} / {sku.onHand} {sku.unit} available
          </span>
          {isLow && <Badge variant="orange">low stock</Badge>}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2 sm:mt-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh"
        >
          <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
    </div>
  );
}
