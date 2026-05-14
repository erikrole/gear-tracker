"use client";

import Link from "next/link";
import { useState } from "react";
import { RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  return (
    <>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div className="flex items-start gap-4">
          {/* Image thumbnail — click to change when canEdit */}
          <button
            type="button"
            onClick={() => canEdit && setImageModalOpen(true)}
            className={canEdit ? "cursor-pointer shrink-0 group relative" : "cursor-default shrink-0"}
            aria-label={canEdit ? "Change image" : undefined}
            tabIndex={canEdit ? 0 : -1}
          >
            <AssetImage
              src={sku.imageUrl}
              alt={sku.name}
              size={64}
              className={canEdit ? "group-hover:opacity-70 transition-opacity" : ""}
            />
            {canEdit && (
              <span className="absolute inset-0 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-medium text-white bg-black/40">
                Edit
              </span>
            )}
          </button>

          <div>
            {/* Title */}
            <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
              {sku.name}
            </h1>

            {/* Meta line */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">
                {sku.trackByNumber ? "Units" : "Quantity"}
              </span>
              {sku.categoryRel?.name && (
                <span className="text-sm text-muted-foreground">{sku.categoryRel.name}</span>
              )}
              <span className="text-sm text-muted-foreground">{sku.location.name}</span>
              {!sku.active && (
                <span className="rounded-sm border border-border px-1.5 py-0.5 text-xs text-muted-foreground">Archived</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          {operationsHref && canEdit && (
            <Button variant="outline" size="sm" asChild>
              <Link href={operationsHref}>
                <Settings className="size-3.5" />
                Stockroom view
              </Link>
            </Button>
          )}
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

      {canEdit && (
        <ChooseImageModal
          open={imageModalOpen}
          onClose={() => setImageModalOpen(false)}
          uploadEndpoint={`/api/bulk-skus/${sku.id}/image`}
          currentImageUrl={sku.imageUrl}
          onImageChanged={(url) => {
            setImageModalOpen(false);
            onImageChanged?.(url);
          }}
        />
      )}
    </>
  );
}
