"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/PageHeader";
import { useFetch } from "@/hooks/use-fetch";
import { useDebounce } from "@/hooks/use-url-state";
import { FadeUp } from "@/components/ui/motion";

function LabelQRCode({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!value || !canvasRef.current) return;
    setLoaded(false);
    import("qrcode").then((QRCode) => {
      if (!canvasRef.current) return;
      QRCode.toCanvas(
        canvasRef.current,
        value,
        { width: 80, margin: 1 },
        () => {
          setLoaded(true);
        },
      );
    });
  }, [value]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: 80, height: 80, opacity: loaded ? 1 : 0.3 }}
    />
  );
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
  const searchParams = useSearchParams();
  const preselectedItems = searchParams.get("items");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [didPreselect, setDidPreselect] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  // Build fetch URL from search state
  const fetchUrl = (() => {
    const params = new URLSearchParams({ limit: "200" });
    if (debouncedSearch) params.set("q", debouncedSearch);
    return `/api/assets?${params}`;
  })();

  const { data: assets, loading } = useFetch<Asset[]>({
    url: fetchUrl,
    transform: (json) => (json.data as Asset[]) ?? [],
  });

  // Auto-select items from URL param on first load
  useEffect(() => {
    if (!didPreselect && preselectedItems && assets && assets.length > 0) {
      const ids = new Set(preselectedItems.split(","));
      const matching = new Set(
        assets.filter((a) => ids.has(a.id)).map((a) => a.id),
      );
      if (matching.size > 0) setSelectedIds(matching);
      setDidPreselect(true);
    }
  }, [didPreselect, preselectedItems, assets]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (assets) setSelectedIds(new Set(assets.map((a) => a.id)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const selectedAssets = (assets ?? []).filter((a) => selectedIds.has(a.id));

  return (
    <FadeUp>
      <PageHeader title="Print Labels" className="no-print">
        <Button
          onClick={() => window.print()}
          disabled={selectedAssets.length === 0}
        >
          Print{" "}
          {selectedAssets.length > 0
            ? `${selectedAssets.length} labels`
            : "labels"}
        </Button>
      </PageHeader>

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
          <Button variant="outline" size="sm" onClick={selectAll}>
            Select all
          </Button>
          <Button variant="outline" size="sm" onClick={selectNone}>
            Clear
          </Button>
        </CardHeader>

        {loading ? (
          <div className="px-4 py-4">
            <div className="space-y-2">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <Skeleton className="size-5 rounded" />
                  <Skeleton className="h-4" style={{ width: `${50 + (i % 3) * 15}%` }} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            {(assets ?? []).map((asset) => (
              <label
                key={asset.id}
                className={`flex items-center gap-2.5 px-4 py-2 cursor-pointer border-b border-border transition-colors ${selectedIds.has(asset.id) ? "bg-[var(--green-bg)]" : "hover:bg-muted/50"}`}
              >
                <Checkbox
                  checked={selectedIds.has(asset.id)}
                  onCheckedChange={() => toggleSelect(asset.id)}
                />
                <div className="flex-1">
                  <span className="font-semibold">{asset.assetTag}</span>
                  <span className="text-muted-foreground text-xs ml-2">
                    {asset.brand} {asset.model}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {asset.location.name}
                </span>
              </label>
            ))}
          </div>
        )}
      </Card>

      {/* Label grid (visible when printing) */}
      {selectedAssets.length > 0 && (
        <div className="label-print-grid">
          {selectedAssets.map((asset) => (
            <div key={asset.id} className="label-print-card">
              <div className="shrink-0">
                <LabelQRCode value={asset.qrCodeValue} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm mb-0.5">{asset.assetTag}</div>
                <div className="text-[11px] text-muted-foreground">
                  {asset.brand} {asset.model}
                </div>
                {asset.primaryScanCode && (
                  <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{asset.primaryScanCode}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </FadeUp>
  );
}
