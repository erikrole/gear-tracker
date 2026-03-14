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

        const scanner = new Html5Qrcode(idRef.current);
        scannerInstance = scanner as typeof scannerInstance;
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            const now = Date.now();
            // Debounce: ignore duplicate scans within 2 seconds
            if (decodedText === lastScanRef.current && now - lastScanTimeRef.current < 2000) {
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
