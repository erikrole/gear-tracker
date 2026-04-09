"use client";

import type { Dispatch, SetStateAction } from "react";
import EquipmentPicker from "@/components/EquipmentPicker";
import type { BulkSelection } from "@/components/EquipmentPicker";
import type { EquipmentSectionKey } from "@/lib/equipment-sections";
import type { AvailableAsset, BulkSkuOption } from "@/components/booking-list/types";
import type { FormState } from "@/components/create-booking/types";

type Props = {
  kind: "CHECKOUT" | "RESERVATION";
  form: FormState;
  bulkSkus: BulkSkuOption[];
  selectedAssetIds: string[];
  setSelectedAssetIds: Dispatch<SetStateAction<string[]>>;
  selectedBulkItems: BulkSelection[];
  setSelectedBulkItems: Dispatch<SetStateAction<BulkSelection[]>>;
  onSelectedAssetsChange: (assets: AvailableAsset[]) => void;
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
  activeSection,
  onActiveSectionChange,
}: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-1">Select Equipment</h2>
        <p className="text-sm text-muted-foreground">
          {kind === "CHECKOUT"
            ? "Pick the gear to check out. Items will be scanned at pickup to confirm."
            : "Browse and reserve the equipment you\u2019ll need."}
        </p>
      </div>

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
        activeSection={activeSection}
        onActiveSectionChange={onActiveSectionChange}
      />
    </div>
  );
}
