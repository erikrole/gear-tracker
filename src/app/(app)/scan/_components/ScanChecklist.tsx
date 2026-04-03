import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flag, AlertTriangle } from "lucide-react";
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
  // Sort order: unscanned (no report) → lost → scanned → damaged
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
    <div className="bg-[var(--panel)] border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border-light)]">
        <h2 className="text-[15px] font-bold m-0">Items</h2>
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
        <div className="max-h-[40vh] max-md:max-h-[35vh] overflow-y-auto [-webkit-overflow-scrolling:touch]">
          {[...scanStatus.serializedItems]
            .sort(sortItems)
            .map((item) => {
              const isLost = item.report?.type === "LOST";
              const isDamaged = item.report?.type === "DAMAGED";

              // Background color: green for scanned (no report), orange for damaged, red tint for lost
              let rowBg = "";
              if (isLost) {
                rowBg = "bg-red-50 dark:bg-red-950/20";
              } else if (isDamaged) {
                rowBg = "bg-orange-50 dark:bg-orange-950/20";
              } else if (item.scanned) {
                rowBg = "bg-[#f0fdf4] dark:bg-green-950/20";
              }

              // Circle color
              let circleCls = "bg-gray-200 text-gray-400";
              if (isLost) {
                circleCls = "bg-orange-500 text-white";
              } else if (item.scanned) {
                circleCls = "bg-green-500 text-white animate-[scan-check-pop_0.3s_ease]";
              }

              return (
                <div
                  key={item.assetId}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-[var(--border-light)] transition-colors duration-300 min-h-[52px] last:border-b-0 ${rowBg}`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold transition-all duration-300 ${circleCls}`}
                  >
                    {isLost ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : item.scanned ? (
                      "\u2713"
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-px">
                    <span className={`text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis ${item.scanned && !isDamaged && !isLost ? "text-green-800 dark:text-green-300" : ""}`}>
                      {item.assetTag}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                      {item.brand} {item.model}
                    </span>
                  </div>

                  {/* Badge + action area */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isDamaged && (
                      <Badge variant="orange" size="sm">Damaged</Badge>
                    )}
                    {isLost && (
                      <Badge variant="red" size="sm">Lost</Badge>
                    )}
                    {item.scanned && !isDamaged && !isLost && (
                      <>
                        <Badge variant="green" size="sm">Scanned</Badge>
                        {isCheckin && onReportDamage && (
                          <button
                            type="button"
                            onClick={() => onReportDamage(item)}
                            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                            title="Report damage"
                          >
                            <Flag className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        )}
                      </>
                    )}
                    {!item.scanned && !isLost && isCheckin && onReportLost && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => onReportLost(item)}
                      >
                        Report Lost
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

          {scanStatus.bulkItems.map((item) => {
            const done = item.scanned >= item.required;
            const allocated = item.allocatedUnits ?? [];
            return (
              <div
                key={item.bulkSkuId}
                className={`flex items-center gap-3 px-4 py-3 border-b border-[var(--border-light)] transition-colors duration-300 min-h-[52px] last:border-b-0 ${done ? "bg-[#f0fdf4] dark:bg-green-950/20" : ""}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold transition-all duration-300 ${
                    done
                      ? "bg-green-500 text-white animate-[scan-check-pop_0.3s_ease]"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  {done && "\u2713"}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-px">
                  <span className={`text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis ${done ? "text-green-800 dark:text-green-300" : ""}`}>
                    {item.name}
                    {item.trackByNumber && (
                      <Badge variant="blue" size="sm" className="ml-1.5">
                        #
                      </Badge>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                    {item.scanned} / {item.required} scanned
                  </span>
                </div>

                {/* Show allocated unit numbers */}
                {item.trackByNumber && allocated.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2 ml-10">
                    {allocated.map((u) => (
                      <Badge
                        key={u.unitNumber}
                        variant={
                          u.checkedIn
                            ? "green"
                            : u.checkedOut
                              ? "blue"
                              : "gray"
                        }
                        size="sm"
                      >
                        #{u.unitNumber}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
