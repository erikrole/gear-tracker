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
    <div className="scan-camera-section">
      {scanning ? (
        <div className="scan-camera-preview">
          <QrScanner
            onScan={onScan}
            onError={setCameraError}
            active={scanning}
          />
          <button
            className="scan-camera-toggle"
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
          className="scan-camera-start"
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
      <div className="scan-manual-entry">
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
          className="scan-manual-input"
        />
        <Button
          className="scan-manual-btn"
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
          className={`scan-feedback ${
            feedback.type === "success"
              ? "scan-feedback-success"
              : feedback.type === "info"
                ? "scan-feedback-info"
                : "scan-feedback-error"
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
