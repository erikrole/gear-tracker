"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarIcon, ExternalLinkIcon } from "lucide-react";
import { AssetImage } from "@/components/AssetImage";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { statusLabelEquipment, statusBadgeVariantEquipment } from "@/lib/status-colors";
import type { ItemPreview } from "./types";
import { getSdCardSlotLabel } from "@/lib/asset-attachments";

type ItemPreviewDrawerProps = {
  item: ItemPreview | null;
  onClose: () => void;
};

function unitStatusLabel(status: string) {
  switch (status) {
    case "AVAILABLE":
      return "Available";
    case "CHECKED_OUT":
      return "Checked Out";
    case "LOST":
      return "Missing";
    case "RETIRED":
      return "Retired";
    default:
      return status.replace(/_/g, " ").toLowerCase();
  }
}

function unitStatusBadgeVariant(status: string): "green" | "blue" | "red" | "gray" {
  switch (status) {
    case "AVAILABLE":
      return "green";
    case "CHECKED_OUT":
      return "blue";
    case "LOST":
      return "red";
    default:
      return "gray";
  }
}

export function ItemPreviewDrawer({ item, onClose }: ItemPreviewDrawerProps) {
  const router = useRouter();
  const isBooked = !!item?.activeBooking;
  const isAvailable = item?.computedStatus === "AVAILABLE";
  const displayName = item ? item.name || `${item.brand} ${item.model}` : "";
  const slotLabel = item?.parentAsset ? getSdCardSlotLabel(item, item.parentAsset.assetTag) : null;

  return (
    <Drawer
      open={!!item}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DrawerContent>
        {item && (
          <div className="mx-auto w-full max-w-sm">
            <DrawerHeader className="text-center">
              {/* Item image */}
              <AssetImage
                src={item.imageUrl}
                alt={displayName}
                size={112}
                className="mx-auto mb-3 rounded-xl"
                fallbackClassName="rounded-xl"
              />

              <DrawerTitle>{displayName}</DrawerTitle>
              <DrawerDescription>
                {item.itemFamily
                  ? `${item.model}${item.category?.name ? ` · ${item.category.name}` : ""}`
                  : `${item.assetTag}${item.name ? ` · ${item.brand} ${item.model}` : ""}`}
              </DrawerDescription>

              <div className="mt-2 flex justify-center">
                <Badge variant={statusBadgeVariantEquipment(item.computedStatus)}>
                  {isBooked && (
                    <UserAvatar
                      name={item.activeBooking!.requesterName}
                      avatarUrl={item.activeBooking!.requesterAvatarUrl}
                      size="xs"
                    />
                  )}
                  {item.availabilityLabel ?? statusLabelEquipment(item.computedStatus)}
                </Badge>
              </div>
              {item.unitLabel && (
                <div className="mt-2 flex justify-center">
                  <Badge variant="secondary" size="sm">{item.unitLabel}</Badge>
                </div>
              )}
              {item.parentAsset && (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <span>Attached to</span>
                  <Link href={`/items/${item.parentAsset.id}`} className="font-mono font-medium text-primary hover:underline">
                    {item.parentAsset.assetTag}
                  </Link>
                  {slotLabel && <Badge variant="blue" size="sm">{slotLabel}</Badge>}
                </div>
              )}
            </DrawerHeader>

            <div className="px-4 pb-2">
              {item.itemFamily ? (
                <div className="space-y-3">
                  {item.scannedUnit ? (
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">
                            Unit #{item.scannedUnit.number}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Exact unit scanned from this item family.
                          </div>
                        </div>
                        <Badge variant={unitStatusBadgeVariant(item.scannedUnit.status)} size="sm">
                          {unitStatusLabel(item.scannedUnit.status)}
                        </Badge>
                      </div>
                      {item.scannedUnit.holder && (
                        <div className="mt-3 border-t border-border/60 pt-3 text-left">
                          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Current custody
                          </div>
                          <div className="mt-1 text-sm font-medium">
                            {item.scannedUnit.holder}
                          </div>
                          {item.scannedUnit.bookingTitle && (
                            <div className="text-xs text-muted-foreground">
                              {item.scannedUnit.bookingTitle}
                            </div>
                          )}
                          {item.scannedUnit.dueAt && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <CalendarIcon className="size-3" />
                              Due {new Date(item.scannedUnit.dueAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null}
                  <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-center text-sm text-muted-foreground">
                    Lookup only. Request quantities in bookings; kiosk pickup and return scans handle exact unit custody.
                  </div>
                </div>
              ) : isBooked ? (
                /* ── Booked state: show holder info ── */
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      name={item.activeBooking!.requesterName}
                      avatarUrl={item.activeBooking!.requesterAvatarUrl}
                      size="default"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {item.activeBooking!.requesterName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {item.activeBooking!.title}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarIcon className="size-3" />
                        {new Date(item.activeBooking!.startsAt).toLocaleDateString()}{" "}
                        -{" "}
                        {new Date(item.activeBooking!.endsAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              ) : isAvailable ? (
                /* ── Available state: quick actions ── */
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      onClose();
                      router.push("/bookings?create=true&tab=checkouts");
                    }}
                  >
                    Check Out
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      onClose();
                      router.push("/bookings?create=true&tab=reservations");
                    }}
                  >
                    Reserve
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-center text-sm text-muted-foreground">
                  View details for maintenance, retirement, or exception handling.
                </div>
              )}
            </div>

            <DrawerFooter className="flex-row gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onClose}
              >
                Dismiss
              </Button>
              <Button className="flex-1" variant="secondary" asChild>
                <Link href={`/items/${item.id}`}>
                  <ExternalLinkIcon className="mr-1.5 size-4" />
                  View Details
                </Link>
              </Button>
            </DrawerFooter>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
