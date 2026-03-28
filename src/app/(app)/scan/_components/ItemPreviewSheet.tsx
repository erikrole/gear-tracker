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
              <div className="text-sm text-muted-foreground mt-0.5">
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
            <div className="flex flex-col gap-2.5">
              {item.serialNumber && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Serial</span>
                  <span className="text-right font-mono">
                    {item.serialNumber}
                  </span>
                </div>
              )}
              {item.location && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Location</span>
                  <span className="text-right">
                    {item.location.name}
                  </span>
                </div>
              )}
              {item.category && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Category</span>
                  <span className="text-right">
                    {item.category.name}
                  </span>
                </div>
              )}
            </div>

            {/* Parent asset banner */}
            {item.parentAsset && (
              <div
                className="rounded-[10px] mx-4 px-3.5 py-3"
                style={{
                  background: "var(--bg-muted)",
                  color: "var(--text-primary)",
                }}
              >
                <div className="text-[13px] font-semibold mb-1">Accessory of</div>
                <Link
                  href={`/items/${item.parentAsset.id}`}
                  className="text-[15px] font-bold font-medium"
                  style={{ color: "var(--primary)" }}
                >
                  {item.parentAsset.assetTag}
                </Link>
                <div className="text-[13px] opacity-85 mt-0.5">
                  {item.parentAsset.brand} {item.parentAsset.model}
                </div>
              </div>
            )}

            {/* Current holder / active booking */}
            {item.activeBooking && (
              <div
                className={`rounded-[10px] mx-4 px-3.5 py-3 ${statusColorClasses(item.computedStatus).bg} ${statusColorClasses(item.computedStatus).text}`}
              >
                <div className="text-[13px] font-semibold mb-1">
                  {item.activeBooking.kind === "CHECKOUT"
                    ? "Currently with"
                    : "Reserved by"}
                </div>
                <div className="text-[15px] font-bold">
                  {item.activeBooking.requesterName}
                </div>
                <div className="text-[13px] opacity-85 mt-0.5">
                  {item.activeBooking.title}
                </div>
                <div className="text-xs opacity-70 mt-1">
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
              className="flex-1 min-h-12 flex items-center justify-center no-underline"
              onClick={onClose}
            >
              Dismiss
            </Button>
            <Button className="flex-1 min-h-12 flex items-center justify-center no-underline" asChild>
              <Link href={`/items/${item.id}`}>View Details</Link>
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
