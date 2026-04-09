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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PencilIcon, ImageIcon, Copy, Check, RefreshCw, Star } from "lucide-react";

import type { AssetDetail } from "../types";

/* ── Status Line ────────────────────────────────────────── */

function StatusLine({ asset }: { asset: AssetDetail }) {
  const s = asset.computedStatus;
  const b = asset.activeBooking;

  if (s === "AVAILABLE") {
    return <Badge variant="green">Available</Badge>;
  }
  if (s === "CHECKED_OUT" && b) {
    const href = `/checkouts/${b.id}`;
    if (b.status === "DRAFT") {
      return (
        <Badge variant="blue" asChild>
          <Link href={href} className="no-underline">Checking out</Link>
        </Badge>
      );
    }
    return (
      <Badge variant="blue" asChild>
        <Link href={href} className="no-underline">Checked out by {b.requesterName}</Link>
      </Badge>
    );
  }
  if (s === "RESERVED" && b) {
    return (
      <Badge variant="purple" asChild>
        <Link href={`/reservations/${b.id}`} className="no-underline">Reserved by {b.requesterName}</Link>
      </Badge>
    );
  }
  if (s === "MAINTENANCE") {
    return <Badge variant="orange">Needs Maintenance</Badge>;
  }
  if (s === "RETIRED") {
    return <Badge variant="gray">Retired</Badge>;
  }
  return <Badge variant="gray">{s}</Badge>;
}

/* ── Serial Number Badge ───────────────────────────────── */

function SerialBadge({ serialNumber }: { serialNumber: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(serialNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="font-mono cursor-pointer select-none gap-1.5"
            onClick={handleCopy}
            role="button"
            aria-label={`Copy serial number ${serialNumber}`}
          >
            <span className="text-muted-foreground uppercase text-[0.6rem] font-semibold tracking-wider">SN</span>
            {serialNumber}
            {copied ? (
              <Check className="size-3 text-green-600 dark:text-green-400" />
            ) : (
              <Copy className="size-3 text-muted-foreground" />
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied!" : "Click to copy serial number"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
  const canDelete = !asset.hasBookingHistory;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onAction("duplicate")}>
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("print-label")}>
          Print label
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("maintenance")}>
          {asset.status === "MAINTENANCE" ? "Clear Maintenance" : "Needs Maintenance"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("retire")}>
          Retire
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={!canDelete}
          title={!canDelete ? "Item has booking history — use Retire instead" : "Permanently delete this item"}
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
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div className="flex gap-4 items-center">
          {/* Hero image — larger square */}
          {asset.imageUrl ? (
            <button
              className={`relative rounded-lg border border-border bg-muted overflow-hidden shrink-0 flex items-center justify-center p-0 aspect-square size-[120px] ${canEdit ? "cursor-pointer" : "cursor-default"} group`}
              onClick={() => canEdit && onImageModalOpen()}
              title={canEdit ? "Change image" : undefined}
              aria-label={canEdit ? `Change image for ${asset.assetTag}` : `Image of ${asset.assetTag}`}
            >
              <Image src={asset.imageUrl} alt={asset.assetTag} width={240} height={240} sizes="120px" className="aspect-square object-cover rounded-lg" unoptimized={!asset.imageUrl.includes(".public.blob.vercel-storage.com")} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              {canEdit && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                  <PencilIcon className="size-5" />
                </div>
              )}
            </button>
          ) : canEdit ? (
            <button className="relative rounded-lg border border-dashed border-border bg-muted overflow-hidden shrink-0 flex items-center justify-center p-0 cursor-pointer hover:border-primary hover:bg-primary/10 aspect-square size-[120px]" onClick={onImageModalOpen} title="Add image" aria-label="Add image">
              <ImageIcon className="size-8 text-muted-foreground" />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex gap-3 items-baseline">
              <InlineTitle
                value={asset.assetTag}
                canEdit={canEdit}
                onSave={(v) => onSaveHeaderField("assetTag", v)}
                className="text-2xl font-bold tracking-tight"
              />
              {asset.metadata?.uwAssetTag && (
                <span className="text-base text-muted-foreground font-medium">
                  UW {asset.metadata.uwAssetTag}
                </span>
              )}
            </div>
            <InlineTitle
              value={asset.name || ""}
              canEdit={canEdit}
              onSave={(v) => onSaveHeaderField("name", v)}
              className="text-base text-muted-foreground mt-2 block"
              placeholder="Add item name"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={onRefresh} disabled={refreshing} aria-label="Refresh item details">
                  <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {lastRefreshed
                  ? `Updated ${lastRefreshed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                  : "Refresh"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFavorite}
            aria-label={asset.isFavorited ? "Remove from favorites" : "Add to favorites"}
          >
            <Star
              className={`size-4 ${
                asset.isFavorited
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground"
              }`}
            />
          </Button>
          {canEdit && <ActionsMenu asset={asset} onAction={onAction} />}
          <Button variant={asset.availableForReservation ? "default" : "outline"} asChild>
            <Link href={`/reservations?newFor=${asset.id}`}>Reserve</Link>
          </Button>
          <Button variant={asset.computedStatus !== "CHECKED_OUT" && asset.availableForCheckout ? "default" : "outline"} asChild>
            <Link href={`/checkouts?newFor=${asset.id}`}>Check out</Link>
          </Button>
        </div>
      </div>

      {/* Properties strip — Notion-style inline badges below title */}
      <div className="mt-6 mb-6 flex items-center gap-2 flex-wrap">
        <StatusLine asset={asset} />
        {asset.location && <Badge variant="outline">{asset.location.name}</Badge>}
        {asset.category && <Badge variant="outline">{asset.category.name}</Badge>}
        {asset.department && <Badge variant="outline">{asset.department.name}</Badge>}
        {asset.serialNumber && <SerialBadge serialNumber={asset.serialNumber} />}
        {asset.updatedAt && (
          <span className="text-xs text-muted-foreground ml-auto">
            Updated {new Date(asset.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        )}
      </div>

      {/* Parent banner — shown when this item is an accessory */}
      {asset.parentAsset && (
        <div className="mb-1 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
          Accessory of{" "}
          <Link href={`/items/${asset.parentAsset.id}`} className="font-medium">
            {asset.parentAsset.assetTag}
          </Link>
          <span className="text-muted-foreground ml-2">{asset.parentAsset.brand} {asset.parentAsset.model}</span>
        </div>
      )}
    </>
  );
}
