"use client";

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

function sortItems(a: SerializedItemStatus, b: SerializedItemStatus): number {
  // Unscanned first, then lost, then scanned, then damaged
  const rank = (item: SerializedItemStatus) => {
    if (item.report?.type === "LOST") return 1;
    if (item.scanned && item.report?.type === "DAMAGED") return 3;
    if (item.scanned) return 2;
    return 0; // unscanned, no report
  };
  return rank(a) - rank(b);
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

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 md:px-4 md:py-3 border-b border-border">
        <h2 className="text-sm md:text-[15px] font-bold m-0">Items</h2>
        <span className="text-sm font-bold text-muted-foreground">
          {scannedItems}/{totalItems}
        </span>
      </div>

      {scanStatus.serializedItems.length === 0 &&
      scanStatus.bulkItems.length === 0 ? (
        <EmptyState
          icon="box"
          title="No items to scan"
          description="This booking has no equipment assigned."
        />
      ) : (
        <div className="overflow-y-auto [-webkit-overflow-scrolling:touch]">
          {[...scanStatus.serializedItems]
            .sort(sortItems)
            .map((item) => {
              const isLost = item.report?.type === "LOST";
              const isDamaged = item.report?.type === "DAMAGED";

              // Background color
              let rowBg = "";
              if (isLost) {
                rowBg = "bg-[var(--red-bg)]";
              } else if (isDamaged) {
                rowBg = "bg-[var(--orange-bg)]";
              } else if (item.scanned) {
                rowBg = "bg-[var(--green-bg)]";
              }

              // Circle styling — 40px like reference
              let circleBorder = "border-2 border-border";
              let circleInner = "";
              if (isLost) {
                circleBorder = "border-2 border-[var(--orange)] bg-[var(--orange)]";
                circleInner = "text-white";
              } else if (item.scanned) {
                circleBorder = "border-2 border-[var(--green)] bg-[var(--green)]";
                circleInner = "text-white animate-[scan-check-pop_0.3s_ease]";
              }

              // Truncated QR code (first 8 chars)
              const qrShort = item.qrCodeValue ? item.qrCodeValue.replace(/^QR-/i, "").slice(0, 8) : null;

              return (
                <div
                  key={item.assetId}
                  className={`flex items-center gap-2.5 px-3 py-2 md:py-3 border-b border-border transition-colors duration-300 last:border-b-0 ${rowBg}`}
                >
                  {/* Item image */}
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.assetTag}
                      width={48}
                      height={48}
                      className="size-12 md:size-16 rounded-lg object-cover shrink-0"
                      unoptimized={!item.imageUrl.includes(".public.blob.vercel-storage.com")}
                    />
                  ) : (
                    <div className="size-12 md:size-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Package className="size-5 md:size-6 text-muted-foreground" />
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
                    <div
                      className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${circleBorder} ${circleInner}`}
                      aria-label={isLost ? "Lost" : item.scanned ? "Scanned" : "Not scanned"}
                      role="img"
                    >
                      {isLost ? (
                        <AlertTriangle className="size-4" aria-hidden="true" />
                      ) : item.scanned ? (
                        <svg className="size-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="4 10 8 14 16 6" />
                        </svg>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}

          {/* Bulk items */}
          {scanStatus.bulkItems.map((item) => {
            const done = item.scanned >= item.required;
            const allocated = item.allocatedUnits ?? [];
            return (
              <div
                key={item.bulkSkuId}
                className={`flex items-center gap-2.5 px-3 py-2 md:py-3 border-b border-border transition-colors duration-300 last:border-b-0 ${done ? "bg-[var(--green-bg)]" : ""}`}
              >
                <div className="size-12 md:size-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Package className="size-5 md:size-6 text-muted-foreground" />
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
                  {item.trackByNumber && allocated.length > 0 && (() => {
                    const returned = allocated.filter((u) => u.checkedIn);
                    const stillOut = allocated.filter((u) => u.checkedOut && !u.checkedIn);
                    return (
                      <>
                        {stillOut.length > 0 && (
                          <div className="text-xs font-medium text-amber-700 dark:text-amber-400 mt-0.5">
                            Still out: {stillOut.map((u) => `#${u.unitNumber}`).join(", ")}
                          </div>
                        )}
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
                        {returned.length > 0 && stillOut.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {returned.length} returned, {stillOut.length} remaining
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                  done
                    ? "border-2 border-[var(--green)] bg-[var(--green)] text-white animate-[scan-check-pop_0.3s_ease]"
                    : "border-2 border-border"
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
