"use client";

import { useCallback, useRef, useState } from "react";
import type {
  ScanMode,
  ScanStatus,
  ItemPreview,
  LookupResult,
  ScanFeedbackResult,
  UnitPickerState,
} from "@/app/(app)/scan/_components/types";
import {
  scanFeedbackSuccess,
  scanFeedbackError,
  scanFeedbackInfo,
} from "@/lib/scan-feedback";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";

type UseScanSubmissionOptions = {
  mode: ScanMode;
  checkoutId: string | null;
  phase: string | null;
  scanStatus: ScanStatus | null;
  setScanStatus: React.Dispatch<React.SetStateAction<ScanStatus | null>>;
  loadScanStatus: () => Promise<void>;
};

type UseScanSubmissionResult = {
  processing: boolean;
  feedback: ScanFeedbackResult;
  setFeedback: (result: ScanFeedbackResult) => void;
  itemPreview: ItemPreview | null;
  setItemPreview: (item: ItemPreview | null) => void;
  unitPicker: UnitPickerState;
  setUnitPicker: (state: UnitPickerState) => void;
  selectedUnits: Set<number>;
  setSelectedUnits: (units: Set<number>) => void;
  handleScan: (value: string) => void;
  handleUnitPickerSubmit: () => Promise<void>;
};

function getDeviceContext(): string | undefined {
  return typeof navigator === "undefined" ? undefined : navigator.userAgent || undefined;
}

