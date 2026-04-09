"use client";

import { useCallback, useRef, useState } from "react";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { handleAuthRedirect } from "@/lib/errors";
import {
  scanFeedbackSuccess,
  scanFeedbackError,
  scanFeedbackInfo,
  scanFeedbackCelebration,
} from "@/lib/scan-feedback";
import type { BookingDetail } from "./types";

export type ScanFeedbackResult = {
  type: "success" | "error" | "info";
  message: string;
} | null;

/**
 * Hook for scan-to-return check-in within the booking details sheet.
 * Performs local QR lookup against booking items, then calls the check-in API.
 */
export function useCheckinScan({
  booking,
  onItemCheckedIn,
}: {
  booking: BookingDetail;
  onItemCheckedIn: () => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [feedback, setFeedback] = useState<ScanFeedbackResult>(null);
  const processingRef = useRef(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Track items checked in locally to prevent re-scan before server refresh
  const checkedInLocallyRef = useRef(new Set<string>());
  // Clear when booking updates (fresh data from server)
  const lastBookingIdRef = useRef(booking.id);
  if (booking.id !== lastBookingIdRef.current) {
    checkedInLocallyRef.current.clear();
    lastBookingIdRef.current = booking.id;
  }

  function clearFeedbackAfter(ms: number) {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), ms);
  }

  // Find an unreturned serialized item by QR code value
  function findItemByQr(scannedValue: string): string | null {
    const val = scannedValue.trim();
    const valNormalized = val.toLowerCase();
    const valWithPrefix = val.startsWith("QR-") ? val : `QR-${val}`;

    for (const item of booking.serializedItems) {
      if (item.allocationStatus === "returned") continue;
      if (checkedInLocallyRef.current.has(item.asset.id)) continue;
      const a = item.asset;

      // Check qrCodeValue
      if (a.qrCodeValue && (a.qrCodeValue.toLowerCase() === valNormalized || a.qrCodeValue === valWithPrefix)) {
        return a.id;
      }
      // Check primaryScanCode
      if (a.primaryScanCode && (a.primaryScanCode.toLowerCase() === valNormalized || a.primaryScanCode === valWithPrefix)) {
        return a.id;
      }
      // Check assetTag
      if (a.assetTag.toLowerCase() === valNormalized) {
        return a.id;
      }
    }
    return null;
  }

  const handleScan = useCallback(async (scannedValue: string) => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      // Local lookup first
      const assetId = findItemByQr(scannedValue);

      if (!assetId) {
        // Fallback: check if it's a known item that's already returned (or just checked in locally)
        const alreadyReturned = booking.serializedItems.find((item) => {
          if (item.allocationStatus !== "returned" && !checkedInLocallyRef.current.has(item.asset.id)) return false;
          const a = item.asset;
          const val = scannedValue.trim().toLowerCase();
          return (
            a.assetTag.toLowerCase() === val ||
            (a.qrCodeValue && a.qrCodeValue.toLowerCase() === val) ||
            (a.primaryScanCode && a.primaryScanCode.toLowerCase() === val)
          );
        });

        if (alreadyReturned) {
          scanFeedbackInfo();
          setFeedback({ type: "info", message: `${alreadyReturned.asset.assetTag} already returned` });
          clearFeedbackAfter(3000);
        } else {
          scanFeedbackError();
          setFeedback({ type: "error", message: "Item not found in this booking" });
          clearFeedbackAfter(5000);
        }
        return;
      }

      // Call check-in API
      const res = await fetchWithTimeout(`/api/checkouts/${booking.id}/checkin-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetIds: [assetId] }),
      });

      if (handleAuthRedirect(res)) return;

      if (res.ok) {
        checkedInLocallyRef.current.add(assetId);
        const item = booking.serializedItems.find((i) => i.asset.id === assetId);
        const tag = item?.asset.assetTag || "Item";
        scanFeedbackSuccess();
        setFeedback({ type: "success", message: `${tag} returned` });
        clearFeedbackAfter(5000);
        onItemCheckedIn();

        // Check if all items are now returned
        const unreturnedCount = booking.serializedItems.filter(
          (i) => i.allocationStatus !== "returned" && !checkedInLocallyRef.current.has(i.asset.id)
        ).length;
        if (unreturnedCount === 0) {
          setTimeout(() => scanFeedbackCelebration(), 500);
        }
      } else {
        const json = await res.json().catch(() => null);
        const msg = (json as Record<string, unknown>)?.error as string || "Check-in failed — try again";
        scanFeedbackError();
        setFeedback({ type: "error", message: msg });
        clearFeedbackAfter(5000);
      }
    } catch {
      scanFeedbackError();
      setFeedback({ type: "error", message: "Network error — check your connection" });
      clearFeedbackAfter(8000);
    } finally {
      processingRef.current = false;
    }
  }, [booking, onItemCheckedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    scanning,
    setScanning,
    cameraError,
    setCameraError,
    feedback,
    setFeedback,
    handleScan,
  };
}
