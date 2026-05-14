"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ItemPreview,
  LookupResult,
  ScanFeedbackResult,
} from "@/app/(app)/scan/_components/types";
import { scanFeedbackSuccess } from "@/lib/scan-feedback";
import { handleAuthRedirect } from "@/lib/errors";
import type { BulkItem } from "@/app/(app)/items/hooks/use-items-query";

type UseScanSubmissionResult = {
  processing: boolean;
  feedback: ScanFeedbackResult;
  setFeedback: (result: ScanFeedbackResult) => void;
  itemPreview: ItemPreview | null;
  setItemPreview: (item: ItemPreview | null) => void;
  handleScan: (value: string) => void;
};

function unitStatusLabel(status: string | undefined) {
  switch (status) {
    case "AVAILABLE":
      return "Available";
    case "CHECKED_OUT":
      return "Checked out";
    case "LOST":
      return "Missing";
    case "RETIRED":
      return "Retired";
    default:
      return status ? status.replace(/_/g, " ").toLowerCase() : "Unknown";
  }
}

function normalizedScanVariants(value: string) {
  const normalized = value.trim().toLowerCase();
  return new Set([normalized, normalized.startsWith("qr-") ? normalized.slice(3) : `qr-${normalized}`]);
}

function toItemFamilyPreview(familyMatch: BulkItem): ItemPreview {
  const scannedUnit = familyMatch.matchedUnitNumber
    ? {
        number: familyMatch.matchedUnitNumber,
        status: familyMatch.matchedUnitStatus ?? "UNKNOWN",
        holder: familyMatch.matchedUnitHolder ?? null,
        dueAt: familyMatch.matchedUnitDueAt ?? null,
        bookingTitle: familyMatch.matchedUnitBookingTitle ?? null,
      }
    : null;
  const unitLabel = scannedUnit
    ? `Unit #${scannedUnit.number} · ${unitStatusLabel(scannedUnit.status)}`
    : null;

  return {
    id: `bulk-${familyMatch.id}`,
    assetTag: `${familyMatch.availableQuantity}/${familyMatch.onHandQuantity} available`,
    itemFamily: true,
    itemFamilyTracking: familyMatch.trackByNumber ? "units" : "quantity",
    unitLabel,
    scannedUnit,
    availabilityLabel: `${familyMatch.availableQuantity}/${familyMatch.onHandQuantity} available`,
    name: familyMatch.name,
    brand: "",
    model: familyMatch.trackByNumber ? "Units" : "Quantity",
    serialNumber: "",
    imageUrl: familyMatch.imageUrl,
    computedStatus: familyMatch.availableQuantity > 0 ? "AVAILABLE" : "RETIRED",
    location: { name: familyMatch.locationName },
    category: { name: familyMatch.category },
    parentAsset: null,
    activeBooking: null,
  };
}

export function useScanSubmission(): UseScanSubmissionResult {
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedbackState] = useState<ScanFeedbackResult>(null);
  const [itemPreview, setItemPreview] = useState<ItemPreview | null>(null);

  const processingRef = useRef(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  const setFeedback = useCallback((result: ScanFeedbackResult) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedbackState(result);
    if (result) {
      const delay = result.type === "success" ? 5_000 : 8_000;
      feedbackTimer.current = setTimeout(() => setFeedbackState(null), delay);
    }
  }, []);

  const handleLookupScan = useCallback(
    async (value: string) => {
      processingRef.current = true;
      setProcessing(true);
      setFeedback(null);
      setItemPreview(null);

      try {
        let searchTerm = value;
        const bgMatch = value.match(/^bg:\/\/(item|case)\/(.+)$/);
        if (bgMatch) searchTerm = bgMatch[2]!;

        const qrParam = `&qr=${encodeURIComponent(value)}`;
        const res = await fetch(
          `/api/assets?q=${encodeURIComponent(searchTerm)}${qrParam}&limit=5`,
        );
        if (handleAuthRedirect(res)) return;
        if (!res.ok) {
          setFeedback({ message: "Failed to look up item", type: "error" });
          return;
        }

        const json = await res.json();
        const assets: LookupResult[] = json.data ?? [];
        const itemFamilies: BulkItem[] = json.bulkItems ?? [];
        const scanVariants = normalizedScanVariants(value);
        const normalizedValue = value.trim().toLowerCase();
        const normalizedSearchTerm = searchTerm.trim().toLowerCase();
        const exactFamily = itemFamilies.find((family) => {
          const familyQr = family.binQrCodeValue.trim().toLowerCase();
          return Boolean(family.matchedUnitNumber) || scanVariants.has(familyQr);
        });

        if (exactFamily) {
          scanFeedbackSuccess();
          setItemPreview(toItemFamilyPreview(exactFamily));
          return;
        }

        const exact = assets.find((asset) => {
          const qr = asset.qrCodeValue?.toLowerCase() ?? "";
          const scanCode = asset.primaryScanCode?.toLowerCase() ?? "";
          const tag = asset.assetTag.toLowerCase();
          return (
            qr === normalizedValue ||
            qr === `qr-${normalizedValue}` ||
            scanCode === normalizedValue ||
            scanCode === `qr-${normalizedValue}` ||
            tag === normalizedSearchTerm
          );
        });
        const match = exact ?? assets[0];

        if (match) {
          scanFeedbackSuccess();
          const detailRes = await fetch(`/api/assets/${match.id}`);
          if (detailRes.ok) {
            const detailJson = await detailRes.json();
            setItemPreview(detailJson.data as ItemPreview);
          } else {
            setItemPreview({
              id: match.id,
              assetTag: match.assetTag,
              brand: match.brand,
              model: match.model,
              serialNumber: "",
              computedStatus: "AVAILABLE",
              location: null,
              category: null,
              parentAsset: null,
              activeBooking: null,
            });
          }
          return;
        }

        const familyMatch = itemFamilies[0];
        if (familyMatch) {
          scanFeedbackSuccess();
          setItemPreview(toItemFamilyPreview(familyMatch));
          return;
        }

        setFeedback({ message: `No item found for: ${value}`, type: "error" });
      } catch {
        setFeedback({ message: "Network error", type: "error" });
      } finally {
        processingRef.current = false;
        setProcessing(false);
      }
    },
    [setFeedback],
  );

  const handleScan = useCallback(
    (value: string) => {
      if (processingRef.current) return;
      handleLookupScan(value);
    },
    [handleLookupScan],
  );

  return {
    processing,
    feedback,
    setFeedback,
    itemPreview,
    setItemPreview,
    handleScan,
  };
}
