"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ChevronLeftIcon, XIcon, ScanIcon, AlertCircleIcon, Loader2Icon, WifiOffIcon, CheckCircle2Icon } from "lucide-react";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";

const QrScanner = dynamic(() => import("@/components/QrScanner"), { ssr: false });

// ── Types ──

type ScanMode = "lookup" | "checkout" | "checkin";

type SerializedItemStatus = {
  assetId: string;
  assetTag: string;
  brand: string;
  model: string;
  scanned: boolean;
};

type AllocatedUnit = {
  unitNumber: number;
  checkedOut: boolean;
  checkedIn: boolean;
};

type BulkItemStatus = {
  bulkSkuId: string;
  name: string;
  required: number;
  scanned: number;
  trackByNumber?: boolean;
  allocatedUnits?: AllocatedUnit[];
};

type ScanStatus = {
  checkoutId: string;
  title: string;
  status: string;
  phase: string;
  requester: { id: string; name: string };
  location: { id: string; name: string };
  serializedItems: SerializedItemStatus[];
  bulkItems: BulkItemStatus[];
  progress: {
    serializedScanned: number;
    serializedTotal: number;
    bulkComplete: boolean;
    allComplete: boolean;
  };
};

type LookupResult = {
  id: string;
  assetTag: string;
  brand: string;
  model: string;
  qrCodeValue?: string;
  primaryScanCode?: string;
};

type ItemPreview = {
  id: string;
  assetTag: string;
  brand: string;
  model: string;
  serialNumber: string;
  computedStatus: string;
  location: { name: string } | null;
  category: { name: string } | null;
  parentAsset: { id: string; assetTag: string; name: string | null; brand: string; model: string } | null;
  activeBooking: {
    id: string;
    kind: string;
    title: string;
    startsAt: string;
    endsAt: string;
    requesterName: string;
  } | null;
};

// ── Component ──

