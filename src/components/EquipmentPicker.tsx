"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePickerSearch } from "@/components/equipment-picker/use-picker-search";
import {
  EQUIPMENT_SECTIONS,
  classifyAssetType,
  groupBulkBySection,
  type EquipmentSectionKey,
} from "@/lib/equipment-sections";
import { getActiveGuidance, type GuidanceContext } from "@/lib/equipment-guidance";
import { CheckCircle2Icon, CircleIcon, SearchIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AssetImage } from "@/components/AssetImage";

/* ───── Types ───── */

export type PickerAsset = {
  id: string;
  assetTag: string;
  name: string;
  brand: string;
  model: string;
  serialNumber: string;
  type: string;
  computedStatus: string;
  qrCodeValue?: string | null;
  primaryScanCode?: string | null;
  categoryName?: string | null;
  imageUrl?: string | null;
  location: { id: string; name: string } | null;
};

export type PickerBulkSku = {
  id: string;
  name: string;
  unit: string;
  category: string;
  currentQuantity: number;
  binQrCodeValue?: string | null;
  categoryName?: string | null;
  imageUrl?: string | null;
};

export type BulkSelection = {
  bulkSkuId: string;
  quantity: number;
};

export type EquipmentPickerProps = {
  /** @deprecated Pass assets to use legacy mode. Search mode (omit assets) is preferred. */
  assets?: PickerAsset[];
  bulkSkus: PickerBulkSku[];
  selectedAssetIds: string[];
  setSelectedAssetIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedBulkItems: BulkSelection[];
  setSelectedBulkItems: React.Dispatch<React.SetStateAction<BulkSelection[]>>;
  /** @deprecated No-op — picker is always visible in new design */
  visible?: boolean;
  /** @deprecated No-op */
  onDone?: () => void;
  /** @deprecated No-op */
  onReopen?: () => void;
  startsAt?: string;
  endsAt?: string;
  locationId?: string;
  initialSelectedAssets?: PickerAsset[];
  onSelectedAssetsChange?: (assets: PickerAsset[]) => void;
};

/* ───── Conflict check hook (inline — avoids stale selectedAssetIds bug) ───── */

type ConflictInfo = {
  assetId: string;
  conflictingBookingTitle?: string;
  startsAt: string;
  endsAt: string;
};

