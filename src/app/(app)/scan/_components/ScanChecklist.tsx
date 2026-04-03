"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flag, AlertTriangle, Package, QrCode, Barcode } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import type { ScanMode, ScanStatus, SerializedItemStatus } from "./types";

type ScanChecklistProps = {
  scanStatus: ScanStatus;
  scannedItems: number;
  totalItems: number;
  mode?: ScanMode;
  onReportDamage?: (item: SerializedItemStatus) => void;
  onReportLost?: (item: SerializedItemStatus) => void;
};

type TabKey = "unscanned" | "scanned" | "issues";

function sortItems(a: SerializedItemStatus, b: SerializedItemStatus): number {
  // Sort order: unscanned (no report) → lost → scanned → damaged
  const rank = (item: SerializedItemStatus) => {
    if (item.report?.type === "LOST") return 1;
    if (item.scanned && item.report?.type === "DAMAGED") return 3;
    if (item.scanned) return 2;
    return 0; // unscanned, no report
  };
  return rank(a) - rank(b);
}

/** Build a category summary like "2 Lenses, 1 Body" */
export function buildCategorySummary(items: SerializedItemStatus[]): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    const cat = item.categoryName || "Item";
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([cat, n]) => `${n} ${cat}${n !== 1 ? "s" : ""}`)
    .join(", ");
}

