"use client";

import { useEffect, useRef, useState } from "react";
import { classifyAssetType, type EquipmentSectionKey } from "@/lib/equipment-sections";
import type { PickerAsset, PickerBulkSku, BulkSelection } from "@/components/EquipmentPicker";

type UseScanToAddParams = {
  legacyMode: boolean;
  legacyAssets: PickerAsset[];
  bulkSkus: PickerBulkSku[];
  selectedAssetIds: string[];
  setSelectedAssetIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedBulkItems: BulkSelection[];
  setSelectedBulkItems: React.Dispatch<React.SetStateAction<BulkSelection[]>>;
  selectedAssetsCache: Map<string, PickerAsset>;
  selectedIdSet: Set<string>;
  conflicts: Map<string, { assetId: string; conflictingBookingTitle?: string; startsAt: string; endsAt: string }>;
  setActiveSection: (key: EquipmentSectionKey) => void;
};

export function useScanToAdd({
  legacyMode,
  legacyAssets,
  bulkSkus,
  selectedAssetIds,
  setSelectedAssetIds,
  selectedBulkItems,
  setSelectedBulkItems,
  selectedAssetsCache,
  selectedIdSet,
  conflicts,
  setActiveSection,
}: UseScanToAddParams) {
  const [scanFeedback, setScanFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const scanFeedbackTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Clean up scan feedback timer on unmount
  useEffect(() => {
    return () => { if (scanFeedbackTimer.current) clearTimeout(scanFeedbackTimer.current); };
  }, []);

  function showScanFeedbackMsg(message: string, type: "success" | "error") {
    setScanFeedback({ message, type });
    if (scanFeedbackTimer.current) clearTimeout(scanFeedbackTimer.current);
    scanFeedbackTimer.current = setTimeout(() => setScanFeedback(null), 2500);
  }

  function handleScannedAsset(asset: PickerAsset) {
    // BRK-001: Check computedStatus -- don't add unavailable items via scan
    const isAvailable = asset.computedStatus === "AVAILABLE";
    const hasConflict = conflicts.has(asset.id);
    if (!isAvailable && !hasConflict) {
      const statusLabel = asset.computedStatus.replace("_", " ").toLowerCase();
      showScanFeedbackMsg(`${asset.assetTag} is ${statusLabel}`, "error");
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
      setActiveSection(classifyAssetType(asset.type, asset.categoryName));
      return;
    }

    // BRK-002: Guard inside callback to prevent duplicate IDs from rapid scans
    let wasAdded = false;
    setSelectedAssetIds((prev) => {
      if (prev.includes(asset.id)) return prev;
      wasAdded = true;
      return [...prev, asset.id];
    });
    const section = classifyAssetType(asset.type, asset.categoryName);
    setActiveSection(section);
    const alreadySelected = selectedIdSet.has(asset.id);
    showScanFeedbackMsg(
      alreadySelected && !wasAdded ? `${asset.assetTag} already selected` : `Added ${asset.assetTag}`,
      alreadySelected && !wasAdded ? "error" : "success",
    );
    if (navigator.vibrate) navigator.vibrate(alreadySelected && !wasAdded ? [50, 50] : 100);
  }

  function handleScannedBulk(sku: PickerBulkSku, _value: string) {
    let wasAdded = false;
    setSelectedBulkItems((prev) => {
      if (prev.some((i) => i.bulkSkuId === sku.id)) return prev;
      wasAdded = true;
      return [...prev, { bulkSkuId: sku.id, quantity: 1 }];
    });
    const section = classifyAssetType(sku.category, sku.categoryName);
    setActiveSection(section);
    const alreadySelected = selectedBulkItems.some((i) => i.bulkSkuId === sku.id);
    showScanFeedbackMsg(
      alreadySelected && !wasAdded ? `${sku.name} already selected` : `Added ${sku.name}`,
      alreadySelected && !wasAdded ? "error" : "success",
    );
    if (navigator.vibrate) navigator.vibrate(alreadySelected && !wasAdded ? [50, 50] : 100);
  }

  function handleScanToAddLegacy(value: string) {
    const bgMatch = value.match(/^bg:\/\/(item|case)\/(.+)$/);
    const searchValue = bgMatch ? bgMatch[2] : value;

    const asset = legacyAssets.find((a) =>
      a.qrCodeValue === value ||
      a.id === searchValue ||
      a.primaryScanCode === value ||
      a.assetTag.toLowerCase() === searchValue.toLowerCase()
    );

    if (asset) {
      handleScannedAsset(asset);
      return;
    }

    const sku = bulkSkus.find((s) => s.binQrCodeValue === value);
    if (sku) {
      handleScannedBulk(sku, value);
      return;
    }

    showScanFeedbackMsg("No matching item \u2014 check this location\u2019s inventory", "error");
    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
  }

  async function handleScanToAddSearch(value: string) {
    try {
      const params = new URLSearchParams();
      params.set("qr", value);
      params.set("only_available", "false");
      params.set("limit", "1");
      const res = await fetch(`/api/assets/picker-search?${params}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data as { assets: PickerAsset[]; total: number; sectionCounts: null };
        if (data.assets.length > 0) {
          const asset = data.assets[0];
          selectedAssetsCache.set(asset.id, asset);
          handleScannedAsset(asset);
          return;
        }
      }
    } catch {
      // Fall through to bulk check
    }

    const sku = bulkSkus.find((s) => s.binQrCodeValue === value);
    if (sku) {
      handleScannedBulk(sku, value);
      return;
    }

    showScanFeedbackMsg("No matching item \u2014 check this location\u2019s inventory", "error");
    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
  }

  function handleScan(value: string) {
    if (legacyMode) {
      handleScanToAddLegacy(value);
    } else {
      handleScanToAddSearch(value);
    }
  }

  return { scanFeedback, handleScan, showScanFeedbackMsg };
}
