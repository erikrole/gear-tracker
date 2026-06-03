"use client";

import type { Dispatch, SetStateAction } from "react";
import EquipmentPicker from "@/components/EquipmentPicker";
import type { BulkSelection, EquipmentPickerSelectionState } from "@/components/EquipmentPicker";
import type { EquipmentSectionKey } from "@/lib/equipment-sections";
import type { AvailableAsset, BulkSkuOption } from "@/components/booking-list/types";
import type { FormState } from "@/components/create-booking/types";
import { SectionHeading } from "@/components/form-layout";
import { Badge } from "@/components/ui/badge";
import { AlertCircleIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { buildAvailabilityReview, getTurnaroundWarningTotal } from "./flow-summary";

type Props = {
  kind: "CHECKOUT" | "RESERVATION";
  form: FormState;
  bulkSkus: BulkSkuOption[];
  selectedAssetIds: string[];
  setSelectedAssetIds: Dispatch<SetStateAction<string[]>>;
  selectedBulkItems: BulkSelection[];
  setSelectedBulkItems: Dispatch<SetStateAction<BulkSelection[]>>;
  onSelectedAssetsChange: (assets: AvailableAsset[]) => void;
  onSelectionStateChange: (state: EquipmentPickerSelectionState) => void;
  selectionState: EquipmentPickerSelectionState;
  itemCount: number;
  activeSection: EquipmentSectionKey;
  onActiveSectionChange: (section: EquipmentSectionKey) => void;
};

export function WizardStep2({
  kind,
  form,
  bulkSkus,
  selectedAssetIds,
  setSelectedAssetIds,
  selectedBulkItems,
  setSelectedBulkItems,
  onSelectedAssetsChange,
  onSelectionStateChange,
  selectionState,
  itemCount,
  activeSection,
  onActiveSectionChange,
}: Props) {
  const hasSelectionState =
    selectionState.totalSelected > 0 ||
    selectionState.checkingAvailability ||
    itemCount > 0;
  const availabilityReview = buildAvailabilityReview(selectionState);
  const turnaroundCount = getTurnaroundWarningTotal(selectionState);
  const hasWarnings = availabilityReview !== null;
  const hasUnavailable = selectionState.unresolvedAssetCount > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <SectionHeading>Select equipment</SectionHeading>
        <p className="text-sm text-muted-foreground">
          {kind === "CHECKOUT"
            ? "Pick the gear to check out. Items will be scanned at pickup to confirm."
            : "Browse and reserve the equipment you\u2019ll need."}
        </p>
        {itemCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {itemCount} item{itemCount !== 1 ? "s" : ""} selected. You can review now or keep browsing sections.
          </p>
        )}
      </div>

      {hasSelectionState && (
        <div className="rounded-md border border-border/60 bg-card/70 px-3 py-2.5 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={itemCount > 0 ? "green" : "secondary"} size="sm" className="gap-1.5 tabular-nums">
              {itemCount > 0 ? <CheckCircle2Icon data-icon="inline-start" /> : null}
              {itemCount} valid item{itemCount !== 1 ? "s" : ""}
            </Badge>
            {availabilityReview && (
              <Badge variant="orange" size="sm" className="gap-1.5 tabular-nums">
                <AlertCircleIcon data-icon="inline-start" />
                {availabilityReview.total} warning{availabilityReview.total !== 1 ? "s" : ""}
              </Badge>
            )}
            {selectionState.conflictCount > 0 && (
              <Badge variant="orange" size="sm" className="gap-1.5 tabular-nums">
                <AlertCircleIcon data-icon="inline-start" />
                {selectionState.conflictCount} conflict{selectionState.conflictCount !== 1 ? "s" : ""}
              </Badge>
            )}
            {selectionState.upcomingCommitmentCount > 0 && (
              <Badge variant="blue" size="sm" className="gap-1.5 tabular-nums">
                {selectionState.upcomingCommitmentCount} next use
              </Badge>
            )}
            {turnaroundCount > 0 && (
              <Badge variant="orange" size="sm" className="gap-1.5 tabular-nums">
                {turnaroundCount} turnaround
              </Badge>
            )}
            {hasUnavailable && (
              <Badge variant="orange" size="sm" className="gap-1.5 tabular-nums">
                <AlertCircleIcon data-icon="inline-start" />
                {selectionState.unresolvedAssetCount} unavailable
              </Badge>
            )}
            {selectionState.checkingAvailability && (
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2Icon className="size-3 animate-spin" />
                Rechecking availability
              </span>
            )}
          </div>
          {(hasWarnings || hasUnavailable) && (
            <p className="mt-2 text-xs text-muted-foreground">
              {hasUnavailable
                ? "Remove unavailable items or pick replacements before review."
                : availabilityReview?.description}
            </p>
          )}
        </div>
      )}

      <EquipmentPicker
        bulkSkus={bulkSkus}
        selectedAssetIds={selectedAssetIds}
        setSelectedAssetIds={setSelectedAssetIds}
        selectedBulkItems={selectedBulkItems}
        setSelectedBulkItems={setSelectedBulkItems}
        startsAt={form.startsAt}
        endsAt={form.endsAt}
        locationId={form.locationId}
        onSelectedAssetsChange={onSelectedAssetsChange}
        onSelectionStateChange={onSelectionStateChange}
        activeSection={activeSection}
        onActiveSectionChange={onActiveSectionChange}
      />
    </div>
  );
}
