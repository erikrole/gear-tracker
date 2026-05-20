"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AssetImage } from "@/components/AssetImage";
import { UserAvatar } from "@/components/UserAvatar";
import {
  CalendarClockIcon,
  CheckCircle2Icon,
  Clock3Icon,
  ClipboardCheckIcon,
  MapPinIcon,
  SmartphoneIcon,
} from "lucide-react";
import { SectionHeading } from "@/components/form-layout";
import { sportLabel } from "@/lib/sports";
import { VENUE_TONES, venueBadgeVariant, venueToneFromIsHome } from "@/lib/venue-tone";
import { formatChipTime, formatDateTime } from "@/lib/format";
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

function HandoffFact({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-sm border border-border/60 bg-background px-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <div className="mt-0.5 text-sm font-semibold text-foreground">{value}</div>
      </div>
    </div>
  );
}

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
  const isCheckout = config.kind === "CHECKOUT";
  const requesterName = requester?.name || "the requester";

  const bulkDisplay = selectedBulkItems.map((bi) => {
    const sku = bulkSkus.find((s) => s.id === bi.bulkSkuId);
    return { id: bi.bulkSkuId, name: sku?.name || bi.bulkSkuId, quantity: bi.quantity, imageUrl: sku?.imageUrl };
  });

  return (
    <div className="flex flex-col gap-7">

      {/* ── Header ── */}
      <div className="flex flex-col gap-1 border-b border-border pb-5">
        <SectionHeading>Confirm {config.label}</SectionHeading>
        <p className="text-sm text-muted-foreground">
          {isCheckout
            ? "Create the pickup, then finish custody at the kiosk."
            : "Confirm the reservation window before gear is held."}
        </p>
      </div>

      {/* ── Handoff outcome ── */}
      <div className="rounded-md border border-border/60 bg-card/70 p-3 shadow-xs">
        <div className="flex items-start gap-3">
          <div
            className={
              isCheckout
                ? "flex size-9 shrink-0 items-center justify-center rounded-sm bg-[var(--orange-bg)] text-[var(--orange-text)]"
                : "flex size-9 shrink-0 items-center justify-center rounded-sm bg-[var(--purple-bg)] text-[var(--purple-text)]"
            }
          >
            {isCheckout ? (
              <Clock3Icon className="size-5" />
            ) : (
              <CheckCircle2Icon className="size-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-balance">
                {isCheckout ? "Pending kiosk pickup" : "Reservation ready"}
              </h3>
              <Badge variant={isCheckout ? "orange" : "purple"} size="sm">
                {isCheckout ? "Pending pickup" : "Reserved window"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              {isCheckout
                ? `${requesterName} will pick up at ${locationName || "the selected location"} and scan each item at the kiosk before the checkout becomes active.`
                : `${requesterName} will have this gear held for the selected window. Staff can start the checkout from the reservation when handoff begins.`}
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <HandoffFact
            icon={isCheckout ? SmartphoneIcon : CalendarClockIcon}
            label={isCheckout ? "Next step" : "Status after submit"}
            value={isCheckout ? "Kiosk scan" : "Confirmed"}
          />
          <HandoffFact
            icon={MapPinIcon}
            label={isCheckout ? "Pickup location" : "Location"}
            value={locationName || "Selected location"}
          />
          <HandoffFact
            icon={isCheckout ? ClipboardCheckIcon : CalendarClockIcon}
            label={isCheckout ? "Due back" : "Starts"}
            value={isCheckout ? formatDateTime(form.endsAt) : formatDateTime(form.startsAt)}
          />
        </div>
      </div>

      {/* ── Booking details ── */}
      <div className="border border-border rounded-sm overflow-hidden divide-y divide-border">
        <SummaryRow label="Booking name">
          <span className="font-semibold">{form.title}</span>
        </SummaryRow>

        {/* Events (one row per linked event, primary first) */}
        {form.selectedEvents.length > 0 && (
          <SummaryRow label={form.selectedEvents.length > 1 ? `Events (${form.selectedEvents.length})` : "Event"}>
            <div className="flex flex-col items-end gap-1.5">
              {form.selectedEvents.map((ev, idx) => (
                <div key={ev.id} className="flex items-center gap-2 flex-wrap justify-end">
                  {idx === 0 && form.selectedEvents.length > 1 && (
                    <Badge variant="outline" size="sm" className="text-[9px] uppercase tracking-wider">
                      Primary
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatChipTime(ev.startsAt)}
                  </span>
                  <span>
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
                  {ev.opponent && (
                    <Badge variant={venueBadgeVariant(ev.isHome)} size="sm">
                      {VENUE_TONES[venueToneFromIsHome(ev.isHome)].label}
                    </Badge>
                  )}
                </div>
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
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <SectionHeading>Equipment</SectionHeading>
          <span className="ml-auto text-[10px] font-bold text-muted-foreground">
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
        <Alert>
          <SmartphoneIcon />
          <AlertTitle>Pickup is not complete yet</AlertTitle>
          <AlertDescription>
            Submitting creates a pending pickup. The requester still needs to scan the planned
            items at the equipment kiosk before custody starts.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
