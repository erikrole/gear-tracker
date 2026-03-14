"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useToast } from "@/components/Toast";

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
  qrCodeValue?: string;
  primaryScanCode?: string;
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
  const { toast } = useToast();
  const [mode, setMode] = useState<ScanMode>("checkout");
  const [scanning, setScanning] = useState(false);
  const [cart, setCart] = useState<ScannedItem[]>([]);
  const [cameraError, setCameraError] = useState("");
  const [manualCode, setManualCode] = useState("");

  // Check in state
  const [foundCheckout, setFoundCheckout] = useState<OpenCheckout | null>(null);
  const [checkinMessage, setCheckinMessage] = useState("");

  const lookupAsset = useCallback(async (scanValue: string): Promise<LookupResult | null> => {
    try {
      // Parse bg://item/<assetTag> or bg://case/<name> URLs
      let searchTerm = scanValue;
      const bgMatch = scanValue.match(/^bg:\/\/(item|case)\/(.+)$/);
      if (bgMatch) {
        searchTerm = bgMatch[2];
      }

      // Search by asset tag, serial, brand/model, or primary scan code
      const res = await fetch(`/api/assets?q=${encodeURIComponent(searchTerm)}&limit=5`);
      if (!res.ok) return null;
      const json = await res.json();
      const assets = json.data ?? [];

      // Exact match on qrCodeValue or primaryScanCode first
      const exactMatch = assets.find(
        (a: LookupResult) =>
          a.qrCodeValue === scanValue ||
          a.primaryScanCode === scanValue ||
          a.assetTag === searchTerm
      );
      if (exactMatch) return exactMatch;

      // Fall back to first search result
      if (assets.length > 0) return assets[0];

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
          toast(`Added ${asset.assetTag}`, "success");
        } else {
          setCart((prev) => [
            { scanValue: value, status: "not_found", message: "Item not found" },
            ...prev
          ]);
          toast(`Item not found: ${value}`, "error");
        }
      } else {
        // Check in mode: scan to find the open checkout containing this item
        try {
          const asset = await lookupAsset(value);
          if (!asset) {
            setCheckinMessage(`Item not found for code: ${value}`);
            return;
          }

          // Find open checkouts containing this asset
          const res = await fetch(`/api/checkouts?status=OPEN&limit=50`);
          if (!res.ok) { setCheckinMessage("Failed to load checkouts"); return; }
          const json = await res.json();
          const checkouts = json.data ?? [];

          const match = checkouts.find((c: OpenCheckout) =>
            c.serializedItems?.some((si) => si.asset.id === asset.id)
          );

          if (match) {
            setFoundCheckout(match);
            setCheckinMessage(`Found open checkout: ${match.title}`);
            toast(`Found checkout: ${match.title}`, "success");
          } else {
            setCheckinMessage(`No open checkout found containing ${asset.assetTag}`);
            toast("No open checkout found for this item", "info");
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
      <div className="seg-toggle mb-12">
        <button
          className={`seg-toggle-btn${mode === "checkout" ? " active" : ""}`}
          onClick={() => { setMode("checkout"); setFoundCheckout(null); setCheckinMessage(""); }}
        >
          Quick Checkout
        </button>
        <button
          className={`seg-toggle-btn${mode === "checkin" ? " active" : ""}`}
          onClick={() => { setMode("checkin"); clearCart(); }}
        >
          Quick Check in
        </button>
      </div>

      {/* Scanner */}
      <div className="card mb-12">
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
          <div className="p-16">
            <QrScanner
              onScan={handleScan}
              onError={setCameraError}
              active={scanning}
            />
          </div>
        )}

        {cameraError && (
          <div className="form-error px-16 mb-12">Camera error: {cameraError}</div>
        )}

        {/* Manual entry fallback */}
        <div className="flex gap-8 p-16">
          <input
            type="text"
            placeholder="Or enter code manually..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualEntry()}
            className="form-input"
          />
          <button
            className="btn btn-primary"
            onClick={handleManualEntry}
            disabled={!manualCode.trim()}
          >
            Add
          </button>
        </div>
      </div>

      {/* ── Checkout mode: Cart ── */}
      {mode === "checkout" && (
        <>
          {cart.length > 0 && (
            <div className="card mb-12">
              <div className="card-header">
                <h2>Cart ({validItems.length} items)</h2>
                <button className="btn btn-sm" onClick={clearCart}>Clear all</button>
              </div>

              <div className="cart-scroll">
                {cart.map((item, i) => (
                  <div
                    key={`${item.scanValue}-${i}`}
                    className={`cart-item${item.status === "not_found" ? " cart-item-error" : item.status === "already_scanned" ? " cart-item-warn" : ""}`}
                  >
                    <div className={`status-dot ${item.status === "found" ? "status-dot-green" : item.status === "already_scanned" ? "status-dot-orange" : "status-dot-red"}`} />

                    <div className="cart-item-content">
                      {item.status === "found" ? (
                        <>
                          <div className="cart-item-title">{item.assetTag}</div>
                          <div className="cart-item-meta">
                            {item.brand} {item.model} — {item.type}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="cart-item-title" style={{ fontFamily: "monospace", fontSize: 13 }}>
                            {item.scanValue}
                          </div>
                          <div className={`cart-item-meta ${item.status === "not_found" ? "text-red" : "text-orange"}`}>
                            {item.message}
                          </div>
                        </>
                      )}
                    </div>

                    <button className="remove-btn" onClick={() => removeFromCart(item.scanValue)} aria-label="Remove">
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Checkout action */}
          {validItems.length > 0 && (
            <div className="sticky-action-bar">
              <div>
                <div className="sticky-action-title">{validItems.length} items ready</div>
                <div className="sticky-action-sub">Continue to create checkout</div>
              </div>
              <a
                href={`/checkouts?prefill=${validItems.map((i) => i.assetId).join(",")}`}
                className="btn btn-primary"
              >
                Checkout
              </a>
            </div>
          )}
        </>
      )}

      {/* ── Check in mode ── */}
      {mode === "checkin" && (
        <>
          {checkinMessage && (
            <div className={`card form-message ${foundCheckout ? "form-message-success" : "form-message-error"}`}>
              <strong>{checkinMessage}</strong>
            </div>
          )}

          {foundCheckout && (
            <div className="card">
              <div className="card-header"><h2>Open Checkout</h2></div>
              <div className="p-16">
                <div className="mb-12">
                  <div className="sticky-action-title">{foundCheckout.title}</div>
                  <div className="cart-item-meta">
                    {foundCheckout.requester.name} — Due {new Date(foundCheckout.endsAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="mb-12">
                  <div className="cart-item-title mb-8">
                    Items ({foundCheckout.serializedItems.length})
                  </div>
                  {foundCheckout.serializedItems.map((si) => (
                    <div key={si.asset.id} className="cart-item">
                      <div className="status-dot status-dot-green" />
                      <span className="cart-item-title">{si.asset.assetTag}</span>
                      <span className="cart-item-meta">
                        {si.asset.brand} {si.asset.model}
                      </span>
                    </div>
                  ))}
                </div>

                <a
                  href={`/checkouts/${foundCheckout.id}`}
                  className="btn btn-primary"
                  style={{ width: "100%", textAlign: "center" }}
                >
                  Go to check in
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
