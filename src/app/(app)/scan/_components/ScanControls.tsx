"use client";

import dynamic from "next/dynamic";
import { type ChangeEvent, type FormEvent, useState } from "react";
import {
  XIcon,
  ScanIcon,
  WifiOffIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  SearchIcon,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { ScanFeedbackResult } from "./types";

const QrScanner = dynamic(() => import("@/components/QrScanner"), {
  ssr: false,
});

type ScanControlsProps = {
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
  scanning,
  setScanning,
  cameraError,
  setCameraError,
  processing,
  feedback,
  setFeedback,
  onScan,
}: ScanControlsProps) {
  const [manualValue, setManualValue] = useState("");

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = manualValue.trim();
    if (!value || processing) return;
    setFeedback(null);
    onScan(value);
    setManualValue("");
  }

  function handleManualChange(event: ChangeEvent<HTMLInputElement> | FormEvent<HTMLInputElement>) {
    setManualValue(event.currentTarget.value);
  }

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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 z-[1] size-11 rounded-full border border-white/15 bg-black/55 text-white shadow-sm [-webkit-tap-highlight-color:transparent] hover:bg-black/70 hover:text-white focus-visible:ring-white/50"
            onClick={() => {
              setScanning(false);
              setCameraError("");
              setFeedback(null);
            }}
            aria-label="Stop camera"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          className="flex h-auto w-full items-center justify-center gap-2 rounded-t-xl rounded-b-none bg-zinc-900 px-4 py-6 text-sm font-medium text-white/70 [-webkit-tap-highlight-color:transparent] hover:bg-zinc-800 hover:text-white focus-visible:ring-white/40 active:bg-zinc-800"
          onClick={() => {
            setScanning(true);
            setCameraError("");
            setFeedback(null);
          }}
        >
          <ScanIcon className="size-5" />
          <span>Resume scanning</span>
        </Button>
      )}

      <form
        onSubmit={handleManualSubmit}
        className="border-t border-white/10 bg-zinc-950 p-3"
      >
        <label htmlFor="scan-manual-entry" className="sr-only">
          Manual scan value
        </label>
        <div className="flex gap-2">
          <Input
            id="scan-manual-entry"
            name="scan-manual-entry"
            value={manualValue}
            onChange={handleManualChange}
            onInput={handleManualChange}
            placeholder="Asset tag, QR, serial, or scan code"
            autoComplete="off"
            disabled={processing}
            className="h-11 min-w-0 border-white/15 bg-white/10 text-white placeholder:text-white/45 focus-visible:ring-white/30 disabled:opacity-60"
          />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={processing || manualValue.trim().length === 0}
            className="h-11 shrink-0 transition-transform active:scale-[0.96]"
          >
            {processing ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <SearchIcon data-icon="inline-start" className="size-4" />
            )}
            Lookup
          </Button>
        </div>
      </form>

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
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-10 self-start px-0 text-xs text-destructive underline-offset-2"
                  onClick={() => { setScanning(true); setCameraError(""); }}
                >
                  Try again
                </Button>
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
