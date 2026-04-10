"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Keyboard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import QrScanner from "@/components/QrScanner";

type Props = {
  onScan: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

type Mode = "hand-scanner" | "camera" | "manual";

const HDG: React.CSSProperties = { fontFamily: "var(--font-heading)" };

export function ScanInput({
  onScan,
  disabled = false,
  placeholder = "Scan a barcode...",
}: Props) {
  const [mode, setMode] = useState<Mode>("hand-scanner");
  const [manualValue, setManualValue] = useState("");
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const [isReady, setIsReady] = useState(false);

  const refocusHiddenInput = useCallback(() => {
    if (hiddenInputRef.current && !disabled) {
      hiddenInputRef.current.focus();
    }
  }, [disabled]);

  useEffect(() => {
    if (mode === "hand-scanner") {
      refocusHiddenInput();
    }
  }, [mode, refocusHiddenInput]);

  useEffect(() => {
    if (mode !== "hand-scanner") return;
    const handleClick = () => {
      setTimeout(refocusHiddenInput, 50);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [mode, refocusHiddenInput]);

  const handleHandScannerKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = (e.target as HTMLInputElement).value.trim();
      if (value) {
        onScan(value);
        (e.target as HTMLInputElement).value = "";
      }
      refocusHiddenInput();
    }
  };

  const handleCameraScan = useCallback(
    (value: string) => {
      onScan(value);
      setMode("hand-scanner");
    },
    [onScan],
  );

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = manualValue.trim();
    if (value) {
      onScan(value);
      setManualValue("");
      setMode("hand-scanner");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Hidden input for hand scanner */}
      <input
        ref={hiddenInputRef}
        type="text"
        className="absolute h-0 w-0 opacity-0"
        style={{ pointerEvents: "none" }}
        onKeyDown={handleHandScannerKeyDown}
        onFocus={() => setIsReady(true)}
        onBlur={() => setIsReady(false)}
        disabled={disabled || mode !== "hand-scanner"}
        tabIndex={-1}
        aria-label="Barcode scanner input"
      />

      {/* Scanner ready indicator */}
      {mode === "hand-scanner" && (
        <div
          className="flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 transition-colors"
          style={{
            background: disabled
              ? "rgba(255,255,255,0.03)"
              : isReady
                ? "rgba(34,197,94,0.08)"
                : "rgba(255,255,255,0.05)",
            border: disabled
              ? "1px solid rgba(255,255,255,0.05)"
              : isReady
                ? "1px solid rgba(34,197,94,0.30)"
                : "1px solid rgba(255,255,255,0.08)",
          }}
          onClick={refocusHiddenInput}
        >
          {/* Pulse dot */}
          <span className="relative flex size-3 shrink-0">
            {isReady && !disabled && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
            )}
            <span
              className="relative inline-flex size-3 rounded-full"
              style={{
                background: disabled
                  ? "rgba(255,255,255,0.15)"
                  : isReady
                    ? "#22c55e"
                    : "rgba(255,255,255,0.20)",
              }}
            />
          </span>
          <span
            style={{ ...HDG, fontWeight: 600, letterSpacing: "0.08em", fontSize: "0.78rem" }}
            className={`uppercase ${
              disabled
                ? "text-white/20"
                : isReady
                  ? "text-green-400"
                  : "text-white/40"
            }`}
          >
            {disabled
              ? "Scanner disabled"
              : isReady
                ? "Ready to scan"
                : "Tap to activate scanner"}
          </span>
        </div>
      )}

      {/* Camera overlay */}
      {mode === "camera" && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "#131316",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            <span
              style={{ ...HDG, fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.10em" }}
              className="uppercase text-white/50"
            >
              Camera Scanner
            </span>
            <Button variant="ghost" size="icon-xs" onClick={() => setMode("hand-scanner")}>
              <X className="size-4" />
            </Button>
          </div>
          <div className="p-2">
            <QrScanner onScan={handleCameraScan} active={mode === "camera"} />
          </div>
        </div>
      )}

      {/* Manual entry overlay */}
      {mode === "manual" && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: "#131316",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            <span
              style={{ ...HDG, fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.10em" }}
              className="uppercase text-white/50"
            >
              Manual Entry
            </span>
            <Button variant="ghost" size="icon-xs" onClick={() => setMode("hand-scanner")}>
              <X className="size-4" />
            </Button>
          </div>
          <form onSubmit={handleManualSubmit} className="flex gap-2 p-3">
            <Input
              autoFocus
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              className="flex-1"
            />
            <Button type="submit" disabled={disabled || !manualValue.trim()}>
              Submit
            </Button>
          </form>
        </div>
      )}

      {/* Mode toggles */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode(mode === "camera" ? "hand-scanner" : "camera")}
          disabled={disabled}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors"
          style={{
            ...HDG,
            fontWeight: 700,
            letterSpacing: "0.08em",
            background:
              mode === "camera" ? "rgba(197,5,12,0.15)" : "rgba(255,255,255,0.05)",
            border:
              mode === "camera"
                ? "1px solid rgba(197,5,12,0.40)"
                : "1px solid rgba(255,255,255,0.08)",
            color: mode === "camera" ? "#c5050c" : "rgba(255,255,255,0.40)",
          }}
        >
          <Camera className="size-3.5" />
          Camera
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "manual" ? "hand-scanner" : "manual")}
          disabled={disabled}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors"
          style={{
            ...HDG,
            fontWeight: 700,
            letterSpacing: "0.08em",
            background:
              mode === "manual" ? "rgba(197,5,12,0.15)" : "rgba(255,255,255,0.05)",
            border:
              mode === "manual"
                ? "1px solid rgba(197,5,12,0.40)"
                : "1px solid rgba(255,255,255,0.08)",
            color: mode === "manual" ? "#c5050c" : "rgba(255,255,255,0.40)",
          }}
        >
          <Keyboard className="size-3.5" />
          Type tag
        </button>
      </div>
    </div>
  );
}
