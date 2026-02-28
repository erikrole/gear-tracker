"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues with html5-qrcode
const QrScanner = dynamic(() => import("@/components/QrScanner"), { ssr: false });

type ScanMode = "checkout" | "checkin";

type ScannedItem = {
  scanValue: string;
  assetTag?: string;
  brand?: string;
  model?: string;
  type?: string;
  assetId?: string;
  status: "found" | "not_found" | "already_scanned" | "error";
  message?: string;
};

type LookupResult = {
  id: string;
  assetTag: string;
  brand: string;
  model: string;
  type: string;
  computedStatus: string;
  location: { name: string };
};

type OpenCheckout = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  requester: { name: string };
  serializedItems: Array<{ asset: { id: string; assetTag: string; brand: string; model: string } }>;
};

export default function ScanPage() {
  const [mode, setMode] = useState<ScanMode>("checkout");
  const [scanning, setScanning] = useState(false);
  const [cart, setCart] = useState<ScannedItem[]>([]);
  const [cameraError, setCameraError] = useState("");
  const [manualCode, setManualCode] = useState("");

  // Check-in state
  const [foundCheckout, setFoundCheckout] = useState<OpenCheckout | null>(null);
  const [checkinMessage, setCheckinMessage] = useState("");

  const lookupAsset = useCallback(async (scanValue: string): Promise<LookupResult | null> => {
    try {
      // Try QR code, primary scan code, or asset tag
      const res = await fetch(`/api/assets?q=${encodeURIComponent(scanValue)}&limit=1`);
      const json = await res.json();
      const assets = json.data ?? [];
      if (assets.length > 0) return assets[0];

      // Also try by exact qrCodeValue match
      // The search endpoint checks assetTag, brand, model, serialNumber
      // For QR codes like "bg://item/..." we need to search differently
      return null;
    } catch {
      return null;
    }
  }, []);

  const handleScan = useCallback(
    async (value: string) => {
      if (mode === "checkout") {
        // Check if already in cart
        if (cart.some((item) => item.scanValue === value)) {
          setCart((prev) => [
            { scanValue: value, status: "already_scanned", message: "Already in cart" },
            ...prev.filter((item) => item.scanValue !== value || item.status !== "already_scanned")
          ]);
          return;
        }

        const asset = await lookupAsset(value);
        if (asset) {
          setCart((prev) => [
            {
              scanValue: value,
              assetTag: asset.assetTag,
              brand: asset.brand,
              model: asset.model,
              type: asset.type,
              assetId: asset.id,
              status: "found"
            },
            ...prev
          ]);
        } else {
          setCart((prev) => [
            { scanValue: value, status: "not_found", message: "Item not found" },
            ...prev
          ]);
        }
      } else {
        // Check-in mode: scan to find the open checkout containing this item
        try {
          const asset = await lookupAsset(value);
          if (!asset) {
            setCheckinMessage(`Item not found for code: ${value}`);
            return;
          }

          // Find open checkouts containing this asset
          const res = await fetch(`/api/checkouts?status=OPEN&limit=50`);
          const json = await res.json();
          const checkouts = json.data ?? [];

          const match = checkouts.find((c: OpenCheckout) =>
            c.serializedItems?.some((si) => si.asset.id === asset.id)
          );

          if (match) {
            setFoundCheckout(match);
            setCheckinMessage(`Found open checkout: ${match.title}`);
          } else {
            setCheckinMessage(`No open checkout found containing ${asset.assetTag}`);
          }
        } catch {
          setCheckinMessage("Error looking up checkout");
        }
      }
    },
    [mode, cart, lookupAsset]
  );

  const handleManualEntry = () => {
    if (manualCode.trim()) {
      handleScan(manualCode.trim());
      setManualCode("");
    }
  };

  const removeFromCart = (scanValue: string) => {
    setCart((prev) => prev.filter((item) => item.scanValue !== scanValue));
  };

  const clearCart = () => {
    setCart([]);
  };

  const validItems = cart.filter((item) => item.status === "found");

  return (
    <>
      <div className="page-header">
        <h1>Scan</h1>
      </div>

      {/* Mode toggle */}
      <div style={{
        display: "flex",
        gap: 4,
        padding: 4,
        background: "var(--bg-secondary, #f3f4f6)",
        borderRadius: 12,
        marginBottom: 16,
        maxWidth: 320
      }}>
        <button
          onClick={() => { setMode("checkout"); setFoundCheckout(null); setCheckinMessage(""); }}
          style={{
            flex: 1,
            padding: "10px 16px",
            borderRadius: 10,
            border: "none",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            background: mode === "checkout" ? "white" : "transparent",
            color: mode === "checkout" ? "var(--text)" : "var(--text-secondary)",
            boxShadow: mode === "checkout" ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
          }}
        >
          Quick Checkout
        </button>
        <button
          onClick={() => { setMode("checkin"); clearCart(); }}
          style={{
            flex: 1,
            padding: "10px 16px",
            borderRadius: 10,
            border: "none",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            background: mode === "checkin" ? "white" : "transparent",
            color: mode === "checkin" ? "var(--text)" : "var(--text-secondary)",
            boxShadow: mode === "checkin" ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
          }}
        >
          Quick Check-in
        </button>
      </div>

      {/* Scanner */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h2>{scanning ? "Scanning..." : "Camera"}</h2>
          <button
            className={`btn ${scanning ? "" : "btn-primary"}`}
            onClick={() => { setScanning(!scanning); setCameraError(""); }}
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
            Camera error: {cameraError}
          </div>
        )}

        {/* Manual entry fallback */}
        <div style={{ padding: 16, display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="Or enter code manually..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualEntry()}
            style={{
              flex: 1,
              padding: "10px 14px",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 15
            }}
          />
          <button
            className="btn btn-primary"
            onClick={handleManualEntry}
            disabled={!manualCode.trim()}
            style={{ minWidth: 80, minHeight: 44 }}
          >
            Add
          </button>
        </div>
      </div>

      {/* ── Checkout mode: Cart ── */}
      {mode === "checkout" && (
        <>
          {cart.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <h2>Cart ({validItems.length} items)</h2>
                <button className="btn btn-sm" onClick={clearCart}>Clear all</button>
              </div>

              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                {cart.map((item, i) => (
                  <div
                    key={`${item.scanValue}-${i}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--border)",
                      background: item.status === "not_found" ? "#fef2f2" :
                                  item.status === "already_scanned" ? "#fffbeb" : "white"
                    }}
                  >
                    {/* Status dot */}
                    <div style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: item.status === "found" ? "#22c55e" :
                                  item.status === "already_scanned" ? "#f59e0b" : "#ef4444"
                    }} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {item.status === "found" ? (
                        <>
                          <div style={{ fontWeight: 600 }}>{item.assetTag}</div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                            {item.brand} {item.model} — {item.type}
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontWeight: 600, fontFamily: "monospace", fontSize: 13 }}>
                            {item.scanValue}
                          </div>
                          <div style={{ fontSize: 12, color: item.status === "not_found" ? "#991b1b" : "#92400e" }}>
                            {item.message}
                          </div>
                        </>
                      )}
                    </div>

                    <button
                      onClick={() => removeFromCart(item.scanValue)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 4,
                        color: "var(--text-secondary)",
                        fontSize: 18,
                        lineHeight: 1
                      }}
                      aria-label="Remove"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Checkout action */}
          {validItems.length > 0 && (
            <div style={{
              position: "sticky",
              bottom: 16,
              padding: 16,
              background: "white",
              borderRadius: 16,
              boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{validItems.length} items ready</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  Continue to create checkout
                </div>
              </div>
              <a
                href={`/checkouts?prefill=${validItems.map((i) => i.assetId).join(",")}`}
                className="btn btn-primary"
                style={{
                  textDecoration: "none",
                  padding: "14px 24px",
                  fontSize: 16,
                  minHeight: 48,
                  display: "flex",
                  alignItems: "center"
                }}
              >
                Checkout
              </a>
            </div>
          )}
        </>
      )}

      {/* ── Check-in mode ── */}
      {mode === "checkin" && (
        <>
          {checkinMessage && (
            <div
              className="card"
              style={{
                padding: 16,
                marginBottom: 16,
                background: foundCheckout ? "#f0fdf4" : "#fef2f2"
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{checkinMessage}</div>
            </div>
          )}

          {foundCheckout && (
            <div className="card">
              <div className="card-header"><h2>Open Checkout</h2></div>
              <div style={{ padding: 16 }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{foundCheckout.title}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {foundCheckout.requester.name} — Due {new Date(foundCheckout.endsAt).toLocaleDateString()}
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                    Items ({foundCheckout.serializedItems.length})
                  </div>
                  {foundCheckout.serializedItems.map((si) => (
                    <div key={si.asset.id} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border)"
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
                      <span style={{ fontWeight: 600 }}>{si.asset.assetTag}</span>
                      <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                        {si.asset.brand} {si.asset.model}
                      </span>
                    </div>
                  ))}
                </div>

                <a
                  href={`/checkouts/${foundCheckout.id}`}
                  className="btn btn-primary"
                  style={{
                    width: "100%",
                    textAlign: "center",
                    textDecoration: "none",
                    padding: "14px 24px",
                    fontSize: 16,
                    display: "block",
                    minHeight: 48,
                    lineHeight: "20px"
                  }}
                >
                  Go to check-in
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
