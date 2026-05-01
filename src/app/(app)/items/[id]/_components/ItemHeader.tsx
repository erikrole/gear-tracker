"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
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
import { PencilIcon, ImageIcon, Copy, Check, RefreshCw, Star, ChevronRight } from "lucide-react";

import type { AssetDetail } from "../types";

/* ── Status Line ────────────────────────────────────────── */

function StatusLine({ asset }: { asset: AssetDetail }) {
  const s = asset.computedStatus;
  const b = asset.activeBooking;

  if (s === "AVAILABLE") return <Badge variant="green">Available</Badge>;
  if (s === "CHECKED_OUT" && b) {
    const href = `/checkouts/${b.id}`;
    return (
      <Badge variant="blue" asChild>
        <Link href={href} className="no-underline">
          {b.status === "DRAFT" ? "Checking out" : `Checked out · ${b.requesterName}`}
        </Link>
      </Badge>
    );
  }
  if (s === "RESERVED" && b) {
    return (
      <Badge variant="purple" asChild>
        <Link href={`/reservations/${b.id}`} className="no-underline">
          Reserved · {b.requesterName}
        </Link>
      </Badge>
    );
  }
  if (s === "MAINTENANCE") return <Badge variant="orange">Maintenance</Badge>;
  if (s === "RETIRED") return <Badge variant="gray">Retired</Badge>;
  return <Badge variant="gray">{s}</Badge>;
}

/* ── Serial Badge (copyable) ────────────────────────────── */

