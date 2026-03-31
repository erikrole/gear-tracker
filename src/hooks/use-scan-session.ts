"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScanStatus } from "@/app/(app)/scan/_components/types";

type ToastFn = (message: string, type: "success" | "error" | "info") => void;

type UseScanSessionOptions = {
  checkoutId: string | null;
  phase: string | null;
  isBookingMode: boolean;
  toast: ToastFn;
};

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
  /** True when the photo capture dialog should be shown before completion */
  showPhotoCapture: boolean;
  setShowPhotoCapture: (v: boolean) => void;
  /** Call after photo is uploaded to proceed with completion */
  proceedAfterPhoto: () => Promise<void>;
};

function vibrate(ms = 100) {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(ms);
  }
}

export function useScanSession(
  options: UseScanSessionOptions & { router: { push: (url: string) => void }; mode: "checkout" | "checkin" | "lookup" },
): UseScanSessionResult {
  const { checkoutId, phase, isBookingMode, toast, router, mode } = options;

  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(isBookingMode);
  const [loadError, setLoadError] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);

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
      if (res.status === 401) {
        toastRef.current("Session expired — please log in again", "error");
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
          vibrate(200);
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
      if (res.status === 401) {
        toastRef.current("Session expired — please log in again", "error");
      } else {
        const json = await res.json().catch(() => ({}));
        toastRef.current(
          (json as Record<string, string>).error || "Could not complete",
          "error",
        );
      }
    } catch {
      toastRef.current("Network error — try again", "error");
    }
    completingRef.current = false;
    setCompleting(false);
  }, [checkoutId, mode, router]);

  // Complete checkout/checkin — opens photo dialog first
  const handleComplete = useCallback(async () => {
    if (!checkoutId) return;
    setShowPhotoCapture(true);
  }, [checkoutId]);

  // Called after photo upload succeeds — proceed with actual completion
  const proceedAfterPhoto = useCallback(async () => {
    setShowPhotoCapture(false);
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
    showPhotoCapture,
    setShowPhotoCapture,
    proceedAfterPhoto,
  };
}
