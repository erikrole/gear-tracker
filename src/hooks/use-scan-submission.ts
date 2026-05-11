"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ItemPreview,
  LookupResult,
  ScanFeedbackResult,
} from "@/app/(app)/scan/_components/types";
import { scanFeedbackSuccess } from "@/lib/scan-feedback";
import { handleAuthRedirect } from "@/lib/errors";

type UseScanSubmissionResult = {
  processing: boolean;
  feedback: ScanFeedbackResult;
  setFeedback: (result: ScanFeedbackResult) => void;
  itemPreview: ItemPreview | null;
  setItemPreview: (item: ItemPreview | null) => void;
  handleScan: (value: string) => void;
};

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
        const normalizedValue = value.toLowerCase();
        const normalizedSearchTerm = searchTerm.toLowerCase();
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
