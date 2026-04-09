"use client";

import type { Dispatch, SetStateAction } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TriangleAlertIcon } from "lucide-react";
import EquipmentPicker from "@/components/EquipmentPicker";
import type { BulkSelection } from "@/components/EquipmentPicker";
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
  unsatisfiedRequirements: Array<{ message: string }>;
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
  unsatisfiedRequirements,
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

      {/* Equipment requirement warnings */}
      {unsatisfiedRequirements.length > 0 && (
        <Alert variant="destructive">
          <TriangleAlertIcon className="size-4" />
          <AlertDescription>
            {unsatisfiedRequirements.map((r, i) => (
              <div key={i}>{r.message}</div>
            ))}
          </AlertDescription>
        </Alert>
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
      />
    </div>
  );
}
