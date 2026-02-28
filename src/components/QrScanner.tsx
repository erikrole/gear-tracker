"use client";

import { useEffect, useRef, useCallback } from "react";

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

  const handleScan = useCallback(
    (decodedText: string) => {
      const now = Date.now();
      // Debounce: ignore duplicate scans within 2 seconds
      if (decodedText === lastScanRef.current && now - lastScanTimeRef.current < 2000) {
        return;
      }
      lastScanRef.current = decodedText;
      lastScanTimeRef.current = now;
      onScan(decodedText);
    },
    [onScan]
  );

  useEffect(() => {
    if (!active || !containerRef.current) return;

    let mounted = true;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");

        if (!mounted || !containerRef.current) return;

        const scanner = new Html5Qrcode(containerRef.current.id);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          (decodedText) => {
            handleScan(decodedText);
          },
          () => {
            // Ignore scan failures (noise)
          }
        );
      } catch (err) {
        if (mounted) {
          onError?.(err instanceof Error ? err.message : "Camera not available");
        }
      }
    }

    startScanner();

    return () => {
      mounted = false;
      const scanner = scannerRef.current as { stop?: () => Promise<void>; clear?: () => void } | null;
      if (scanner?.stop) {
        scanner.stop().catch(() => {}).then(() => scanner.clear?.());
      }
    };
  }, [active, handleScan, onError]);

  return (
    <div
      id="qr-scanner-container"
      ref={containerRef}
      style={{
        width: "100%",
        maxWidth: 400,
        margin: "0 auto",
        borderRadius: 12,
        overflow: "hidden",
        background: "#000"
      }}
    />
  );
}
