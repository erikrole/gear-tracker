"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AssetImage } from "@/components/AssetImage";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ScanIcon } from "lucide-react";
import type { BulkSelection } from "@/components/EquipmentPicker";
import type { FormUser, Location, AvailableAsset, BulkSkuOption } from "@/components/booking-list/types";
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
  selectedAssetDetails: AvailableAsset[];
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
  const requesterName = users.find((u) => u.id === form.requester)?.name || "";

  const bulkDisplay = selectedBulkItems.map((bi) => {
    const sku = bulkSkus.find((s) => s.id === bi.bulkSkuId);
    return { name: sku?.name || bi.bulkSkuId, quantity: bi.quantity };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Review & Confirm</h2>
        <p className="text-sm text-muted-foreground">
          Double-check everything before submitting.
        </p>
      </div>

      {/* ── Booking details summary ── */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{form.title}</span>

            <span className="text-muted-foreground">{config.requesterLabel}</span>
            <span>{requesterName}</span>

            <span className="text-muted-foreground">Location</span>
            <span>{locationName}</span>

            <span className="text-muted-foreground">{config.startLabel}</span>
            <span>{formatDateTime(form.startsAt)}</span>

            <span className="text-muted-foreground">{config.endLabel}</span>
            <span>{formatDateTime(form.endsAt)}</span>

            {form.selectedEvent && (
              <>
                <span className="text-muted-foreground">Event</span>
                <span>
                  {form.selectedEvent.opponent
                    ? `${form.selectedEvent.isHome === false ? "at" : "vs"} ${form.selectedEvent.opponent}`
                    : form.selectedEvent.summary}
                  {form.selectedEvent.sportCode && (
                    <Badge variant="sport" size="sm" className="ml-1.5">
                      {form.selectedEvent.sportCode}
                    </Badge>
                  )}
                </span>
              </>
            )}

            {form.sport && !form.selectedEvent && (
              <>
                <span className="text-muted-foreground">Sport</span>
                <span>{form.sport}</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Equipment summary ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold">Equipment</h3>
          <Badge variant="secondary" size="sm">
            {itemCount} item{itemCount !== 1 ? "s" : ""}
          </Badge>
        </div>

        {itemCount === 0 ? (
          <p className="text-sm text-muted-foreground italic">No equipment selected</p>
        ) : (
          <Card>
            <ScrollArea className="max-h-64">
              <CardContent className="p-0 divide-y divide-border/40">
                {selectedAssetDetails.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                    <AssetImage src={a.imageUrl} alt={a.assetTag} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{a.assetTag}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {a.brand} {a.model}
                      </div>
                    </div>
                  </div>
                ))}
                {bulkDisplay.map((bi) => (
                  <div key={bi.name} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="size-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <ScanIcon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{bi.name}</div>
                    </div>
                    <Badge variant="secondary" size="sm">&times; {bi.quantity}</Badge>
                  </div>
                ))}
              </CardContent>
            </ScrollArea>
          </Card>
        )}
      </div>

      {/* ── Checkout scan notice ── */}
      {config.kind === "CHECKOUT" && itemCount > 0 && (
        <div className="flex items-start gap-2.5 rounded-md bg-muted/60 px-3 py-2.5 text-sm">
          <ScanIcon className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
          <p className="text-muted-foreground">
            Items will need to be <strong className="text-foreground">scanned at pickup</strong> to confirm the checkout.
          </p>
        </div>
      )}
    </div>
  );
}
