"use client";

import dynamic from "next/dynamic";
import {
  XIcon,
  ScanIcon,
  WifiOffIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
} from "lucide-react";
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
  return (
    <div className="bg-black rounded-xl overflow-hidden shadow-sm">
      {scanning ? (
        <div className="relative">
          <div className="max-h-[180px] md:max-h-[240px] overflow-hidden">
            <QrScanner
              onScan={onScan}
              onError={setCameraError}
              active={scanning}
            />
          </div>
          <button
            className="absolute top-2 right-2 size-8 rounded-full bg-black/50 text-white border-none flex items-center justify-center cursor-pointer z-[1] [-webkit-tap-highlight-color:transparent]"
            onClick={() => {
              setScanning(false);
              setCameraError("");
              setFeedback(null);
            }}
            aria-label="Stop camera"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      ) : (
        <button
          className="flex items-center justify-center gap-2 w-full px-4 py-6 bg-zinc-900 border-none text-white/70 cursor-pointer font-inherit text-sm [-webkit-tap-highlight-color:transparent] active:bg-zinc-800 rounded-xl"
          onClick={() => {
            setScanning(true);
            setCameraError("");
            setFeedback(null);
          }}
        >
          <ScanIcon className="size-5" />
          <span>Resume scanning</span>
        </button>
      )}

      {cameraError && (
        <Alert
          variant="destructive"
          className="rounded-none border-x-0 border-b-0"
        >
          <AlertCircleIcon className="size-4" />
          <AlertDescription className="flex flex-col gap-1.5">
            {cameraError.includes("NotAllowed") || cameraError.toLowerCase().includes("permission") ? (
              <>
                <span>Camera access was blocked. Check your browser settings to allow camera on this page.</span>
              </>
            ) : (
              <>
                <span>{cameraError}</span>
                <button
                  type="button"
                  className="self-start text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
                  onClick={() => { setScanning(true); setCameraError(""); }}
                >
                  Try again
                </button>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Inline scan feedback */}
      {feedback && (
        <div
          role="status"
          aria-live="assertive"
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold animate-[scan-feedback-in_0.2s_ease] ${
            feedback.type === "success"
              ? "text-green-400 bg-green-950/40"
              : feedback.type === "info"
                ? "text-white/60 bg-zinc-800"
                : "text-red-400 bg-red-950/40"
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
