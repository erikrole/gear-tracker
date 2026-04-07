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

export function ScanInput({
  onScan,
  disabled = false,
  placeholder = "Scan a barcode...",
}: Props) {
  const [mode, setMode] = useState<Mode>("hand-scanner");
  const [manualValue, setManualValue] = useState("");
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Keep hidden input focused for hand scanner mode
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

  // Refocus on click anywhere when in hand-scanner mode
  useEffect(() => {
    if (mode !== "hand-scanner") return;

    const handleClick = () => {
      // Small delay to let any button clicks process first
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

  const dismissOverlay = () => {
    setMode("hand-scanner");
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Hand scanner hidden input (always present) */}
      <div className="relative">
        <input
          ref={hiddenInputRef}
          type="text"
          className="absolute opacity-0 h-0 w-0 pointer-events-none"
          onKeyDown={handleHandScannerKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled || mode !== "hand-scanner"}
          tabIndex={-1}
          aria-label="Barcode scanner input"
        />

        {/* Visual indicator for hand scanner mode */}
        {mode === "hand-scanner" && (
          <div
            className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3 cursor-pointer"
            onClick={refocusHiddenInput}
          >
            <span className="relative flex h-3 w-3">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isFocused && !disabled
                    ? "animate-ping bg-green-400"
                    : "bg-muted-foreground"
                }`}
              />
              <span
                className={`relative inline-flex h-3 w-3 rounded-full ${
                  isFocused && !disabled
                    ? "bg-green-500"
                    : "bg-muted-foreground"
                }`}
              />
            </span>
            <span className="text-sm text-muted-foreground">
              {disabled
                ? "Scanner disabled"
                : isFocused
                  ? "Ready to scan"
                  : "Tap to activate scanner"}
            </span>
          </div>
        )}
      </div>

      {/* Camera overlay */}
      {mode === "camera" && (
        <div className="relative rounded-lg border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-sm font-medium">Camera Scanner</span>
            <Button variant="ghost" size="icon-xs" onClick={dismissOverlay}>
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
        <div className="relative rounded-lg border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-sm font-medium">Manual Entry</span>
            <Button variant="ghost" size="icon-xs" onClick={dismissOverlay}>
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

      {/* Mode toggle buttons */}
      <div className="flex gap-2">
        <Button
          variant={mode === "camera" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode(mode === "camera" ? "hand-scanner" : "camera")}
          disabled={disabled}
        >
          <Camera className="size-4" />
          Camera
        </Button>
        <Button
          variant={mode === "manual" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode(mode === "manual" ? "hand-scanner" : "manual")}
          disabled={disabled}
        >
          <Keyboard className="size-4" />
          Type tag
        </Button>
      </div>
    </div>
  );
}
