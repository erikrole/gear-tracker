"use client";

import { useEffect, useState } from "react";

type Asset = {
  id: string;
  assetTag: string;
  brand: string;
  model: string;
  qrCodeValue: string;
  primaryScanCode?: string;
  serialNumber: string;
  location: { name: string };
};

export default function LabelsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const params = new URLSearchParams({ limit: "200" });
    if (search) params.set("q", search);

    fetch(`/api/assets?${params}`)
      .then((res) => res.ok ? res.json() : null)
      .then((json) => setAssets(json?.data ?? []))
      .finally(() => setLoading(false));
  }, [search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(assets.map((a) => a.id)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const selectedAssets = assets.filter((a) => selectedIds.has(a.id));

  return (
    <>
      <div className="page-header no-print">
        <h1>Print Labels</h1>
        <button className="btn btn-primary" onClick={() => window.print()} disabled={selectedAssets.length === 0}>
          Print {selectedAssets.length > 0 ? `${selectedAssets.length} labels` : "labels"}
        </button>
      </div>

      {/* Selection UI (hidden when printing) */}
      <div className="card no-print" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ gap: 12 }}>
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              padding: "7px 12px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: 13
            }}
          />
          <button className="btn btn-sm" onClick={selectAll}>Select all</button>
          <button className="btn btn-sm" onClick={selectNone}>Clear</button>
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : (
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {assets.map((asset) => (
              <label
                key={asset.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 16px",
                  cursor: "pointer",
                  borderBottom: "1px solid var(--border)",
                  background: selectedIds.has(asset.id) ? "#f0fdf4" : "white"
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(asset.id)}
                  onChange={() => toggleSelect(asset.id)}
                  style={{ width: 18, height: 18 }}
                />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600 }}>{asset.assetTag}</span>
                  <span style={{ color: "var(--text-secondary)", fontSize: 12, marginLeft: 8 }}>
                    {asset.brand} {asset.model}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{asset.location.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Label grid (visible when printing) */}
      {selectedAssets.length > 0 && (
        <div className="label-grid">
          {selectedAssets.map((asset) => (
            <div key={asset.id} className="label-card">
              <div className="label-qr">
                {/* Simple QR placeholder - in production, use a QR rendering library */}
                <div style={{
                  width: 80,
                  height: 80,
                  border: "2px solid #000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 8,
                  fontFamily: "monospace",
                  textAlign: "center",
                  padding: 4,
                  wordBreak: "break-all"
                }}>
                  {asset.qrCodeValue}
                </div>
              </div>
              <div className="label-info">
                <div className="label-tag">{asset.assetTag}</div>
                <div className="label-detail">{asset.brand} {asset.model}</div>
                {asset.primaryScanCode && (
                  <div className="label-barcode">{asset.primaryScanCode}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .label-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          padding: 12px;
        }
        .label-card {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 12px;
          display: flex;
          gap: 10px;
          align-items: center;
          page-break-inside: avoid;
        }
        .label-info {
          flex: 1;
          min-width: 0;
        }
        .label-tag {
          font-weight: 700;
          font-size: 14px;
          margin-bottom: 2px;
        }
        .label-detail {
          font-size: 11px;
          color: #666;
        }
        .label-barcode {
          font-family: monospace;
          font-size: 10px;
          color: #888;
          margin-top: 2px;
        }

        @media print {
          .no-print { display: none !important; }
          .label-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            padding: 0;
          }
          .label-card {
            border: 1px solid #000;
            border-radius: 0;
            padding: 8px;
          }
          body { margin: 0; padding: 8px; }
        }

        @media (max-width: 768px) {
          .label-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </>
  );
}
