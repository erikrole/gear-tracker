"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Circle, AlertTriangle, Package } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { ScanInput } from "./ScanInput";

type KioskInfo = { kioskId: string; locationId: string; locationName: string };
type KioskUser = { id: string; name: string; avatarUrl: string | null };

type BookingItem = {
  id: string;
  name: string;
  tagName: string;
  confirmed: boolean;
};

type BulkItem = {
  name: string;
  quantity: number;
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

export function PickupFlow({
  kioskInfo,
  user,
  bookingId,
  countdown,
  onBack,
  onComplete,
}: Props) {
  const [bookingTitle, setBookingTitle] = useState("");
  const [items, setItems] = useState<BookingItem[]>([]);
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [scanning, setScanning] = useState(false);
  const [completing, setCompleting] = useState(false);

  void kioskInfo;

  useEffect(() => {
    let mounted = true;

    async function loadBooking() {
      try {
        const res = await fetch(`/api/kiosk/checkout/${bookingId}`);
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || `Error ${res.status}`);
        }
        const data = await res.json();
        if (!mounted) return;
        setBookingTitle(data.title || "Pending Pickup");
        setItems(
          (data.items ?? []).map((i: { id: string; name: string; tagName: string }) => ({
            id: i.id,
            name: i.name,
            tagName: i.tagName,
            confirmed: false,
          }))
        );
        // bulk items come from student API endpoint — not in this response, so we leave empty
        setBulkItems([]);
      } catch (err) {
        if (mounted) setLoadError(err instanceof Error ? err.message : "Failed to load booking");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadBooking();
    return () => { mounted = false; };
  }, [bookingId]);

  const handleScan = useCallback(
    async (scanValue: string) => {
      setScanning(true);
      setFeedback(null);

      try {
        const res = await fetch(`/api/kiosk/pickup/${bookingId}/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scanValue }),
        });

        const data = await res.json() as { success: boolean; item?: { id: string; name: string; tagName: string }; error?: string };

        if (!data.success || !data.item) {
          setFeedback({ type: "error", message: data.error || "Item not found" });
          return;
        }

        if (items.some((i) => i.id === data.item!.id && i.confirmed)) {
          setFeedback({ type: "warning", message: `${data.item.tagName} already confirmed` });
          return;
        }

        setItems((prev) =>
          prev.map((i) => i.id === data.item!.id ? { ...i, confirmed: true } : i)
        );
        setFeedback({ type: "success", message: `${data.item.tagName} confirmed` });
      } catch {
        setFeedback({ type: "error", message: "Scan failed — try again" });
      } finally {
        setScanning(false);
        setTimeout(() => setFeedback(null), 3000);
      }
    },
    [bookingId, items]
  );

  const allConfirmed = items.length > 0 && items.every((i) => i.confirmed);
  const confirmedCount = items.filter((i) => i.confirmed).length;

  const handleComplete = useCallback(async () => {
    setCompleting(true);
    try {
      const res = await fetch(`/api/kiosk/pickup/${bookingId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: user.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setFeedback({ type: "error", message: err?.error || "Failed to complete pickup" });
        return;
      }
      onComplete(items.length + bulkItems.reduce((s, b) => s + b.quantity, 0));
    } catch {
      setFeedback({ type: "error", message: "Network error — try again" });
    } finally {
      setCompleting(false);
    }
  }, [bookingId, user.id, items, bulkItems, onComplete]);

  const feedbackColor =
    feedback?.type === "success" ? "#22c55e"
    : feedback?.type === "warning" ? "#f59e0b"
    : "#c5050c";

  return (
    <div className="flex h-full w-full flex-col" style={{ background: "#0b0b0d" }}>
      {/* Top bar */}
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
        <span style={{ ...HDG, fontWeight: 800, letterSpacing: "0.08em" }} className="text-sm uppercase text-white truncate">
          {loading ? "Loading…" : bookingTitle}
        </span>
        <div className="ml-auto">
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }} className="tabular-nums text-white/30">
            {countdown}
          </span>
        </div>
      </div>

      {/* Main content */}
      {loading ? (
        <div className="flex flex-1 flex-col gap-3 p-5">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </div>
      ) : loadError ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-red-400">{loadError}</p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-4 p-4">
          {/* Left: item list */}
          <div className="flex w-[55%] flex-col gap-3 overflow-y-auto">
            <div className="mb-1">
              <span className="text-[10px] uppercase tracking-[0.14em] text-white/35" style={HDG}>
                Items to confirm ({confirmedCount}/{items.length})
              </span>
            </div>

            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  background: item.confirmed ? "rgba(34,197,94,0.08)" : "#131316",
                  border: item.confirmed ? "1px solid rgba(34,197,94,0.30)" : "1px solid rgba(255,255,255,0.07)",
                }}
              >
                {item.confirmed ? (
                  <Check className="size-4 shrink-0 text-green-400" />
                ) : (
                  <Circle className="size-4 shrink-0 text-white/20" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" style={{ color: item.confirmed ? "rgba(74,222,128,0.9)" : "rgba(255,255,255,0.85)" }}>
                    {item.tagName}
                  </p>
                  <p className="truncate text-xs text-white/35">{item.name}</p>
                </div>
              </div>
            ))}

            {bulkItems.map((bi, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.30)" }}
              >
                <Package className="size-4 shrink-0 text-green-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-green-400/90">{bi.name}</p>
                  <p className="text-xs text-white/35">&times; {bi.quantity}</p>
                </div>
                <Check className="size-4 shrink-0 text-green-400" />
              </div>
            ))}
          </div>

          {/* Right: scan + confirm */}
          <div className="flex w-[45%] flex-col gap-3">
            {/* Feedback */}
            {feedback && (
              <div
                className="rounded-xl px-4 py-3 text-center text-sm font-semibold"
                style={{ background: `${feedbackColor}22`, border: `1px solid ${feedbackColor}55`, color: feedbackColor }}
              >
                {feedback.type === "error" && <AlertTriangle className="inline mr-1.5 size-4" />}
                {feedback.message}
              </div>
            )}

            {/* Scan input */}
            {!allConfirmed && (
              <div
                className="flex-1 rounded-xl p-4"
                style={{ background: "#131316", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <p className="mb-3 text-center text-[10px] uppercase tracking-[0.14em] text-white/35" style={HDG}>
                  Scan each item
                </p>
                {scanning ? (
                  <div className="flex justify-center py-4">
                    <Spinner className="size-6 text-white/40" />
                  </div>
                ) : (
                  <ScanInput onScan={handleScan} />
                )}
              </div>
            )}

            {/* Complete button */}
            <button
              type="button"
              disabled={!allConfirmed || completing}
              onClick={handleComplete}
              className="flex h-[80px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl transition-all disabled:opacity-30"
              style={{
                background: allConfirmed ? "#22c55e" : "#1e1e24",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              {completing ? (
                <Spinner className="size-5 text-white" />
              ) : (
                <>
                  <Check className="size-6 text-white" />
                  <span style={{ ...HDG, fontWeight: 800, fontSize: "0.85rem", letterSpacing: "0.10em" }} className="uppercase text-white">
                    {allConfirmed ? "Complete Pickup" : `${confirmedCount}/${items.length} Confirmed`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
