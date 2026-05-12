"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { InlineTitle } from "@/components/InlineTitle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PencilIcon, ImageIcon, RefreshCw, Star, ChevronRight } from "lucide-react";

import type { AssetDetail } from "../types";
import { getAttachmentKind, getSdCardSlotLabel } from "@/lib/asset-attachments";
import { normalizeAssetImageSrc } from "@/lib/asset-image";

/* ── Status Line ────────────────────────────────────────── */

function StatusLine({ asset }: { asset: AssetDetail }) {
  const s = asset.computedStatus;
  const b = asset.activeBooking;

  if (s === "AVAILABLE") return <Badge variant="green" className="px-2.5 py-1 text-xs">Available</Badge>;
  if (s === "CHECKED_OUT" && b) {
    const href = `/checkouts/${b.id}`;
    return (
      <Badge variant="blue" className="px-2.5 py-1 text-xs" asChild>
        <Link href={href} className="no-underline">
          Checked out by {b.requesterName}
        </Link>
      </Badge>
    );
  }
  if (s === "PENDING_PICKUP" && b) {
    return (
      <Badge variant="orange" className="px-2.5 py-1 text-xs" asChild>
        <Link href={`/checkouts/${b.id}`} className="no-underline">
          Awaiting pickup by {b.requesterName}
        </Link>
      </Badge>
    );
  }
  if (s === "RESERVED" && b) {
    return (
      <Badge variant="purple" className="px-2.5 py-1 text-xs" asChild>
        <Link href={`/reservations/${b.id}`} className="no-underline">
          Reserved by {b.requesterName}
        </Link>
      </Badge>
    );
  }
  if (s === "MAINTENANCE") return <Badge variant="orange" className="px-2.5 py-1 text-xs">Needs maintenance</Badge>;
  if (s === "RETIRED") return <Badge variant="gray" className="px-2.5 py-1 text-xs">Retired</Badge>;
  return <Badge variant="gray" className="px-2.5 py-1 text-xs">{s}</Badge>;
}

/* ── Actions Dropdown ───────────────────────────────────── */

function ActionsMenu({
  asset,
  disabled,
  onAction,
}: {
  asset: AssetDetail;
  disabled?: boolean;
  onAction: (action: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onAction("duplicate")}>Duplicate</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("print-label")}>Print label</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("maintenance")}>
          {asset.status === "MAINTENANCE" ? "Clear Maintenance" : "Needs Maintenance"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("retire")}>Retire</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={asset.hasBookingHistory}
          title={asset.hasBookingHistory ? "Item has booking history — use Retire instead" : "Permanently delete this item"}
          onSelect={() => onAction("delete")}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function includesLoose(haystack: string, needle: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const normalizedNeedle = normalize(needle);
  return normalizedNeedle.length > 0 && normalize(haystack).includes(normalizedNeedle);
}

/* ── Item Header ────────────────────────────────────────── */

type ItemHeaderProps = {
  asset: AssetDetail;
  canEdit: boolean;
  refreshing: boolean;
  actionBusy: boolean;
  lastRefreshed: Date | null;
  onRefresh: () => void;
  onToggleFavorite: () => void;
  onSaveHeaderField: (field: string, value: string) => Promise<void>;
  onAction: (action: string) => void;
  onImageModalOpen: () => void;
};

