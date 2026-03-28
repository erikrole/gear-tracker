"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  XIcon,
  ScanIcon,
  Loader2Icon,
  WifiOffIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ScanMode, ScanFeedbackResult } from "./types";

const QrScanner = dynamic(() => import("@/components/QrScanner"), {
  ssr: false,
});

type ScanControlsProps = {
  mode: ScanMode;
  scanning: boolean;
  setScanning: (v: boolean) => void;
  cameraError: string;
  setCameraError: (v: string) => void;
  processing: boolean;
  feedback: ScanFeedbackResult;
  setFeedback: (result: ScanFeedbackResult) => void;
  onScan: (value: string) => void;
};

export function ScanControls({
  mode,
  scanning,
  setScanning,
  cameraError,
  setCameraError,
  processing,
  feedback,
  setFeedback,
  onScan,
}: ScanControlsProps) {
  const manualInputRef = useRef<HTMLInputElement>(null);
  const [manualCode, setManualCode] = useState("");

  function handleManualEntry() {
    const v = manualCode.trim();
    if (v) {
      onScan(v);
      setManualCode("");
      manualInputRef.current?.focus();
    }
  }

  // Auto-focus the manual entry field on mount
  useEffect(() => {
    const timer = setTimeout(() => manualInputRef.current?.focus(), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="bg-[var(--panel)] border border-border rounded-xl overflow-hidden shadow-sm">
      {scanning ? (
        <div className="relative bg-black">
          <QrScanner
            onScan={onScan}
            onError={setCameraError}
            active={scanning}
          />
          <button
            className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/50 text-white border-none flex items-center justify-center cursor-pointer z-[1] [-webkit-tap-highlight-color:transparent]"
            onClick={() => {
              setScanning(false);
              setCameraError("");
              setFeedback(null);
            }}
          >
            <XIcon className="size-4" />
          </button>
        </div>
      ) : (
        <button
          className="flex flex-col items-center justify-center gap-2 w-full px-4 py-8 bg-[var(--panel)] border-none text-muted-foreground cursor-pointer font-inherit text-sm [-webkit-tap-highlight-color:transparent] active:bg-[var(--panel-hover)]"
          onClick={() => {
            setScanning(true);
            setCameraError("");
            setFeedback(null);
          }}
        >
          <ScanIcon className="size-8" />
          <span>Tap to start camera</span>
        </button>
      )}

      {cameraError && (
        <Alert
          variant="destructive"
          className="rounded-none border-x-0 border-b-0"
        >
          <AlertCircleIcon className="size-4" />
          <AlertDescription>Camera error: {cameraError}</AlertDescription>
        </Alert>
      )}

      {/* Manual entry */}
      <div className="flex gap-2 p-3 border-t border-[var(--border-light)]">
        <Input
          ref={manualInputRef}
          type="text"
          placeholder={
            mode === "lookup"
              ? "Enter asset tag or QR code..."
              : "Enter item code..."
          }
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleManualEntry()}
          className="flex-1 min-w-0 px-3.5 py-3 border border-border rounded-[10px] text-base min-h-12 outline-none transition-colors duration-150 focus:border-[var(--accent)]"
        />
        <Button
          className="min-w-[72px] min-h-12 text-[15px] font-semibold"
          onClick={handleManualEntry}
          disabled={!manualCode.trim() || processing}
        >
          {processing ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : mode === "lookup" ? (
            "Look up"
          ) : (
            "Scan"
          )}
        </Button>
      </div>

      {/* Inline scan feedback */}
      {feedback && (
        <div
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-t border-[var(--border-light)] animate-[scan-feedback-in_0.2s_ease] ${
            feedback.type === "success"
              ? "text-[var(--green,#16a34a)] bg-[var(--green-bg)]"
              : feedback.type === "info"
                ? "text-muted-foreground bg-[var(--accent-soft)]"
                : "text-[var(--red,#dc2626)] bg-[var(--red-bg)]"
          }`}
        >
          {feedback.type === "success" || feedback.type === "info" ? (
            <CheckCircle2Icon className="size-4 shrink-0" />
          ) : feedback.message.includes("Network") ||
            feedback.message.includes("offline") ? (
            <WifiOffIcon className="size-4 shrink-0" />
          ) : (
            <AlertCircleIcon className="size-4 shrink-0" />
          )}
          {feedback.message}
        </div>
      )}
    </div>
  );
}
