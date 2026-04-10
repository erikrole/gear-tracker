"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Circle, AlertTriangle, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { ScanInput } from "./ScanInput";

type KioskInfo = { kioskId: string; locationId: string; locationName: string };
type KioskUser = { id: string; name: string; avatarUrl: string | null };

type BookingItem = {
  id: string;
  name: string;
  tagName: string;
  returned: boolean;
};

type ScanFeedback = {
  type: "success" | "error" | "warning";
  message: string;
};

type Props = {
  kioskInfo: KioskInfo;
  user: KioskUser;
  bookingId: string;
  countdown: string;
  onBack: () => void;
  onComplete: (itemCount: number) => void;
};

const HDG: React.CSSProperties = { fontFamily: "var(--font-heading)" };

export function ReturnFlow({
  kioskInfo,
  user,
  bookingId,
  countdown,
  onBack,
  onComplete,
}: Props) {
  const [bookingItems, setBookingItems] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [scanning, setScanning] = useState(false);
  const [completing, setCompleting] = useState(false);

  // kioskInfo available for future scoped queries
  void kioskInfo;

  useEffect(() => {
    let mounted = true;

    async function loadBooking() {
      try {
        const res = await fetch(`/api/kiosk/checkout/${bookingId}`);
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          if (mounted) setLoadError(err?.error || "Could not load booking");
          return;
        }
        const data = (await res.json()) as {
          id: string;
          items: Array<{
            id: string;
            name: string;
            tagName: string;
            returned: boolean;
          }>;
          error?: string;
        };

        if (!mounted) return;
        if (!data.items) {
          setLoadError(data.error || "Failed to load booking");
          return;
        }
        setBookingItems(data.items);
      } catch {
        if (mounted) setLoadError("Network error loading booking");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadBooking();
    return () => {
      mounted = false;
    };
  }, [bookingId]);

  const returnedCount = bookingItems.filter((i) => i.returned).length;
  const totalCount = bookingItems.length;
  const progressPct = totalCount > 0 ? (returnedCount / totalCount) * 100 : 0;
  const allReturned = returnedCount === totalCount && totalCount > 0;

  const handleScan = useCallback(
    async (scanValue: string) => {
      setScanning(true);
      setFeedback(null);

      try {
        const res = await fetch(`/api/kiosk/checkin/${bookingId}/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scanValue, actorId: user.id }),
        });

        const data = (await res.json()) as {
          success: boolean;
          item?: { id: string; name: string; tagName: string };
          error?: string;
        };

        if (!data.success || !data.item) {
          setFeedback({
            type: "error",
            message: data.error || "Item not found in this booking",
          });
          return;
        }

        setBookingItems((prev) =>
          prev.map((i) =>
            i.id === data.item!.id ? { ...i, returned: true } : i,
          ),
        );

        setFeedback({
          type: "success",
          message: `${data.item.name} (${data.item.tagName})`,
        });
      } catch {
        setFeedback({ type: "error", message: "Network error. Try again." });
      } finally {
        setScanning(false);
      }
    },
    [bookingId, user.id],
  );

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const res = await fetch(`/api/kiosk/checkin/${bookingId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: user.id }),
      });

      const data = (await res.json()) as { success: boolean; error?: string };

      if (data.success) {
        onComplete(returnedCount);
      } else {
        setFeedback({
          type: "error",
          message: data.error || "Failed to complete return",
        });
      }
    } catch {
      setFeedback({ type: "error", message: "Network error. Try again." });
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: "#0b0b0d" }}>
        <div className="space-y-3 p-4">
          <Skeleton className="h-6 w-48" />
          <div className="space-y-2 mt-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-8 rounded" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className="flex h-full items-center justify-center"
        style={{ background: "#0b0b0d" }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <X className="size-10 text-[#c5050c]" />
          <p className="text-lg font-semibold text-white">Could not load booking</p>
          <p className="text-sm text-white/40">{loadError}</p>
          <button
            type="button"
            onClick={onBack}
            className="mt-2 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm text-white/50 transition-colors hover:text-white"
            style={{ border: "1px solid rgba(255,255,255,0.10)" }}
          >
            <ArrowLeft className="size-4" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" style={{ background: "#0b0b0d" }}>
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
          style={{ ...HDG, fontWeight: 800, fontSize: "0.8rem", letterSpacing: "0.12em", color: "#c5050c" }}
          className="uppercase"
        >
          Returning
        </span>
        <span className="text-white/30">·</span>
        <span
          style={{ ...HDG, fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.08em" }}
          className="uppercase text-white/80"
        >
          {user.name}
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

      {/* ── Two columns ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: scan zone */}
        <div
          className="flex w-1/2 flex-col gap-4 p-4"
          style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="h-3 w-0.5 rounded-full" style={{ background: "#c5050c" }} />
              <span
                className="text-[10px] uppercase tracking-[0.15em] text-white/35"
                style={HDG}
              >
                Scan to Return
              </span>
            </div>
            <ScanInput onScan={handleScan} disabled={scanning || completing} />
          </div>

          {scanning && (
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <Spinner className="size-4 text-white/40" />
              <span className="text-sm text-white/50">Looking up item...</span>
            </div>
          )}

          {feedback && !scanning && (
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{
                background:
                  feedback.type === "success"
                    ? "rgba(34,197,94,0.08)"
                    : feedback.type === "warning"
                      ? "rgba(245,158,11,0.08)"
                      : "rgba(197,5,12,0.10)",
                border:
                  feedback.type === "success"
                    ? "1px solid rgba(34,197,94,0.30)"
                    : feedback.type === "warning"
                      ? "1px solid rgba(245,158,11,0.30)"
                      : "1px solid rgba(197,5,12,0.30)",
              }}
            >
              {feedback.type === "success" && (
                <Check className="size-4 shrink-0 text-green-400" />
              )}
              {feedback.type === "warning" && (
                <AlertTriangle className="size-4 shrink-0 text-amber-400" />
              )}
              {feedback.type === "error" && (
                <X className="size-4 shrink-0 text-red-400" />
              )}
              <span
                className={`text-sm ${
                  feedback.type === "success"
                    ? "text-green-300"
                    : feedback.type === "warning"
                      ? "text-amber-300"
                      : "text-red-300"
                }`}
              >
                {feedback.message}
              </span>
            </div>
          )}
        </div>

        {/* Right: checklist */}
        <div className="flex w-1/2 flex-col p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-3 w-0.5 rounded-full" style={{ background: "#c5050c" }} />
            <span
              className="text-[10px] uppercase tracking-[0.15em] text-white/35"
              style={HDG}
            >
              Booking Items
            </span>
            <span
              style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}
              className="ml-auto tabular-nums"
            >
              <span className={allReturned ? "text-green-400" : "text-white/40"}>
                {returnedCount}
              </span>
              <span className="text-white/20"> / {totalCount}</span>
            </span>
          </div>

          {/* Progress bar */}
          <div
            className="mb-4 h-1 w-full overflow-hidden rounded-full"
            style={{ background: "rgba(255,255,255,0.07)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progressPct}%`,
                background: allReturned ? "#22c55e" : "#c5050c",
              }}
            />
          </div>

          {/* Checklist */}
          <div className="flex-1 overflow-y-auto">
            <ul className="flex flex-col gap-1.5">
              {bookingItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-300"
                  style={{
                    background: item.returned ? "rgba(34,197,94,0.07)" : "#131316",
                    border: item.returned
                      ? "1px solid rgba(34,197,94,0.25)"
                      : "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  {item.returned ? (
                    <Check className="size-4 shrink-0 text-green-400" />
                  ) : (
                    <Circle className="size-4 shrink-0 text-white/20" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-medium ${
                        item.returned ? "text-green-300" : "text-white/80"
                      }`}
                    >
                      {item.name}
                    </p>
                  </div>
                  <span
                    style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem" }}
                    className={item.returned ? "text-green-400/60" : "text-white/30"}
                  >
                    {item.tagName}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Done button */}
          <div
            className="mt-4 pt-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <button
              type="button"
              className="h-12 w-full rounded-xl text-base transition-all"
              style={{
                ...HDG,
                fontWeight: 900,
                letterSpacing: "0.12em",
                background: !completing ? "#c5050c" : "rgba(255,255,255,0.06)",
                color: !completing ? "#fff" : "rgba(255,255,255,0.20)",
                border: !completing
                  ? "1px solid #c5050c"
                  : "1px solid rgba(255,255,255,0.06)",
                cursor: !completing ? "pointer" : "not-allowed",
              }}
              disabled={completing}
              onClick={handleComplete}
            >
              {completing ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner className="size-4" />
                  Processing...
                </span>
              ) : (
                <span className="uppercase">
                  Done — {returnedCount} of {totalCount} returned
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
