"use client";

import { useEffect, useRef, useCallback } from "react";

type QrScannerProps = {
  onScan: (value: string) => void;
  onError?: (error: string) => void;
  active?: boolean;
};

/**
 * Camera-based QR/barcode scanner using native BarcodeDetector API.
 *
 * Uses getUserMedia + BarcodeDetector directly — no html5-qrcode wrapper.
 * This is dramatically more reliable on iOS Safari because:
 *  1. No forced aspect ratio (camera chooses its natural output)
 *  2. No intermediate canvas copy — BarcodeDetector reads the video element
 *  3. Native iOS barcode engine (same as Camera.app) via BarcodeDetector
 *
 * Falls back to barcode-detector polyfill (ZXing WASM) on Firefox/older browsers.
 */
export default function QrScanner({
  onScan,
  onError,
  active = true,
}: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastScanRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);

  // Stable refs for callbacks
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (!active) {
      stopCamera();
      return;
    }

    let mounted = true;

    async function startScanner() {
      try {
        // Get native or polyfilled BarcodeDetector
        let DetectorClass: typeof BarcodeDetector;
        if (typeof globalThis.BarcodeDetector !== "undefined") {
          DetectorClass = globalThis.BarcodeDetector;
        } else {
          // Polyfill for Firefox / older browsers (ZXing WASM)
          const mod = await import("barcode-detector");
          DetectorClass =
            (mod as unknown as { default: typeof BarcodeDetector }).default ??
            (mod as unknown as { BarcodeDetector: typeof BarcodeDetector })
              .BarcodeDetector;
        }

        if (!mounted) return;

        const detector = new DetectorClass({
          formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8"],
        });

        // Request camera — rear-facing, autofocus
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();

        // Detection loop — runs via requestAnimationFrame for smooth perf
        // Throttled to ~12 fps to balance battery vs responsiveness
        let lastDetectTime = 0;
        const DETECT_INTERVAL_MS = 80; // ~12fps

        async function detect() {
          if (!mounted) return;

          const now = performance.now();
          if (now - lastDetectTime >= DETECT_INTERVAL_MS) {
            lastDetectTime = now;
            try {
              if (video!.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
                const barcodes = await detector.detect(video!);
                if (barcodes.length > 0 && mounted) {
                  const value = barcodes[0].rawValue;
                  const scanNow = Date.now();
                  // Debounce: same code within 3s, or any code within 1s
                  const isDupe =
                    value === lastScanRef.current &&
                    scanNow - lastScanTimeRef.current < 3000;
                  const isTooFast = scanNow - lastScanTimeRef.current < 1000;

                  if (!isDupe && !isTooFast) {
                    lastScanRef.current = value;
                    lastScanTimeRef.current = scanNow;
                    onScanRef.current(value);
                  }
                }
              }
            } catch {
              // detect() can throw on iOS if video isn't ready — ignore
            }
          }

          rafRef.current = requestAnimationFrame(detect);
        }

        rafRef.current = requestAnimationFrame(detect);
      } catch (err) {
        if (mounted) {
          onErrorRef.current?.(
            err instanceof Error ? err.message : "Camera not available"
          );
        }
      }
    }

    startScanner();

    return () => {
      mounted = false;
      stopCamera();
    };
  }, [active, stopCamera]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 400,
        margin: "0 auto",
        borderRadius: 12,
        overflow: "hidden",
        background: "#000",
      }}
    >
      {/* Live camera feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          objectFit: "cover",
        }}
      />
      {/* Viewfinder overlay with corner brackets */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: "70%",
            aspectRatio: "1 / 1",
            position: "relative",
          }}
        >
          {/* Top-left corner */}
          <Corner top={0} left={0} />
          {/* Top-right corner */}
          <Corner top={0} right={0} />
          {/* Bottom-left corner */}
          <Corner bottom={0} left={0} />
          {/* Bottom-right corner */}
          <Corner bottom={0} right={0} />
        </div>
      </div>
    </div>
  );
}

/** A single corner bracket for the viewfinder overlay */
function Corner(pos: {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}) {
  const size = 24;
  const weight = 3;
  const color = "rgba(255,255,255,0.85)";
  const radius = 6;

  const isTop = pos.top !== undefined;
  const isLeft = pos.left !== undefined;

  return (
    <div
      style={{
        position: "absolute",
        ...pos,
        width: size,
        height: size,
        borderColor: color,
        borderStyle: "solid",
        borderWidth: 0,
        ...(isTop ? { borderTopWidth: weight } : { borderBottomWidth: weight }),
        ...(isLeft
          ? { borderLeftWidth: weight }
          : { borderRightWidth: weight }),
        borderTopLeftRadius: isTop && isLeft ? radius : 0,
        borderTopRightRadius: isTop && !isLeft ? radius : 0,
        borderBottomLeftRadius: !isTop && isLeft ? radius : 0,
        borderBottomRightRadius: !isTop && !isLeft ? radius : 0,
      }}
    />
  );
}
