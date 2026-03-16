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

type AllocatedUnit = {
  unitNumber: number;
  checkedOut: boolean;
  checkedIn: boolean;
};

type BulkItemStatus = {
  bulkSkuId: string;
  name: string;
  required: number;
  scanned: number;
  trackByNumber?: boolean;
  allocatedUnits?: AllocatedUnit[];
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
  parentAsset: { id: string; assetTag: string; name: string | null; brand: string; model: string } | null;
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

  // Numbered bulk unit picker
  const [unitPicker, setUnitPicker] = useState<{
    bulkSkuId: string;
    scanValue: string;
    name: string;
    availableUnits: number[];
  } | null>(null);
  const [selectedUnits, setSelectedUnits] = useState<Set<number>>(new Set());

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
      // Start (or resume) a scan session for audit tracking, then load status
      if (checkoutId && phaseParam) {
        fetch(`/api/checkouts/${checkoutId}/start-scan-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phase: phaseParam }),
        }).catch(() => {/* non-blocking */});
      }
      loadScanStatus();
    }
  }, [mode, loadScanStatus, checkoutId, phaseParam]);

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
            parentAsset: null,
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

  // ── Submit a scan (serialized or bulk with units) ──
  const submitScan = useCallback(async (payload: Record<string, unknown>) => {
    if (!checkoutId || !phaseParam) return false;

    const endpoint = phaseParam === "CHECKIN"
      ? `/api/checkouts/${checkoutId}/checkin-scan`
      : `/api/checkouts/${checkoutId}/scan`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: phaseParam, ...payload }),
      });

      if (res.ok) {
        vibrate();
        setLastScanResult({ message: "Item scanned successfully", success: true });
        await loadScanStatus();
        return true;
      } else {
        const json = await res.json().catch(() => ({}));
        const errMsg = (json as Record<string, string>).error || "Scan not recognized";
        setLastScanResult({ message: errMsg, success: false });
        vibrate(50);
        return false;
      }
    } catch {
      setLastScanResult({ message: "Network error \u2014 try again", success: false });
      return false;
    }
  }, [checkoutId, phaseParam, loadScanStatus]);

  // ── Booking scan: record scan event ──
  const handleBookingScan = useCallback(async (value: string) => {
    if (!checkoutId || !phaseParam || !scanStatus) return;
    setProcessing(true);
    setLastScanResult(null);

    // Check if this QR belongs to a numbered bulk item
    const numberedBulk = scanStatus.bulkItems.find(
      (item) => item.trackByNumber
    );

    // We need to check if the scan value matches a bulk bin QR — try the scan
    // and if it's a numbered bulk item, the API will tell us we need unitNumbers
    if (numberedBulk) {
      // Try as serialized first
      const res = await fetch(
        phaseParam === "CHECKIN"
          ? `/api/checkouts/${checkoutId}/checkin-scan`
          : `/api/checkouts/${checkoutId}/scan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phase: phaseParam, scanType: "SERIALIZED", scanValue: value }),
        }
      );

      if (res.ok) {
        vibrate();
        setLastScanResult({ message: "Item scanned successfully", success: true });
        await loadScanStatus();
        setProcessing(false);
        return;
      }

      const errJson = await res.json().catch(() => ({})) as { error?: string; data?: { code?: string } };
      const errCode = errJson.data?.code;
      const errMsg = errJson.error || "";

      // If serialized scan failed because item isn't in this checkout,
      // check if the scan matches a numbered bulk bin instead
      const matchingBulk = scanStatus.bulkItems.find(
        (item) => item.trackByNumber
      );

      if (matchingBulk && errCode === "SCAN_NOT_IN_CHECKOUT") {
        // Fetch available units to show picker
        const unitsRes = await fetch(`/api/bulk-skus/${matchingBulk.bulkSkuId}/units`);
        if (unitsRes.ok) {
          const unitsJson = await unitsRes.json();
          const units = unitsJson.data as Array<{ unitNumber: number; status: string }>;

          const availableUnits = phaseParam === "CHECKOUT"
            ? units.filter((u) => u.status === "AVAILABLE").map((u) => u.unitNumber)
            : units.filter((u) => u.status === "CHECKED_OUT").map((u) => u.unitNumber);

          if (availableUnits.length > 0) {
            setUnitPicker({
              bulkSkuId: matchingBulk.bulkSkuId,
              scanValue: value,
              name: matchingBulk.name,
              availableUnits,
            });
            setSelectedUnits(new Set(availableUnits));
            setProcessing(false);
            return;
          }
        }
      }

      setLastScanResult({ message: errMsg || "Scan not recognized", success: false });
      vibrate(50);
      setProcessing(false);
      return;
    }

    // Standard flow: try as serialized scan
    setProcessing(true);
    await submitScan({ scanType: "SERIALIZED", scanValue: value });
    setProcessing(false);
  }, [checkoutId, phaseParam, scanStatus, loadScanStatus, submitScan]);

  // ── Submit numbered bulk unit selection ──
  async function handleUnitPickerSubmit() {
    if (!unitPicker || selectedUnits.size === 0) return;
    setProcessing(true);
    setLastScanResult(null);

    const success = await submitScan({
      scanType: "BULK_BIN",
      scanValue: unitPicker.scanValue,
      unitNumbers: [...selectedUnits].sort((a, b) => a - b),
    });

    if (success) {
      setUnitPicker(null);
      setSelectedUnits(new Set());
    }
    setProcessing(false);
  }

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
  const allComplete = progress?.allComplete ?? false;

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
    <div className="scan-page">
      {/* ══════ Sticky header with progress (booking modes) ══════ */}
      {mode !== "lookup" && scanStatus && (
        <div className="scan-sticky-header">
          <Link href={`/checkouts/${checkoutId}`} className="scan-header-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <div className="scan-header-info">
              <span className="scan-header-title">{scanStatus.title}</span>
              <span className="scan-header-meta">
                {scanStatus.requester.name} &middot; {scanStatus.location.name}
              </span>
            </div>
          </Link>
          <div className={`scan-mode-pill scan-mode-${mode}`}>
            <div className="scan-mode-dot" />
            {mode === "checkout" ? "Out" : "In"}
          </div>
        </div>
      )}

      {/* ══════ Lookup mode header ══════ */}
      {mode === "lookup" && (
        <div className="scan-lookup-header">
          <h1>Scan</h1>
          <div className="scan-mode-pill scan-mode-lookup">
            <div className="scan-mode-dot" />
            Look Up
          </div>
        </div>
      )}

      {/* ══════ Progress bar (booking modes) ══════ */}
      {mode !== "lookup" && scanStatus && totalItems > 0 && (
        <div className="scan-progress">
          <div className="scan-progress-text">
            <span className="scan-progress-count">{scannedItems}/{totalItems}</span>
            <span className="scan-progress-label">items scanned</span>
            <span className="scan-progress-pct">{progressPct}%</span>
          </div>
          <div className="scan-progress-bar">
            <div
              className={`scan-progress-fill ${allComplete ? "scan-progress-complete" : ""}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* ══════ Loading / error states ══════ */}
      {mode !== "lookup" && statusLoading && (
        <div className="scan-status-card">
          <div className="spinner" style={{ width: 20, height: 20 }} />
          <span>Loading checkout details...</span>
        </div>
      )}

      {mode !== "lookup" && loadError && (
        <div className="scan-status-card scan-status-error">
          Failed to load checkout details.{" "}
          <button className="btn btn-sm" onClick={loadScanStatus}>Retry</button>
        </div>
      )}

      {/* ══════ Camera + Manual entry ══════ */}
      <div className="scan-camera-section">
        {scanning ? (
          <div className="scan-camera-preview">
            <QrScanner
              onScan={handleScan}
              onError={setCameraError}
              active={scanning}
            />
            <button
              className="scan-camera-toggle"
              onClick={() => { setScanning(false); setCameraError(""); setLastScanResult(null); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M18.36 5.64l-12.72 12.72M5.64 5.64l12.72 12.72" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            className="scan-camera-start"
            onClick={() => { setScanning(true); setCameraError(""); setLastScanResult(null); }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
              <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
              <line x1="7" y1="12" x2="17" y2="12" />
              <line x1="12" y1="7" x2="12" y2="17" />
            </svg>
            <span>Tap to start camera</span>
          </button>
        )}

        {cameraError && (
          <div className="scan-camera-error">
            Camera error: {cameraError}
          </div>
        )}

        {/* Manual entry */}
        <div className="scan-manual-entry">
          <input
            ref={manualInputRef}
            type="text"
            placeholder={mode === "lookup" ? "Enter asset tag or QR code..." : "Enter item code..."}
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualEntry()}
            className="scan-manual-input"
          />
          <button
            className="btn btn-primary scan-manual-btn"
            onClick={handleManualEntry}
            disabled={!manualCode.trim() || processing}
          >
            {processing ? "..." : mode === "lookup" ? "Look up" : "Scan"}
          </button>
        </div>

        {/* Inline scan feedback */}
        {lastScanResult && (
          <div className={`scan-feedback ${lastScanResult.success ? "scan-feedback-success" : "scan-feedback-error"}`}>
            <span className="scan-feedback-icon">{lastScanResult.success ? "\u2713" : "\u2717"}</span>
            {lastScanResult.message}
          </div>
        )}
      </div>

      {/* ══════ Lookup mode hint ══════ */}
      {mode === "lookup" && !scanning && !lastScanResult && (
        <div className="scan-hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
            <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
            <line x1="7" y1="12" x2="17" y2="12" />
            <line x1="12" y1="7" x2="12" y2="17" />
          </svg>
          <span>Scan any item&apos;s QR code or enter its asset tag to view details.</span>
        </div>
      )}

      {/* ══════ Item checklist (booking modes) ══════ */}
      {mode !== "lookup" && scanStatus && (
        <div className="scan-checklist">
          <div className="scan-checklist-header">
            <h2>Items</h2>
            <span className="scan-checklist-count">{scannedItems}/{totalItems}</span>
          </div>

          {scanStatus.serializedItems.length === 0 && scanStatus.bulkItems.length === 0 ? (
            <div className="empty-state">No items to scan.</div>
          ) : (
            <div className="scan-checklist-items">
              {/* Unscanned first, then scanned */}
              {[...scanStatus.serializedItems]
                .sort((a, b) => (a.scanned === b.scanned ? 0 : a.scanned ? 1 : -1))
                .map((item) => (
                <div
                  key={item.assetId}
                  className={`scan-item ${item.scanned ? "scan-item-done" : ""}`}
                >
                  <div className={`scan-item-check ${item.scanned ? "scan-item-check-done" : ""}`}>
                    {item.scanned && "\u2713"}
                  </div>
                  <div className="scan-item-info">
                    <span className="scan-item-tag">{item.assetTag}</span>
                    <span className="scan-item-desc">{item.brand} {item.model}</span>
                  </div>
                  {item.scanned && (
                    <span className="scan-item-badge">Scanned</span>
                  )}
                </div>
              ))}

              {scanStatus.bulkItems.map((item) => {
                const done = item.scanned >= item.required;
                const allocated = item.allocatedUnits ?? [];
                return (
                  <div
                    key={item.bulkSkuId}
                    className={`scan-item ${done ? "scan-item-done" : ""}`}
                  >
                    <div className={`scan-item-check ${done ? "scan-item-check-done" : ""}`}>
                      {done && "\u2713"}
                    </div>
                    <div className="scan-item-info">
                      <span className="scan-item-tag">
                        {item.name}
                        {item.trackByNumber && (
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: "1px 5px",
                            borderRadius: 4, background: "#eff6ff", color: "#3b82f6",
                            marginLeft: 6,
                          }}>#</span>
                        )}
                      </span>
                      <span className="scan-item-desc">{item.scanned} / {item.required} scanned</span>
                    </div>

                    {/* Show allocated unit numbers */}
                    {item.trackByNumber && allocated.length > 0 && (
                      <div style={{
                        display: "flex", flexWrap: "wrap", gap: 4,
                        marginTop: 8, marginLeft: 40,
                      }}>
                        {allocated.map((u) => (
                          <span key={u.unitNumber} style={{
                            fontSize: 11, fontWeight: 600,
                            padding: "2px 6px", borderRadius: 4,
                            background: u.checkedIn ? "#dcfce7" : u.checkedOut ? "#dbeafe" : "#f3f4f6",
                            color: u.checkedIn ? "#166534" : u.checkedOut ? "#1e40af" : "#6b7280",
                          }}>
                            #{u.unitNumber}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════ Numbered bulk unit picker ══════ */}
      {unitPicker && (
        <>
          <div className="sheet-overlay" onClick={() => setUnitPicker(null)} />
          <div className="sheet-panel" style={{ maxWidth: 480 }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 0" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#d1d5db" }} />
            </div>

            <div className="sheet-header">
              <h2 style={{ margin: 0 }}>Select {unitPicker.name} units</h2>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                {mode === "checkout" ? "Which units are going out?" : "Which units came back?"}
              </div>
            </div>

            <div style={{ padding: "0 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {selectedUnits.size} of {unitPicker.availableUnits.length} selected
                </span>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    if (selectedUnits.size === unitPicker.availableUnits.length) {
                      setSelectedUnits(new Set());
                    } else {
                      setSelectedUnits(new Set(unitPicker.availableUnits));
                    }
                  }}
                >
                  {selectedUnits.size === unitPicker.availableUnits.length ? "Deselect all" : "Select all"}
                </button>
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))",
                gap: 6,
                maxHeight: 300,
                overflowY: "auto",
                paddingBottom: 8,
              }}>
                {unitPicker.availableUnits.map((num) => {
                  const selected = selectedUnits.has(num);
                  return (
                    <button
                      key={num}
                      onClick={() => {
                        const next = new Set(selectedUnits);
                        if (selected) next.delete(num); else next.add(num);
                        setSelectedUnits(next);
                      }}
                      style={{
                        padding: "8px 4px",
                        borderRadius: 8,
                        border: selected ? "2px solid #3b82f6" : "2px solid #e5e7eb",
                        background: selected ? "#dbeafe" : "white",
                        fontSize: 14, fontWeight: 600,
                        cursor: "pointer",
                        color: selected ? "#1e40af" : "var(--text)",
                        transition: "all 0.1s",
                      }}
                    >
                      #{num}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="sheet-actions" style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => setUnitPicker(null)} style={{ flex: 1, minHeight: 48 }}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleUnitPickerSubmit}
                disabled={selectedUnits.size === 0 || processing}
                style={{ flex: 1, minHeight: 48 }}
              >
                {processing ? "Scanning..." : `Scan ${selectedUnits.size} unit${selectedUnits.size !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══════ Sticky bottom bar (booking modes) ══════ */}
      {mode !== "lookup" && scanStatus && (
        <div className="scan-bottom-bar">
          <button
            className={`btn ${allComplete ? "btn-primary" : ""} scan-complete-btn`}
            onClick={handleComplete}
            disabled={!allComplete || completing}
          >
            {completing
              ? "Completing..."
              : allComplete
                ? mode === "checkout" ? "Complete Checkout" : "Complete Check-in"
                : `${totalItems - scannedItems} item${totalItems - scannedItems !== 1 ? "s" : ""} remaining`
            }
          </button>
        </div>
      )}

      {/* ══════ Celebration overlay ══════ */}
      {showCelebration && (
        <div className="scan-celebration">
          <div className="scan-celebration-card">
            <div className="scan-celebration-icon">{"\u2705"}</div>
            <div className="scan-celebration-title">All items scanned!</div>
            <div className="scan-celebration-desc">
              Tap the button below to {mode === "checkin" ? "complete check-in" : "complete checkout"}
            </div>
          </div>
        </div>
      )}

      {/* ══════ Item preview bottom sheet (lookup mode) ══════ */}
      {itemPreview && (
        <>
          <div className="sheet-overlay" onClick={() => setItemPreview(null)} />
          <div className="sheet-panel" style={{ maxWidth: 480 }}>
            {/* Drag handle */}
            <div className="scan-sheet-handle">
              <div className="scan-sheet-handle-bar" />
            </div>

            <div className="sheet-header scan-sheet-header">
              <div>
                <h2 style={{ margin: 0 }}>{itemPreview.assetTag}</h2>
                <div className="scan-sheet-subtitle">
                  {itemPreview.brand} {itemPreview.model}
                </div>
              </div>
              <span
                className="scan-status-badge"
                style={{
                  background: statusColor(itemPreview.computedStatus).bg,
                  color: statusColor(itemPreview.computedStatus).text,
                }}
              >
                {statusLabel(itemPreview.computedStatus)}
              </span>
            </div>

            <div className="sheet-section scan-sheet-details">
              {itemPreview.serialNumber && (
                <div className="scan-sheet-row">
                  <span className="scan-sheet-label">Serial</span>
                  <span className="scan-sheet-value font-mono">{itemPreview.serialNumber}</span>
                </div>
              )}
              {itemPreview.location && (
                <div className="scan-sheet-row">
                  <span className="scan-sheet-label">Location</span>
                  <span className="scan-sheet-value">{itemPreview.location.name}</span>
                </div>
              )}
              {itemPreview.category && (
                <div className="scan-sheet-row">
                  <span className="scan-sheet-label">Category</span>
                  <span className="scan-sheet-value">{itemPreview.category.name}</span>
                </div>
              )}
            </div>

            {/* Parent asset banner */}
            {itemPreview.parentAsset && (
              <div className="scan-sheet-booking" style={{ background: "var(--bg-muted)", color: "var(--text-primary)" }}>
                <div className="scan-sheet-booking-label">Accessory of</div>
                <Link href={`/items/${itemPreview.parentAsset.id}`} className="scan-sheet-booking-name font-medium" style={{ color: "var(--primary)" }}>
                  {itemPreview.parentAsset.assetTag}
                </Link>
                <div className="scan-sheet-booking-title">
                  {itemPreview.parentAsset.brand} {itemPreview.parentAsset.model}
                </div>
              </div>
            )}

            {/* Current holder / active booking */}
            {itemPreview.activeBooking && (
              <div
                className="scan-sheet-booking"
                style={{
                  background: statusColor(itemPreview.computedStatus).bg,
                  color: statusColor(itemPreview.computedStatus).text,
                }}
              >
                <div className="scan-sheet-booking-label">
                  {itemPreview.activeBooking.kind === "CHECKOUT" ? "Currently with" : "Reserved by"}
                </div>
                <div className="scan-sheet-booking-name">
                  {itemPreview.activeBooking.requesterName}
                </div>
                <div className="scan-sheet-booking-title">
                  {itemPreview.activeBooking.title}
                </div>
                <div className="scan-sheet-booking-dates">
                  {new Date(itemPreview.activeBooking.startsAt).toLocaleDateString()} &ndash; {new Date(itemPreview.activeBooking.endsAt).toLocaleDateString()}
                </div>
              </div>
            )}

            <div className="sheet-actions scan-sheet-actions">
              <button
                className="btn scan-sheet-btn"
                onClick={() => setItemPreview(null)}
              >
                Dismiss
              </button>
              <Link
                href={`/items/${itemPreview.id}`}
                className="btn btn-primary scan-sheet-btn"
              >
                View Details
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
