import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/EmptyState";
import type { ScanStatus } from "./types";

type ScanChecklistProps = {
  scanStatus: ScanStatus;
  scannedItems: number;
  totalItems: number;
};

export function ScanChecklist({
  scanStatus,
  scannedItems,
  totalItems,
}: ScanChecklistProps) {
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
          {/* Unscanned first, then scanned */}
          {[...scanStatus.serializedItems]
            .sort((a, b) =>
              a.scanned === b.scanned ? 0 : a.scanned ? 1 : -1,
            )
            .map((item) => (
              <div
                key={item.assetId}
                className={`flex items-center gap-3 px-4 py-3 border-b border-[var(--border-light)] transition-colors duration-300 min-h-[52px] last:border-b-0 ${item.scanned ? "bg-[#f0fdf4] dark:bg-green-950/20" : ""}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold transition-all duration-300 ${
                    item.scanned
                      ? "bg-green-500 text-white animate-[scan-check-pop_0.3s_ease]"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  {item.scanned && "\u2713"}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-px">
                  <span className={`text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis ${item.scanned ? "text-green-800 dark:text-green-300" : ""}`}>{item.assetTag}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                    {item.brand} {item.model}
                  </span>
                </div>
                {item.scanned && (
                  <Badge variant="green" size="sm">
                    Scanned
                  </Badge>
                )}
              </div>
            ))}

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
