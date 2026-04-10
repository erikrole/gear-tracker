"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { ArrowLeft, ScanLine } from "lucide-react";

type KioskInfo = {
  kioskId: string;
  locationId: string;
  locationName: string;
};

type LookupResult = {
  id: string;
  tagName: string;
  productName: string;
  type: string;
  status: string;
  holder?: string;
  dueAt?: string;
  bookingTitle?: string;
};

type Props = {
  kioskInfo: KioskInfo;
  countdown: string;
  onBack: () => void;
};

const HDG: React.CSSProperties = { fontFamily: "var(--font-heading)" };

function statusColor(status: string) {
  switch (status) {
    case "Available":
      return { color: "#22c55e", bg: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.25)" };
    case "Overdue":
      return { color: "#c5050c", bg: "rgba(197,5,12,0.10)", border: "rgba(197,5,12,0.30)" };
    case "Checked Out":
      return { color: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.25)" };
    default:
      return { color: "rgba(255,255,255,0.50)", bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.10)" };
  }
}

export function ScanLookup({ countdown, onBack }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const manualRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, [result]);

  const handleScan = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/kiosk/scan-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanValue: trimmed }),
      });

      if (res.ok) {
        const json = await res.json();
        setResult(json.item);
      } else {
        const json = await res.json().catch(() => null);
        setError(json?.error || "Item not found");
      }
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  }, []);

  function handleHiddenKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const value = e.currentTarget.value;
      e.currentTarget.value = "";
      handleScan(value);
    }
  }

  function handleManualKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const value = e.currentTarget.value.trim();
      if (value) {
        e.currentTarget.value = "";
        handleScan(value);
      }
    }
  }

  const sc = result ? statusColor(result.status) : null;

  return (
    <div
      className="flex h-full flex-col"
      style={{ background: "#0b0b0d" }}
    >
      {/* Hidden hand-scanner input */}
      <input
        ref={inputRef}
        type="text"
        className="absolute h-0 w-0 opacity-0"
        style={{ pointerEvents: "none" }}
        onKeyDown={handleHiddenKeyDown}
        autoFocus
        tabIndex={-1}
      />

      {/* ── Header ── */}
      <div
        className="flex h-[52px] shrink-0 items-center gap-3 px-5"
        style={{ borderBottom: "2px solid #c5050c" }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-white/40 transition-colors hover:text-white/80"
          style={HDG}
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        <div className="mx-1 h-4 w-px" style={{ background: "rgba(255,255,255,0.10)" }} />
        <span
          style={{ ...HDG, fontWeight: 800, fontSize: "0.8rem", letterSpacing: "0.12em" }}
          className="uppercase text-white/70"
        >
          Scan / Lookup
        </span>
        <div className="ml-auto">
          <span
            style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}
            className="tabular-nums text-white/30"
          >
            {countdown}
          </span>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
        <div className="flex w-full max-w-sm flex-col items-center gap-6">
          {/* Scan target zone */}
          <div className="relative flex items-center justify-center">
            <div
              className="flex h-[120px] w-[120px] items-center justify-center rounded-full"
              style={{
                background: loading
                  ? "rgba(197,5,12,0.10)"
                  : "rgba(255,255,255,0.04)",
                border: loading
                  ? "2px solid rgba(197,5,12,0.40)"
                  : "2px solid rgba(255,255,255,0.08)",
              }}
            >
              {loading ? (
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#c5050c]" />
              ) : (
                <ScanLine
                  className="size-10"
                  style={{ color: result ? "#22c55e" : "rgba(255,255,255,0.20)" }}
                />
              )}
            </div>
            {/* Outer ring pulse when ready */}
            {!loading && !result && (
              <div
                className="pointer-events-none absolute inset-0 animate-ping rounded-full opacity-20"
                style={{ border: "2px solid rgba(255,255,255,0.15)", animationDuration: "2s" }}
              />
            )}
          </div>

          {/* Labels */}
          <div className="text-center">
            <p
              style={{ ...HDG, fontWeight: 800, fontSize: "1.25rem", letterSpacing: "0.06em" }}
              className="uppercase text-white"
            >
              Scan any item
            </p>
            <p className="mt-1 text-sm text-white/35">
              Use the hand scanner or type a tag below
            </p>
          </div>

          {/* Manual input */}
          <input
            ref={manualRef}
            type="text"
            placeholder="Type asset tag and press Enter"
            className="h-12 w-full rounded-xl text-center text-sm text-white placeholder:text-white/20 outline-none transition-colors"
            style={{
              background: "#131316",
              border: "1px solid rgba(255,255,255,0.08)",
              fontFamily: "var(--font-mono)",
            }}
            onKeyDown={handleManualKeyDown}
            onFocusCapture={(e) => {
              e.currentTarget.style.borderColor = "rgba(197,5,12,0.50)";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(197,5,12,0.10)";
            }}
            onBlurCapture={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />

          {/* Error */}
          {error && (
            <div
              className="w-full rounded-xl px-4 py-3 text-center text-sm"
              style={{
                background: "rgba(197,5,12,0.10)",
                border: "1px solid rgba(197,5,12,0.30)",
                color: "#f87171",
              }}
            >
              {error}
            </div>
          )}

          {/* Result card */}
          {result && sc && (
            <div
              className="w-full rounded-xl"
              style={{
                background: "#131316",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {/* Tag + status */}
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                  }}
                  className="text-white"
                >
                  {result.tagName}
                </span>
                <span
                  className="rounded-lg px-3 py-1 text-xs font-semibold uppercase tracking-widest"
                  style={{
                    ...HDG,
                    fontWeight: 800,
                    fontSize: "0.65rem",
                    color: sc.color,
                    background: sc.bg,
                    border: `1px solid ${sc.border}`,
                  }}
                >
                  {result.status}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-2.5 px-4 py-3">
                <p className="text-base font-semibold text-white/90">
                  {result.productName}
                </p>
                <p className="text-xs text-white/35 uppercase tracking-wider">
                  {result.type}
                </p>

                {result.holder && (
                  <div
                    className="flex items-center justify-between pt-2"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <span className="text-xs text-white/35">Checked out by</span>
                    <span className="text-sm font-semibold text-white/80">
                      {result.holder}
                    </span>
                  </div>
                )}
                {result.dueAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/35">Due back</span>
                    <span
                      style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}
                      className="text-white/60"
                    >
                      {new Date(result.dueAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
