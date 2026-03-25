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
    <div className="scan-checklist">
      <div className="scan-checklist-header">
        <h2>Items</h2>
        <span className="scan-checklist-count">
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
        <div className="scan-checklist-items">
          {/* Unscanned first, then scanned */}
          {[...scanStatus.serializedItems]
            .sort((a, b) =>
              a.scanned === b.scanned ? 0 : a.scanned ? 1 : -1,
            )
            .map((item) => (
              <div
                key={item.assetId}
                className={`scan-item ${item.scanned ? "scan-item-done" : ""}`}
              >
                <div
                  className={`scan-item-check ${item.scanned ? "scan-item-check-done" : ""}`}
                >
                  {item.scanned && "\u2713"}
                </div>
                <div className="scan-item-info">
                  <span className="scan-item-tag">{item.assetTag}</span>
                  <span className="scan-item-desc">
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
                className={`scan-item ${done ? "scan-item-done" : ""}`}
              >
                <div
                  className={`scan-item-check ${done ? "scan-item-check-done" : ""}`}
                >
                  {done && "\u2713"}
                </div>
                <div className="scan-item-info">
                  <span className="scan-item-tag">
                    {item.name}
                    {item.trackByNumber && (
                      <Badge variant="blue" size="sm" className="ml-1.5">
                        #
                      </Badge>
                    )}
                  </span>
                  <span className="scan-item-desc">
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
