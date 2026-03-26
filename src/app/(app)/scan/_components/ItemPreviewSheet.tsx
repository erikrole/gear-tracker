import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { statusColorClasses } from "@/lib/status-colors";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import type { ItemPreview } from "./types";

function statusLabel(s: string) {
  switch (s) {
    case "AVAILABLE":
      return "Available";
    case "CHECKED_OUT":
      return "Checked Out";
    case "RESERVED":
      return "Reserved";
    case "MAINTENANCE":
      return "In Maintenance";
    case "RETIRED":
      return "Retired";
    default:
      return s;
  }
}

function statusBadgeVariant(
  s: string,
): "green" | "blue" | "purple" | "orange" | "gray" {
  switch (s) {
    case "AVAILABLE":
      return "green";
    case "CHECKED_OUT":
      return "blue";
    case "RESERVED":
      return "purple";
    case "MAINTENANCE":
      return "orange";
    default:
      return "gray";
  }
}


type ItemPreviewSheetProps = {
  item: ItemPreview | null;
  onClose: () => void;
};

export function ItemPreviewSheet({ item, onClose }: ItemPreviewSheetProps) {
  return (
    <Sheet
      open={!!item}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="sm:max-w-[480px]">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle>{item?.assetTag}</SheetTitle>
              <div className="scan-sheet-subtitle">
                {item?.brand} {item?.model}
              </div>
            </div>
            {item && (
              <Badge variant={statusBadgeVariant(item.computedStatus)}>
                {statusLabel(item.computedStatus)}
              </Badge>
            )}
          </div>
        </SheetHeader>

        {item && (
          <SheetBody className="px-6 py-4">
            <div className="scan-sheet-details">
              {item.serialNumber && (
                <div className="scan-sheet-row">
                  <span className="scan-sheet-label">Serial</span>
                  <span className="scan-sheet-value font-mono">
                    {item.serialNumber}
                  </span>
                </div>
              )}
              {item.location && (
                <div className="scan-sheet-row">
                  <span className="scan-sheet-label">Location</span>
                  <span className="scan-sheet-value">
                    {item.location.name}
                  </span>
                </div>
              )}
              {item.category && (
                <div className="scan-sheet-row">
                  <span className="scan-sheet-label">Category</span>
                  <span className="scan-sheet-value">
                    {item.category.name}
                  </span>
                </div>
              )}
            </div>

            {/* Parent asset banner */}
            {item.parentAsset && (
              <div
                className="scan-sheet-booking"
                style={{
                  background: "var(--bg-muted)",
                  color: "var(--text-primary)",
                }}
              >
                <div className="scan-sheet-booking-label">Accessory of</div>
                <Link
                  href={`/items/${item.parentAsset.id}`}
                  className="scan-sheet-booking-name font-medium"
                  style={{ color: "var(--primary)" }}
                >
                  {item.parentAsset.assetTag}
                </Link>
                <div className="scan-sheet-booking-title">
                  {item.parentAsset.brand} {item.parentAsset.model}
                </div>
              </div>
            )}

            {/* Current holder / active booking */}
            {item.activeBooking && (
              <div
                className={`scan-sheet-booking ${statusColorClasses(item.computedStatus).bg} ${statusColorClasses(item.computedStatus).text}`}
              >
                <div className="scan-sheet-booking-label">
                  {item.activeBooking.kind === "CHECKOUT"
                    ? "Currently with"
                    : "Reserved by"}
                </div>
                <div className="scan-sheet-booking-name">
                  {item.activeBooking.requesterName}
                </div>
                <div className="scan-sheet-booking-title">
                  {item.activeBooking.title}
                </div>
                <div className="scan-sheet-booking-dates">
                  {new Date(item.activeBooking.startsAt).toLocaleDateString()}{" "}
                  &ndash;{" "}
                  {new Date(item.activeBooking.endsAt).toLocaleDateString()}
                </div>
              </div>
            )}
          </SheetBody>
        )}

        {item && (
          <SheetFooter className="flex-row gap-2">
            <Button
              variant="outline"
              className="scan-sheet-btn"
              onClick={onClose}
            >
              Dismiss
            </Button>
            <Button className="scan-sheet-btn" asChild>
              <Link href={`/items/${item.id}`}>View Details</Link>
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
