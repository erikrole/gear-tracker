"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScanStatus } from "@/app/(app)/scan/_components/types";
import { scanFeedbackCelebration } from "@/lib/scan-feedback";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";

type ToastFn = (message: string, type: "success" | "error" | "info") => void;

type UseScanSessionOptions = {
  checkoutId: string | null;
  phase: string | null;
  isBookingMode: boolean;
  toast: ToastFn;
};

type SummaryCounts = { returned: number; damaged: number; lost: number };

type UseScanSessionResult = {
  scanStatus: ScanStatus | null;
  setScanStatus: React.Dispatch<React.SetStateAction<ScanStatus | null>>;
  statusLoading: boolean;
  loadError: boolean;
  showCelebration: boolean;
  setShowCelebration: (v: boolean) => void;
  completing: boolean;
  loadScanStatus: () => Promise<void>;
  handleComplete: () => Promise<void>;
  /** Check-in summary screen state */
  showSummary: boolean;
  setShowSummary: (v: boolean) => void;
  summaryData: SummaryCounts | null;
  /** Confirm the summary and complete the check-in */
  confirmSummary: () => Promise<void>;
};

export function useScanSession(
  options: UseScanSessionOptions & { router: { push: (url: string) => void }; mode: "checkout" | "checkin" | "lookup" },
): UseScanSessionResult {
  const { checkoutId, phase, isBookingMode, toast, router, mode } = options;

  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(isBookingMode);
  const [loadError, setLoadError] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<SummaryCounts | null>(null);

  const toastRef = useRef(toast);
  toastRef.current = toast;
  const loadingStatusRef = useRef(false);
  const completingRef = useRef(false);

  const loadScanStatus = useCallback(async () => {
    if (!checkoutId || !phase) return;
    if (loadingStatusRef.current) return;
    loadingStatusRef.current = true;
    try {
      const res = await fetch(`/api/checkouts/${checkoutId}/scan-status?phase=${phase}`);
      if (handleAuthRedirect(res)) {
        loadingStatusRef.current = false;
        return;
      }
      if (!res.ok) {
        setScanStatus((prev) => {
          if (!prev) setLoadError(true);
          else toastRef.current("Could not refresh scan status", "error");
          return prev;
        });
        setStatusLoading(false);
        loadingStatusRef.current = false;
        return;
      }
      const json = await res.json();
      const data = json.data as ScanStatus;

      setScanStatus((prev) => {
        if (prev && !prev.progress.allComplete && data.progress.allComplete) {
          setShowCelebration(true);
          scanFeedbackCelebration();
          setTimeout(() => setShowCelebration(false), 3000);
        }
        return data;
      });
      setLoadError(false);
    } catch {
      setScanStatus((prev) => {
        if (!prev) setLoadError(true);
        else toastRef.current("Network error — could not refresh", "error");
        return prev;
      });
    }
    setStatusLoading(false);
    loadingStatusRef.current = false;
  }, [checkoutId, phase]);

  // Start scan session + load status on mount
  useEffect(() => {
    if (!isBookingMode) return;
    if (checkoutId && phase) {
      fetch(`/api/checkouts/${checkoutId}/start-scan-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase }),
      })
        .then((res) => {
          if (!res.ok) {
            toastRef.current("Scan session could not be started — scans may not be audited", "error");
          }
        })
        .catch(() => {
          toastRef.current("Scan session could not be started — scans may not be audited", "error");
        });
    }
    loadScanStatus();
  }, [isBookingMode, loadScanStatus, checkoutId, phase]);

  // 15s polling for multi-device sync
  useEffect(() => {
    if (!isBookingMode || !checkoutId || !phase) return;
    const interval = setInterval(() => {
      loadScanStatus();
    }, 15_000);
    return () => clearInterval(interval);
  }, [isBookingMode, checkoutId, phase, loadScanStatus]);

  // Actually call the completion endpoint (used after photo is uploaded)
  const doComplete = useCallback(async () => {
    if (!checkoutId || completingRef.current) return;
    completingRef.current = true;
    setCompleting(true);

    const endpoint =
      mode === "checkin"
        ? `/api/checkouts/${checkoutId}/complete-checkin`
        : `/api/checkouts/${checkoutId}/complete-checkout`;

    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (res.ok) {
        toastRef.current(
          mode === "checkin" ? "Check-in complete!" : "Checkout confirmed!",
          "success",
        );
        router.push(`/checkouts/${checkoutId}`);
        return;
      }
      if (handleAuthRedirect(res)) return;
      const msg = await parseErrorMessage(res, "Could not complete");
      toastRef.current(msg, "error");
    } catch {
      toastRef.current("Network error — try again", "error");
    }
    completingRef.current = false;
    setCompleting(false);
  }, [checkoutId, mode, router]);

  // Complete checkout/checkin — always show summary for check-in
  const handleComplete = useCallback(async () => {
    if (!checkoutId) return;

    // For check-in, always show summary before completing
    if (mode === "checkin" && scanStatus) {
      const damaged = scanStatus.progress.damagedCount ?? 0;
      const lost = scanStatus.progress.lostCount ?? 0;
      const returned = scanStatus.progress.serializedScanned - lost;
      setSummaryData({ returned, damaged, lost });
      setShowSummary(true);
      return;
    }

    await doComplete();
  }, [checkoutId, doComplete, mode, scanStatus]);

  // Confirm the check-in summary and complete
  const confirmSummary = useCallback(async () => {
    setShowSummary(false);
    await doComplete();
  }, [doComplete]);

  return {
    scanStatus,
    setScanStatus,
    statusLoading,
    loadError,
    showCelebration,
    setShowCelebration,
    completing,
    loadScanStatus,
    handleComplete,
    showSummary,
    setShowSummary,
    summaryData,
    confirmSummary,
  };
}
