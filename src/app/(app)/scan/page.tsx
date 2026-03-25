"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeftIcon, ScanIcon, Loader2Icon, AlertCircleIcon } from "lucide-react";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useScanSession } from "@/hooks/use-scan-session";
import { useScanSubmission } from "@/hooks/use-scan-submission";
import { ScanControls } from "./_components/ScanControls";
import { ScanChecklist } from "./_components/ScanChecklist";
import { UnitPickerSheet } from "./_components/UnitPickerSheet";
import { ItemPreviewSheet } from "./_components/ItemPreviewSheet";
import type { ScanMode } from "./_components/types";

export default function ScanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const confirm = useConfirm();

  // Determine mode from URL params
  const checkoutId = searchParams.get("checkout");
  const phaseParam = searchParams.get("phase");
  const mode: ScanMode =
    checkoutId && phaseParam === "CHECKOUT"
      ? "checkout"
      : checkoutId && phaseParam === "CHECKIN"
        ? "checkin"
        : "lookup";

  const isBookingMode = mode !== "lookup";

  // Camera state (owned by page since it's shared across modes)
  const [scanning, setScanning] = useState(true);
  const [cameraError, setCameraError] = useState("");

  // ── Hooks ──
  const session = useScanSession({
    checkoutId,
    phase: phaseParam,
    isBookingMode,
    toast,
    router,
    mode,
  });

  const submission = useScanSubmission({
    mode,
    checkoutId,
    phase: phaseParam,
    scanStatus: session.scanStatus,
    setScanStatus: session.setScanStatus,
    loadScanStatus: session.loadScanStatus,
  });

  // ── Progress calculations ──
  const progress = session.scanStatus?.progress;
  const totalItems = progress?.serializedTotal ?? 0;
  const scannedItems = progress?.serializedScanned ?? 0;
  const progressPct = totalItems > 0 ? Math.round((scannedItems / totalItems) * 100) : 0;
  const allComplete = progress?.allComplete ?? false;

  // ── Guard against accidental navigation when items have been scanned ──
  const hasScannedItems = scannedItems > 0 && !allComplete;
  useEffect(() => {
    if (!hasScannedItems) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasScannedItems]);

  // ── Render ──
  return (
    <div className="scan-page">
      {/* ══════ Sticky header with progress (booking modes) ══════ */}
      {isBookingMode && session.scanStatus && (
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
              <span className="scan-header-title">{session.scanStatus.title}</span>
              <span className="scan-header-meta">
                {session.scanStatus.requester.name} &middot; {session.scanStatus.location.name}
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
      {isBookingMode && session.scanStatus && totalItems > 0 && (
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
      {isBookingMode && session.statusLoading && (
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

      {isBookingMode && session.loadError && (
        <Alert variant="destructive">
          <AlertCircleIcon className="size-4" />
          <AlertDescription className="flex items-center gap-3">
            Failed to load checkout details.
            <Button variant="outline" size="sm" onClick={session.loadScanStatus}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* ══════ Camera + Manual entry + Feedback ══════ */}
      <ScanControls
        mode={mode}
        scanning={scanning}
        setScanning={setScanning}
        cameraError={cameraError}
        setCameraError={setCameraError}
        processing={submission.processing}
        feedback={submission.feedback}
        setFeedback={submission.setFeedback}
        onScan={submission.handleScan}
      />

      {/* ══════ Lookup mode hint ══════ */}
      {mode === "lookup" && !scanning && !submission.feedback && (
        <div className="scan-hint">
          <ScanIcon className="size-12" />
          <span>Scan any item&apos;s QR code or enter its asset tag to view details.</span>
        </div>
      )}

      {/* ══════ Item checklist (booking modes) ══════ */}
      {isBookingMode && session.scanStatus && (
        <ScanChecklist
          scanStatus={session.scanStatus}
          scannedItems={scannedItems}
          totalItems={totalItems}
        />
      )}

      {/* ══════ Numbered bulk unit picker ══════ */}
      <UnitPickerSheet
        mode={mode}
        unitPicker={submission.unitPicker}
        selectedUnits={submission.selectedUnits}
        processing={submission.processing}
        onClose={() => submission.setUnitPicker(null)}
        onSelectUnits={submission.setSelectedUnits}
        onSubmit={submission.handleUnitPickerSubmit}
      />

      {/* ══════ Sticky bottom bar (booking modes) ══════ */}
      {isBookingMode && session.scanStatus && (
        <div className="scan-bottom-bar">
          <Button
            variant={allComplete ? "default" : "outline"}
            className="scan-complete-btn"
            onClick={session.handleComplete}
            disabled={!allComplete || session.completing}
          >
            {session.completing ? (
              <>
                <Loader2Icon className="size-4 animate-spin mr-2" />
                Completing...
              </>
            ) : allComplete ? (
              mode === "checkout" ? "Complete Checkout" : "Complete Check-in"
            ) : (
              `${totalItems - scannedItems} item${totalItems - scannedItems !== 1 ? "s" : ""} remaining`
            )}
          </Button>
        </div>
      )}

      {/* ══════ Celebration overlay ══════ */}
      {session.showCelebration && (
        <div className="scan-celebration" onClick={() => session.setShowCelebration(false)}>
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
      <ItemPreviewSheet
        item={submission.itemPreview}
        onClose={() => submission.setItemPreview(null)}
      />
    </div>
  );
}
