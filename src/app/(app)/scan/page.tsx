"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useToast } from "@/components/Toast";

const QrScanner = dynamic(() => import("@/components/QrScanner"), { ssr: false });

// ── Types ──

type ScanMode = "lookup" | "checkout" | "checkin";

type SerializedItemStatus = {
  assetId: string;
  assetTag: string;
  brand: string;
  model: string;
  scanned: boolean;
};

type BulkItemStatus = {
  bulkSkuId: string;
  name: string;
  required: number;
  scanned: number;
};

type ScanStatus = {
  checkoutId: string;
  title: string;
  status: string;
  phase: string;
  requester: { id: string; name: string };
  location: { id: string; name: string };
  serializedItems: SerializedItemStatus[];
  bulkItems: BulkItemStatus[];
  progress: {
    serializedScanned: number;
    serializedTotal: number;
    bulkComplete: boolean;
    allComplete: boolean;
  };
};

type LookupResult = {
  id: string;
  assetTag: string;
  brand: string;
  model: string;
  qrCodeValue?: string;
  primaryScanCode?: string;
};

type ItemPreview = {
  id: string;
  assetTag: string;
  brand: string;
  model: string;
  serialNumber: string;
  computedStatus: string;
  location: { name: string } | null;
  category: { name: string } | null;
  activeBooking: {
    id: string;
    kind: string;
    title: string;
    startsAt: string;
    endsAt: string;
    requesterName: string;
  } | null;
};

// ── Component ──