export function ScanChecklist({
  scanStatus,
  scannedItems,
  totalItems,
  mode,
  onReportDamage,
  onReportLost,
}: ScanChecklistProps) {
  const isCheckin = mode === "checkin";
  const [activeTab, setActiveTab] = useState<TabKey>("unscanned");

  const allItems = useMemo(
    () => [...scanStatus.serializedItems].sort(sortItems),
    [scanStatus.serializedItems]
  );

  const unscannedItems = allItems.filter((i) => !i.scanned && !i.report);
  const scannedItemsList = allItems.filter((i) => i.scanned && !i.report?.type);
  const issueItems = allItems.filter((i) => i.report?.type === "DAMAGED" || i.report?.type === "LOST");

  const counts = {
    unscanned: unscannedItems.length,
    scanned: scannedItemsList.length,
    issues: issueItems.length,
  };

  const filteredItems =
    activeTab === "unscanned" ? unscannedItems :
    activeTab === "scanned" ? scannedItemsList :
    issueItems;

  return (
    <div className="bg-[var(--panel)] border border-border rounded-xl shadow-sm overflow-hidden">
      {/* Status tabs */}
      <div className="flex border-b border-[var(--border-light)]">
        {([
          { key: "unscanned" as TabKey, label: "unscanned" },
          { key: "scanned" as TabKey, label: "scanned" },
          { key: "issues" as TabKey, label: "issues" },
        ]).map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`flex-1 py-2.5 text-sm font-semibold text-center border-none cursor-pointer transition-colors ${
              activeTab === tab.key
                ? "bg-[var(--panel)] text-foreground border-b-2 border-b-foreground"
                : "bg-muted/30 text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {counts[tab.key]} {tab.label}
          </button>
        ))}
      </div>

      {scanStatus.serializedItems.length === 0 &&
      scanStatus.bulkItems.length === 0 ? (
        <EmptyState
          icon="box"
          title="No items to scan"
          description="This booking has no equipment assigned."
        />
      ) : filteredItems.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {activeTab === "unscanned"
            ? "All items have been scanned!"
            : activeTab === "scanned"
              ? "No items scanned yet"
              : "No issues reported"}
        </div>
      ) : (
        <div className="overflow-y-auto [-webkit-overflow-scrolling:touch]">
          {filteredItems.map((item) => {
            const isLost = item.report?.type === "LOST";
            const isDamaged = item.report?.type === "DAMAGED";

            // Background color
            let rowBg = "";
            if (isLost) {
              rowBg = "bg-red-50 dark:bg-red-950/20";
            } else if (isDamaged) {
              rowBg = "bg-orange-50 dark:bg-orange-950/20";
            } else if (item.scanned) {
              rowBg = "bg-green-50/50 dark:bg-green-950/10";
            }

            // Circle styling — larger like reference (40px)
            let circleBorder = "border-2 border-gray-200 dark:border-gray-700";
            let circleInner = "";
            if (isLost) {
              circleBorder = "border-2 border-orange-500 bg-orange-500";
              circleInner = "text-white";
            } else if (item.scanned) {
              circleBorder = "border-2 border-green-500 bg-green-500";
              circleInner = "text-white animate-[scan-check-pop_0.3s_ease]";
            }

            // Truncated QR code (first 8 chars)
            const qrShort = item.qrCodeValue ? item.qrCodeValue.replace(/^QR-/i, "").slice(0, 8) : null;

            return (
              <div
                key={item.assetId}
                className={`flex items-center gap-3 px-3 py-3 border-b border-[var(--border-light)] transition-colors duration-300 last:border-b-0 ${rowBg}`}
              >
                {/* Item image */}
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.assetTag}
                    width={64}
                    height={64}
                    className="size-16 rounded-lg object-cover shrink-0"
                    unoptimized={!item.imageUrl.includes(".public.blob.vercel-storage.com")}
                  />
                ) : (
                  <div className="size-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Package className="size-6 text-muted-foreground" />
                  </div>
                )}

                {/* Item info */}
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className={`text-base font-bold leading-tight ${item.scanned && !isDamaged && !isLost ? "text-green-800 dark:text-green-300" : ""}`}>
                    {item.assetTag}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {item.categoryName || [item.brand, item.model].filter(Boolean).join(" ")}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                    {qrShort && (
                      <span className="flex items-center gap-0.5">
                        <QrCode className="size-3" />
                        {qrShort}
                      </span>
                    )}
                    {item.primaryScanCode && (
                      <span className="flex items-center gap-0.5">
                        <Barcode className="size-3" />
                        {item.primaryScanCode}
                      </span>
                    )}
                  </div>
                  {/* Report badges inline */}
                  {(isDamaged || isLost) && (
                    <div className="flex items-center gap-1 mt-0.5">
                      {isDamaged && <Badge variant="orange" size="sm">Damaged</Badge>}
                      {isLost && <Badge variant="red" size="sm">Lost</Badge>}
                    </div>
                  )}
                </div>

                {/* Circle checkbox + actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Check-in actions */}
                  {item.scanned && !isDamaged && !isLost && isCheckin && onReportDamage && (
                    <button
                      type="button"
                      onClick={() => onReportDamage(item)}
                      className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      aria-label={`Report damage for ${item.assetTag}`}
                    >
                      <Flag className="size-4 text-muted-foreground" />
                    </button>
                  )}
                  {!item.scanned && !isLost && isCheckin && onReportLost && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => onReportLost(item)}
                    >
                      Lost
                    </Button>
                  )}

                  {/* Circle */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${circleBorder} ${circleInner}`}>
                    {isLost ? (
                      <AlertTriangle className="size-4" />
                    ) : item.scanned ? (
                      <svg className="size-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="4 10 8 14 16 6" />
                      </svg>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Bulk items (show in unscanned or scanned tab) */}
          {activeTab !== "issues" && scanStatus.bulkItems.map((item) => {
            const done = item.scanned >= item.required;
            if (activeTab === "scanned" && !done) return null;
            if (activeTab === "unscanned" && done) return null;
            const allocated = item.allocatedUnits ?? [];
            return (
              <div
                key={item.bulkSkuId}
                className={`flex items-center gap-3 px-3 py-3 border-b border-[var(--border-light)] transition-colors duration-300 last:border-b-0 ${done ? "bg-green-50/50 dark:bg-green-950/10" : ""}`}
              >
                <div className="size-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Package className="size-6 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className={`text-base font-bold leading-tight ${done ? "text-green-800 dark:text-green-300" : ""}`}>
                    {item.name}
                    {item.trackByNumber && (
                      <Badge variant="blue" size="sm" className="ml-1.5">#</Badge>
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {item.scanned} / {item.required} scanned
                  </span>
                  {item.trackByNumber && allocated.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {allocated.map((u) => (
                        <Badge
                          key={u.unitNumber}
                          variant={u.checkedIn ? "green" : u.checkedOut ? "blue" : "gray"}
                          size="sm"
                        >
                          #{u.unitNumber}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                  done
                    ? "border-2 border-green-500 bg-green-500 text-white animate-[scan-check-pop_0.3s_ease]"
                    : "border-2 border-gray-200 dark:border-gray-700"
                }`}>
                  {done && (
                    <svg className="size-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="4 10 8 14 16 6" />
                    </svg>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