export default function ScanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const confirm = useConfirm();

  // Determine mode from URL params
  const checkoutId = searchParams.get("checkout");
  const phaseParam = searchParams.get("phase");
  const mode: ScanMode =
    checkoutId && phaseParam === "CHECKOUT" ? "checkout" :
    checkoutId && phaseParam === "CHECKIN" ? "checkin" :
    "lookup";

  // Auto-start camera — user navigated here to scan
  const [scanning, setScanning] = useState(true);
  const [cameraError, setCameraError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [processing, setProcessing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const scanFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [itemPreview, setItemPreview] = useState<ItemPreview | null>(null);

  // Booking scan state
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(mode !== "lookup");
  const [loadError, setLoadError] = useState(false);

  // Numbered bulk unit picker
  const [unitPicker, setUnitPicker] = useState<{
    bulkSkuId: string;
    scanValue: string;
    name: string;
    availableUnits: number[];
  } | null>(null);
  const [selectedUnits, setSelectedUnits] = useState<Set<number>>(new Set());

  const toastRef = useRef(toast);
  toastRef.current = toast;
  const manualInputRef = useRef<HTMLInputElement>(null);

  // Race condition guards
  const processingRef = useRef(false);
  const loadingStatusRef = useRef(false);
  const completingRef = useRef(false);

  // ── Load scan status for booking modes ──
  const loadScanStatus = useCallback(async () => {
    if (!checkoutId || !phaseParam) return;
    // Prevent concurrent status loads
    if (loadingStatusRef.current) return;
    loadingStatusRef.current = true;
    try {
      const res = await fetch(`/api/checkouts/${checkoutId}/scan-status?phase=${phaseParam}`);
      if (res.status === 401) {
        toastRef.current("Session expired — please log in again", "error");
        loadingStatusRef.current = false;
        return;
      }
      if (!res.ok) {
        // Only show error screen on initial load; toast on refresh
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

      // Check if we just completed all items (celebration trigger)
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
      // Only show error screen on initial load; toast on refresh
      setScanStatus((prev) => {
        if (!prev) setLoadError(true);
        else toastRef.current("Network error — could not refresh", "error");
        return prev;
      });
    }
    setStatusLoading(false);
    loadingStatusRef.current = false;
  }, [checkoutId, phaseParam]);

  useEffect(() => {
    if (mode !== "lookup") {
      // Start (or resume) a scan session for audit tracking, then load status
      if (checkoutId && phaseParam) {
        fetch(`/api/checkouts/${checkoutId}/start-scan-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phase: phaseParam }),
        }).then((res) => {
          if (!res.ok) {
            toastRef.current("Scan session could not be started — scans may not be audited", "error");
          }
        }).catch(() => {
          toastRef.current("Scan session could not be started — scans may not be audited", "error");
        });
      }
      loadScanStatus();
    }
  }, [mode, loadScanStatus, checkoutId, phaseParam]);

  // Refresh scan status periodically so multi-device scanning stays in sync
  useEffect(() => {
    if (mode === "lookup" || !checkoutId || !phaseParam) return;
    const interval = setInterval(() => {
      loadScanStatus();
    }, 15_000);
    return () => clearInterval(interval);
  }, [mode, checkoutId, phaseParam, loadScanStatus]);

  // ── Set scan feedback with auto-clear ──
  type ScanFeedback = { message: string; type: "success" | "error" | "info" } | null;
  function setScanFeedback(result: { message: string; success: boolean } | ScanFeedback) {
    if (scanFeedbackTimer.current) clearTimeout(scanFeedbackTimer.current);
    if (!result) { setLastScanResult(null); return; }
    // Normalize old {success} format to {type}
    const normalized = "type" in result ? result : { message: result.message, type: result.success ? "success" as const : "error" as const };
    setLastScanResult(normalized);
    if (normalized) {
      const delay = normalized.type === "success" ? 5_000 : 8_000;
      scanFeedbackTimer.current = setTimeout(() => setLastScanResult(null), delay);
    }
  }

  // ── Vibrate on scan (mobile haptic feedback) ──
  function vibrate(ms = 100) {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  }

  // ── Lookup mode: scan → show item preview bottom sheet ──
  const handleLookupScan = useCallback(async (value: string) => {
    processingRef.current = true;
    setProcessing(true);
    setScanFeedback(null);
    setItemPreview(null);
    try {
      let searchTerm = value;
      const bgMatch = value.match(/^bg:\/\/(item|case)\/(.+)$/);
      if (bgMatch) searchTerm = bgMatch[2];

      const res = await fetch(`/api/assets?q=${encodeURIComponent(searchTerm)}&limit=5`);
      if (!res.ok) {
        setScanFeedback({ message: res.status === 401 ? "Session expired — please log in again" : "Failed to look up item", success: false });
        processingRef.current = false;
        setProcessing(false);
        return;
      }
      const json = await res.json();
      const assets: LookupResult[] = json.data ?? [];

      const exact = assets.find(
        (a) => a.qrCodeValue === value || a.primaryScanCode === value || a.assetTag === searchTerm
      );
      const match = exact ?? assets[0];

      if (match) {
        vibrate();
        // Fetch full item detail for the preview
        const detailRes = await fetch(`/api/assets/${match.id}`);
        if (detailRes.ok) {
          const detailJson = await detailRes.json();
          setItemPreview(detailJson.data as ItemPreview);
        } else {
          // Fallback: still show what we have from search
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
        processingRef.current = false;
        setProcessing(false);
        return;
      }

      setScanFeedback({ message: `No item found for: ${value}`, success: false });
    } catch {
      setScanFeedback({ message: "Network error", success: false });
    }
    processingRef.current = false;
    setProcessing(false);
  }, []);

  // ── Submit a scan (serialized or bulk with units) ──
  const submitScan = useCallback(async (payload: Record<string, unknown>) => {
    if (!checkoutId || !phaseParam) return false;

    const endpoint = phaseParam === "CHECKIN"
      ? `/api/checkouts/${checkoutId}/checkin-scan`
      : `/api/checkouts/${checkoutId}/scan`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: phaseParam, ...payload }),
      });

      if (res.ok) {
        vibrate();
        setScanFeedback({ message: "Item scanned successfully", success: true });
        // Optimistic update — mark item scanned in checklist immediately
        if (payload.scanType === "SERIALIZED" && payload.scanValue) {
          setScanStatus((prev) => {
            if (!prev) return prev;
            const val = payload.scanValue as string;
            const updated = prev.serializedItems.map((item) =>
              (item.assetTag === val || item.assetId === val) ? { ...item, scanned: true } : item
            );
            const scannedCount = updated.filter((i) => i.scanned).length;
            return {
              ...prev,
              serializedItems: updated,
              progress: {
                ...prev.progress,
                serializedScanned: scannedCount,
                allComplete: scannedCount === prev.progress.serializedTotal && prev.progress.bulkComplete,
              },
            };
          });
        }
        // Background refresh to get authoritative state
        loadScanStatus();
        return true;
      } else {
        if (res.status === 401) {
          setScanFeedback({ message: "Session expired — please log in again", success: false });
          return false;
        }
        const json = await res.json().catch(() => ({})) as { error?: string; data?: { code?: string } };
        const errCode = json.data?.code;
        let errMsg = json.error || "Scan not recognized";
        // Provide friendlier messages for known error codes
        if (errCode === "SCAN_NOT_IN_CHECKOUT") {
          errMsg = "This item is not part of this checkout";
        } else if (res.status === 409) {
          errMsg = json.error || "Unit not available — it may have been scanned by another device";
        } else if (errCode === "DUPLICATE_SCAN") {
          setScanFeedback({ message: "Already scanned — skipping duplicate", type: "info" });
          return false;
        }
        setScanFeedback({ message: errMsg, success: false });
        vibrate(50);
        return false;
      }
    } catch {
      setScanFeedback({ message: "Network error \u2014 try again", success: false });
      return false;
    }
  }, [checkoutId, phaseParam, loadScanStatus]);

  // ── Booking scan: record scan event ──
  const handleBookingScan = useCallback(async (value: string) => {
    if (!checkoutId || !phaseParam || !scanStatus) return;
    // Double-guard: ref check prevents race between camera debounce and state update
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    setScanFeedback(null);

    try {
      // Check if this QR belongs to a numbered bulk item
      const numberedBulk = scanStatus.bulkItems.find(
        (item) => item.trackByNumber
      );

      // We need to check if the scan value matches a bulk bin QR — try the scan
      // and if it's a numbered bulk item, the API will tell us we need unitNumbers
      if (numberedBulk) {
        // Try as serialized first
        const res = await fetch(
          phaseParam === "CHECKIN"
            ? `/api/checkouts/${checkoutId}/checkin-scan`
            : `/api/checkouts/${checkoutId}/scan`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phase: phaseParam, scanType: "SERIALIZED", scanValue: value }),
          }
        );

        if (res.ok) {
          vibrate();
          setScanFeedback({ message: "Item scanned successfully", success: true });
          await loadScanStatus();
          return;
        }

        if (res.status === 401) {
          setScanFeedback({ message: "Session expired — please log in again", success: false });
          return;
        }

        const errJson = await res.json().catch(() => ({})) as { error?: string; data?: { code?: string } };
        const errCode = errJson.data?.code;
        const errMsg = errJson.error || "";

        // If serialized scan failed because item isn't in this checkout,
        // check if the scan matches a numbered bulk bin instead
        const matchingBulk = scanStatus.bulkItems.find(
          (item) => item.trackByNumber
        );

        if (matchingBulk && errCode === "SCAN_NOT_IN_CHECKOUT") {
          // Fetch available units to show picker
          const unitsRes = await fetch(`/api/bulk-skus/${matchingBulk.bulkSkuId}/units`);
          if (unitsRes.ok) {
            const unitsJson = await unitsRes.json();
            const units = (unitsJson.data ?? []) as Array<{ unitNumber: number; status: string }>;

            const availableUnits = phaseParam === "CHECKOUT"
              ? units.filter((u) => u.status === "AVAILABLE").map((u) => u.unitNumber)
              : units.filter((u) => u.status === "CHECKED_OUT").map((u) => u.unitNumber);

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
        }

        setScanFeedback({ message: errMsg || "This item is not part of this checkout", success: false });
        vibrate(50);
        return;
      }

      // Standard flow: try as serialized scan
      await submitScan({ scanType: "SERIALIZED", scanValue: value });
    } catch {
      setScanFeedback({ message: "Network error — try again", success: false });
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, [checkoutId, phaseParam, scanStatus, loadScanStatus, submitScan]);

  // ── Submit numbered bulk unit selection ──
  async function handleUnitPickerSubmit() {
    if (!unitPicker || selectedUnits.size === 0 || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    setScanFeedback(null);

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
  }

  // ── Route scan to correct handler ──
  const handleScan = useCallback((value: string) => {
    // Use ref for synchronous guard — state may be stale from camera callback
    if (processingRef.current) return;
    if (mode === "lookup") {
      handleLookupScan(value);
    } else {
      handleBookingScan(value);
    }
  }, [mode, handleLookupScan, handleBookingScan]);

  const handleManualEntry = () => {
    const v = manualCode.trim();
    if (v) {
      handleScan(v);
      setManualCode("");
      manualInputRef.current?.focus();
    }
  };

  // Auto-focus the manual entry field on mount (helps barcode scanner keyboards)
  useEffect(() => {
    // Delay slightly to avoid conflict with camera initialization
    const timer = setTimeout(() => manualInputRef.current?.focus(), 500);
    return () => clearTimeout(timer);
  }, []);

  // ── Complete checkout/checkin ──
  async function handleComplete() {
    if (!checkoutId || completingRef.current) return;
    completingRef.current = true;
    setCompleting(true);

    const endpoint = mode === "checkin"
      ? `/api/checkouts/${checkoutId}/complete-checkin`
      : `/api/checkouts/${checkoutId}/complete-checkout`;

    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (res.ok) {
        toast(mode === "checkin" ? "Check-in complete!" : "Checkout confirmed!", "success");
        router.push(`/checkouts/${checkoutId}`);
        return;
      }
      if (res.status === 401) {
        toast("Session expired — please log in again", "error");
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Could not complete", "error");
      }
    } catch {
      toast("Network error \u2014 try again", "error");
    }
    completingRef.current = false;
    setCompleting(false);
  }

  // ── Progress calculations ──
  const progress = scanStatus?.progress;
  const totalItems = progress?.serializedTotal ?? 0;
  const scannedItems = progress?.serializedScanned ?? 0;
  const progressPct = totalItems > 0 ? Math.round((scannedItems / totalItems) * 100) : 0;
  const allComplete = progress?.allComplete ?? false;

  // ── Guard against accidental navigation when items have been scanned ──
  const hasScannedItems = scannedItems > 0 && !allComplete;
  useEffect(() => {
    if (!hasScannedItems) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasScannedItems]);

  // ── Status display helpers ──
  function statusLabel(s: string) {
    switch (s) {
      case "AVAILABLE": return "Available";
      case "CHECKED_OUT": return "Checked Out";
      case "RESERVED": return "Reserved";
      case "MAINTENANCE": return "In Maintenance";
      case "RETIRED": return "Retired";
      default: return s;
    }
  }
  function statusBadgeVariant(s: string): "green" | "blue" | "purple" | "orange" | "gray" {
    switch (s) {
      case "AVAILABLE": return "green";
      case "CHECKED_OUT": return "blue";
      case "RESERVED": return "purple";
      case "MAINTENANCE": return "orange";
      default: return "gray";
    }
  }
  function statusColor(s: string) {
    switch (s) {
      case "AVAILABLE": return { bg: "var(--green-bg)", text: "#16a34a" };
      case "CHECKED_OUT": return { bg: "var(--blue-bg)", text: "#2563eb" };
      case "RESERVED": return { bg: "var(--purple-bg)", text: "#7c3aed" };
      case "MAINTENANCE": return { bg: "var(--orange-bg)", text: "#d97706" };
      case "RETIRED": return { bg: "var(--accent-soft)", text: "var(--text-secondary)" };
      default: return { bg: "var(--accent-soft)", text: "var(--text-secondary)" };
    }
  }

  // ── Render ──
  return (
    <div className="scan-page">
      {/* ══════ Sticky header with progress (booking modes) ══════ */}
      {mode !== "lookup" && scanStatus && (
        <div className="scan-sticky-header">
          <button
            type="button"
            className="scan-header-link"
            onClick={async () => {
              if (hasScannedItems) {
                const ok = await confirm({
                  title: "Leave scan page?",
                  message: `You\u2019ve scanned ${scannedItems} of ${totalItems} items. Your progress is saved \u2014 you can resume later.`,
                  confirmLabel: "Leave",
                  cancelLabel: "Keep scanning",
                });
                if (!ok) return;
              }
              router.push(`/checkouts/${checkoutId}`);
            }}
          >
            <ChevronLeftIcon className="size-[18px]" />
            <div className="scan-header-info">
              <span className="scan-header-title">{scanStatus.title}</span>
              <span className="scan-header-meta">
                {scanStatus.requester.name} &middot; {scanStatus.location.name}
              </span>
            </div>
          </button>
          <div className={`scan-mode-pill scan-mode-${mode}`}>
            <div className="scan-mode-dot" />
            {mode === "checkout" ? "Out" : "In"}
          </div>
        </div>
      )}

      {/* ══════ Lookup mode header ══════ */}
      {mode === "lookup" && (
        <div className="scan-lookup-header">
          <h1>Scan</h1>
          <div className="scan-mode-pill scan-mode-lookup">
            <div className="scan-mode-dot" />
            Look Up
          </div>
        </div>
      )}

      {/* ══════ Progress bar (booking modes) ══════ */}
      {mode !== "lookup" && scanStatus && totalItems > 0 && (
        <div className="scan-progress">
          <div className="scan-progress-text">
            <span className="scan-progress-count">{scannedItems}/{totalItems}</span>
            <span className="scan-progress-label">items scanned</span>
            <span className="scan-progress-pct">{progressPct}%</span>
          </div>
          <Progress
            value={progressPct}
            className={`h-2.5 ${allComplete ? "[&>[data-slot=progress-indicator]]:bg-green-500" : "[&>[data-slot=progress-indicator]]:bg-blue-500"}`}
          />
        </div>
      )}

      {/* ══════ Loading / error states ══════ */}
      {mode !== "lookup" && statusLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-full" />
          <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      )}

      {mode !== "lookup" && loadError && (
        <Alert variant="destructive">
          <AlertCircleIcon className="size-4" />
          <AlertDescription className="flex items-center gap-3">
            Failed to load checkout details.
            <Button variant="outline" size="sm" onClick={loadScanStatus}>Retry</Button>
          </AlertDescription>
        </Alert>
      )}

      {/* ══════ Camera + Manual entry ══════ */}
      <div className="scan-camera-section">
        {scanning ? (
          <div className="scan-camera-preview">
            <QrScanner
              onScan={handleScan}
              onError={setCameraError}
              active={scanning}
            />
            <button
              className="scan-camera-toggle"
              onClick={() => { setScanning(false); setCameraError(""); setScanFeedback(null); }}
            >
              <XIcon className="size-4" />
            </button>
          </div>
        ) : (
          <button
            className="scan-camera-start"
            onClick={() => { setScanning(true); setCameraError(""); setScanFeedback(null); }}
          >
            <ScanIcon className="size-8" />
            <span>Tap to start camera</span>
          </button>
        )}

        {cameraError && (
          <Alert variant="destructive" className="rounded-none border-x-0 border-b-0">
            <AlertCircleIcon className="size-4" />
            <AlertDescription>Camera error: {cameraError}</AlertDescription>
          </Alert>
        )}

        {/* Manual entry */}
        <div className="scan-manual-entry">
          <Input
            ref={manualInputRef}
            type="text"
            placeholder={mode === "lookup" ? "Enter asset tag or QR code..." : "Enter item code..."}
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualEntry()}
            className="scan-manual-input"
          />
          <Button
            className="scan-manual-btn"
            onClick={handleManualEntry}
            disabled={!manualCode.trim() || processing}
          >
            {processing ? <Loader2Icon className="size-4 animate-spin" /> : mode === "lookup" ? "Look up" : "Scan"}
          </Button>
        </div>

        {/* Inline scan feedback */}
        {lastScanResult && (
          <div className={`scan-feedback ${lastScanResult.type === "success" ? "scan-feedback-success" : lastScanResult.type === "info" ? "scan-feedback-info" : "scan-feedback-error"}`}>
            {lastScanResult.type === "success" ? (
              <CheckCircle2Icon className="size-4 shrink-0" />
            ) : lastScanResult.type === "info" ? (
              <CheckCircle2Icon className="size-4 shrink-0" />
            ) : lastScanResult.message.includes("Network") || lastScanResult.message.includes("offline") ? (
              <WifiOffIcon className="size-4 shrink-0" />
            ) : (
              <AlertCircleIcon className="size-4 shrink-0" />
            )}
            {lastScanResult.message}
          </div>
        )}
      </div>

      {/* ══════ Lookup mode hint ══════ */}
      {mode === "lookup" && !scanning && !lastScanResult && (
        <div className="scan-hint">
          <ScanIcon className="size-12" />
          <span>Scan any item&apos;s QR code or enter its asset tag to view details.</span>
        </div>
      )}

      {/* ══════ Item checklist (booking modes) ══════ */}
      {mode !== "lookup" && scanStatus && (
        <div className="scan-checklist">
          <div className="scan-checklist-header">
            <h2>Items</h2>
            <span className="scan-checklist-count">{scannedItems}/{totalItems}</span>
          </div>

          {scanStatus.serializedItems.length === 0 && scanStatus.bulkItems.length === 0 ? (
            <EmptyState icon="box" title="No items to scan" description="This booking has no equipment assigned." />
          ) : (
            <div className="scan-checklist-items">
              {/* Unscanned first, then scanned */}
              {[...scanStatus.serializedItems]
                .sort((a, b) => (a.scanned === b.scanned ? 0 : a.scanned ? 1 : -1))
                .map((item) => (
                <div
                  key={item.assetId}
                  className={`scan-item ${item.scanned ? "scan-item-done" : ""}`}
                >
                  <div className={`scan-item-check ${item.scanned ? "scan-item-check-done" : ""}`}>
                    {item.scanned && "\u2713"}
                  </div>
                  <div className="scan-item-info">
                    <span className="scan-item-tag">{item.assetTag}</span>
                    <span className="scan-item-desc">{item.brand} {item.model}</span>
                  </div>
                  {item.scanned && (
                    <Badge variant="green" size="sm">Scanned</Badge>
                  )}
                </div>
              ))}

              {scanStatus.bulkItems.map((item) => {
                const done = item.scanned >= item.required;
                const allocated = item.allocatedUnits ?? [];
                return (
                  <div
                    key={item.bulkSkuId}
                    className={`scan-item ${done ? "scan-item-done" : ""}`}
                  >
                    <div className={`scan-item-check ${done ? "scan-item-check-done" : ""}`}>
                      {done && "\u2713"}
                    </div>
                    <div className="scan-item-info">
                      <span className="scan-item-tag">
                        {item.name}
                        {item.trackByNumber && (
                          <Badge variant="blue" size="sm" className="ml-1.5">#</Badge>
                        )}
                      </span>
                      <span className="scan-item-desc">{item.scanned} / {item.required} scanned</span>
                    </div>

                    {/* Show allocated unit numbers */}
                    {item.trackByNumber && allocated.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 ml-10">
                        {allocated.map((u) => (
                          <Badge
                            key={u.unitNumber}
                            variant={u.checkedIn ? "green" : u.checkedOut ? "blue" : "gray"}
                            size="sm"
                          >
                            #{u.unitNumber}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════ Numbered bulk unit picker ══════ */}
      <Sheet open={!!unitPicker} onOpenChange={(open) => { if (!open) setUnitPicker(null); }}>
        <SheetContent className="sm:max-w-[480px]">
          <SheetHeader>
            <SheetTitle>Select {unitPicker?.name} units</SheetTitle>
            <p className="text-sm text-muted-foreground">
              {mode === "checkout" ? "Which units are going out?" : "Which units came back?"}
            </p>
          </SheetHeader>

          <SheetBody className="px-6 py-4">
            {unitPicker && (
              <>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-semibold">
                    {selectedUnits.size} of {unitPicker.availableUnits.length} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedUnits.size === unitPicker.availableUnits.length) {
                        setSelectedUnits(new Set());
                      } else {
                        setSelectedUnits(new Set(unitPicker.availableUnits));
                      }
                    }}
                  >
                    {selectedUnits.size === unitPicker.availableUnits.length ? "Deselect all" : "Select all"}
                  </Button>
                </div>

                <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5 max-h-[300px] overflow-y-auto pb-2">
                  {unitPicker.availableUnits.map((num) => {
                    const isSelected = selectedUnits.has(num);
                  return (
                    <button
                      key={num}
                      onClick={() => {
                        const next = new Set(selectedUnits);
                        if (isSelected) next.delete(num); else next.add(num);
                        setSelectedUnits(next);
                      }}
                      className={`px-1 py-2 rounded-lg border-2 font-semibold cursor-pointer transition-all duration-100 ${isSelected ? "border-blue-500 bg-blue-100 text-blue-800" : "border-gray-200 bg-white text-[var(--text)]"}`}
                    >
                      #{num}
                    </button>
                  );
                })}
                </div>
              </>
            )}
          </SheetBody>

          <SheetFooter className="flex-row gap-2">
            <Button variant="outline" onClick={() => setUnitPicker(null)} className="flex-1 min-h-12">
              Cancel
            </Button>
            <Button
              onClick={handleUnitPickerSubmit}
              disabled={selectedUnits.size === 0 || processing}
              className="flex-1 min-h-12"
            >
              {processing ? <><Loader2Icon className="size-4 animate-spin mr-2" />Scanning...</> : `Scan ${selectedUnits.size} unit${selectedUnits.size !== 1 ? "s" : ""}`}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ══════ Sticky bottom bar (booking modes) ══════ */}
      {mode !== "lookup" && scanStatus && (
        <div className="scan-bottom-bar">
          <Button
            variant={allComplete ? "default" : "outline"}
            className="scan-complete-btn"
            onClick={handleComplete}
            disabled={!allComplete || completing}
          >
            {completing
              ? <><Loader2Icon className="size-4 animate-spin mr-2" />Completing...</>
              : allComplete
                ? mode === "checkout" ? "Complete Checkout" : "Complete Check-in"
                : `${totalItems - scannedItems} item${totalItems - scannedItems !== 1 ? "s" : ""} remaining`
            }
          </Button>
        </div>
      )}

      {/* ══════ Celebration overlay ══════ */}
      {showCelebration && (
        <div className="scan-celebration" onClick={() => setShowCelebration(false)}>
          <div className="scan-celebration-card">
            <div className="scan-celebration-icon">{"\u2705"}</div>
            <div className="scan-celebration-title">All items scanned!</div>
            <div className="scan-celebration-desc">
              Tap to dismiss, then complete {mode === "checkin" ? "check-in" : "checkout"} below
            </div>
          </div>
        </div>
      )}

      {/* ══════ Item preview bottom sheet (lookup mode) ══════ */}
      <Sheet open={!!itemPreview} onOpenChange={(open) => { if (!open) setItemPreview(null); }}>
        <SheetContent className="sm:max-w-[480px]">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle>{itemPreview?.assetTag}</SheetTitle>
                <div className="scan-sheet-subtitle">
                  {itemPreview?.brand} {itemPreview?.model}
                </div>
              </div>
              {itemPreview && (
                <Badge variant={statusBadgeVariant(itemPreview.computedStatus)}>
                  {statusLabel(itemPreview.computedStatus)}
                </Badge>
              )}
            </div>
          </SheetHeader>

          {itemPreview && (
          <SheetBody className="px-6 py-4">
            <div className="scan-sheet-details">
              {itemPreview.serialNumber && (
                <div className="scan-sheet-row">
                  <span className="scan-sheet-label">Serial</span>
                  <span className="scan-sheet-value font-mono">{itemPreview.serialNumber}</span>
                </div>
              )}
              {itemPreview.location && (
                <div className="scan-sheet-row">
                  <span className="scan-sheet-label">Location</span>
                  <span className="scan-sheet-value">{itemPreview.location.name}</span>
                </div>
              )}
              {itemPreview.category && (
                <div className="scan-sheet-row">
                  <span className="scan-sheet-label">Category</span>
                  <span className="scan-sheet-value">{itemPreview.category.name}</span>
                </div>
              )}
            </div>

            {/* Parent asset banner */}
            {itemPreview.parentAsset && (
              <div className="scan-sheet-booking" style={{ background: "var(--bg-muted)", color: "var(--text-primary)" }}>
                <div className="scan-sheet-booking-label">Accessory of</div>
                <Link href={`/items/${itemPreview.parentAsset.id}`} className="scan-sheet-booking-name font-medium" style={{ color: "var(--primary)" }}>
                  {itemPreview.parentAsset.assetTag}
                </Link>
                <div className="scan-sheet-booking-title">
                  {itemPreview.parentAsset.brand} {itemPreview.parentAsset.model}
                </div>
              </div>
            )}

            {/* Current holder / active booking */}
            {itemPreview.activeBooking && (
              <div
                className="scan-sheet-booking"
                style={{
                  background: statusColor(itemPreview.computedStatus).bg,
                  color: statusColor(itemPreview.computedStatus).text,
                }}
              >
                <div className="scan-sheet-booking-label">
                  {itemPreview.activeBooking.kind === "CHECKOUT" ? "Currently with" : "Reserved by"}
                </div>
                <div className="scan-sheet-booking-name">
                  {itemPreview.activeBooking.requesterName}
                </div>
                <div className="scan-sheet-booking-title">
                  {itemPreview.activeBooking.title}
                </div>
                <div className="scan-sheet-booking-dates">
                  {new Date(itemPreview.activeBooking.startsAt).toLocaleDateString()} &ndash; {new Date(itemPreview.activeBooking.endsAt).toLocaleDateString()}
                </div>
              </div>
            )}

          </SheetBody>
          )}

          {itemPreview && (
          <SheetFooter className="flex-row gap-2">
            <Button
              variant="outline"
              className="scan-sheet-btn"
              onClick={() => setItemPreview(null)}
            >
              Dismiss
            </Button>
            <Button className="scan-sheet-btn" asChild>
              <Link href={`/items/${itemPreview.id}`}>
                View Details
              </Link>
            </Button>
          </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
