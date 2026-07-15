"use client";

import Link from "next/link";
import { useState } from "react";
import { MapPin, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AssetImage } from "@/components/AssetImage";
import ChooseImageModal from "@/components/ChooseImageModal";
import type { BulkSkuDetail } from "../types";

export function BulkSkuHeader({
  sku,
  refreshing,
  canEdit,
  onRefresh,
  onImageChanged,
  operationsHref,
}: {
  sku: BulkSkuDetail;
  refreshing: boolean;
  canEdit: boolean;
  onRefresh: () => void;
  onImageChanged?: (url: string | null) => void;
  operationsHref?: string;
}) {
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const activeUnitCount = sku.trackByNumber
    ? sku.units.filter((unit) => unit.status !== "RETIRED").length
    : sku.onHand;

  return (
    <>
      <header className="mb-4 rounded-lg border border-border/50 bg-card px-4 py-4 shadow-xs sm:px-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
          {/* Image thumbnail — click to change when canEdit */}
          <button
            type="button"
            onClick={() => canEdit && setImageModalOpen(true)}
            className={canEdit
              ? "group relative shrink-0 cursor-pointer rounded-lg active:scale-[0.96] transition-transform"
              : "relative shrink-0 cursor-default rounded-lg"}
            aria-label={canEdit ? "Change image" : undefined}
            tabIndex={canEdit ? 0 : -1}
          >
            <AssetImage
              src={sku.imageUrl}
              alt={sku.name}
              size={72}
              className={canEdit ? "outline outline-1 outline-black/10 dark:outline-white/10 group-hover:opacity-70 transition-opacity" : "outline outline-1 outline-black/10 dark:outline-white/10"}
            />
            {canEdit && (
              <span className="absolute inset-0 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-medium text-white bg-black/40">
                Edit
              </span>
            )}
          </button>

          <div className="min-w-0">
            {/* Title */}
            <h1 className="text-balance text-2xl font-black tracking-tight sm:text-3xl" style={{ fontFamily: "var(--font-heading)" }}>
              {sku.name}
            </h1>

            {/* Meta line */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="tabular-nums">
                {activeUnitCount} {sku.trackByNumber ? "active units" : `${sku.unit} on hand`}
              </Badge>
              {sku.categoryRel?.name && (
                <span className="text-sm text-muted-foreground">{sku.categoryRel.name}</span>
              )}
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-3.5" />
                {sku.location.name}
              </span>
              {!sku.active && (
                <Badge variant="gray">Archived</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {operationsHref && canEdit && (
            <Button variant="outline" className="h-10 active:scale-[0.96] transition-transform" asChild>
              <Link href={operationsHref}>
                <Settings className="size-4" />
                Stockroom view
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            className="h-10 active:scale-[0.96] transition-transform"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh"
          >
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
        </div>
      </header>

      {canEdit && (
        <ChooseImageModal
          open={imageModalOpen}
          onClose={() => setImageModalOpen(false)}
          uploadEndpoint={`/api/bulk-skus/${sku.id}/image`}
          currentImageUrl={sku.imageUrl}
          searchQuery={sku.name}
          onImageChanged={(url) => {
            setImageModalOpen(false);
            onImageChanged?.(url);
          }}
        />
      )}
    </>
  );
}
