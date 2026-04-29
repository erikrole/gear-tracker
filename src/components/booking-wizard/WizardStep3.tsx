"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AssetImage } from "@/components/AssetImage";
import { UserAvatar } from "@/components/UserAvatar";
import { MapPinIcon, SmartphoneIcon } from "lucide-react";
import { sportLabel } from "@/lib/sports";
import { formatDateTime } from "@/lib/format";
import type { BulkSelection } from "@/components/EquipmentPicker";
import type { PickerAsset } from "@/components/EquipmentPicker";
import type { FormUser, Location, BulkSkuOption } from "@/components/booking-list/types";
import type { FormState } from "@/components/create-booking/types";
import { MAX_SCROLL_HEIGHT } from "./constants";

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

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 px-4 py-3">
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground shrink-0 mt-0.5">
        {label}
      </span>
      <div className="text-sm font-medium text-right min-w-0">{children}</div>
    </div>
  );
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
    <div className="space-y-7">

      {/* ── Header ── */}
      <div className="pb-5 border-b border-border">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1"
          style={{ color: "var(--wi-red)" }}
        >
          Step 3 of 3
        </p>
        <h2
          className="text-2xl font-black uppercase leading-none"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Confirm {config.label}
        </h2>
        <p className="text-sm text-muted-foreground mt-1.5">
          Review everything before you submit.
        </p>
      </div>

      {/* ── Booking details ── */}
      <div className="border border-border rounded-sm overflow-hidden divide-y divide-border">
        <SummaryRow label="Booking name">
          <span className="font-semibold">{form.title}</span>
        </SummaryRow>

        {/* Events (one row per linked event) */}
        {form.selectedEvents.length > 0 && (
          <SummaryRow label={form.selectedEvents.length > 1 ? "Events" : "Event"}>
            <div className="flex flex-col items-end gap-0.5">
              {form.selectedEvents.map((ev) => (
                <span key={ev.id}>
                  {ev.sportCode && (
                    <span className="font-normal text-muted-foreground">
                      {sportLabel(ev.sportCode)}
                      {ev.opponent ? " \u00b7 " : ""}
                    </span>
                  )}
                  {ev.opponent
                    ? `${ev.isHome === false ? "at" : "vs"} ${ev.opponent}`
                    : !ev.sportCode
                      ? ev.summary
                      : ""}
                </span>
              ))}
            </div>
          </SummaryRow>
        )}

        {/* Requester */}
        <SummaryRow label={config.requesterLabel}>
          <div className="flex items-center gap-2 justify-end">
            {requester ? (
              <UserAvatar name={requester.name} avatarUrl={requester.avatarUrl} size="sm" />
            ) : (
              <div className="size-5 rounded-full bg-muted" />
            )}
            <span>{requester?.name || "\u2014"}</span>
          </div>
        </SummaryRow>

        {/* Location */}
        <SummaryRow label="Location">
          <div className="flex items-center gap-1.5 justify-end">
            <MapPinIcon className="size-3.5 text-muted-foreground shrink-0" />
            <span>{locationName}</span>
          </div>
        </SummaryRow>

        {/* Dates */}
        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-1">
              {config.startLabel}
            </p>
            <p className="text-sm font-medium">{formatDateTime(form.startsAt)}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-1">
              {config.endLabel}
            </p>
            <p className="text-sm font-medium">{formatDateTime(form.endsAt)}</p>
          </div>
        </div>

        {/* Notes (only when present) */}
        {form.notes.trim() && (
          <SummaryRow label="Notes">
            <span className="whitespace-pre-wrap text-left">{form.notes}</span>
          </SummaryRow>
        )}
      </div>

      {/* ── Equipment ── */}
      <div>
        <div className="flex items-center gap-2.5 mb-3">
          <span
            className="h-[18px] w-[3px] shrink-0 rounded-full"
            style={{ backgroundColor: "var(--wi-red)" }}
          />
          <h3
            className="text-[11px] font-black uppercase tracking-[0.15em]"
          >
            Equipment
          </h3>
          <span className="text-[10px] font-bold text-muted-foreground ml-auto">
            {itemCount} item{itemCount !== 1 ? "s" : ""}
          </span>
        </div>

        {itemCount === 0 ? (
          <div className="border border-dashed rounded-sm px-4 py-6 text-center text-sm text-muted-foreground">
            No equipment selected \u2014 go back to add items.
          </div>
        ) : (
          <div
            className="border border-border rounded-sm overflow-y-auto overscroll-contain [touch-action:pan-y]"
            style={{ maxHeight: MAX_SCROLL_HEIGHT }}
          >
            {selectedAssetDetails.map((asset, i) => (
              <div key={asset.id}>
                {i > 0 && <Separator className="opacity-40" />}
                <div className="flex items-center gap-3 px-4 py-3">
                  <AssetImage
                    src={asset.imageUrl}
                    alt={asset.assetTag}
                    size={48}
                    className="rounded-sm shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{asset.assetTag}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {asset.brand} {asset.model}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {bulkDisplay.map((bi, i) => (
              <div key={bi.id}>
                {(selectedAssetDetails.length > 0 || i > 0) && <Separator className="opacity-40" />}
                <div className="flex items-center gap-3 px-4 py-3">
                  <AssetImage
                    src={bi.imageUrl}
                    alt={bi.name}
                    size={48}
                    className="rounded-sm shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{bi.name}</p>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground tabular-nums">
                    &times; {bi.quantity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Kiosk pickup notice (CHECKOUT only) ── */}
      {config.kind === "CHECKOUT" && (
        <div
          className="flex items-start gap-3 rounded-sm px-4 py-3.5 border"
          style={{
            backgroundColor: "color-mix(in srgb, var(--wi-red) 5%, transparent)",
            borderColor: "color-mix(in srgb, var(--wi-red) 20%, transparent)",
          }}
        >
          <SmartphoneIcon
            className="size-4 shrink-0 mt-0.5"
            style={{ color: "var(--wi-red)" }}
          />
          <p className="text-sm text-foreground">
            Gear pickup must happen at a kiosk. After submitting, the requester should go to the
            equipment kiosk and scan each item to complete the checkout.
          </p>
        </div>
      )}
    </div>
  );
}
