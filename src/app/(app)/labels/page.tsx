"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ExternalLink, PackageSearch, Printer, Search, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { useFetch } from "@/hooks/use-fetch";
import { useDebounce } from "@/hooks/use-url-state";
import { FadeUp } from "@/components/ui/motion";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { cn } from "@/lib/utils";

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
  name?: string | null;
  type?: string | null;
  brand: string;
  model: string;
  qrCodeValue: string;
  primaryScanCode?: string;
  serialNumber: string;
  location: { name: string };
};

function assetSubtitle(asset: Asset) {
  const seen = new Set([asset.assetTag.trim().toLowerCase()]);
  return [asset.name, `${asset.brand} ${asset.model}`.trim()]
    .map((part) => part?.trim())
    .filter((part): part is string => {
      if (!part) return false;
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(" · ");
}

function LabelMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "green" | "muted";
}) {
  const toneClass =
    tone === "green"
      ? "bg-green-50/70 dark:bg-green-950/20"
      : tone === "muted"
        ? "bg-muted/50"
        : "bg-background";

  return (
    <div className={cn("rounded-sm px-3 py-2 shadow-xs", toneClass)}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold leading-none tabular-nums">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function labelCount(count: number) {
  return `${count} ${count === 1 ? "label" : "labels"}`;
}

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
  const matchingCount = assets?.length ?? 0;
  const hasSearch = debouncedSearch.trim().length > 0;
  const allVisibleSelected =
    matchingCount > 0 && assets?.every((asset) => selectedIds.has(asset.id));

  return (
    <FadeUp>
      <PageHeader
        title="Print Labels"
        description="Build a focused queue of asset tags and QR labels before sending them to browser print."
        className="no-print"
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/items">
            <PackageSearch className="mr-1.5 size-4" />
            Items
          </Link>
        </Button>
        <Button
          onClick={() => window.print()}
          disabled={selectedAssets.length === 0}
          size="sm"
        >
          <Printer className="mr-1.5 size-4" />
          {selectedAssets.length > 0
            ? `Print ${labelCount(selectedAssets.length)}`
            : "Print labels"}
        </Button>
      </PageHeader>

      <div className="no-print mb-4 grid gap-2 rounded-md border border-border/60 bg-muted/20 p-2 sm:grid-cols-3">
        <LabelMetric label="Matching items" value={matchingCount} />
        <LabelMetric label="Selected" value={selectedAssets.length} tone="green" />
        <LabelMetric
          label="Ready to print"
          value={selectedAssets.filter((asset) => asset.qrCodeValue).length}
          tone="muted"
        />
      </div>

      <Card className="no-print mb-4 overflow-hidden" elevation="flat">
        <CardHeader className="gap-3 border-b border-border/70">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="labels-search"
                name="labels-search"
                type="text"
                placeholder="Search by tag, model, serial, QR, category, location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 pl-9 pr-9"
              />
              {search && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="tabular-nums">
                {selectedAssets.length} selected
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                disabled={matchingCount === 0 || allVisibleSelected}
              >
                Select visible
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectNone}
                disabled={selectedAssets.length === 0}
              >
                Clear queue
              </Button>
            </div>
          </div>
        </CardHeader>

        {loading ? (
          <CardContent className="p-0">
            <div className="space-y-1 p-3">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-md px-2 py-3">
                  <Skeleton className="size-5 rounded" />
                  <Skeleton className="size-9 rounded-sm" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-72 max-w-full" />
                  </div>
                  <Skeleton className="h-7 w-20 rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        ) : matchingCount === 0 ? (
          <EmptyState
            icon={hasSearch ? "search" : "box"}
            title={hasSearch ? "No matching labels" : "No labels available"}
            description={
              hasSearch
                ? "Clear the search or try another asset tag, model, serial, or location."
                : "Add serialized items before printing asset labels."
            }
            actionLabel={hasSearch ? "Clear search" : undefined}
            onAction={hasSearch ? () => setSearch("") : undefined}
            compact
          />
        ) : (
          <ItemGroup className="max-h-[380px] overflow-y-auto p-2">
            {(assets ?? []).map((asset) => (
              <Item
                key={asset.id}
                size="sm"
                className={cn(
                  "border border-transparent transition-colors",
                  selectedIds.has(asset.id)
                    ? "border-green-200 bg-[var(--green-bg)] dark:border-green-900/60"
                    : "hover:bg-muted/50",
                )}
              >
                <Checkbox
                  checked={selectedIds.has(asset.id)}
                  onCheckedChange={() => toggleSelect(asset.id)}
                  aria-label={`Select ${asset.assetTag}`}
                />
                <ItemMedia variant="icon" className="bg-background">
                  {selectedIds.has(asset.id) ? (
                    <CheckCircle2 className="size-4 text-[var(--green-text)]" />
                  ) : (
                    <Printer className="size-4 text-muted-foreground" />
                  )}
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle className="w-full min-w-0 justify-between">
                    <span className="truncate">{asset.assetTag}</span>
                    <Badge variant="outline" className="hidden tabular-nums sm:inline-flex">
                      {asset.location.name}
                    </Badge>
                  </ItemTitle>
                  <ItemDescription className="truncate">
                    {assetSubtitle(asset) || "No secondary identity"}
                    {asset.primaryScanCode && (
                      <span className="ml-2 font-mono text-[11px]">
                        · {asset.primaryScanCode}
                      </span>
                    )}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    asChild
                  >
                    <Link href={`/items/${asset.id}`} aria-label={`Open ${asset.assetTag}`}>
                      <ExternalLink className="size-4" />
                    </Link>
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
      </Card>

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
                  {assetSubtitle(asset) || `${asset.brand} ${asset.model}`}
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