export default function ScanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Determine mode from URL params
  const checkoutId = searchParams.get("checkout");
  const phaseParam = searchParams.get("phase");
  const mode: ScanMode =
    checkoutId && phaseParam === "CHECKOUT" ? "checkout" :
    checkoutId && phaseParam === "CHECKIN" ? "checkin" :
    "lookup";

  // Auto-start camera — user navigated here to scan
  const [scanning, setScanning] = useState(true);
  const [cameraError, setCameraError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [processing, setProcessing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<{ message: string; success: boolean } | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [itemPreview, setItemPreview] = useState<ItemPreview | null>(null);

  // Booking scan state
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(mode !== "lookup");
  const [loadError, setLoadError] = useState(false);

  const toastRef = useRef(toast);
  toastRef.current = toast;
  const manualInputRef = useRef<HTMLInputElement>(null);

  // ── Load scan status for booking modes ──
  const loadScanStatus = useCallback(async () => {
    if (!checkoutId || !phaseParam) return;
    try {
      const res = await fetch(`/api/checkouts/${checkoutId}/scan-status?phase=${phaseParam}`);
      if (!res.ok) { setLoadError(true); setStatusLoading(false); return; }
      const json = await res.json();
      const data = json.data as ScanStatus;

      // Check if we just completed all items (celebration trigger)
      setScanStatus((prev) => {
        if (prev && !prev.progress.allComplete && data.progress.allComplete) {
          setShowCelebration(true);
          vibrate(200);
          setTimeout(() => setShowCelebration(false), 3000);
        }
        return data;
      });
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
    setStatusLoading(false);
  }, [checkoutId, phaseParam]);

  useEffect(() => {
    if (mode !== "lookup") {
      loadScanStatus();
    }
  }, [mode, loadScanStatus]);

  // ── Vibrate on scan (mobile haptic feedback) ──
  function vibrate(ms = 100) {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  }

  // ── Lookup mode: scan → show item preview bottom sheet ──
  const handleLookupScan = useCallback(async (value: string) => {
    setProcessing(true);
    setLastScanResult(null);
    setItemPreview(null);
    try {
      let searchTerm = value;
      const bgMatch = value.match(/^bg:\/\/(item|case)\/(.+)$/);
      if (bgMatch) searchTerm = bgMatch[2];

      const res = await fetch(`/api/assets?q=${encodeURIComponent(searchTerm)}&limit=5`);
      if (!res.ok) {
        setLastScanResult({ message: "Failed to look up item", success: false });
        setProcessing(false);
        return;
      }
      const json = await res.json();
      const assets: LookupResult[] = json.data ?? [];

      const exact = assets.find(
        (a) => a.qrCodeValue === value || a.primaryScanCode === value || a.assetTag === searchTerm
      );
      const match = exact ?? assets[0];

      if (match) {
        vibrate();
        // Fetch full item detail for the preview
        const detailRes = await fetch(`/api/assets/${match.id}`);
        if (detailRes.ok) {
          const detailJson = await detailRes.json();
          setItemPreview(detailJson.data as ItemPreview);
        } else {
          // Fallback: still show what we have from search
          setItemPreview({
            id: match.id,
            assetTag: match.assetTag,
            brand: match.brand,
            model: match.model,
            serialNumber: "",
            computedStatus: "AVAILABLE",
            location: null,
            category: null,
            activeBooking: null,
          });
        }
        setProcessing(false);
        return;
      }

      setLastScanResult({ message: `No item found for: ${value}`, success: false });
    } catch {
      setLastScanResult({ message: "Network error", success: false });
    }
    setProcessing(false);
  }, []);

  // ── Booking scan: record scan event ──
  const handleBookingScan = useCallback(async (value: string) => {
    if (!checkoutId || !phaseParam) return;
    setProcessing(true);
    setLastScanResult(null);

    const endpoint = phaseParam === "CHECKIN"
      ? `/api/checkouts/${checkoutId}/checkin-scan`
      : `/api/checkouts/${checkoutId}/scan`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: phaseParam,
          scanType: "SERIALIZED",
          scanValue: value,
        }),
      });

      if (res.ok) {
        vibrate();
        setLastScanResult({ message: "Item scanned successfully", success: true });
        await loadScanStatus();
      } else {
        const json = await res.json().catch(() => ({}));
        const errMsg = (json as Record<string, string>).error || "Scan not recognized";
        setLastScanResult({ message: errMsg, success: false });
        vibrate(50);
      }
    } catch {
      setLastScanResult({ message: "Network error \u2014 try again", success: false });
    }
    setProcessing(false);
  }, [checkoutId, phaseParam, loadScanStatus]);

  // ── Route scan to correct handler ──
  const handleScan = useCallback((value: string) => {
    if (processing) return;
    if (mode === "lookup") {
      handleLookupScan(value);
    } else {
      handleBookingScan(value);
    }
  }, [mode, processing, handleLookupScan, handleBookingScan]);

  const handleManualEntry = () => {
    const v = manualCode.trim();
    if (v) {
      handleScan(v);
      setManualCode("");
      manualInputRef.current?.focus();
    }
  };

  // ── Complete checkout/checkin ──
  async function handleComplete() {
    if (!checkoutId) return;
    setCompleting(true);

    const endpoint = mode === "checkin"
      ? `/api/checkouts/${checkoutId}/complete-checkin`
      : `/api/checkouts/${checkoutId}/complete-checkout`;

    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (res.ok) {
        toast(mode === "checkin" ? "Check-in complete!" : "Checkout confirmed!", "success");
        router.push(`/checkouts/${checkoutId}`);
        return;
      }
      const json = await res.json().catch(() => ({}));
      toast((json as Record<string, string>).error || "Could not complete", "error");
    } catch {
      toast("Network error \u2014 try again", "error");
    }
    setCompleting(false);
  }

  // ── Progress calculations ──
  const progress = scanStatus?.progress;
  const totalItems = progress?.serializedTotal ?? 0;
  const scannedItems = progress?.serializedScanned ?? 0;
  const progressPct = totalItems > 0 ? Math.round((scannedItems / totalItems) * 100) : 0;

  // ── Status display helpers ──
  function statusLabel(s: string) {
    switch (s) {
      case "AVAILABLE": return "Available";
      case "CHECKED_OUT": return "Checked Out";
      case "RESERVED": return "Reserved";
      case "MAINTENANCE": return "In Maintenance";
      case "RETIRED": return "Retired";
      default: return s;
    }
  }
  function statusColor(s: string) {
    switch (s) {
      case "AVAILABLE": return { bg: "#dcfce7", text: "#166534" };
      case "CHECKED_OUT": return { bg: "#dbeafe", text: "#1e40af" };
      case "RESERVED": return { bg: "#fef9c3", text: "#854d0e" };
      case "MAINTENANCE": return { bg: "#fed7aa", text: "#9a3412" };
      case "RETIRED": return { bg: "#f3f4f6", text: "#6b7280" };
      default: return { bg: "#f3f4f6", text: "#6b7280" };
    }
  }

  // ── Render ──
  return (
    <>
      {/* Breadcrumb */}
      {mode !== "lookup" && checkoutId && (
        <div className="breadcrumb">
          <Link href="/checkouts">Checkouts</Link>
          <span>{"\u203a"}</span>
          <Link href={`/checkouts/${checkoutId}`}>{scanStatus?.title ?? "Checkout"}</Link>
          <span>{"\u203a"}</span>
          {mode === "checkout" ? "Scan Out" : "Scan In"}
        </div>
      )}

      <div className="page-header">
        <h1>Scan</h1>
        {mode !== "lookup" && (
          <Link href="/scan" className="btn btn-sm" style={{ textDecoration: "none" }}>
            Item Look Up
          </Link>
        )}
      </div>

      {/* Mode pill */}
      <div style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px",
        background: mode === "checkout" ? "#dbeafe" : mode === "checkin" ? "#dcfce7" : "var(--bg-secondary, #f3f4f6)",
        color: mode === "checkout" ? "#1e40af" : mode === "checkin" ? "#166534" : "var(--text-secondary)",
        borderRadius: 20,
        fontSize: 13,
        fontWeight: 600,
        marginBottom: 16,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: mode === "checkout" ? "#3b82f6" : mode === "checkin" ? "#22c55e" : "#9ca3af",
        }} />
        {mode === "checkout" ? "Checkout Scan" : mode === "checkin" ? "Check-in Scan" : "Look Up Item"}
      </div>

      {/* Booking context banner (clickable) */}
      {mode !== "lookup" && statusLoading && (
        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className="spinner" style={{ width: 20, height: 20 }} />
            <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>Loading checkout details...</span>
          </div>
        </div>
      )}

      {mode !== "lookup" && scanStatus && (
        <Link
          href={`/checkouts/${checkoutId}`}
          className="card"
          style={{ marginBottom: 16, padding: 16, display: "block", textDecoration: "none", color: "inherit" }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{scanStatus.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {scanStatus.requester.name} &middot; {scanStatus.location.name}
              </div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" style={{ color: "var(--text-secondary)", flexShrink: 0 }}>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>

          {/* Progress bar */}
          {totalItems > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                <span>{scannedItems} of {totalItems} items scanned</span>
                <span>{progressPct}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: "#e5e7eb", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  borderRadius: 4,
                  width: `${progressPct}%`,
                  background: progress?.allComplete ? "#22c55e" : "#3b82f6",
                  transition: "width 0.3s ease",
                }} />
              </div>
            </div>
          )}
        </Link>
      )}

      {mode !== "lookup" && loadError && (
        <div className="card" style={{ padding: 16, marginBottom: 16, color: "var(--red)" }}>
          Failed to load checkout details.{" "}
          <button className="btn btn-sm" onClick={loadScanStatus}>Retry</button>
        </div>
      )}

      {/* Celebration overlay */}
      {showCelebration && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.4)",
          zIndex: 100,
          animation: "fadeIn 0.2s ease",
        }}>
          <div style={{
            background: "white",
            borderRadius: 20,
            padding: "32px 40px",
            textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            animation: "scaleIn 0.3s ease",
          }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>
              {mode === "checkin" ? "\u2705" : "\u2705"}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>All items scanned!</div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Tap the button below to {mode === "checkin" ? "complete check-in" : "complete checkout"}
            </div>
          </div>
        </div>
      )}

      {/* Scanner */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h2>{scanning ? "Scanning..." : "Camera"}</h2>
          <button
            className={`btn ${scanning ? "" : "btn-primary"}`}
            onClick={() => { setScanning(!scanning); setCameraError(""); setLastScanResult(null); }}
            style={{ minHeight: 44 }}
          >
            {scanning ? "Stop camera" : "Start camera"}
          </button>
        </div>

        {scanning && (
          <div style={{ padding: 16 }}>
            <QrScanner
              onScan={handleScan}
              onError={setCameraError}
              active={scanning}
            />
          </div>
        )}

        {cameraError && (
          <div style={{ padding: "12px 16px", color: "var(--red)", fontSize: 13 }}>
            Camera error: {cameraError}. Try entering the code manually below.
          </div>
        )}

        {/* Manual entry */}
        <div style={{ padding: 16, display: "flex", gap: 8 }}>
          <input
            ref={manualInputRef}
            type="text"
            placeholder={mode === "lookup" ? "Enter asset tag or QR code..." : "Enter item QR code..."}
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualEntry()}
            style={{
              flex: 1, padding: "12px 14px",
              border: "1px solid var(--border)", borderRadius: 10, fontSize: 16,
              minHeight: 48,
            }}
          />
          <button
            className="btn btn-primary"
            onClick={handleManualEntry}
            disabled={!manualCode.trim() || processing}
            style={{ minWidth: 80, minHeight: 48, fontSize: 15 }}
          >
            {processing ? "..." : mode === "lookup" ? "Look up" : "Scan"}
          </button>
        </div>

        {/* Last scan result inline feedback */}
        {lastScanResult && (
          <div style={{
            padding: "10px 16px",
            fontSize: 14, fontWeight: 600,
            color: lastScanResult.success ? "#166534" : "#991b1b",
            background: lastScanResult.success ? "#f0fdf4" : "#fef2f2",
            borderTop: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 16 }}>{lastScanResult.success ? "\u2713" : "\u2717"}</span>
            {lastScanResult.message}
          </div>
        )}
      </div>

      {/* Lookup mode hint */}
      {mode === "lookup" && !scanning && !lastScanResult && (
        <div style={{
          textAlign: "center",
          padding: "32px 16px",
          color: "var(--text-secondary)",
          fontSize: 14,
        }}>
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48" style={{ display: "inline" }}>
              <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
              <line x1="7" y1="12" x2="17" y2="12" />
              <line x1="12" y1="7" x2="12" y2="17" />
            </svg>
          </div>
          Scan any item&apos;s QR code or enter its asset tag to view details.
        </div>
      )}

      {/* ── Booking mode: Item checklist ── */}
      {mode !== "lookup" && scanStatus && (
        <div className="card" style={{ marginBottom: progress?.allComplete ? 100 : 16 }}>
          <div className="card-header">
            <h2>Items ({scannedItems}/{totalItems})</h2>
          </div>

          {scanStatus.serializedItems.length === 0 && scanStatus.bulkItems.length === 0 ? (
            <div className="empty-state">No items to scan.</div>
          ) : (
            <>
              {/* Show unscanned items first, then scanned */}
              {[...scanStatus.serializedItems]
                .sort((a, b) => (a.scanned === b.scanned ? 0 : a.scanned ? 1 : -1))
                .map((item) => (
                <div
                  key={item.assetId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 16px",
                    borderBottom: "1px solid var(--border)",
                    background: item.scanned ? "#f0fdf4" : "white",
                    transition: "background 0.3s ease",
                    minHeight: 56,
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    background: item.scanned ? "#22c55e" : "#e5e7eb",
                    color: item.scanned ? "white" : "#9ca3af",
                    fontSize: 14, fontWeight: 700,
                    transition: "all 0.3s ease",
                  }}>
                    {item.scanned ? "\u2713" : ""}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600,
                      color: item.scanned ? "#166534" : "var(--text)",
                    }}>
                      {item.assetTag}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      {item.brand} {item.model}
                    </div>
                  </div>

                  {item.scanned && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#22c55e" }}>Scanned</span>
                  )}
                </div>
              ))}

              {scanStatus.bulkItems.map((item) => {
                const done = item.scanned >= item.required;
                return (
                  <div
                    key={item.bulkSkuId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 16px",
                      borderBottom: "1px solid var(--border)",
                      background: done ? "#f0fdf4" : "white",
                      minHeight: 56,
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                      background: done ? "#22c55e" : "#e5e7eb",
                      color: done ? "white" : "#9ca3af",
                      fontSize: 14, fontWeight: 700,
                    }}>
                      {done ? "\u2713" : ""}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: done ? "#166534" : "var(--text)" }}>{item.name}</div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        {item.scanned} / {item.required} scanned
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ── Complete action (sticky bottom, clears mobile nav) ── */}
      {mode !== "lookup" && scanStatus?.progress.allComplete && (
        <div style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "16px 16px calc(16px + env(safe-area-inset-bottom, 0px))",
          paddingBottom: "calc(16px + 60px)",
          background: "white",
          borderTop: "1px solid var(--border)",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
          zIndex: 50,
        }}>
          <button
            className="btn btn-primary"
            onClick={handleComplete}
            disabled={completing}
            style={{
              width: "100%",
              padding: "16px 24px",
              fontSize: 16,
              fontWeight: 700,
              minHeight: 52,
            }}
          >
            {completing
              ? "Completing..."
              : mode === "checkout"
                ? "Complete Checkout"
                : "Complete Check-in"
            }
          </button>
        </div>
      )}

      {/* ── Item preview bottom sheet (lookup mode) ── */}
      {itemPreview && (
        <>
          <div className="sheet-overlay" onClick={() => setItemPreview(null)} />
          <div className="sheet-panel" style={{ maxWidth: 480 }}>
            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 0" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#d1d5db" }} />
            </div>

            <div className="sheet-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ margin: 0 }}>{itemPreview.assetTag}</h2>
                <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 2 }}>
                  {itemPreview.brand} {itemPreview.model}
                </div>
              </div>
              <span style={{
                padding: "4px 10px",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 600,
                background: statusColor(itemPreview.computedStatus).bg,
                color: statusColor(itemPreview.computedStatus).text,
                whiteSpace: "nowrap",
              }}>
                {statusLabel(itemPreview.computedStatus)}
              </span>
            </div>

            <div className="sheet-section" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {itemPreview.serialNumber && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Serial</span>
                  <span style={{ fontFamily: "monospace" }}>{itemPreview.serialNumber}</span>
                </div>
              )}
              {itemPreview.location && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Location</span>
                  <span>{itemPreview.location.name}</span>
                </div>
              )}
              {itemPreview.category && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Category</span>
                  <span>{itemPreview.category.name}</span>
                </div>
              )}
            </div>

            {/* Current holder / active booking */}
            {itemPreview.activeBooking && (
              <div className="sheet-section" style={{
                background: statusColor(itemPreview.computedStatus).bg,
                borderRadius: 10,
                margin: "0 16px",
                padding: "12px 14px",
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: statusColor(itemPreview.computedStatus).text, marginBottom: 4 }}>
                  {itemPreview.activeBooking.kind === "CHECKOUT" ? "Currently with" : "Reserved by"}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  {itemPreview.activeBooking.requesterName}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                  {itemPreview.activeBooking.title}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                  {new Date(itemPreview.activeBooking.startsAt).toLocaleDateString()} &ndash; {new Date(itemPreview.activeBooking.endsAt).toLocaleDateString()}
                </div>
              </div>
            )}

            <div className="sheet-actions" style={{ display: "flex", gap: 8 }}>
              <button
                className="btn"
                onClick={() => setItemPreview(null)}
                style={{ flex: 1, minHeight: 48 }}
              >
                Dismiss
              </button>
              <Link
                href={`/items/${itemPreview.id}`}
                className="btn btn-primary"
                style={{ flex: 1, minHeight: 48, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                View Details
              </Link>
            </div>
          </div>
        </>
      )}

      {/* Inline styles for animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
