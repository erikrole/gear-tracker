"use client";

import dynamic from "next/dynamic";
import {
  XIcon,
  ScanIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  WifiOffIcon,
} from "lucide-react";
import type { ScanFeedbackResult } from "./useCheckinScan";

const QrScanner = dynamic(() => import("@/components/QrScanner"), {
  ssr: false,
});

type Props = {
  scanning: boolean;
  setScanning: (v: boolean) => void;
  cameraError: string;
  setCameraError: (v: string) => void;
  feedback: ScanFeedbackResult;
  setFeedback: (v: ScanFeedbackResult) => void;
  onScan: (value: string) => void;
};

export function ScanToReturnView({
  scanning,
  setScanning,
  cameraError,
  setCameraError,
  feedback,
  setFeedback,
  onScan,
}: Props) {
  return (
    <div className="mb-4">
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
              className="absolute top-2 right-2 size-11 rounded-full bg-black/50 text-white border-none flex items-center justify-center cursor-pointer z-[1] [-webkit-tap-highlight-color:transparent]"
              onClick={() => {
                setScanning(false);
                setCameraError("");
                setFeedback(null);
              }}
              aria-label="Stop camera"
            >
              <XIcon className="size-5" />
            </button>
          </div>
        ) : (
          <button
            className="flex items-center justify-center gap-2 w-full px-4 py-6 bg-zinc-900 border-none text-white/70 cursor-pointer font-inherit text-sm [-webkit-tap-highlight-color:transparent] active:bg-zinc-800 rounded-xl max-md:min-h-[56px]"
            onClick={() => {
              setScanning(true);
              setCameraError("");
              setFeedback(null);
            }}
          >
            <ScanIcon className="size-5" />
            <span>Tap to scan items for return</span>
          </button>
        )}

        {cameraError && (
          <div className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 bg-red-950/40">
            <AlertCircleIcon className="size-4 shrink-0" />
            Camera error: {cameraError}
          </div>
        )}

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
            ) : feedback.message.includes("Network") || feedback.message.includes("offline") ? (
              <WifiOffIcon className="size-4 shrink-0" />
            ) : (
              <AlertCircleIcon className="size-4 shrink-0" />
            )}
            <span className="flex-1">{feedback.message}</span>
            {feedback.type === "error" && (
              <button
                onClick={() => setFeedback(null)}
                className="ml-1 text-xs font-bold underline text-red-300 hover:text-red-100 [-webkit-tap-highlight-color:transparent]"
              >
                Scan again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
