"use client";

import { useEffect, useRef } from "react";

type QrScannerProps = {
  onScan: (value: string) => void;
  onError?: (error: string) => void;
  active?: boolean;
};

/**
 * Camera-based QR/barcode scanner using html5-qrcode.
 * Dynamically imports the library to avoid SSR issues.
 *
 * iOS Safari notes:
 * - aspectRatio must not be forced to 1.0 (camera rejects it)
 * - qrbox must be responsive (percentage of viewfinder), not fixed pixels
 * - useBarCodeDetectorIfSupported enables native BarcodeDetector on iOS 15.4+
 */
export default function QrScanner({ onScan, onError, active = true }: QrScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<unknown>(null);
  const lastScanRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);

  // Stable refs for callbacks — prevents effect from re-running on every render
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Use a unique ID per mount to avoid html5-qrcode ID conflicts
  const idRef = useRef(`qr-scanner-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    let mounted = true;
    let scannerInstance: { stop?: () => Promise<void>; clear?: () => void } | null = null;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");

        if (!mounted || !containerRef.current) return;

        const scanner = new Html5Qrcode(idRef.current, {
          // Use native BarcodeDetector API when available (iOS Safari 15.4+)
          // Falls back to JS-based decoder on older browsers
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        });
        scannerInstance = scanner as typeof scannerInstance;
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            // Responsive scan box — 70% of the smaller viewfinder dimension
            // (fixed 250px was too small relative to high-DPI iPhone video feeds)
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.7);
              return { width: size, height: size };
            },
            // Do NOT set aspectRatio — iOS cameras reject 1.0 and silently fail
          },
          (decodedText) => {
            const now = Date.now();
            // Debounce: ignore duplicate scans within 3 seconds
            if (decodedText === lastScanRef.current && now - lastScanTimeRef.current < 3000) {
              return;
            }
            // Also ignore ANY scan within 1 second of the last (rapid-fire prevention)
            if (now - lastScanTimeRef.current < 1000) {
              return;
            }
            lastScanRef.current = decodedText;
            lastScanTimeRef.current = now;
            onScanRef.current(decodedText);
          },
          () => {
            // Ignore scan failures (noise)
          }
        );
      } catch (err) {
        if (mounted) {
          onErrorRef.current?.(err instanceof Error ? err.message : "Camera not available");
        }
      }
    }

    startScanner();

    return () => {
      mounted = false;
      if (scannerInstance?.stop) {
        scannerInstance.stop().catch(() => {}).then(() => scannerInstance?.clear?.());
      }
    };
  }, [active]); // Only re-run when active changes

  return (
    <div
      id={idRef.current}
      ref={containerRef}
      style={{
        width: "100%",
        maxWidth: 400,
        margin: "0 auto",
        borderRadius: 12,
        overflow: "hidden",
        background: "#000",
      }}
    />
  );
}
