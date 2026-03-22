"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

function LabelQRCode({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!value || !canvasRef.current) return;
    setLoaded(false);
    import("qrcode").then((QRCode) => {
      if (!canvasRef.current) return;
      QRCode.toCanvas(canvasRef.current, value, { width: 80, margin: 1 }, () => {
        setLoaded(true);
      });
    });
  }, [value]);

  return <canvas ref={canvasRef} style={{ width: 80, height: 80, opacity: loaded ? 1 : 0.3 }} />;
}

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
        <Button onClick={() => window.print()} disabled={selectedAssets.length === 0}>
          Print {selectedAssets.length > 0 ? `${selectedAssets.length} labels` : "labels"}
        </Button>
      </div>

      {/* Selection UI (hidden when printing) */}
      <Card className="no-print mb-1">
        <CardHeader className="gap-3">
          <Input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Button variant="outline" size="sm" onClick={selectAll}>Select all</Button>
          <Button variant="outline" size="sm" onClick={selectNone}>Clear</Button>
        </CardHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10"><Spinner className="size-8" /></div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            {assets.map((asset) => (
              <label
                key={asset.id}
                className={`flex items-center gap-2.5 px-4 py-2 cursor-pointer border-b border-border ${selectedIds.has(asset.id) ? "bg-green-50" : "bg-white"}`}
              >
                <Checkbox
                  checked={selectedIds.has(asset.id)}
                  onCheckedChange={() => toggleSelect(asset.id)}
                  className="size-[18px]"
                />
                <div className="flex-1">
                  <span className="font-semibold">{asset.assetTag}</span>
                  <span className="text-secondary text-xs ml-2">
                    {asset.brand} {asset.model}
                  </span>
                </div>
                <span className="text-xs text-secondary">{asset.location.name}</span>
              </label>
            ))}
          </div>
        )}
      </Card>

      {/* Label grid (visible when printing) */}
      {selectedAssets.length > 0 && (
        <div className="label-grid">
          {selectedAssets.map((asset) => (
            <div key={asset.id} className="label-card">
              <div className="label-qr">
                <LabelQRCode value={asset.qrCodeValue} />
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