function SerialBadge({ serialNumber }: { serialNumber: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(serialNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className="group flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          style={{ fontFamily: "var(--font-mono)" }}
          onClick={handleCopy}
          aria-label={`Copy serial number ${serialNumber}`}
        >
          <span className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground/50">SN</span>
          {serialNumber}
          {copied ? (
            <Check className="size-3 text-green-500 shrink-0" />
          ) : (
            <Copy className="size-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>{copied ? "Copied!" : "Copy serial number"}</TooltipContent>
    </Tooltip>
  );
}

/* ── Actions Dropdown ───────────────────────────────────── */

function ActionsMenu({
  asset,
  onAction,
}: {
  asset: AssetDetail;
  onAction: (action: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">Actions</Button>
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

/* ── Item Header ────────────────────────────────────────── */

type ItemHeaderProps = {
  asset: AssetDetail;
  canEdit: boolean;
  refreshing: boolean;
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
  lastRefreshed,
  onRefresh,
  onToggleFavorite,
  onSaveHeaderField,
  onAction,
  onImageModalOpen,
}: ItemHeaderProps) {
  return (
    <>
      {/* ── Equipment Manifest Card ─────────────────────────── */}
      <div className="relative mb-4 rounded-xl border bg-card overflow-hidden">
        {/* Atmospheric red wash — corner glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 0% 0%, rgba(160,0,0,0.055) 0%, transparent 60%)",
          }}
        />

        {/* Top accent stripe */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background:
              "linear-gradient(90deg, var(--wi-red) 0%, rgba(160,0,0,0.15) 35%, transparent 65%)",
          }}
        />

        <div className="relative flex flex-col sm:flex-row gap-4 sm:gap-5 p-5 sm:p-6 pt-[18px]">
          {/* ── Image ── */}
          <div className="shrink-0 self-start">
            {asset.imageUrl ? (
              <button
                className={`relative rounded-lg border border-border bg-muted overflow-hidden flex items-center justify-center size-[96px] sm:size-[104px] ${canEdit ? "cursor-pointer" : "cursor-default"} group`}
                onClick={() => canEdit && onImageModalOpen()}
                title={canEdit ? "Change image" : undefined}
                aria-label={canEdit ? `Change image for ${asset.assetTag}` : `Image of ${asset.assetTag}`}
              >
                <Image
                  src={asset.imageUrl}
                  alt={asset.assetTag}
                  width={208}
                  height={208}
                  sizes="104px"
                  className="aspect-square object-cover"
                  unoptimized={!asset.imageUrl.includes(".public.blob.vercel-storage.com")}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                {canEdit && (
                  <div className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                    <PencilIcon className="size-4" />
                  </div>
                )}
              </button>
            ) : canEdit ? (
              <button
                className="relative rounded-lg border border-dashed border-border bg-muted/40 flex items-center justify-center size-[96px] sm:size-[104px] cursor-pointer hover:border-[var(--wi-red)]/50 hover:bg-[var(--wi-red)]/5 transition-colors group"
                onClick={onImageModalOpen}
                title="Add image"
                aria-label="Add image"
              >
                <ImageIcon className="size-5 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />
              </button>
            ) : (
              <div className="rounded-lg border border-border bg-muted/20 flex items-center justify-center size-[96px] sm:size-[104px]">
                <ImageIcon className="size-5 text-muted-foreground/25" />
              </div>
            )}
          </div>

          {/* ── Identity block ── */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Asset tag — primary identifier */}
            <div
              className="flex items-baseline gap-2.5 mb-0.5"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <InlineTitle
                value={asset.assetTag}
                canEdit={false}
                onSave={(v) => onSaveHeaderField("assetTag", v)}
                className="text-[28px] sm:text-[32px] font-black leading-none tracking-tight"
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

            {/* Item name */}
            <div style={{ fontFamily: "var(--font-heading)" }}>
              <InlineTitle
                value={asset.name || ""}
                canEdit={false}
                onSave={(v) => onSaveHeaderField("name", v)}
                className="text-[14px] font-medium text-muted-foreground leading-tight"
                placeholder="Add item name"
              />
            </div>

            {/* Brand · Model */}
            {(asset.brand || asset.model) && (
              <p
                className="text-[11px] text-muted-foreground/45 mt-1 leading-none"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {[asset.brand, asset.model].filter(Boolean).join(" · ")}
              </p>
            )}

            {/* ── Properties row ── */}
            <div className="flex items-center gap-3 flex-wrap mt-3">
              <StatusLine asset={asset} />

              {asset.location && (
                <span
                  className="text-[11px] text-muted-foreground/70"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {asset.location.name}
                </span>
              )}
              {asset.category && (
                <span
                  className="text-[11px] text-muted-foreground/70"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {asset.category.name}
                </span>
              )}
              {asset.department && (
                <span
                  className="text-[11px] text-muted-foreground/70"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {asset.department.name}
                </span>
              )}
              {asset.serialNumber && <SerialBadge serialNumber={asset.serialNumber} />}
            </div>
          </div>

          {/* ── Actions column ── */}
          <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 sm:self-start sm:pt-0.5">
            {/* Utility icons */}
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={onRefresh}
                    disabled={refreshing}
                    aria-label="Refresh"
                  >
                    <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {lastRefreshed
                    ? `Updated ${lastRefreshed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                    : "Refresh"}
                </TooltipContent>
              </Tooltip>

              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={onToggleFavorite}
                aria-label={asset.isFavorited ? "Remove from favorites" : "Add to favorites"}
              >
                <Star
                  className={`size-3.5 ${
                    asset.isFavorited ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
                  }`}
                />
              </Button>

              {canEdit && <ActionsMenu asset={asset} onAction={onAction} />}
            </div>

            {/* Primary CTAs */}
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={asset.availableForReservation ? "default" : "outline"}
                asChild
              >
                <Link href={`/reservations?newFor=${asset.id}`}>Reserve</Link>
              </Button>
              <Button
                size="sm"
                variant={
                  asset.computedStatus !== "CHECKED_OUT" && asset.availableForCheckout
                    ? "default"
                    : "outline"
                }
                asChild
              >
                <Link href={`/checkouts?newFor=${asset.id}`}>Check out</Link>
              </Button>
            </div>

            {/* Last updated — desktop only */}
            {asset.updatedAt && (
              <span
                className="hidden sm:block text-[10px] text-muted-foreground/35 text-right leading-none mt-auto"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {new Date(asset.updatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Parent banner ─────────────────────────────────────── */}
      {asset.parentAsset && (
        <div className="mb-3 rounded-lg border bg-muted/30 px-3 py-2 flex items-center gap-1.5">
          <span
            className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/50"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Accessory of
          </span>
          <ChevronRight className="size-3 text-muted-foreground/30" />
          <Link
            href={`/items/${asset.parentAsset.id}`}
            className="text-[12px] font-semibold hover:underline"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {asset.parentAsset.assetTag}
          </Link>
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
