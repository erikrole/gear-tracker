"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  message: string;
  detail?: string;
  onDone: () => void;
};

const HDG: React.CSSProperties = { fontFamily: "var(--font-heading)" };

export function SuccessScreen({ message, detail, onDone }: Props) {
  const [countdown, setCountdown] = useState(5);
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    const DURATION = 5000;
    startRef.current = Date.now();

    const frame = () => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.min((elapsed / DURATION) * 100, 100);
      setProgress(pct);
      setCountdown(Math.max(0, Math.ceil((DURATION - elapsed) / 1000)));
      if (elapsed < DURATION) {
        animRef.current = requestAnimationFrame(frame);
      } else {
        onDone();
      }
    };

    const animRef2 = { current: requestAnimationFrame(frame) };
    const animRef = animRef2;
    return () => cancelAnimationFrame(animRef.current);
  }, [onDone]);

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center gap-8 overflow-hidden"
      style={{ background: "#0b0b0d" }}
    >
      {/* Radial glow behind checkmark */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 50% at 50% 45%, rgba(34,197,94,0.08) 0%, transparent 70%)",
        }}
      />

      {/* Animated SVG checkmark */}
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        className="relative z-10"
      >
        <style>{`
          @keyframes draw-circle {
            from { stroke-dashoffset: 346; }
            to   { stroke-dashoffset: 0; }
          }
          @keyframes draw-check {
            from { stroke-dashoffset: 80; }
            to   { stroke-dashoffset: 0; }
          }
          .success-circle {
            stroke-dasharray: 346;
            stroke-dashoffset: 346;
            animation: draw-circle 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.1s forwards;
          }
          .success-check {
            stroke-dasharray: 80;
            stroke-dashoffset: 80;
            animation: draw-check 0.35s cubic-bezier(0.4, 0, 0.2, 1) 0.55s forwards;
          }
        `}</style>
        <circle
          cx="60"
          cy="60"
          r="55"
          stroke="#22c55e"
          strokeWidth="3"
          strokeLinecap="round"
          className="success-circle"
        />
        <polyline
          points="36,60 52,76 84,44"
          stroke="#22c55e"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="success-check"
        />
      </svg>

      {/* Message */}
      <div className="relative z-10 flex flex-col items-center gap-2 text-center">
        <h1
          style={{
            ...HDG,
            fontWeight: 900,
            fontSize: "2.5rem",
            letterSpacing: "0.06em",
          }}
          className="uppercase text-white"
        >
          {message}
        </h1>
        {detail && (
          <p className="text-base text-white/40">{detail}</p>
        )}
      </div>

      {/* Progress bar + returning label */}
      <div className="relative z-10 flex w-full max-w-xs flex-col items-center gap-2">
        <div
          className="h-0.5 w-full overflow-hidden rounded-full"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <div
            className="h-full rounded-full transition-none"
            style={{ width: `${progress}%`, background: "#22c55e" }}
          />
        </div>
        <p className="text-xs text-white/25">
          Returning to home in {countdown}s
        </p>
      </div>

      {/* Done button */}
      <button
        type="button"
        onClick={onDone}
        className="relative z-10 h-12 rounded-xl px-10 text-sm font-semibold uppercase tracking-widest transition-colors"
        style={{
          ...HDG,
          fontWeight: 700,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.10)",
          color: "rgba(255,255,255,0.50)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.10)";
          (e.currentTarget as HTMLButtonElement).style.color = "#fff";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
          (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.50)";
        }}
      >
        Done
      </button>
    </div>
  );
}
