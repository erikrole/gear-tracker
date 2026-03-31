"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { CameraIcon, RotateCcwIcon } from "lucide-react";

type PhotoCaptureProps = {
  /** Called with the captured JPEG file when user confirms the photo */
  onCapture: (file: File) => void;
  /** Called when camera fails */
  onError?: (error: string) => void;
  disabled?: boolean;
};

/**
 * Camera-only photo capture component.
 * Opens the rear camera, lets the user take a still photo, then preview + confirm or retake.
 */
export default function PhotoCapture({
  onCapture,
  onError,
  disabled,
}: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [captured, setCaptured] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError("");
    setCaptured(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      await video.play();
      setCameraReady(true);
    } catch (err) {
      const isPermissionDenied =
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
      const msg = isPermissionDenied
        ? "Camera permission denied. Allow camera access in your browser settings and reload."
        : err instanceof Error
          ? err.message
          : "Camera not available";
      setCameraError(msg);
      onError?.(msg);
    }
  }, [onError]);

  // Start camera on mount
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  function handleCapture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCaptured(dataUrl);
    stopCamera();
  }

  function handleRetake() {
    setCaptured(null);
    startCamera();
  }

  function handleUsePhoto() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onCapture(file);
      },
      "image/jpeg",
      0.85,
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Camera / Preview area */}
      <div className="relative w-full max-w-[480px] mx-auto rounded-xl overflow-hidden bg-black aspect-[4/3]">
        {/* Live camera feed */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover ${captured ? "hidden" : "block"}`}
        />

        {/* Captured photo preview */}
        {captured && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={captured}
            alt="Captured photo"
            className="w-full h-full object-cover"
          />
        )}

        {/* Camera error */}
        {cameraError && !captured && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/80">
            {cameraError}
          </div>
        )}
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Controls */}
      <div className="flex gap-3 justify-center">
        {!captured ? (
          <Button
            size="lg"
            onClick={handleCapture}
            disabled={!cameraReady || disabled}
            className="min-w-[160px] gap-2"
          >
            <CameraIcon className="size-5" />
            Take Photo
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="lg"
              onClick={handleRetake}
              disabled={disabled}
              className="gap-2"
            >
              <RotateCcwIcon className="size-4" />
              Retake
            </Button>
            <Button
              size="lg"
              onClick={handleUsePhoto}
              disabled={disabled}
              className="min-w-[140px]"
            >
              Use Photo
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
