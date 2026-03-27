"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import type { BookingListConfig, AvailableAsset, BulkSkuOption } from "./types";
import type { BulkSelection } from "@/components/EquipmentPicker";

type ConfirmBookingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  config: BookingListConfig;
  title: string;
  startsAt: string;
  endsAt: string;
  locationName: string;
  requesterName: string;
  selectedAssetDetails: AvailableAsset[];
  selectedBulkItems: BulkSelection[];
  bulkSkus: BulkSkuOption[];
  submitting: boolean;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ConfirmBookingDialog({
  open,
  onOpenChange,
  onConfirm,
  config,
  title,
  startsAt,
  endsAt,
  locationName,
  requesterName,
  selectedAssetDetails,
  selectedBulkItems,
  bulkSkus,
  submitting,
}: ConfirmBookingDialogProps) {
  const totalItems = selectedAssetDetails.length + selectedBulkItems.length;

  const selectedBulkDisplay = selectedBulkItems.map((bi) => {
    const sku = bulkSkus.find((s) => s.id === bi.bulkSkuId);
    return { name: sku?.name || bi.bulkSkuId, quantity: bi.quantity };
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm {config.label}</AlertDialogTitle>
          <AlertDialogDescription>
            Review the details before submitting.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{title}</span>

            <span className="text-muted-foreground">{config.startLabel}</span>
            <span>{formatDateTime(startsAt)}</span>

            <span className="text-muted-foreground">{config.endLabel}</span>
            <span>{formatDateTime(endsAt)}</span>

            <span className="text-muted-foreground">Location</span>
            <span>{locationName}</span>

            <span className="text-muted-foreground">{config.requesterLabel}</span>
            <span>{requesterName}</span>
          </div>

          {totalItems > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-muted-foreground">Equipment</span>
                <Badge variant="secondary" className="text-xs">{totalItems} item{totalItems !== 1 ? "s" : ""}</Badge>
              </div>
              <ul className="space-y-0.5 text-muted-foreground max-h-40 overflow-y-auto">
                {selectedAssetDetails.map((a) => (
                  <li key={a.id} className="flex items-center gap-1.5">
                    <span className="text-foreground font-mono text-xs">{a.assetTag}</span>
                    <span className="truncate">{a.brand} {a.model}</span>
                  </li>
                ))}
                {selectedBulkDisplay.map((bi) => (
                  <li key={bi.name} className="flex items-center gap-1.5">
                    <span className="truncate">{bi.name}</span>
                    <span>&times; {bi.quantity}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {totalItems === 0 && (
            <p className="text-muted-foreground italic">No equipment selected</p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Go back</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={submitting}>
            {submitting ? config.actionLabelProgress : config.actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