function useConflictCheck({
  startsAt,
  endsAt,
  locationId,
  selectedAssetIds,
}: {
  startsAt?: string;
  endsAt?: string;
  locationId?: string;
  selectedAssetIds: string[];
}) {
  const [conflicts, setConflicts] = useState<Map<string, ConflictInfo>>(new Map());
  const [checking, setChecking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const check = useCallback(async (ids: string[], start: string, end: string, loc: string) => {
    if (ids.length === 0) { setConflicts(new Map()); return; }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setChecking(true);
    try {
      const res = await fetch("/api/availability/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: loc,
          startsAt: new Date(start).toISOString(),
          endsAt: new Date(end).toISOString(),
          serializedAssetIds: ids,
          bulkItems: [],
        }),
        signal: ctrl.signal,
      });
      if (ctrl.signal.aborted) return;
      if (res.ok) {
        const json = await res.json();
        const data = json.data as {
          conflicts?: Array<{ assetId: string; conflictingBookingTitle?: string; startsAt: string; endsAt: string }>;
        };
        const map = new Map<string, ConflictInfo>();
        for (const c of data.conflicts ?? []) map.set(c.assetId, c);
        setConflicts(map);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
    if (!abortRef.current?.signal.aborted) setChecking(false);
  }, []);

  useEffect(() => {
    if (!startsAt || !endsAt || !locationId) { setConflicts(new Map()); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      check(selectedAssetIds, startsAt, endsAt, locationId);
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // selectedAssetIds intentionally included — re-check whenever selection changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startsAt, endsAt, locationId, selectedAssetIds.join(","), check]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { conflicts, checking };
}

/* ───── Component ───── */

export default function EquipmentPicker({
  assets,
  bulkSkus,
  selectedAssetIds,
  setSelectedAssetIds,
  selectedBulkItems,
  setSelectedBulkItems,
  startsAt,
  endsAt,
  locationId,
  initialSelectedAssets,
  onSelectedAssetsChange,
}: EquipmentPickerProps) {
  const legacyMode = !!assets;

  const [activeSection, setActiveSection] = useState<EquipmentSectionKey>(EQUIPMENT_SECTIONS[0].key);
  const [sectionSearch, setSectionSearch] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(true);

  // Asset cache for search mode (so we can display selected items we've seen)
  const [selectedAssetsCache] = useState<Map<string, PickerAsset>>(() => {
    const m = new Map<string, PickerAsset>();
    if (initialSelectedAssets) for (const a of initialSelectedAssets) m.set(a.id, a);
    return m;
  });

  // Search mode data
  const { sectionResults, apiSectionCounts, searchLoading } = usePickerSearch({
    legacyMode,
    activeSection,
    equipSearch: sectionSearch,
    onlyAvailable,
    globalSearch: "",
  });

  // Availability conflict check — re-runs when selectedAssetIds changes
  const { conflicts, checking: conflictsLoading } = useConflictCheck({
    startsAt,
    endsAt,
    locationId,
    selectedAssetIds,
  });

  // Indexed lookups
  const assetById = useMemo(() => {
    if (legacyMode) return new Map((assets ?? []).map((a) => [a.id, a]));
    const m = new Map<string, PickerAsset>();
    for (const a of sectionResults) m.set(a.id, a);
    selectedAssetsCache.forEach((a, id) => { if (!m.has(id)) m.set(id, a); });
    return m;
  }, [legacyMode, assets, sectionResults, selectedAssetsCache]);

  const bulkById = useMemo(() => new Map(bulkSkus.map((s) => [s.id, s])), [bulkSkus]);
  const bulkBySection = useMemo(() => groupBulkBySection(bulkSkus), [bulkSkus]);
  const selectedIdSet = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds]);

  // Section asset list
  const sectionAssets = useMemo(() => {
    if (!legacyMode) return sectionResults;
    const q = sectionSearch.toLowerCase();
    return ((assets ?? []).filter((a) => {
      const inSection = classifyAssetType(a.type, a.categoryName) === activeSection;
      if (!inSection) return false;
      if (onlyAvailable && a.computedStatus !== "AVAILABLE") return false;
      if (!q) return true;
      return (
        a.assetTag.toLowerCase().includes(q) ||
        a.brand.toLowerCase().includes(q) ||
        a.model.toLowerCase().includes(q) ||
        a.serialNumber.toLowerCase().includes(q)
      );
    }));
  }, [legacyMode, assets, activeSection, sectionSearch, onlyAvailable, sectionResults]);

  const sectionBulk = useMemo(() => {
    const q = sectionSearch.toLowerCase();
    return (bulkBySection[activeSection] || []).filter((s) =>
      !q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    );
  }, [bulkBySection, activeSection, sectionSearch]);

  // Section tab counts
  const sectionCounts = useMemo(() => {
    if (!legacyMode) {
      const c = { ...apiSectionCounts };
      for (const key of Object.keys(c) as EquipmentSectionKey[]) {
        c[key] = (c[key] || 0) + (bulkBySection[key]?.length || 0);
      }
      return c;
    }
    const c: Record<EquipmentSectionKey, number> = { cameras: 0, lenses: 0, batteries: 0, accessories: 0, others: 0 };
    for (const a of assets ?? []) {
      const sec = classifyAssetType(a.type, a.categoryName);
      c[sec] = (c[sec] || 0) + 1;
    }
    for (const key of Object.keys(c) as EquipmentSectionKey[]) {
      c[key] = (c[key] || 0) + (bulkBySection[key]?.length || 0);
    }
    return c;
  }, [legacyMode, assets, apiSectionCounts, bulkBySection]);

  // Selected count per section (for tab badges)
  const selectedBySection = useMemo(() => {
    const c: Record<EquipmentSectionKey, number> = { cameras: 0, lenses: 0, batteries: 0, accessories: 0, others: 0 };
    for (const id of selectedAssetIds) {
      const a = legacyMode ? assetById.get(id) : (selectedAssetsCache.get(id) ?? assetById.get(id));
      if (a) { const s = classifyAssetType(a.type, a.categoryName); c[s]++; }
    }
    for (const item of selectedBulkItems) {
      const sku = bulkById.get(item.bulkSkuId);
      if (sku) { const s = classifyAssetType(sku.category, sku.categoryName); c[s]++; }
    }
    return c;
  }, [selectedAssetIds, selectedBulkItems, assetById, bulkById, legacyMode, selectedAssetsCache]);

  // Selected section keys (for guidance)
  const selectedSectionKeys = useMemo(() => {
    const keys = new Set<EquipmentSectionKey>();
    for (const id of selectedAssetIds) {
      const a = legacyMode ? assetById.get(id) : (selectedAssetsCache.get(id) ?? assetById.get(id));
      if (a) keys.add(classifyAssetType(a.type, a.categoryName));
    }
    for (const item of selectedBulkItems) {
      const sku = bulkById.get(item.bulkSkuId);
      if (sku) keys.add(classifyAssetType(sku.category, sku.categoryName));
    }
    return Array.from(keys);
  }, [selectedAssetIds, selectedBulkItems, assetById, bulkById, legacyMode, selectedAssetsCache]);

  const activeGuidance = useMemo(() => {
    const ctx: GuidanceContext = { selectedSectionKeys, activeSection };
    return getActiveGuidance(ctx);
  }, [selectedSectionKeys, activeSection]);

  // Notify parent of selected asset details
  useEffect(() => {
    if (legacyMode || !onSelectedAssetsChange) return;
    const resolved = selectedAssetIds
      .map((id) => selectedAssetsCache.get(id))
      .filter((a): a is PickerAsset => !!a);
    onSelectedAssetsChange(resolved);
  }, [selectedAssetIds, legacyMode, onSelectedAssetsChange, selectedAssetsCache]);

  // Resolved selected items for shelf display
  const resolvedSelectedAssets = useMemo(() => {
    return selectedAssetIds
      .map((id) => (legacyMode ? assetById.get(id) : (selectedAssetsCache.get(id) ?? assetById.get(id))))
      .filter((a): a is PickerAsset => !!a);
  }, [selectedAssetIds, assetById, legacyMode, selectedAssetsCache]);

  /* ── Helpers ── */

  function toggleAsset(id: string, asset?: PickerAsset) {
    if (!legacyMode && asset && !selectedAssetsCache.has(id)) {
      selectedAssetsCache.set(id, asset);
    }
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function setBulkQty(bulkSkuId: string, qty: number) {
    if (qty <= 0) {
      setSelectedBulkItems((prev) => prev.filter((i) => i.bulkSkuId !== bulkSkuId));
    } else {
      setSelectedBulkItems((prev) => {
        const existing = prev.find((i) => i.bulkSkuId === bulkSkuId);
        if (existing) return prev.map((i) => i.bulkSkuId === bulkSkuId ? { ...i, quantity: qty } : i);
        return [...prev, { bulkSkuId, quantity: qty }];
      });
    }
  }

  const totalSelected = selectedAssetIds.length + selectedBulkItems.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="flex flex-col gap-0 rounded-lg border border-border overflow-hidden">
      {/* ── Section tabs ── */}
      <div className="flex border-b border-border bg-muted/30 overflow-x-auto" role="tablist">
        {EQUIPMENT_SECTIONS.map((sec) => {
          const selectedCount = selectedBySection[sec.key] || 0;
          const isActive = activeSection === sec.key;
          return (
            <button
              key={sec.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => { setActiveSection(sec.key); setSectionSearch(""); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 min-h-[44px]",
                isActive
                  ? "border-b-primary text-foreground bg-background"
                  : "border-b-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {sec.label}
              {selectedCount > 0 && (
                <span className="inline-flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {selectedCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Search + filter bar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            className="w-full pl-8 pr-8 py-1.5 text-sm bg-muted/40 border border-transparent rounded-md outline-none focus:bg-background focus:border-ring focus:shadow-xs max-md:min-h-[40px] max-md:text-base"
            placeholder={`Search ${EQUIPMENT_SECTIONS.find((s) => s.key === activeSection)?.label.toLowerCase() ?? ""}...`}
            value={sectionSearch}
            onChange={(e) => setSectionSearch(e.target.value)}
          />
          {sectionSearch && (
            <button
              type="button"
              onClick={() => setSectionSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyAvailable}
            onChange={(e) => setOnlyAvailable(e.target.checked)}
            className="rounded"
          />
          Available only
        </label>
      </div>

      {/* ── Guidance banner ── */}
      {activeGuidance.length > 0 && (
        <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
          {activeGuidance.map((g, i) => <div key={i}>{g.message}</div>)}
        </div>
      )}

      {/* ── Item list ── */}
      <ScrollArea className="max-h-72">
        <div role="listbox" aria-label={`${EQUIPMENT_SECTIONS.find((s) => s.key === activeSection)?.label} equipment`}>
          {searchLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : sectionAssets.length === 0 && sectionBulk.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {sectionSearch ? "No results" : onlyAvailable ? "Nothing available right now" : "No items in this section"}
            </div>
          ) : (
            <>
              {sectionAssets.map((asset) => {
                const isSelected = selectedIdSet.has(asset.id);
                const conflict = conflicts.get(asset.id);
                const isAvailable = asset.computedStatus === "AVAILABLE";
                const isDisabled = !isAvailable && !isSelected;

                return (
                  <button
                    key={asset.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={isDisabled}
                    onClick={() => toggleAsset(asset.id, asset)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-border/50 last:border-b-0 min-h-[52px]",
                      isSelected
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-muted/50",
                      isDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent"
                    )}
                  >
                    <AssetImage src={asset.imageUrl} alt={asset.assetTag} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{asset.assetTag}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {asset.brand} {asset.model}
                        {!isAvailable && !isSelected && (
                          <span className="text-orange-500 ml-1">· {asset.computedStatus.replace(/_/g, " ").toLowerCase()}</span>
                        )}
                      </div>
                    </div>
                    {conflict && !isSelected && (
                      <Badge variant="orange" size="sm" className="shrink-0">Conflict</Badge>
                    )}
                    {isSelected ? (
                      <CheckCircle2Icon className="size-5 text-primary shrink-0" />
                    ) : (
                      <CircleIcon className="size-5 text-border shrink-0" />
                    )}
                  </button>
                );
              })}

              {sectionBulk.map((sku) => {
                const current = selectedBulkItems.find((i) => i.bulkSkuId === sku.id)?.quantity ?? 0;
                const max = sku.currentQuantity;

                return (
                  <div
                    key={sku.id}
                    className="flex items-center gap-3 px-3 py-2.5 border-b border-border/50 last:border-b-0 min-h-[52px]"
                  >
                    <AssetImage src={sku.imageUrl} alt={sku.name} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{sku.name}</div>
                      <div className="text-xs text-muted-foreground">{max} available</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setBulkQty(sku.id, current - 1)}
                        disabled={current === 0}
                        className="size-8 flex items-center justify-center rounded-md border border-border text-sm font-bold hover:bg-muted disabled:opacity-30 min-h-[44px] min-w-[44px]"
                        aria-label={`Remove one ${sku.name}`}
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-medium tabular-nums">{current}</span>
                      <button
                        type="button"
                        onClick={() => setBulkQty(sku.id, current + 1)}
                        disabled={current >= max}
                        className="size-8 flex items-center justify-center rounded-md border border-border text-sm font-bold hover:bg-muted disabled:opacity-30 min-h-[44px] min-w-[44px]"
                        aria-label={`Add one ${sku.name}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </ScrollArea>

      {/* ── Conflict check indicator ── */}
      {conflictsLoading && (
        <div className="px-3 py-1.5 text-xs text-muted-foreground border-t border-border/50 bg-muted/20">
          Checking availability…
        </div>
      )}

      {/* ── Selected items shelf ── */}
      {totalSelected > 0 && (
        <div className="border-t border-border bg-muted/20">
          <div className="px-3 py-2 flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Selected</span>
            <span className="inline-flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {totalSelected}
            </span>
          </div>
          <div className="flex flex-col">
            {resolvedSelectedAssets.map((asset) => (
              <div key={asset.id} className="flex items-center gap-3 px-3 py-2 border-t border-border/30">
                <AssetImage src={asset.imageUrl} alt={asset.assetTag} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{asset.assetTag}</div>
                  <div className="text-xs text-muted-foreground truncate">{asset.brand} {asset.model}</div>
                </div>
                {conflicts.has(asset.id) && (
                  <Badge variant="orange" size="sm" className="shrink-0">Conflict</Badge>
                )}
                <button
                  type="button"
                  onClick={() => toggleAsset(asset.id)}
                  className="shrink-0 size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label={`Remove ${asset.assetTag}`}
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            ))}
            {selectedBulkItems.map((item) => {
              const sku = bulkById.get(item.bulkSkuId);
              if (!sku) return null;
              return (
                <div key={item.bulkSkuId} className="flex items-center gap-3 px-3 py-2 border-t border-border/30">
                  <AssetImage src={sku.imageUrl} alt={sku.name} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{sku.name}</div>
                    <div className="text-xs text-muted-foreground">× {item.quantity}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBulkQty(sku.id, 0)}
                    className="shrink-0 size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label={`Remove ${sku.name}`}
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
