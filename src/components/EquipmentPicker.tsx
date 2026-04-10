"use client";

import { useEffect, useMemo, useState } from "react";
import { usePickerSearch } from "@/components/equipment-picker/use-picker-search";
import { useConflictCheck, type ConflictInfo } from "@/components/equipment-picker/use-conflict-check";
import {
  EQUIPMENT_SECTIONS,
  classifyAssetType,
  groupBulkBySection,
  type EquipmentSectionKey,
} from "@/lib/equipment-sections";
import { CheckCircle2Icon, CircleIcon, SearchIcon, XIcon, ExternalLinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
// Native overflow-y-auto used instead of Radix ScrollArea (max-height incompatibility)
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
  currentHolder?: { bookingId: string; bookingTitle: string; holderName: string } | null;
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
  bulkSkus: PickerBulkSku[];
  selectedAssetIds: string[];
  setSelectedAssetIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedBulkItems: BulkSelection[];
  setSelectedBulkItems: React.Dispatch<React.SetStateAction<BulkSelection[]>>;
  /** Booking window start (ISO string) — used for availability conflict check */
  startsAt?: string;
  /** Booking window end (ISO string) — used for availability conflict check */
  endsAt?: string;
  /** Location filter for availability check */
  locationId?: string;
  /** Pre-selected assets to seed the display cache (search mode) */
  initialSelectedAssets?: PickerAsset[];
  /** Called when selection changes with resolved asset objects */
  onSelectedAssetsChange?: (assets: PickerAsset[]) => void;
  /** Controlled active section (for parent tab-advance logic) */
  activeSection?: EquipmentSectionKey;
  /** Called when active section changes */
  onActiveSectionChange?: (section: EquipmentSectionKey) => void;
};

export { type ConflictInfo };

/* ───── Component ───── */

