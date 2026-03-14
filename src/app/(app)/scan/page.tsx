"use client";

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

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [processing, setProcessing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<{ message: string; success: boolean } | null>(null);

  // Booking scan state
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Track a stable ref to the toast function to avoid re-triggering effects
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // ── Load scan status for booking modes ──
  const loadScanStatus = useCallback(async () => {
    if (!checkoutId || !phaseParam) return;
    try {
      const res = await fetch(`/api/checkouts/${checkoutId}/scan-status?phase=${phaseParam}`);
      if (!res.ok) { setLoadError(true); return; }
      const json = await res.json();
      setScanStatus(json.data);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [checkoutId, phaseParam]);

  useEffect(() => {
    if (mode !== "lookup") {
      loadScanStatus();
    }
  }, [mode, loadScanStatus]);

  // ── Vibrate on scan (mobile haptic feedback) ──
  function vibrate() {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(100);
    }
  }

  // ── Lookup mode: scan → navigate to item ──
  const handleLookupScan = useCallback(async (value: string) => {
    setProcessing(true);
    setLastScanResult(null);
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
        router.push(`/items/${match.id}`);
        return; // navigating away
      }

      setLastScanResult({ message: `No item found for: ${value}`, success: false });
    } catch {
      setLastScanResult({ message: "Network error", success: false });
    }
    setProcessing(false);
  }, [router]);

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
        // Refresh scan status
        await loadScanStatus();
      } else {
        const json = await res.json().catch(() => ({}));
        const errMsg = (json as Record<string, string>).error || "Scan not recognized";
        setLastScanResult({ message: errMsg, success: false });
      }
    } catch {
      setLastScanResult({ message: "Network error — try again", success: false });
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
      toast("Network error — try again", "error");
    }
    setCompleting(false);
  }

  // ── Progress calculations ──
  const progress = scanStatus?.progress;
  const totalItems = (progress?.serializedTotal ?? 0);
  const scannedItems = (progress?.serializedScanned ?? 0);
  const progressPct = totalItems > 0 ? Math.round((scannedItems / totalItems) * 100) : 0;

  // ── Render ──
  const modeLabel = mode === "checkout" ? "Checkout Scan" : mode === "checkin" ? "Check-in Scan" : "Look Up Item";

  return (
    <>
      <div className="page-header">
        <h1>Scan</h1>
        {mode !== "lookup" && (
          <button className="btn btn-sm" onClick={() => router.push("/scan")}>
            Switch to Look Up
          </button>
        )}
      </div>

      {/* Mode indicator */}
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
        {modeLabel}
      </div>

      {/* Booking context banner */}
      {mode !== "lookup" && scanStatus && (
        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{scanStatus.title}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {scanStatus.requester.name} &middot; {scanStatus.location.name}
          </div>

          {/* Progress bar */}
          {totalItems > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                <span>{scannedItems} of {totalItems} items scanned</span>
                <span>{progressPct}%</span>
              </div>
              <div style={{
                height: 8, borderRadius: 4, background: "#e5e7eb", overflow: "hidden",
              }}>
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
        </div>
      )}

      {mode !== "lookup" && loadError && (
        <div className="card" style={{ padding: 16, marginBottom: 16, color: "var(--red)" }}>
          Failed to load checkout details.{" "}
          <button className="btn btn-sm" onClick={loadScanStatus}>Retry</button>
        </div>
      )}

      {/* Scanner */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h2>{scanning ? "Scanning..." : "Camera"}</h2>
          <button
            className={`btn ${scanning ? "" : "btn-primary"}`}
            onClick={() => { setScanning(!scanning); setCameraError(""); setLastScanResult(null); }}
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
            type="text"
            placeholder={mode === "lookup" ? "Enter asset tag or QR code..." : "Enter item QR code..."}
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualEntry()}
            style={{
              flex: 1, padding: "10px 14px",
              border: "1px solid var(--border)", borderRadius: 10, fontSize: 15,
            }}
          />
          <button
            className="btn btn-primary"
            onClick={handleManualEntry}
            disabled={!manualCode.trim() || processing}
            style={{ minWidth: 80, minHeight: 44 }}
          >
            {processing ? "..." : mode === "lookup" ? "Look up" : "Scan"}
          </button>
        </div>

        {/* Last scan result toast */}
        {lastScanResult && (
          <div style={{
            padding: "10px 16px",
            fontSize: 13, fontWeight: 600,
            color: lastScanResult.success ? "#166534" : "#991b1b",
            background: lastScanResult.success ? "#f0fdf4" : "#fef2f2",
            borderTop: "1px solid var(--border)",
          }}>
            {lastScanResult.message}
          </div>
        )}
      </div>

      {/* ── Booking mode: Item checklist ── */}
      {mode !== "lookup" && scanStatus && (
        <div className="card" style={{ marginBottom: scanStatus.progress.allComplete ? 100 : 16 }}>
          <div className="card-header">
            <h2>Items</h2>
          </div>

          {scanStatus.serializedItems.length === 0 && scanStatus.bulkItems.length === 0 ? (
            <div className="empty-state">No items to scan.</div>
          ) : (
            <>
              {scanStatus.serializedItems.map((item) => (
                <div
                  key={item.assetId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--border)",
                    background: item.scanned ? "#f0fdf4" : "white",
                    transition: "background 0.3s ease",
                  }}
                >
                  {/* Scan status indicator */}
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    background: item.scanned ? "#22c55e" : "#e5e7eb",
                    color: item.scanned ? "white" : "#9ca3af",
                    fontSize: 14, fontWeight: 700,
                  }}>
                    {item.scanned ? "\u2713" : ""}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600,
                      textDecoration: item.scanned ? "none" : "none",
                      color: item.scanned ? "#166534" : "var(--text)",
                    }}>
                      {item.assetTag}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {item.brand} {item.model}
                    </div>
                  </div>

                  {item.scanned && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#22c55e" }}>Scanned</span>
                  )}
                </div>
              ))}

              {scanStatus.bulkItems.map((item) => (
                <div
                  key={item.bulkSkuId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--border)",
                    background: item.scanned >= item.required ? "#f0fdf4" : "white",
                  }}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    background: item.scanned >= item.required ? "#22c55e" : "#e5e7eb",
                    color: item.scanned >= item.required ? "white" : "#9ca3af",
                    fontSize: 14, fontWeight: 700,
                  }}>
                    {item.scanned >= item.required ? "\u2713" : ""}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {item.scanned} / {item.required} scanned
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Complete action (sticky bottom) ── */}
      {mode !== "lookup" && scanStatus?.progress.allComplete && (
        <div style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: 16,
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
    </>
  );
}
