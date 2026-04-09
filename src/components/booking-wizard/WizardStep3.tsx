"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AssetImage } from "@/components/AssetImage";
import { UserAvatar } from "@/components/UserAvatar";
import { CalendarIcon, MapPinIcon, BoxesIcon, SmartphoneIcon } from "lucide-react";
import type { BulkSelection } from "@/components/EquipmentPicker";
import type { PickerAsset } from "@/components/EquipmentPicker";
import type { FormUser, Location, BulkSkuOption } from "@/components/booking-list/types";
import type { FormState } from "@/components/create-booking/types";

type WizardConfig = {
  kind: "CHECKOUT" | "RESERVATION";
  label: string;
  requesterLabel: string;
  startLabel: string;
  endLabel: string;
};

type Props = {
  config: WizardConfig;
  form: FormState;
  users: FormUser[];
  locations: Location[];
  selectedAssetDetails: PickerAsset[];
  selectedBulkItems: BulkSelection[];
  bulkSkus: BulkSkuOption[];
  itemCount: number;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function WizardStep3({
  config,
  form,
  users,
  locations,
  selectedAssetDetails,
  selectedBulkItems,
  bulkSkus,
  itemCount,
}: Props) {
  const locationName = locations.find((l) => l.id === form.locationId)?.name || "";
  const requester = users.find((u) => u.id === form.requester);

  const bulkDisplay = selectedBulkItems.map((bi) => {
    const sku = bulkSkus.find((s) => s.id === bi.bulkSkuId);
    return { id: bi.bulkSkuId, name: sku?.name || bi.bulkSkuId, quantity: bi.quantity, imageUrl: sku?.imageUrl };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Confirm {config.label}</h2>
        <p className="text-sm text-muted-foreground">Review everything before you submit.</p>
      </div>

      {/* ── Booking details card ── */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="divide-y divide-border/40">
            {/* Title */}
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground mb-0.5">Booking name</p>
              <p className="font-semibold">{form.title}</p>
            </div>

            {/* Event */}
            {form.selectedEvent && (
              <div className="px-4 py-3 flex items-start gap-3">
                <CalendarIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Event</p>
                  <p className="font-medium">
                    {form.selectedEvent.opponent
                      ? `${form.selectedEvent.isHome === false ? "at" : "vs"} ${form.selectedEvent.opponent}`
                      : form.selectedEvent.summary}
                  </p>
                </div>
                {form.selectedEvent.sportCode && (
                  <Badge variant="sport" size="sm" className="shrink-0 mt-0.5">{form.selectedEvent.sportCode}</Badge>
                )}
              </div>
            )}

            {/* Requester */}
            <div className="px-4 py-3 flex items-center gap-3">
              {requester ? (
                <UserAvatar name={requester.name} avatarUrl={requester.avatarUrl} size="sm" />
              ) : (
                <div className="size-6 rounded-full bg-muted" />
              )}
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">{config.requesterLabel}</p>
                <p className="font-medium">{requester?.name || "—"}</p>
              </div>
            </div>

            {/* Location */}
            <div className="px-4 py-3 flex items-center gap-3">
              <MapPinIcon className="size-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">Pickup Location</p>
                <p className="font-medium">{locationName}</p>
              </div>
            </div>

            {/* Dates */}
            <div className="px-4 py-3 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">{config.startLabel}</p>
                <p className="text-sm font-medium">{formatDateTime(form.startsAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">{config.endLabel}</p>
                <p className="text-sm font-medium">{formatDateTime(form.endsAt)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Equipment card ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BoxesIcon className="size-4 text-muted-foreground" />
          <h3 className="font-semibold">Equipment</h3>
          <Badge variant="secondary" size="sm">
            {itemCount} item{itemCount !== 1 ? "s" : ""}
          </Badge>
        </div>

        {itemCount === 0 ? (
          <Card className="border-border/60">
            <CardContent className="px-4 py-6 text-center text-sm text-muted-foreground">
              No equipment selected — go back to add items.
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/60 overflow-hidden">
            <CardContent className="p-0">
              {selectedAssetDetails.map((asset, i) => (
                <div key={asset.id}>
                  {i > 0 && <Separator className="opacity-40" />}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <AssetImage src={asset.imageUrl} alt={asset.assetTag} size={56} className="rounded-lg shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{asset.assetTag}</p>
                      <p className="text-sm text-muted-foreground truncate">{asset.brand} {asset.model}</p>
                    </div>
                  </div>
                </div>
              ))}
              {bulkDisplay.map((bi, i) => (
                <div key={bi.id}>
                  {(selectedAssetDetails.length > 0 || i > 0) && <Separator className="opacity-40" />}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <AssetImage src={bi.imageUrl} alt={bi.name} size={56} className="rounded-lg shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{bi.name}</p>
                    </div>
                    <Badge variant="secondary">× {bi.quantity}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Scan requirement notice ── */}
      {config.kind === "CHECKOUT" && (
        <div className="flex items-start gap-3 rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
          <SmartphoneIcon className="size-4 shrink-0 mt-0.5 text-primary" />
          <p className="text-sm text-foreground">
            Each item must be scanned out at pickup. Use a kiosk device or your phone to scan.
          </p>
        </div>
      )}
    </div>
  );
}
