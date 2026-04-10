"use client";

import { useState, useRef, KeyboardEvent, ClipboardEvent } from "react";
import { Spinner } from "@/components/ui/spinner";

type Props = {
  onActivated: (data: {
    kioskId: string;
    name: string;
    locationName: string;
  }) => void;
};

const HDG: React.CSSProperties = { fontFamily: "var(--font-heading)" };

export function ActivationForm({ onActivated }: Props) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join("");

  function handleChange(index: number, value: string) {
    const clean = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    setError("");
    if (clean && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        const next = [...digits];
        next[index - 1] = "";
        setDigits(next);
        inputRefs.current[index - 1]?.focus();
      } else {
        const next = [...digits];
        next[index] = "";
        setDigits(next);
      }
    } else if (e.key === "Enter" && code.length === 6) {
      handleSubmit();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length > 0) {
      const next = pasted.split("").concat(Array(6).fill("")).slice(0, 6);
      setDigits(next);
      const focusIdx = Math.min(pasted.length, 5);
      inputRefs.current[focusIdx]?.focus();
    }
  }

  async function handleSubmit() {
    if (code.length !== 6 || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/kiosk/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (res.ok) {
        const json = await res.json();
        onActivated({
          kioskId: json.kioskId,
          name: json.name,
          locationName: json.location.name,
        });
      } else {
        const json = await res.json().catch(() => null);
        setError(json?.error || "Invalid activation code");
        setDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: "#0b0b0d" }}
    >
      {/* Subtle grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-10 px-6">
        {/* Wordmark */}
        <div className="text-center">
          <div
            style={{
              ...HDG,
              fontWeight: 900,
              fontSize: "2rem",
              letterSpacing: "0.18em",
            }}
            className="uppercase text-white"
          >
            Gear Tracker
          </div>
          <div
            className="mt-1 text-[10px] uppercase tracking-[0.22em] text-white/30"
            style={HDG}
          >
            Device Activation
          </div>
          <div
            className="mx-auto mt-4 h-0.5 w-12"
            style={{ background: "#c5050c" }}
          />
        </div>

        {/* Instruction */}
        <p className="text-center text-sm text-white/40">
          Enter the 6-digit activation code from{" "}
          <span className="text-white/60">Settings → Kiosk Devices</span>
        </p>

        {/* OTP Digit Boxes */}
        <div className="flex gap-3">
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={digit}
              autoFocus={i === 0}
              disabled={loading}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              onFocus={(e) => e.currentTarget.select()}
              className="h-[72px] w-[52px] rounded-xl text-center text-3xl font-mono font-bold text-white outline-none transition-all"
              style={{
                background: digit ? "#1e1e28" : "#141418",
                border: digit
                  ? "1px solid rgba(197,5,12,0.60)"
                  : "1px solid rgba(255,255,255,0.10)",
                caretColor: "#c5050c",
              }}
              onFocusCapture={(e) => {
                e.currentTarget.style.borderColor = "rgba(197,5,12,0.80)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(197,5,12,0.15)";
              }}
              onBlurCapture={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.borderColor = e.currentTarget.value
                  ? "rgba(197,5,12,0.60)"
                  : "rgba(255,255,255,0.10)";
              }}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <p
            className="rounded-lg px-4 py-2 text-sm text-red-400"
            style={{
              background: "rgba(197,5,12,0.10)",
              border: "1px solid rgba(197,5,12,0.25)",
            }}
          >
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || code.length !== 6}
          className="h-[52px] w-full rounded-xl text-base font-semibold uppercase tracking-widest transition-all"
          style={{
            ...HDG,
            fontWeight: 800,
            background:
              code.length === 6 && !loading ? "#c5050c" : "rgba(255,255,255,0.06)",
            color: code.length === 6 && !loading ? "#fff" : "rgba(255,255,255,0.25)",
            border:
              code.length === 6 && !loading
                ? "1px solid #c5050c"
                : "1px solid rgba(255,255,255,0.08)",
            cursor: code.length === 6 && !loading ? "pointer" : "not-allowed",
          }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner className="size-4" />
              Activating...
            </span>
          ) : (
            "Activate Device"
          )}
        </button>
      </div>
    </div>
  );
}