export function ItemHeader({
  asset,
  canEdit,
  refreshing,
  actionBusy,
  lastRefreshed,
  onRefresh,
  onToggleFavorite,
  onSaveHeaderField,
  onAction,
  onImageModalOpen,
}: ItemHeaderProps) {
  const attachmentKind = asset.parentAsset ? getAttachmentKind(asset) : null;
  const slotLabel = asset.parentAsset ? getSdCardSlotLabel(asset, asset.parentAsset.assetTag) : null;
  const [imageFailed, setImageFailed] = useState(false);
  const imageSrc = normalizeAssetImageSrc(asset.imageUrl);
  const isRetired = asset.computedStatus === "RETIRED";
  const isMaintenance = asset.computedStatus === "MAINTENANCE";
  const hasBlockingCheckout =
    (asset.computedStatus === "CHECKED_OUT" || asset.computedStatus === "PENDING_PICKUP") &&
    asset.activeBooking?.kind === "CHECKOUT";
  const canReserve = asset.availableForReservation && !isRetired;
  const canCheckOut = asset.availableForCheckout && !isRetired && !isMaintenance && !hasBlockingCheckout;
  const activeBookingHref = asset.activeBooking
    ? asset.activeBooking.kind === "RESERVATION"
      ? `/reservations/${asset.activeBooking.id}`
      : `/checkouts/${asset.activeBooking.id}`
    : null;
  const activeBookingLabel = asset.activeBooking
    ? asset.activeBooking.kind === "RESERVATION"
      ? "Open reservation"
      : asset.activeBooking.status === "PENDING_PICKUP"
        ? "Open pickup"
        : "Open checkout"
    : null;
  const brandModel = [asset.brand, asset.model].filter(Boolean).join(" ");
  const productLabel = asset.name || brandModel;
  const showBrandModel =
    brandModel &&
    asset.name &&
    !includesLoose(asset.name, asset.brand) &&
    !includesLoose(asset.name, asset.model);
  const metaParts = [
    asset.location?.name,
    asset.category?.name,
    asset.department?.name,
  ].filter(Boolean);
  const updatedAt = asset.updatedAt ? new Date(asset.updatedAt) : null;
  const updatedLabel = updatedAt
    ? `Updated ${updatedAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })} at ${updatedAt.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })}`
    : null;

  useEffect(() => {
    setImageFailed(false);
  }, [imageSrc]);

  return (
    <>
      <header className="mb-4 rounded-lg border border-border/50 bg-card px-4 py-4 shadow-xs sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="shrink-0 self-start">
            {imageSrc && !imageFailed ? (
              <button
                className={`relative flex size-[88px] items-center justify-center overflow-hidden rounded-md border border-border bg-muted shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] sm:size-[96px] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] ${canEdit ? "cursor-pointer active:scale-[0.96]" : "cursor-default"} group transition-[border-color,background-color,box-shadow,transform]`}
                onClick={() => canEdit && onImageModalOpen()}
                title={canEdit ? "Change image" : undefined}
                aria-label={canEdit ? `Change image for ${asset.assetTag}` : `Image of ${asset.assetTag}`}
              >
                <Image
                  src={imageSrc}
                  alt={asset.assetTag}
                  width={208}
                  height={208}
                  sizes="104px"
                  className="aspect-square object-cover"
                  unoptimized
                  onError={() => setImageFailed(true)}
                />
                {canEdit && (
                  <div className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                    <PencilIcon className="size-4" />
                  </div>
                )}
              </button>
            ) : canEdit ? (
              <button
                className="group relative flex size-[88px] cursor-pointer items-center justify-center rounded-md border border-dashed border-border bg-muted/40 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] transition-[border-color,background-color,transform] hover:border-[var(--wi-red)]/50 hover:bg-[var(--wi-red)]/5 active:scale-[0.96] sm:size-[96px] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                onClick={onImageModalOpen}
                title="Add image"
                aria-label="Add image"
              >
                <ImageIcon className="size-5 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />
              </button>
            ) : (
              <div className="flex size-[88px] items-center justify-center rounded-md border border-border bg-muted/20 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] sm:size-[96px] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
                <ImageIcon className="size-5 text-muted-foreground/25" />
              </div>
            )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusLine asset={asset} />
              </div>

              <div
                className="flex items-baseline gap-2.5"
                style={{ fontFamily: "var(--font-heading)" }}
              >
              <InlineTitle
                value={asset.assetTag}
                canEdit={false}
                onSave={(v) => onSaveHeaderField("assetTag", v)}
                className="text-balance text-[28px] font-black leading-none tracking-tight sm:text-[32px]"
              />
              {asset.metadata?.uwAssetTag && (
                <span
                  className="text-[10.5px] text-muted-foreground/50 tracking-[0.06em]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  UW·{asset.metadata.uwAssetTag}
                </span>
              )}
              </div>

              <div style={{ fontFamily: "var(--font-heading)" }}>
              <InlineTitle
                value={productLabel}
                canEdit={false}
                onSave={(v) => onSaveHeaderField("name", v)}
                className="text-pretty text-[14px] font-medium leading-tight text-muted-foreground"
                placeholder="Add item name"
              />
              </div>

              {showBrandModel && (
                <p
                  className="mt-1 text-[11px] leading-none text-muted-foreground/50"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {brandModel}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground/70">
                {metaParts.map((part, index) => (
                  <span key={part} className="inline-flex items-center gap-2">
                    {index > 0 && (
                      <span aria-hidden="true" className="text-muted-foreground/30">
                        /
                      </span>
                    )}
                    <span>{part}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:min-w-[270px] lg:items-end">
            <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
              {activeBookingHref && activeBookingLabel && (
                <Button size="sm" variant="default" asChild>
                  <Link href={activeBookingHref}>{activeBookingLabel}</Link>
                </Button>
              )}
              {canCheckOut ? (
                <Button size="sm" variant={activeBookingHref ? "outline" : "default"} asChild>
                  <Link href={`/checkouts?newFor=${asset.id}`}>Check out</Link>
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled
                  title={
                    hasBlockingCheckout
                      ? asset.computedStatus === "PENDING_PICKUP"
                        ? "This item is awaiting pickup"
                        : "This item is already checked out"
                      : isMaintenance
                        ? "Maintenance items cannot be checked out"
                        : "Check out is disabled for this item"
                  }
                >
                  Check out
                </Button>
              )}
              {canReserve ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/reservations?newFor=${asset.id}`}>Reserve</Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled title="Reservations are disabled for this item">
                  Reserve
                </Button>
              )}
              {canEdit && <ActionsMenu asset={asset} disabled={actionBusy} onAction={onAction} />}
            </div>

            <div className="flex items-center gap-1 text-[10px] leading-none text-muted-foreground/40 lg:justify-end">
              {updatedLabel && (
                <span className="hidden sm:inline" style={{ fontFamily: "var(--font-mono)" }}>
                  {updatedLabel}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-8 active:scale-[0.96] transition-[background-color,color,box-shadow,transform]"
                onClick={onRefresh}
                disabled={refreshing || actionBusy}
                aria-label={
                  lastRefreshed
                    ? `Refresh. Last refreshed ${lastRefreshed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                    : "Refresh"
                }
              >
                <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="size-8 active:scale-[0.96] transition-[background-color,color,box-shadow,transform]"
                onClick={onToggleFavorite}
                disabled={actionBusy}
                aria-label={asset.isFavorited ? "Remove from favorites" : "Add to favorites"}
              >
                <Star
                  className={`size-3.5 ${
                    asset.isFavorited ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
                  }`}
                />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Parent banner ─────────────────────────────────────── */}
      {asset.parentAsset && (
        <div className="mb-3 rounded-lg border bg-muted/30 px-3 py-2 flex items-center gap-1.5">
          <span
            className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/50"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Attached to
          </span>
          <ChevronRight className="size-3 text-muted-foreground/30" />
          <Link
            href={`/items/${asset.parentAsset.id}`}
            className="text-[12px] font-semibold hover:underline"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {asset.parentAsset.assetTag}
          </Link>
          {slotLabel && <Badge variant="blue" size="sm">{slotLabel}</Badge>}
          {attachmentKind && !slotLabel && (
            <Badge variant={attachmentKind === "camera-rig" ? "purple" : "gray"} size="sm">
              Attachment
            </Badge>
          )}
          {(asset.parentAsset.brand || asset.parentAsset.model) && (
            <span
              className="text-[11px] text-muted-foreground/50"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              · {[asset.parentAsset.brand, asset.parentAsset.model].filter(Boolean).join(" ")}
            </span>
          )}
        </div>
      )}
    </>
  );
}
