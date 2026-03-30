"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScanIcon, UserIcon, CalendarIcon, ExternalLinkIcon } from "lucide-react";
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

type ItemPreviewDrawerProps = {
  item: ItemPreview | null;
  onClose: () => void;
};

export function ItemPreviewDrawer({ item, onClose }: ItemPreviewDrawerProps) {
  const router = useRouter();
  const isBooked = !!item?.activeBooking;
  const displayName = item?.name || `${item?.brand} ${item?.model}`;

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
              {item.imageUrl ? (
                <div className="mx-auto mb-3 h-28 w-28 overflow-hidden rounded-xl border bg-muted">
                  <img
                    src={item.imageUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="mx-auto mb-3 flex h-28 w-28 items-center justify-center rounded-xl border bg-muted">
                  <ScanIcon className="h-10 w-10 text-muted-foreground" />
                </div>
              )}

              <DrawerTitle>{displayName}</DrawerTitle>
              <DrawerDescription>
                {item.assetTag}
                {item.name && ` · ${item.brand} ${item.model}`}
              </DrawerDescription>

              <div className="mt-2 flex justify-center">
                <Badge variant={statusBadgeVariant(item.computedStatus)}>
                  {statusLabel(item.computedStatus)}
                </Badge>
              </div>
            </DrawerHeader>

            <div className="px-4 pb-2">
              {isBooked ? (
                /* ── Booked state: show holder info ── */
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    {item.activeBooking!.requesterAvatarUrl ? (
                      <img
                        src={item.activeBooking!.requesterAvatarUrl}
                        alt={item.activeBooking!.requesterName}
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                        <UserIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {item.activeBooking!.requesterName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {item.activeBooking!.title}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarIcon className="h-3 w-3" />
                        {new Date(item.activeBooking!.startsAt).toLocaleDateString()}{" "}
                        &ndash;{" "}
                        {new Date(item.activeBooking!.endsAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
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
                  <ExternalLinkIcon className="mr-1.5 h-4 w-4" />
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
