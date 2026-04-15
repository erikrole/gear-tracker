"use client";

import { useEffect, useRef } from "react";

export function QrCodeImage({ value, size = 180 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!value || !canvasRef.current) return;
    import("qrcode").then((QRCode) => {
      QRCode.toCanvas(canvasRef.current!, value, {
        width: size,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
    });
  }, [value, size]);

  return <canvas ref={canvasRef} width={size} height={size} className="rounded-md" />;
}
