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
import { ItemPreviewDrawer } from "./_components/ItemPreviewDrawer";
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
    <div className="flex flex-col gap-3 pb-4 md:max-w-[640px] md:mx-auto max-md:gap-2.5 max-md:pb-[100px]">
      {/* ══════ Sticky header with progress (booking modes) ══════ */}
      {isBookingMode && session.scanStatus && (
        <div className="flex items-center gap-2.5 sticky top-[56px] z-[1] bg-[var(--bg)] -mx-4 -mt-4 px-4 py-2.5 max-md:border-b max-md:border-[var(--border-light)] md:static md:mx-0 md:px-0 md:py-2">
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
          >
            <ChevronLeftIcon className="size-[18px]" />
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold whitespace-nowrap overflow-hidden text-ellipsis">{session.scanStatus.title}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                {session.scanStatus.requester.name} &middot; {session.scanStatus.location.name}
              </span>
            </div>
          </button>
          <div className={`inline-flex items-center gap-1.5 px-3 py-[5px] rounded-[20px] text-xs font-bold whitespace-nowrap shrink-0 ${
            mode === "checkout"
              ? "bg-[var(--blue-bg)] text-[#2563eb]"
              : "bg-[var(--green-bg)] text-[#16a34a]"
          }`}>
            <div className={`w-[7px] h-[7px] rounded-full animate-[pulse-dot-anim_2s_ease-in-out_infinite] ${
              mode === "checkout" ? "bg-[var(--blue)]" : "bg-[var(--green)]"
            }`} />
            {mode === "checkout" ? "Out" : "In"}
          </div>
        </div>
      )}

      {/* ══════ Lookup mode header ══════ */}
      {mode === "lookup" && (
        <div className="flex items-center justify-between gap-3 py-1">
          <h1 className="font-[var(--font-heading)] text-[26px] font-bold m-0">Scan</h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-[5px] rounded-[20px] text-xs font-bold whitespace-nowrap shrink-0 bg-[var(--accent-soft)] text-muted-foreground">
            <div className="w-[7px] h-[7px] rounded-full bg-[#9ca3af]" />
            Look Up
          </div>
        </div>
      )}

      {/* ══════ Progress bar (booking modes) ══════ */}
      {isBookingMode && session.scanStatus && totalItems > 0 && (
        <div>
          <div className="flex items-baseline gap-1.5 mb-1.5">
            <span className="text-xl font-extrabold font-[var(--font-heading)] leading-none">{scannedItems}/{totalItems}</span>
            <span className="text-[13px] text-muted-foreground">items scanned</span>
            <span className="text-[13px] font-bold ml-auto text-muted-foreground">{progressPct}%</span>
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
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center text-muted-foreground text-sm opacity-60">
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
        <div className="fixed bottom-0 left-0 right-0 px-4 pt-3 pb-[calc(12px+56px+env(safe-area-inset-bottom,0px))] bg-[var(--panel)] border-t border-border shadow-[0_-4px_24px_rgba(0,0,0,0.08)] z-[25] md:static md:p-0 md:bg-transparent md:border-none md:shadow-none">
          <Button
            variant={allComplete ? "default" : "outline"}
            className="w-full py-3.5 px-6 text-base font-bold min-h-[52px] justify-center disabled:opacity-60 disabled:font-medium"
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
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/40 z-40 animate-[fadeIn_0.2s_ease] p-[env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)]"
          onClick={() => session.setShowCelebration(false)}
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

      {/* ══════ Item preview drawer (lookup mode) ══════ */}
      <ItemPreviewDrawer
        item={submission.itemPreview}
        onClose={() => submission.setItemPreview(null)}
      />
    </div>
  );
}
