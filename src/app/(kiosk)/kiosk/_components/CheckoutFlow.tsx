"use client";

import { useCallback, useState } from "react";
import { ArrowLeft, Check, AlertTriangle, X, Package } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { ScanInput } from "./ScanInput";

type KioskInfo = { kioskId: string; locationId: string; locationName: string };
type KioskUser = { id: string; name: string; avatarUrl: string | null };

type ScannedItem = {
  id: string;
  name: string;
  tagName: string;
  type: string;
};

type ScanFeedback = {
  type: "success" | "error" | "warning";
  message: string;
};

type Props = {
  kioskInfo: KioskInfo;
  user: KioskUser;
  countdown: string;
  onBack: () => void;
  onComplete: (itemCount: number) => void;
};

const HDG: React.CSSProperties = { fontFamily: "var(--font-heading)" };

export function CheckoutFlow({
  kioskInfo,
  user,
  countdown,
  onBack,
  onComplete,
}: Props) {
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [scanning, setScanning] = useState(false);
  const [completing, setCompleting] = useState(false);

  const handleScan = useCallback(
    async (scanValue: string) => {
      setScanning(true);
      setFeedback(null);

      try {
        const res = await fetch("/api/kiosk/checkout/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scanValue,
            actorId: user.id,
            locationId: kioskInfo.locationId,
          }),
        });

        const data = (await res.json()) as {
          success: boolean;
          item?: ScannedItem;
          error?: string;
        };

        if (!data.success || !data.item) {
          setFeedback({
            type: "error",
            message: data.error || "Item not found",
          });
          return;
        }

        if (items.some((i) => i.id === data.item!.id)) {
          setFeedback({
            type: "warning",
            message: `${data.item.name} (${data.item.tagName}) already scanned`,
          });
          return;
        }

        setItems((prev) => [...prev, data.item!]);
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
    [user.id, kioskInfo.locationId, items],
  );

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const res = await fetch("/api/kiosk/checkout/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: user.id,
          locationId: kioskInfo.locationId,
          items: items.map((i) => ({ assetId: i.id })),
        }),
      });

      const data = (await res.json()) as { success: boolean; error?: string };

      if (data.success) {
        onComplete(items.length);
      } else {
        setFeedback({
          type: "error",
          message: data.error || "Failed to complete checkout",
        });
      }
    } catch {
      setFeedback({ type: "error", message: "Network error. Try again." });
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div
      className="flex h-full flex-col"
      style={{ background: "#0b0b0d" }}
    >
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
          Checking Out
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
                Scan Item
              </span>
            </div>
            <ScanInput onScan={handleScan} disabled={scanning || completing} />
          </div>

          {/* Feedback */}
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

        {/* Right: scanned items */}
        <div className="flex w-1/2 flex-col p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-3 w-0.5 rounded-full" style={{ background: "#c5050c" }} />
            <span
              className="text-[10px] uppercase tracking-[0.15em] text-white/35"
              style={HDG}
            >
              Scanned Items
            </span>
            <span
              style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}
              className="ml-auto tabular-nums text-white/30"
            >
              {items.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <Package className="size-10 text-white/10" />
                <p className="text-sm text-white/25">No items scanned yet</p>
                <p className="text-xs text-white/15">Scan barcodes to add items</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {items.map((item, idx) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{
                      background: "#131316",
                      border: "1px solid rgba(34,197,94,0.20)",
                      animationDelay: `${idx * 50}ms`,
                    }}
                  >
                    <Check className="size-4 shrink-0 text-green-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white/90">
                        {item.name}
                      </p>
                    </div>
                    <span
                      style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem" }}
                      className="shrink-0 text-white/35"
                    >
                      {item.tagName}
                    </span>
                  </li>
                ))}
              </ul>
            )}
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
                background:
                  items.length > 0 && !completing ? "#c5050c" : "rgba(255,255,255,0.06)",
                color:
                  items.length > 0 && !completing ? "#fff" : "rgba(255,255,255,0.20)",
                border:
                  items.length > 0 && !completing
                    ? "1px solid #c5050c"
                    : "1px solid rgba(255,255,255,0.06)",
                cursor: items.length > 0 && !completing ? "pointer" : "not-allowed",
              }}
              disabled={items.length === 0 || completing}
              onClick={handleComplete}
            >
              {completing ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner className="size-4" />
                  Processing...
                </span>
              ) : (
                <span className="uppercase">
                  Done — {items.length} item{items.length !== 1 ? "s" : ""}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