export function useScanSubmission(
  options: UseScanSubmissionOptions,
): UseScanSubmissionResult {
  const { mode, checkoutId, phase, scanStatus, setScanStatus, loadScanStatus } =
    options;

  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedbackState] = useState<ScanFeedbackResult>(null);
  const [itemPreview, setItemPreview] = useState<ItemPreview | null>(null);
  const [unitPicker, setUnitPicker] = useState<UnitPickerState>(null);
  const [selectedUnits, setSelectedUnits] = useState<Set<number>>(new Set());

  const processingRef = useRef(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Set feedback with auto-clear ──
  function setFeedback(result: ScanFeedbackResult) {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedbackState(result);
    if (result) {
      const delay = result.type === "success" ? 5_000 : 8_000;
      feedbackTimer.current = setTimeout(() => setFeedbackState(null), delay);
    }
  }

  // ── Submit a scan (serialized or bulk with units) ──
  const submitScan = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!checkoutId || !phase) return false;

      const endpoint =
        phase === "CHECKIN"
          ? `/api/checkouts/${checkoutId}/checkin-scan`
          : `/api/checkouts/${checkoutId}/scan`;

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phase, ...payload, deviceContext: getDeviceContext() }),
        });

        if (res.ok) {
          scanFeedbackSuccess();
          setFeedback({ message: "Item scanned successfully", type: "success" });
          // Optimistic update for serialized items
          if (payload.scanType === "SERIALIZED" && payload.scanValue) {
            setScanStatus((prev) => {
              if (!prev) return prev;
              const val = payload.scanValue as string;
              const updated = prev.serializedItems.map((item) =>
                item.assetTag === val || item.assetId === val
                  ? { ...item, scanned: true }
                  : item,
              );
              const scannedCount = updated.filter((i) => i.scanned).length;
              return {
                ...prev,
                serializedItems: updated,
                progress: {
                  ...prev.progress,
                  serializedScanned: scannedCount,
                  allComplete:
                    scannedCount === prev.progress.serializedTotal &&
                    prev.progress.bulkComplete,
                },
              };
            });
          }
          loadScanStatus();
          return true;
        } else {
          if (handleAuthRedirect(res)) return false;
          const json = (await res.clone().json().catch(() => ({}))) as {
            error?: string;
            data?: { code?: string };
          };
          const errCode = json.data?.code;
          if (errCode === "DUPLICATE_SCAN") {
            scanFeedbackInfo();
            setFeedback({
              message: "Already scanned — skipping duplicate",
              type: "info",
            });
            return false;
          }
          let errMsg: string;
          if (errCode === "SCAN_NOT_IN_CHECKOUT") {
            errMsg = "This item is not part of this checkout";
          } else if (res.status === 409) {
            errMsg = await parseErrorMessage(res, "Unit not available — it may have been scanned by another device");
          } else {
            errMsg = await parseErrorMessage(res, "Scan not recognized");
          }
          setFeedback({ message: errMsg, type: "error" });
          scanFeedbackError();
          return false;
        }
      } catch {
        setFeedback({ message: "Network error — try again", type: "error" });
        return false;
      }
    },
    [checkoutId, phase, setScanStatus, loadScanStatus],
  );

  // ── Lookup mode scan ──
  const handleLookupScan = useCallback(
    async (value: string) => {
      processingRef.current = true;
      setProcessing(true);
      setFeedback(null);
      setItemPreview(null);
      try {
        let searchTerm = value;
        const bgMatch = value.match(/^bg:\/\/(item|case)\/(.+)$/);
        if (bgMatch) searchTerm = bgMatch[2];

        // Search with both original QR value and stripped term for best match
        // Always pass qr= so the API checks qrCodeValue/primaryScanCode fields
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

        const v = value.toLowerCase();
        const s = searchTerm.toLowerCase();
        const exact = assets.find((a) => {
          const qr = a.qrCodeValue?.toLowerCase() ?? "";
          const sc = a.primaryScanCode?.toLowerCase() ?? "";
          const tag = a.assetTag.toLowerCase();
          return qr === v || qr === `qr-${v}` || sc === v || sc === `qr-${v}` || tag === s;
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
    [],
  );

  // ── Booking mode scan ──
  const handleBookingScan = useCallback(
    async (value: string) => {
      if (!checkoutId || !phase || !scanStatus) return;
      if (processingRef.current) return;
      processingRef.current = true;
      setProcessing(true);
      setFeedback(null);

      try {
        const numberedBulk = scanStatus.bulkItems.find(
          (item) => item.trackByNumber,
        );

        if (numberedBulk) {
          const endpoint =
            phase === "CHECKIN"
              ? `/api/checkouts/${checkoutId}/checkin-scan`
              : `/api/checkouts/${checkoutId}/scan`;

          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phase,
              scanType: "SERIALIZED",
              scanValue: value,
              deviceContext: getDeviceContext(),
            }),
          });

          if (res.ok) {
            scanFeedbackSuccess();
            setFeedback({
              message: "Item scanned successfully",
              type: "success",
            });
            await loadScanStatus();
            return;
          }

          if (handleAuthRedirect(res)) return;

          const errJson = (await res.json().catch(() => ({}))) as {
            error?: string;
            data?: { code?: string };
          };
          const errCode = errJson.data?.code;
          const errMsg = errJson.error || "";

          const matchingBulk = scanStatus.bulkItems.find(
            (item) => item.trackByNumber,
          );

          if (matchingBulk && errCode === "SCAN_NOT_IN_CHECKOUT") {
            let availableUnits: number[] = [];

            if (phase === "CHECKIN") {
              // For check-in: use already-loaded allocations from scan status — only
              // shows units that belong to THIS booking, preventing cross-booking theft.
              availableUnits = (matchingBulk.allocatedUnits ?? [])
                .filter((u) => u.checkedOut && !u.checkedIn)
                .map((u) => u.unitNumber);
            } else {
              // For checkout: fetch all available units from the SKU (fungible at checkout time)
              const unitsRes = await fetch(
                `/api/bulk-skus/${matchingBulk.bulkSkuId}/units`,
              );
              if (unitsRes.ok) {
                const unitsJson = await unitsRes.json();
                availableUnits = ((unitsJson.data ?? []) as Array<{ unitNumber: number; status: string }>)
                  .filter((u) => u.status === "AVAILABLE")
                  .map((u) => u.unitNumber);
              }
            }

            if (availableUnits.length > 0) {
              setUnitPicker({
                bulkSkuId: matchingBulk.bulkSkuId,
                scanValue: value,
                name: matchingBulk.name,
                availableUnits,
              });
              setSelectedUnits(new Set(availableUnits));
              return;
            }
          }

          setFeedback({
            message: errMsg || "This item is not part of this checkout",
            type: "error",
          });
          scanFeedbackError();
          return;
        }

        // Standard flow: try as serialized scan
        await submitScan({ scanType: "SERIALIZED", scanValue: value });
      } catch {
        setFeedback({ message: "Network error — try again", type: "error" });
      } finally {
        processingRef.current = false;
        setProcessing(false);
      }
    },
    [checkoutId, phase, scanStatus, loadScanStatus, submitScan],
  );

  // ── Route scan to correct handler ──
  const handleScan = useCallback(
    (value: string) => {
      if (processingRef.current) return;
      if (mode === "lookup") {
        handleLookupScan(value);
      } else {
        handleBookingScan(value);
      }
    },
    [mode, handleLookupScan, handleBookingScan],
  );

  // ── Submit numbered bulk unit selection ──
  const handleUnitPickerSubmit = useCallback(async () => {
    if (!unitPicker || selectedUnits.size === 0 || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    setFeedback(null);

    const success = await submitScan({
      scanType: "BULK_BIN",
      scanValue: unitPicker.scanValue,
      unitNumbers: [...selectedUnits].sort((a, b) => a - b),
    });

    if (success) {
      setUnitPicker(null);
      setSelectedUnits(new Set());
    }
    processingRef.current = false;
    setProcessing(false);
  }, [unitPicker, selectedUnits, submitScan]);

  return {
    processing,
    feedback,
    setFeedback,
    itemPreview,
    setItemPreview,
    unitPicker,
    setUnitPicker,
    selectedUnits,
    setSelectedUnits,
    handleScan,
    handleUnitPickerSubmit,
  };
}