export default function EquipmentPicker({
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
  activeSection: controlledSection,
  onActiveSectionChange,
}: EquipmentPickerProps) {
  const [internalSection, setInternalSection] = useState<EquipmentSectionKey>(EQUIPMENT_SECTIONS[0].key);
  const activeSection = controlledSection ?? internalSection;
  const setActiveSection = (sec: EquipmentSectionKey) => {
    setInternalSection(sec);
    onActiveSectionChange?.(sec);
  };
  const [sectionSearch, setSectionSearch] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  // Asset cache so we can display selected items even after switching sections
  const [selectedAssetsCache] = useState<Map<string, PickerAsset>>(() => {
    const m = new Map<string, PickerAsset>();
    if (initialSelectedAssets) for (const a of initialSelectedAssets) m.set(a.id, a);
    return m;
  });

  // ── Data hooks ──
  const { sectionResults, searchLoading, searchError } = usePickerSearch({
    legacyMode: false,
    activeSection,
    equipSearch: sectionSearch,
    onlyAvailable,
    globalSearch: "",
  });

  const { conflicts, checking: conflictsLoading } = useConflictCheck({
    startsAt,
    endsAt,
    locationId,
    selectedAssetIds,
  });

  // ── Indexed lookups ──
  const assetById = useMemo(() => {
    const m = new Map<string, PickerAsset>();
    for (const a of sectionResults) m.set(a.id, a);
    selectedAssetsCache.forEach((a, id) => { if (!m.has(id)) m.set(id, a); });
    return m;
  }, [sectionResults, selectedAssetsCache]);

  const bulkById = useMemo(() => new Map(bulkSkus.map((s) => [s.id, s])), [bulkSkus]);
  const bulkBySection = useMemo(() => groupBulkBySection(bulkSkus), [bulkSkus]);
  const selectedIdSet = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds]);

  // ── Section data ──
  const sectionBulk = useMemo(() => {
    const q = sectionSearch.toLowerCase();
    return (bulkBySection[activeSection] || []).filter((s) =>
      !q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    );
  }, [bulkBySection, activeSection, sectionSearch]);

  // ── Selected count per section (for tab badges) ──
  const selectedBySection = useMemo(() => {
    const c: Record<EquipmentSectionKey, number> = { cameras: 0, lenses: 0, batteries: 0, accessories: 0, others: 0 };
    for (const id of selectedAssetIds) {
      const a = selectedAssetsCache.get(id) ?? assetById.get(id);
      if (a) c[classifyAssetType(a.type, a.categoryName)]++;
    }
    for (const item of selectedBulkItems) {
      const sku = bulkById.get(item.bulkSkuId);
      if (sku) c[classifyAssetType(sku.category, sku.categoryName)]++;
    }
    return c;
  }, [selectedAssetIds, selectedBulkItems, assetById, bulkById, selectedAssetsCache]);

  // ── Notify parent of resolved asset details ──
  useEffect(() => {
    if (!onSelectedAssetsChange) return;
    const resolved = selectedAssetIds
      .map((id) => selectedAssetsCache.get(id))
      .filter((a): a is PickerAsset => !!a);
    onSelectedAssetsChange(resolved);
  }, [selectedAssetIds, onSelectedAssetsChange, selectedAssetsCache]);

  // ── Resolved selected items for shelf display ──
  const resolvedSelectedAssets = useMemo(() => {
    return selectedAssetIds
      .map((id) => selectedAssetsCache.get(id) ?? assetById.get(id))
      .filter((a): a is PickerAsset => !!a);
  }, [selectedAssetIds, assetById, selectedAssetsCache]);

  // ── Helpers ──

  function toggleAsset(id: string, asset?: PickerAsset) {
    if (asset && !selectedAssetsCache.has(id)) {
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

  // ── Render ──

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

      {/* ── Item list ── */}
      <div className="max-h-[28rem] overflow-y-auto">
        <div role="listbox" aria-label={`${EQUIPMENT_SECTIONS.find((s) => s.key === activeSection)?.label} equipment`}>
          {searchLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : searchError ? (
            <div className="py-8 text-center text-sm text-destructive">
              Failed to load equipment — check your connection and try again.
            </div>
          ) : sectionResults.length === 0 && sectionBulk.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {sectionSearch ? "No results" : onlyAvailable ? "Nothing available right now" : "No items in this section"}
            </div>
          ) : (
            <>
              {sectionResults.map((asset) => {
                const isSelected = selectedIdSet.has(asset.id);
                const conflict = conflicts.get(asset.id);
                const isAvailable = asset.computedStatus === "AVAILABLE";
                const isUnavailable = !isAvailable && !isSelected;
                const holder = asset.currentHolder;

                return (
                  <div
                    key={asset.id}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-border/50 last:border-b-0 min-h-[52px]",
                      isUnavailable && "opacity-50"
                    )}
                  >
                    {/* Clickable area for available/selected items */}
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={isUnavailable}
                      onClick={() => toggleAsset(asset.id, asset)}
                      className={cn(
                        "flex items-center gap-3 flex-1 min-w-0 text-left",
                        !isUnavailable && (isSelected ? "cursor-pointer" : "cursor-pointer"),
                        isUnavailable && "cursor-default"
                      )}
                    >
                      <AssetImage src={asset.imageUrl} alt={asset.assetTag} size={40} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{asset.assetTag}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {asset.brand} {asset.model}
                        </div>
                      </div>
                    </button>
                    {/* Right side: holder badge or selection indicator */}
                    {isUnavailable && holder ? (
                      <a
                        href={`/bookings?highlight=${holder.bookingId}`}
                        className="shrink-0 flex items-center gap-1 max-w-[140px]"
                        title={`${holder.bookingTitle} — ${holder.holderName}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Badge variant="secondary" size="sm" className="truncate gap-1">
                          {holder.holderName}
                          <ExternalLinkIcon className="size-2.5 shrink-0 opacity-60" />
                        </Badge>
                      </a>
                    ) : isUnavailable ? (
                      <Badge variant="secondary" size="sm" className="shrink-0">
                        {asset.computedStatus.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                    ) : (
                      <>
                        {conflict && !isSelected && (
                          <Badge variant="orange" size="sm" className="shrink-0">Conflict</Badge>
                        )}
                        {isSelected ? (
                          <CheckCircle2Icon className="size-5 text-primary shrink-0" />
                        ) : (
                          <CircleIcon className="size-5 text-border shrink-0" />
                        )}
                      </>
                    )}
                  </div>
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
      </div>

      {/* ── Selected items shelf ── */}
      {totalSelected > 0 && (
        <div className="border-t border-border bg-muted/20">
          <div className="px-3 py-2 flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Selected</span>
            <span className="inline-flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {totalSelected}
            </span>
            {conflictsLoading && (
              <span className="ml-auto text-[10px] text-muted-foreground">
                Checking availability\u2026
              </span>
            )}
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
