"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeftIcon, ScanIcon, AlertCircleIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
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
import { ItemPreviewDrawer } from "./_components/ItemPreviewDrawer";
import { ReportDamageDialog } from "./_components/ReportDamageDialog";
import { ReportLostDialog } from "./_components/ReportLostDialog";
import { CheckinSummaryDialog } from "./_components/CheckinSummaryDialog";
import { parseErrorMessage } from "@/lib/errors";
import { FadeUp } from "@/components/ui/motion";
import type { ScanMode, SerializedItemStatus } from "./_components/types";

export default function ScanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const hasReports = (progress?.damagedCount ?? 0) + (progress?.lostCount ?? 0) > 0;

  // ── Report dialogs state ──
  const [reportDamageTarget, setReportDamageTarget] = useState<SerializedItemStatus | null>(null);
  const [reportLostTarget, setReportLostTarget] = useState<SerializedItemStatus | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const submitReport = useCallback(async (assetId: string, type: "DAMAGED" | "LOST", description?: string) => {
    if (!checkoutId) return;
    setReportSubmitting(true);
    try {
      const res = await fetch(`/api/checkouts/${checkoutId}/checkin-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, type, description }),
      });
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Failed to submit report");
        toast.error(msg);
        return;
      }
      // Optimistically update the local scan status
      session.setScanStatus((prev) => {
        if (!prev) return prev;
        const updatedItems = prev.serializedItems.map((item) =>
          item.assetId === assetId
            ? { ...item, report: { type, description }, ...(type === "LOST" ? {} : {}) }
            : item
        );
        const lostCount = updatedItems.filter((i) => i.report?.type === "LOST").length;
        const damagedCount = updatedItems.filter((i) => i.report?.type === "DAMAGED").length;
        const serializedScanned = updatedItems.filter(
          (i) => i.scanned || i.report?.type === "LOST"
        ).length;
        const bulkComplete = prev.progress.bulkComplete;
        return {
          ...prev,
          serializedItems: updatedItems,
          progress: {
            ...prev.progress,
            serializedScanned,
            allComplete: serializedScanned === prev.progress.serializedTotal && bulkComplete,
            damagedCount,
            lostCount,
          },
        };
      });
      toast.info(type === "DAMAGED" ? "Damage reported" : "Item reported as lost");
      // Sync with server
      session.loadScanStatus();
    } catch {
      toast.error("Network error — try again");
    } finally {
      setReportSubmitting(false);
      setReportDamageTarget(null);
      setReportLostTarget(null);
    }
  }, [checkoutId, session]);

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
    <FadeUp>
    <div className="flex flex-col gap-2 pb-4 md:gap-3 md:max-w-[640px] md:mx-auto max-md:pb-[100px]">
      {/* ══════ Compact header (booking modes) ══════ */}
      {isBookingMode && session.scanStatus && (
        <div className="flex items-center gap-2.5 sticky top-[56px] z-[1] bg-[var(--bg)] -mx-4 -mt-4 px-4 py-2 max-md:border-b max-md:border-[var(--border-light)] md:static md:mx-0 md:px-0 md:py-2">
          <button
            type="button"
            className="flex items-center gap-2 flex-1 min-w-0 no-underline text-inherit [-webkit-tap-highlight-color:transparent]"
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
            aria-label="Back to checkout"
          >
            <ChevronLeftIcon className="size-5 shrink-0 text-muted-foreground" />
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold truncate">{session.scanStatus.title}</span>
              <span className="text-xs text-muted-foreground truncate">
                {session.scanStatus.requester.name} &middot; {session.scanStatus.location.name}
              </span>
            </div>
          </button>
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap shrink-0 ${
            mode === "checkout"
              ? "bg-blue-600/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400"
              : "bg-green-600/10 text-green-600 dark:bg-green-400/10 dark:text-green-400"
          }`}>
            <div className={`w-[6px] h-[6px] rounded-full animate-[pulse-dot-anim_2s_ease-in-out_infinite] motion-reduce:animate-none ${
              mode === "checkout" ? "bg-blue-600 dark:bg-blue-400" : "bg-green-600 dark:bg-green-400"
            }`} />
            {mode === "checkout" ? "Out" : "In"}
          </div>
        </div>
      )}

      {/* ══════ Lookup mode header ══════ */}
      {mode === "lookup" && (
        <div className="flex items-center justify-between gap-3 py-1">
          <h1>Scan</h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-[5px] rounded-[20px] text-xs font-bold whitespace-nowrap shrink-0 bg-[var(--accent-soft)] text-muted-foreground">
            <div className="w-[7px] h-[7px] rounded-full bg-[#9ca3af]" />
            Look Up
          </div>
        </div>
      )}

      {/* ══════ Progress bar (booking modes) ══════ */}
      {isBookingMode && session.scanStatus && totalItems > 0 && (
        <div>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-lg md:text-xl font-extrabold font-[var(--font-heading)] leading-none">{scannedItems}/{totalItems}</span>
            <span className="text-xs md:text-[13px] text-muted-foreground">{hasReports ? "items accounted for" : "items scanned"}</span>
            <span className="text-xs md:text-[13px] font-bold ml-auto text-muted-foreground">{progressPct}%</span>
          </div>
          <Progress
            value={progressPct}
            aria-label={`Scan progress: ${scannedItems} of ${totalItems} items scanned`}
            className={`h-2 md:h-2.5 ${allComplete ? "[&>[data-slot=progress-indicator]]:bg-green-500" : "[&>[data-slot=progress-indicator]]:bg-blue-500"}`}
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
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center text-muted-foreground text-sm opacity-60">
          <ScanIcon className="size-12" />
          <span>Scan any item&apos;s QR code to view details.</span>
        </div>
      )}

      {/* ══════ Item checklist (booking modes) ══════ */}
      {isBookingMode && session.scanStatus && (
        <ScanChecklist
          scanStatus={session.scanStatus}
          scannedItems={scannedItems}
          totalItems={totalItems}
          mode={mode}
          onReportDamage={(item) => setReportDamageTarget(item)}
          onReportLost={(item) => setReportLostTarget(item)}
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
        <div className="fixed bottom-0 left-0 right-0 px-4 pt-3 pb-[calc(12px+56px+env(safe-area-inset-bottom,0px))] bg-[var(--panel)] border-t border-border shadow-[0_-4px_24px_rgba(0,0,0,0.08)] z-[25] md:static md:p-0 md:bg-transparent md:border-none md:shadow-none">
          <Button
            variant={allComplete ? "default" : "outline"}
            className="w-full py-3.5 px-6 text-base font-bold min-h-[52px] justify-center disabled:opacity-60 disabled:font-medium"
            onClick={session.handleComplete}
            disabled={!allComplete || session.completing}
          >
            {session.completing ? (
              <>
                <Spinner data-icon="inline-start" />
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
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/40 z-40 animate-[fadeIn_0.2s_ease] p-[env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)]"
          onClick={() => session.setShowCelebration(false)}
          role="dialog"
          aria-label="All items scanned"
        >
          <div className="bg-[var(--panel-solid)] rounded-[20px] px-10 py-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.3)] animate-[scale-in_0.3s_ease] max-md:mx-6 max-md:px-6 max-md:py-7">
            <div className="text-5xl mb-2">{"\u2705"}</div>
            <div className="text-xl font-bold mb-1">All items scanned!</div>
            <div className="text-sm text-muted-foreground">
              Tap to dismiss, then complete {mode === "checkin" ? "check-in" : "checkout"} below
            </div>
          </div>
        </div>
      )}

      {/* ══════ Report damage dialog ══════ */}
      <ReportDamageDialog
        open={!!reportDamageTarget}
        onOpenChange={(v) => { if (!v) setReportDamageTarget(null); }}
        assetTag={reportDamageTarget?.assetTag ?? ""}
        onConfirm={(description) => {
          if (reportDamageTarget) submitReport(reportDamageTarget.assetId, "DAMAGED", description);
        }}
        submitting={reportSubmitting}
      />

      {/* ══════ Report lost dialog ══════ */}
      <ReportLostDialog
        open={!!reportLostTarget}
        onOpenChange={(v) => { if (!v) setReportLostTarget(null); }}
        assetTag={reportLostTarget?.assetTag ?? ""}
        onConfirm={() => {
          if (reportLostTarget) submitReport(reportLostTarget.assetId, "LOST");
        }}
        submitting={reportSubmitting}
      />

      {/* ══════ Check-in summary dialog ══════ */}
      <CheckinSummaryDialog
        open={session.showSummary}
        counts={session.summaryData}
        onGoBack={() => session.setShowSummary(false)}
        onFinish={session.confirmSummary}
        completing={session.completing}
      />

      {/* ══════ Item preview drawer (lookup mode) ══════ */}
      <ItemPreviewDrawer
        item={submission.itemPreview}
        onClose={() => submission.setItemPreview(null)}
      />
    </div>
    </FadeUp>
  );
}
