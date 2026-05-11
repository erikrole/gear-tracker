"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ScanIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useScanSubmission } from "@/hooks/use-scan-submission";
import { ScanControls } from "./_components/ScanControls";
import { ItemPreviewDrawer } from "./_components/ItemPreviewDrawer";
import { FadeUp } from "@/components/ui/motion";
import { Badge } from "@/components/ui/badge";

export default function ScanPage() {
  const searchParams = useSearchParams();

  const checkoutId = searchParams.get("checkout");
  const phaseParam = searchParams.get("phase");
  const requestedBookingFlow = Boolean(checkoutId || phaseParam);

  const [scanning, setScanning] = useState(true);
  const [cameraError, setCameraError] = useState("");

  const submission = useScanSubmission();

  return (
    <FadeUp>
      <div className="mx-auto flex max-w-[640px] flex-col gap-3 pb-4 max-md:pb-[100px]">
        <div className="flex items-center justify-between gap-3 py-1">
          <div className="min-w-0">
            <h1 className="text-balance">Lookup</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Scan an item tag, QR code, serial number, or primary scan code.
            </p>
          </div>
          <Badge variant="gray" className="gap-1.5 py-1 font-bold shrink-0">
            <div className="size-[6px] rounded-full bg-muted-foreground" />
            Look Up
          </Badge>
        </div>

        {requestedBookingFlow && (
          <Alert className="border-blue-200 bg-blue-50/60 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
            <ShieldCheckIcon className="size-4" />
            <AlertTitle>Checkout scans run at the kiosk</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                This page is for item lookup. Pickup and return scans are handled by kiosk flows.
              </span>
              <div className="flex gap-2">
                {checkoutId && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/checkouts/${checkoutId}`}>View checkout</Link>
                  </Button>
                )}
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/scan">Clear</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <ScanControls
          scanning={scanning}
          setScanning={setScanning}
          cameraError={cameraError}
          setCameraError={setCameraError}
          processing={submission.processing}
          feedback={submission.feedback}
          setFeedback={submission.setFeedback}
          onScan={submission.handleScan}
        />

        {!scanning && !submission.feedback && (
          <div className="flex flex-col items-center gap-3 px-4 py-8 text-center text-sm text-muted-foreground opacity-70">
            <ScanIcon className="size-12" />
            <span>Start the camera or type a code above.</span>
          </div>
        )}

        <ItemPreviewDrawer
          item={submission.itemPreview}
          onClose={() => submission.setItemPreview(null)}
        />
      </div>
    </FadeUp>
  );
}
