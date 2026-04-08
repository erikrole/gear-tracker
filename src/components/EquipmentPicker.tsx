"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAvailabilityCheck } from "@/components/equipment-picker/use-availability-check";
import { usePickerSearch } from "@/components/equipment-picker/use-picker-search";
import { useScanToAdd } from "@/components/equipment-picker/use-scan-to-add";
import {
  EQUIPMENT_SECTIONS,
  classifyAssetType,
  groupAssetsBySection,
  groupBulkBySection,
  type EquipmentSectionKey,
} from "@/lib/equipment-sections";
import { getActiveGuidance, type GuidanceContext } from "@/lib/equipment-guidance";
import { QrCodeIcon, SearchIcon, XIcon } from "lucide-react";
import QrScanner from "@/components/QrScanner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

/* ───── Status dot colors ───── */

const STATUS_DOT_COLORS: Record<string, string> = {
  AVAILABLE: "var(--green)",
  CHECKED_OUT: "var(--blue)",
  RESERVED: "var(--purple)",
  MAINTENANCE: "var(--orange)",
  RETIRED: "var(--text-muted)",
};

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

/* Stable empty array — avoids re-creating [] on every render in search mode */
const EMPTY_ASSETS: PickerAsset[] = [];

export type EquipmentPickerProps = {
  /** Pass assets to use legacy (load-all) mode. Omit for search-on-type mode. */
  assets?: PickerAsset[];
  bulkSkus: PickerBulkSku[];
  selectedAssetIds: string[];
  setSelectedAssetIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedBulkItems: BulkSelection[];
  setSelectedBulkItems: React.Dispatch<React.SetStateAction<BulkSelection[]>>;
  visible: boolean;
  onDone: () => void;
  onReopen: () => void;
  /** Booking window for availability preview (ISO strings) */
  startsAt?: string;
  endsAt?: string;
  locationId?: string;
  /** Pre-selected assets to seed the cache in search mode */
  initialSelectedAssets?: PickerAsset[];
  /** Called when selection changes with resolved asset objects (search mode only) */
  onSelectedAssetsChange?: (assets: PickerAsset[]) => void;
};

/* ───── Component ───── */

export default function EquipmentPicker({
  assets,
  bulkSkus,
  selectedAssetIds,
  setSelectedAssetIds,
  selectedBulkItems,
  setSelectedBulkItems,
  visible,
  onDone,
  onReopen,
  startsAt,
  endsAt,
  locationId,
  initialSelectedAssets,
  onSelectedAssetsChange,
}: EquipmentPickerProps) {
  const legacyMode = !!assets;

  // ── Internal UI state ──
  const [activeSection, setActiveSection] = useState<EquipmentSectionKey>(EQUIPMENT_SECTIONS[0].key);
  const [searchBySection, setSearchBySection] = useState<Record<EquipmentSectionKey, string>>({
    cameras: "", lenses: "", batteries: "", accessories: "", others: "",
  });
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [showScanner, setShowScanner] = useState(false);

  // ── Global search state ──
  const [globalSearch, setGlobalSearch] = useState("");
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const globalSearchRef = useRef<HTMLInputElement>(null);

  // ── Search mode: selected assets cache (only used when legacyMode is false) ──
  const [selectedAssetsCache] = useState<Map<string, PickerAsset>>(() => {
    const m = new Map<string, PickerAsset>();
    if (initialSelectedAssets) {
      for (const a of initialSelectedAssets) m.set(a.id, a);
    }
    return m;
  });

  // ── Derived values needed by hooks ──
  const legacyAssets = assets || EMPTY_ASSETS;
  const equipSearch = searchBySection[activeSection] || "";

  // ── Custom hooks (data-fetching & business logic) ──
  const { conflicts, bulkAvailability, conflictsLoading, conflictsError, fetchConflicts } =
    useAvailabilityCheck({
      startsAt,
      endsAt,
      locationId,
      selectedAssetIds,
      legacyMode,
      legacyAssets,
      bulkSkusLength: bulkSkus.length,
    });

  const { sectionResults, apiSectionCounts, searchLoading, globalSearchApiResults, globalSearchLoading } =
    usePickerSearch({
      legacyMode,
      activeSection,
      equipSearch,
      onlyAvailable,
      globalSearch,
    });

  // ── Indexed lookups (O(1) instead of O(n)) ──
  const assetById = useMemo(() => {
    if (legacyMode) return new Map(legacyAssets.map((a) => [a.id, a]));
    // In search mode, merge sectionResults + globalSearchApiResults + cache
    const m = new Map<string, PickerAsset>();
    for (const a of sectionResults) m.set(a.id, a);
    for (const a of globalSearchApiResults) m.set(a.id, a);
    selectedAssetsCache.forEach((a, id) => { if (!m.has(id)) m.set(id, a); });
    return m;
  }, [legacyMode, legacyAssets, sectionResults, globalSearchApiResults, selectedAssetsCache]);
  const bulkById = useMemo(() => new Map(bulkSkus.map((s) => [s.id, s])), [bulkSkus]);
  const selectedIdSet = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds]);

  // ── Section grouping (legacy mode only) ──
  const assetsBySection = useMemo(() => groupAssetsBySection(legacyAssets), [legacyAssets]);
  const bulkBySection = useMemo(() => groupBulkBySection(bulkSkus), [bulkSkus]);

  const sectionAssets = useMemo(() => {
    if (!activeSection) return [];
    if (!legacyMode) return sectionResults;
    const q = equipSearch.toLowerCase();
    return (assetsBySection[activeSection] || []).filter((a) => {
      if (onlyAvailable && a.computedStatus !== "AVAILABLE") return false;
      if (!q) return true;
      return (
        a.assetTag.toLowerCase().includes(q) ||
        a.brand.toLowerCase().includes(q) ||
        a.model.toLowerCase().includes(q) ||
        a.serialNumber.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q) ||
        (a.name && a.name.toLowerCase().includes(q))
      );
    });
  }, [legacyMode, assetsBySection, activeSection, equipSearch, onlyAvailable, sectionResults]);

  const sectionBulk = useMemo(() => {
    if (!activeSection) return [];
    const q = equipSearch.toLowerCase();
    return (bulkBySection[activeSection] || []).filter((s) => {
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
    });
  }, [bulkBySection, activeSection, equipSearch]);

  // Count selected items per section
  const selectedCountBySection = useMemo(() => {
    const counts: Record<EquipmentSectionKey, number> = {
      cameras: 0, lenses: 0, batteries: 0, accessories: 0, others: 0,
    };
    for (const id of selectedAssetIds) {
      const asset = legacyMode ? assetById.get(id) : (selectedAssetsCache.get(id) || assetById.get(id));
      if (asset) {
        const sec = classifyAssetType(asset.type, asset.categoryName);
        counts[sec]++;
      }
    }
    for (const item of selectedBulkItems) {
      const sku = bulkById.get(item.bulkSkuId);
      if (sku) {
        const sec = classifyAssetType(sku.category, sku.categoryName);
        counts[sec]++;
      }
    }
    return counts;
  }, [selectedAssetIds, selectedBulkItems, assetById, bulkById, legacyMode, selectedAssetsCache]);

  const sectionTotalCounts = useMemo(() => {
    if (!legacyMode) {
      // In search mode, use API-provided section counts + bulk counts
      const counts = { ...apiSectionCounts };
      for (const key of Object.keys(counts) as EquipmentSectionKey[]) {
        counts[key] = (counts[key] || 0) + (bulkBySection[key]?.length || 0);
      }
      return counts;
    }
    const counts: Record<EquipmentSectionKey, number> = {
      cameras: 0, lenses: 0, batteries: 0, accessories: 0, others: 0,
    };
    for (const key of Object.keys(counts) as EquipmentSectionKey[]) {
      counts[key] = (assetsBySection[key]?.length || 0) + (bulkBySection[key]?.length || 0);
    }
    return counts;
  }, [legacyMode, assetsBySection, bulkBySection, apiSectionCounts]);

  const equipmentCount = selectedAssetIds.length + selectedBulkItems.length;

  const selectedSectionKeys = useMemo(() => {
    const keys = new Set<EquipmentSectionKey>();
    for (const id of selectedAssetIds) {
      const asset = legacyMode ? assetById.get(id) : (selectedAssetsCache.get(id) || assetById.get(id));
      if (asset) keys.add(classifyAssetType(asset.type, asset.categoryName));
    }
    for (const item of selectedBulkItems) {
      const sku = bulkById.get(item.bulkSkuId);
      if (sku) keys.add(classifyAssetType(sku.category, sku.categoryName));
    }
    return Array.from(keys);
  }, [selectedAssetIds, selectedBulkItems, assetById, bulkById, legacyMode, selectedAssetsCache]);

  // ── Global search results (flat list across all sections) ──
  const globalSearchResults = useMemo(() => {
    const q = globalSearch.toLowerCase().trim();
    if (!q) return [];
    if (!legacyMode) {
      // In search mode, use API results
      return globalSearchApiResults.map((a) => ({
        type: "asset" as const,
        item: a,
        section: classifyAssetType(a.type, a.categoryName),
      }));
    }
    const results: { type: "asset"; item: PickerAsset; section: EquipmentSectionKey }[] = [];
    for (const sec of EQUIPMENT_SECTIONS) {
      const sectionItems = assetsBySection[sec.key] || [];
      for (const a of sectionItems) {
        if (onlyAvailable && a.computedStatus !== "AVAILABLE") continue;
        if (
          a.assetTag.toLowerCase().includes(q) ||
          a.brand.toLowerCase().includes(q) ||
          a.model.toLowerCase().includes(q) ||
          a.serialNumber.toLowerCase().includes(q) ||
          a.type.toLowerCase().includes(q) ||
          (a.name && a.name.toLowerCase().includes(q))
        ) {
          results.push({ type: "asset", item: a, section: sec.key });
        }
      }
    }
    return results;
  }, [globalSearch, assetsBySection, onlyAvailable, legacyMode, globalSearchApiResults]);

  // Reset highlight when results change
  useEffect(() => {
    setHighlightedIdx(globalSearchResults.length > 0 ? 0 : -1);
  }, [globalSearchResults]);

  // Notify parent of selected asset details (search mode)
  useEffect(() => {
    if (legacyMode || !onSelectedAssetsChange) return;
    const resolved = selectedAssetIds
      .map((id) => selectedAssetsCache.get(id))
      .filter((a): a is PickerAsset => !!a);
    onSelectedAssetsChange(resolved);
  }, [selectedAssetIds, legacyMode, onSelectedAssetsChange, selectedAssetsCache]);

  const isGlobalSearchActive = globalSearch.trim().length > 0;

  const activeGuidance = useMemo(() => {
    if (!activeSection) return [];
    const ctx: GuidanceContext = { selectedSectionKeys, activeSection };
    return getActiveGuidance(ctx);
  }, [selectedSectionKeys, activeSection]);

  // ── Header checkbox state ──
  const allSectionAvailableIds = useMemo(() => {
    return sectionAssets
      .filter((a) => a.computedStatus === "AVAILABLE" && !conflicts.has(a.id))
      .map((a) => a.id);
  }, [sectionAssets, conflicts]);

  const allSectionSelected = allSectionAvailableIds.length > 0 &&
    allSectionAvailableIds.every((id) => selectedIdSet.has(id));
  const someSectionSelected = allSectionAvailableIds.some((id) => selectedIdSet.has(id));

  const { scanFeedback, handleScan, showScanFeedbackMsg } = useScanToAdd({
    legacyMode,
    legacyAssets,
    bulkSkus,
    selectedAssetIds,
    setSelectedAssetIds,
    selectedBulkItems,
    setSelectedBulkItems,
    selectedAssetsCache,
    selectedIdSet,
    conflicts,
    setActiveSection,
  });

  // ── Helpers ──

  function advanceToSection(key: EquipmentSectionKey) {
    setActiveSection(key);
  }

  function setSearch(value: string) {
    setSearchBySection((prev) => ({ ...prev, [activeSection]: value }));
  }

  function toggleAsset(id: string) {
    if (!legacyMode) {
      // Cache the asset when toggling on so we can display it later
      const asset = assetById.get(id);
      if (asset && !selectedAssetsCache.has(id)) {
        selectedAssetsCache.set(id, asset);
      }
    }
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleAllInSection() {
    if (allSectionSelected) {
      const sectionIds = new Set(allSectionAvailableIds);
      setSelectedAssetIds((prev) => prev.filter((id) => !sectionIds.has(id)));
    } else {
      setSelectedAssetIds((prev) => {
        const existing = new Set(prev);
        const toAdd = allSectionAvailableIds.filter((id) => !existing.has(id));
        return [...prev, ...toAdd];
      });
    }
  }

  function deselectAllInSection() {
    if (legacyMode) {
      const sectionIds = new Set((assetsBySection[activeSection] || []).map((a) => a.id));
      setSelectedAssetIds((prev) => prev.filter((id) => !sectionIds.has(id)));
    } else {
      // In search mode, find selected assets in this section via cache
      const sectionIds = new Set<string>();
      selectedAssetsCache.forEach((a, id) => {
        if (selectedAssetIds.includes(id) && classifyAssetType(a.type, a.categoryName) === activeSection) {
          sectionIds.add(id);
        }
      });
      setSelectedAssetIds((prev) => prev.filter((id) => !sectionIds.has(id)));
    }
    const sectionBulkIds = new Set((bulkBySection[activeSection] || []).map((s) => s.id));
    setSelectedBulkItems((prev) => prev.filter((i) => !sectionBulkIds.has(i.bulkSkuId)));
  }

  // ── Keyboard navigation ──

  function handleTabKeyDown(e: React.KeyboardEvent, currentIdx: number) {
    let nextIdx = currentIdx;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIdx = (currentIdx + 1) % EQUIPMENT_SECTIONS.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIdx = (currentIdx - 1 + EQUIPMENT_SECTIONS.length) % EQUIPMENT_SECTIONS.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      nextIdx = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      nextIdx = EQUIPMENT_SECTIONS.length - 1;
    } else {
      return;
    }
    setActiveSection(EQUIPMENT_SECTIONS[nextIdx].key);
    // Focus the target tab button
    const tabList = (e.currentTarget as HTMLElement).parentElement;
    const buttons = tabList?.querySelectorAll<HTMLButtonElement>("[role=\"tab\"]");
    buttons?.[nextIdx]?.focus();
  }

  function formatConflictDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const currentSectionSelected = selectedCountBySection[activeSection] || 0;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-2">
        <label className="text-[length:var(--text-xs)] font-[number:var(--weight-semibold)] text-[var(--text-secondary)]">
          Equipment
        </label>
        <div className="flex gap-1.5 items-center">
          {visible && (
            <>
              <Button
                type="button"
                variant="outline" size="sm"
                className="inline-flex items-center gap-1 max-md:min-h-[44px] max-md:px-3 max-md:py-2"
                onClick={() => setShowScanner(true)}
                aria-label="Scan QR code to add item"
              >
                <QrCodeIcon className="size-4" />
                Scan
              </Button>
              <Button
                type="button"
                variant="outline" size="sm"
                onClick={onDone}
              >
                Done adding
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Sectioned picker */}
      {visible && (
        <div className="border border-[var(--border)] rounded-[var(--radius)] overflow-hidden" role="region" aria-label="Equipment picker">
          {/* Global search bar */}
          <div className="relative flex items-center mb-2">
            <SearchIcon className="absolute left-2.5 max-md:left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none size-3.5" aria-hidden="true" />
            <input
              ref={globalSearchRef}
              className="w-full py-2 pr-3 pl-8 border border-[var(--border)] rounded-[var(--radius)] text-[length:var(--text-sm)] outline-none box-border focus:border-[var(--primary,#3b82f6)] focus:shadow-[0_0_0_2px_rgba(59,130,246,0.15)] max-md:min-h-[44px] max-md:text-[length:var(--text-lg)] max-md:pl-9"
              placeholder="Search all equipment..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              onKeyDown={(e) => {
                if (!isGlobalSearchActive || globalSearchResults.length === 0) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlightedIdx((i) => Math.min(i + 1, globalSearchResults.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlightedIdx((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const hit = globalSearchResults[highlightedIdx];
                  if (hit?.type === "asset") {
                    const isDisabled = hit.item.computedStatus !== "AVAILABLE" && !conflicts.has(hit.item.id);
                    if (!isDisabled) toggleAsset(hit.item.id);
                  }
                } else if (e.key === "Escape") {
                  setGlobalSearch("");
                  globalSearchRef.current?.blur();
                }
              }}
              aria-label="Search all equipment across sections"
            />
            {globalSearch && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 bg-none border-none shadow-none text-[length:var(--text-lg)] text-[var(--text-secondary)] cursor-pointer p-1 leading-none h-auto min-h-0 hover:bg-[var(--accent-soft)]"
                onClick={() => { setGlobalSearch(""); globalSearchRef.current?.focus(); }}
                aria-label="Clear global search"
              >
                <XIcon className="size-3.5" />
              </Button>
            )}
          </div>

          {/* Global search results (replaces tabs when active) */}
          {isGlobalSearchActive ? (
            <div className="p-3 max-md:p-2">
              <ScrollArea className="max-h-[280px] max-md:max-h-[300px]" role="listbox" aria-label="Search results">
                {globalSearchLoading ? (
                  <div className="py-6 text-center text-[var(--text-secondary)] text-[length:var(--text-sm)]" role="status">Searching...</div>
                ) : globalSearchResults.length === 0 ? (
                  <div className="py-6 text-center text-[var(--text-secondary)] text-[length:var(--text-sm)]" role="status">No matching items across any section</div>
                ) : (
                  <>
                    <div className="text-[length:var(--text-3xs)] text-[var(--text-muted)] ml-auto px-2 pb-1" aria-live="polite">
                      {globalSearchResults.length} result{globalSearchResults.length !== 1 ? "s" : ""}
                    </div>
                    {globalSearchResults.map((hit, idx) => {
                      const asset = hit.item;
                      const isSelected = selectedIdSet.has(asset.id);
                      const isAvailable = asset.computedStatus === "AVAILABLE";
                      const conflict = conflicts.get(asset.id);
                      const dotColor = conflict
                        ? "var(--orange)"
                        : STATUS_DOT_COLORS[asset.computedStatus] || "var(--text-muted)";
                      const statusLabel = asset.computedStatus.replace("_", " ").toLowerCase();
                      const isDisabled = !isAvailable && !conflict;
                      const isHighlighted = idx === highlightedIdx;
                      return (
                        <div
                          key={asset.id}
                          role="option"
                          aria-selected={isSelected}
                          aria-disabled={isDisabled}
                          tabIndex={0}
                          className={cn(
                            "flex items-center gap-2.5 py-2.5 px-2 cursor-pointer border-l-[3px] border-l-transparent border-b border-b-[var(--border-light)] transition-[background,border-color] duration-100 last:border-b-0 hover:bg-[var(--bg-hover,#f8fafc)] data-[unavailable]:cursor-default data-[unavailable]:opacity-50 data-[unavailable]:hover:bg-transparent max-md:py-3 max-md:min-h-[52px]",
                            isSelected && "bg-[var(--bg-active,#f0f4ff)] border-l-[var(--primary,#3b82f6)] hover:bg-[var(--bg-active,#f0f4ff)]",
                            conflict && "border-l-[var(--orange)]",
                            isHighlighted && "outline-2 outline-[var(--primary,#3b82f6)] -outline-offset-2",
                          )}
                          data-unavailable={isDisabled ? true : undefined}
                          onClick={() => { if (!isDisabled) toggleAsset(asset.id); }}
                          onMouseEnter={() => setHighlightedIdx(idx)}
                          onKeyDown={(e) => {
                            if (isDisabled) return;
                            if (e.key === " " || e.key === "Enter") {
                              e.preventDefault();
                              toggleAsset(asset.id);
                            }
                          }}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleAsset(asset.id)}
                            disabled={isDisabled}
                            aria-label={`Select ${asset.assetTag}`}
                            tabIndex={-1}
                          />
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: dotColor }}
                            title={conflict ? "Scheduling conflict" : statusLabel}
                            aria-hidden="true"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-[number:var(--weight-bold)] text-[length:var(--text-base)] leading-[1.3]">
                              {asset.assetTag}
                              <Badge variant="gray" size="sm" className="ml-1.5">
                                {EQUIPMENT_SECTIONS.find((s) => s.key === hit.section)?.label || hit.section}
                              </Badge>
                            </div>
                            <div className="text-[length:var(--text-xs)] text-[var(--text-secondary)] leading-[1.4] mt-px">
                              {asset.name || `${asset.brand} ${asset.model}`}
                              {asset.serialNumber ? ` \u00b7 ${asset.serialNumber}` : ""}
                              {asset.location ? ` \u00b7 ${asset.location.name}` : ""}
                              {!isAvailable && !conflict && ` \u00b7 ${statusLabel}`}
                            </div>
                            {conflict && (
                              <div className="text-[length:var(--text-3xs)] text-[var(--orange)] mt-0.5">
                                {"\u26a0"} {conflict.conflictingBookingTitle || "another booking"} ({formatConflictDate(conflict.startsAt)}{"\u2013"}{formatConflictDate(conflict.endsAt)})
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </ScrollArea>
            </div>
          ) : (
          <>
          {/* Section tabs */}
          <div className="flex flex-wrap border-b border-b-[var(--border)]" role="tablist" aria-label="Equipment sections">
            {EQUIPMENT_SECTIONS.map((sec, idx) => {
              const isActive = activeSection === sec.key;
              const selCount = selectedCountBySection[sec.key] || 0;
              return (
                <button
                  key={sec.key}
                  type="button"
                  role="tab"
                  id={`picker-tab-${sec.key}`}
                  aria-selected={isActive}
                  aria-controls={`picker-panel-${sec.key}`}
                  tabIndex={isActive ? 0 : -1}
                  className={cn(
                    "flex-auto py-2.5 px-3 text-[length:var(--text-xs)] font-[number:var(--weight-medium)] bg-transparent border-none border-b-2 border-b-transparent cursor-pointer text-[var(--text-secondary)] whitespace-nowrap min-h-[40px] max-md:min-h-[44px] max-md:px-2.5 transition-[color,border-color] duration-150 hover:text-[var(--text-primary)]",
                    isActive && "font-[number:var(--weight-bold)] border-b-[var(--primary,#3b82f6)] text-[var(--primary,#3b82f6)]",
                  )}
                  onClick={() => setActiveSection(sec.key)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                >
                  {sec.label}
                  {selCount > 0 ? (
                    <span className="ml-1 text-[length:var(--text-3xs)] text-[var(--primary,#3b82f6)] font-[number:var(--weight-bold)] opacity-100">({selCount})</span>
                  ) : sectionTotalCounts[sec.key] > 0 ? (
                    <span className="ml-1 text-[length:var(--text-3xs)] opacity-60">({sectionTotalCounts[sec.key]})</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Active section content */}
          {activeSection && (
            <div
              className="p-3 max-md:p-2"
              role="tabpanel"
              id={`picker-panel-${activeSection}`}
              aria-labelledby={`picker-tab-${activeSection}`}
            >
              {/* Search + "Only available" filter */}
              <div className="flex gap-2 mb-2 items-stretch max-md:flex-wrap">
                <div className="flex-1 relative">
                  <SearchIcon className="absolute left-2.5 max-md:left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none size-3.5" aria-hidden="true" />
                  <input
                    className="w-full py-2 pr-3 pl-8 border border-[var(--border)] rounded-[var(--radius)] text-[length:var(--text-sm)] outline-none box-border focus:border-[var(--primary,#3b82f6)] focus:shadow-[0_0_0_2px_rgba(59,130,246,0.15)] max-md:min-h-[44px] max-md:text-[length:var(--text-lg)] max-md:pl-9"
                    placeholder={`Search ${EQUIPMENT_SECTIONS.find((s) => s.key === activeSection)?.label.toLowerCase() || "items"}...`}
                    value={equipSearch}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label={`Search ${EQUIPMENT_SECTIONS.find((s) => s.key === activeSection)?.label || "items"}`}
                  />
                  {equipSearch && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 bg-none border-none shadow-none text-[length:var(--text-lg)] text-[var(--text-secondary)] cursor-pointer p-1 leading-none h-auto min-h-0 hover:bg-[var(--accent-soft)]"
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                    >
                      <XIcon className="size-3.5" />
                    </Button>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "py-1.5 px-3 text-[length:var(--text-xs)] font-[number:var(--weight-medium)] rounded-full border border-[var(--border)] bg-[var(--panel)] shadow-none cursor-pointer h-auto text-[var(--text-secondary)] whitespace-nowrap transition-all duration-150 hover:bg-[var(--accent-soft)] max-md:min-h-[40px] max-md:py-2 max-md:px-3.5 max-md:text-[length:var(--text-sm)]",
                    onlyAvailable && "bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] border-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-bg-hover)]",
                  )}
                  onClick={() => setOnlyAvailable((v) => !v)}
                  aria-pressed={onlyAvailable}
                  aria-label={onlyAvailable ? "Showing only available items. Click to show all." : "Showing all items. Click to filter to available only."}
                >
                  Only available
                </Button>
              </div>

              {/* Column header with select-all checkbox */}
              {sectionAssets.length > 0 && (
                <div className="flex items-center gap-2 py-1.5 border-b border-b-[var(--border-light)] mb-0.5">
                  <div className="flex items-center cursor-pointer">
                    <Checkbox
                      checked={allSectionSelected ? true : someSectionSelected ? "indeterminate" : false}
                      onCheckedChange={toggleAllInSection}
                      aria-label={allSectionSelected ? "Deselect all items in section" : "Select all available items in section"}
                    />
                  </div>
                  <span className="text-[length:var(--text-3xs)] font-[number:var(--weight-semibold)] text-[var(--text-secondary)] uppercase tracking-[var(--tracking-wider)]">Item</span>
                  {currentSectionSelected > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-[length:var(--text-3xs)] text-[var(--text-secondary)] bg-none border-none shadow-none cursor-pointer py-0.5 px-1.5 rounded-[var(--radius)] h-auto min-h-0 hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                      onClick={deselectAllInSection}
                    >
                      Deselect ({currentSectionSelected})
                    </Button>
                  )}
                  {equipSearch && (
                    <span className="text-[length:var(--text-3xs)] text-[var(--text-muted)] ml-auto" aria-live="polite">
                      {sectionAssets.length + sectionBulk.length} results
                    </span>
                  )}
                  {conflictsLoading && (
                    <span className="text-[length:var(--text-3xs)] text-[var(--text-muted)] italic ml-auto" aria-live="polite">Checking availability...</span>
                  )}
                  {conflictsError && !conflictsLoading && (
                    <button
                      type="button"
                      className="text-[length:var(--text-3xs)] text-[var(--orange)] italic ml-auto underline cursor-pointer"
                      onClick={fetchConflicts}
                      aria-live="polite"
                    >
                      Availability unavailable — retry
                    </button>
                  )}
                </div>
              )}

              <ScrollArea className="max-h-[280px] max-md:max-h-[300px]" role="listbox" aria-label={`${EQUIPMENT_SECTIONS.find((s) => s.key === activeSection)?.label || "Items"} list`}>
                {/* Bulk items (shown first — high-frequency items like batteries) */}
                {sectionBulk.length > 0 && (
                  <>
                    {sectionBulk.map((sku) => {
                      const sel = selectedBulkItems.find((i) => i.bulkSkuId === sku.id);
                      const isSelected = !!sel;
                      const qty = sel?.quantity ?? 0;
                      const bulkAvail = bulkAvailability[sku.id];
                      const maxQty = bulkAvail ? bulkAvail.available : sku.currentQuantity;
                      const hasDateConstraint = bulkAvail && bulkAvail.available < bulkAvail.onHand;
                      const isBookedOut = maxQty === 0 && !!bulkAvail;
                      return (
                        <div
                          key={sku.id}
                          role="option"
                          aria-selected={isSelected}
                          aria-disabled={isBookedOut && !isSelected}
                          tabIndex={0}
                          className={cn(
                            "flex items-center gap-2.5 py-2.5 px-2 cursor-pointer border-l-[3px] border-l-transparent border-b border-b-[var(--border-light)] transition-[background,border-color] duration-100 last:border-b-0 hover:bg-[var(--bg-hover,#f8fafc)] max-md:py-3 max-md:min-h-[52px]",
                            isSelected && "bg-[var(--bg-active,#f0f4ff)] border-l-[var(--primary,#3b82f6)] hover:bg-[var(--bg-active,#f0f4ff)]",
                            isBookedOut && !isSelected && "opacity-50 cursor-default hover:bg-transparent",
                          )}
                          onClick={() => {
                            if (!isSelected && !isBookedOut) {
                              setSelectedBulkItems((prev) => [...prev, { bulkSkuId: sku.id, quantity: 1 }]);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === " " || e.key === "Enter") {
                              e.preventDefault();
                              if (!isSelected && !isBookedOut) {
                                setSelectedBulkItems((prev) => [...prev, { bulkSkuId: sku.id, quantity: 1 }]);
                              }
                            }
                          }}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => {
                              setSelectedBulkItems((prev) =>
                                isSelected
                                  ? prev.filter((i) => i.bulkSkuId !== sku.id)
                                  : [...prev, { bulkSkuId: sku.id, quantity: 1 }]
                              );
                            }}
                            aria-label={`Select ${sku.name}`}
                            tabIndex={-1}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-[number:var(--weight-bold)] text-[length:var(--text-base)] leading-[1.3]">{sku.name}</div>
                            <div className="text-[length:var(--text-xs)] text-[var(--text-secondary)] leading-[1.4] mt-px">{sku.category} {"\u00b7"} {sku.unit}</div>
                          </div>
                          {isSelected ? (
                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                className="size-7 p-0 text-base leading-none"
                                onClick={() => {
                                  if (qty <= 1) setSelectedBulkItems((prev) => prev.filter((i) => i.bulkSkuId !== sku.id));
                                  else setSelectedBulkItems((prev) => prev.map((i) => i.bulkSkuId === sku.id ? { ...i, quantity: i.quantity - 1 } : i));
                                }}
                                aria-label={`Decrease ${sku.name} quantity`}
                              >
                                &minus;
                              </Button>
                              <span className="w-6 text-center text-[length:var(--text-sm)] font-[number:var(--weight-semibold)] tabular-nums">{qty}</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                className="size-7 p-0 text-base leading-none"
                                onClick={() => setSelectedBulkItems((prev) => prev.map((i) => i.bulkSkuId === sku.id ? { ...i, quantity: i.quantity + 1 } : i))}
                                disabled={maxQty > 0 && qty >= maxQty}
                                aria-label={`Increase ${sku.name} quantity`}
                              >
                                +
                              </Button>
                              <span className="text-[length:var(--text-3xs)] text-[var(--text-secondary)] ml-1 whitespace-nowrap">/ {maxQty}</span>
                            </div>
                          ) : maxQty === 0 && bulkAvail ? (
                            <span className="text-[length:var(--text-xs)] text-[var(--orange)] shrink-0">Booked out</span>
                          ) : (
                            <span className="text-[length:var(--text-xs)] text-[var(--text-secondary)] shrink-0">
                              {hasDateConstraint ? `${maxQty} of ${bulkAvail!.onHand} free` : `${maxQty} available`}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Serialized assets */}
                {sectionAssets.length > 0 && (
                  <>
                    {sectionBulk.length > 0 && (
                      <div className="text-[length:var(--text-2xs)] font-[number:var(--weight-semibold)] text-[var(--text-secondary)] pt-2.5 pb-1 uppercase tracking-[0.05em]" role="separator">Serialized Items</div>
                    )}
                    {sectionAssets.map((asset) => {
                      const isSelected = selectedIdSet.has(asset.id);
                      const isAvailable = asset.computedStatus === "AVAILABLE";
                      const conflict = conflicts.get(asset.id);
                      const dotColor = conflict
                        ? "var(--orange)"
                        : STATUS_DOT_COLORS[asset.computedStatus] || "var(--text-muted)";
                      const statusLabel = asset.computedStatus.replace("_", " ").toLowerCase();
                      const isDisabled = !isAvailable && !conflict;
                      return (
                        <div
                          key={asset.id}
                          role="option"
                          aria-selected={isSelected}
                          aria-disabled={isDisabled}
                          tabIndex={0}
                          className={cn(
                            "flex items-center gap-2.5 py-2.5 px-2 cursor-pointer border-l-[3px] border-l-transparent border-b border-b-[var(--border-light)] transition-[background,border-color] duration-100 last:border-b-0 hover:bg-[var(--bg-hover,#f8fafc)] data-[unavailable]:cursor-default data-[unavailable]:opacity-50 data-[unavailable]:hover:bg-transparent max-md:py-3 max-md:min-h-[52px]",
                            isSelected && "bg-[var(--bg-active,#f0f4ff)] border-l-[var(--primary,#3b82f6)] hover:bg-[var(--bg-active,#f0f4ff)]",
                            conflict && "border-l-[var(--orange)]",
                          )}
                          data-unavailable={isDisabled ? true : undefined}
                          onClick={() => { if (!isDisabled) toggleAsset(asset.id); }}
                          onKeyDown={(e) => {
                            if (isDisabled) return;
                            if (e.key === " " || e.key === "Enter") {
                              e.preventDefault();
                              toggleAsset(asset.id);
                            }
                          }}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleAsset(asset.id)}
                            disabled={isDisabled}
                            aria-label={`Select ${asset.assetTag}`}
                            tabIndex={-1}
                          />
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: dotColor }}
                            title={conflict ? "Scheduling conflict" : statusLabel}
                            aria-hidden="true"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-[number:var(--weight-bold)] text-[length:var(--text-base)] leading-[1.3]">
                              {asset.assetTag}
                            </div>
                            <div className="text-[length:var(--text-xs)] text-[var(--text-secondary)] leading-[1.4] mt-px">
                              {asset.name || `${asset.brand} ${asset.model}`}
                              {asset.serialNumber ? ` \u00b7 ${asset.serialNumber}` : ""}
                              {asset.location ? ` \u00b7 ${asset.location.name}` : ""}
                              {!isAvailable && !conflict && ` \u00b7 ${statusLabel}`}
                            </div>
                            {conflict && (
                              <div className="text-[length:var(--text-3xs)] text-[var(--orange)] mt-0.5">
                                {"\u26a0"} {conflict.conflictingBookingTitle || "another booking"} ({formatConflictDate(conflict.startsAt)}{"\u2013"}{formatConflictDate(conflict.endsAt)})
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {searchLoading && !legacyMode && (
                  <div className="py-6 text-center text-[var(--text-secondary)] text-[length:var(--text-sm)]" role="status">Searching...</div>
                )}
                {sectionAssets.length === 0 && sectionBulk.length === 0 && !(searchLoading && !legacyMode) && (
                  <div className="py-6 text-center text-[var(--text-secondary)] text-[length:var(--text-sm)]" role="status">
                    {equipSearch
                      ? "No matching items"
                      : onlyAvailable && (sectionTotalCounts[activeSection] || 0) > 0
                        ? <>No available items in this section — <button type="button" className="underline cursor-pointer" onClick={() => setOnlyAvailable(false)}>show all</button></>
                        : onlyAvailable
                          ? "No available items in this section"
                          : "No items in this section"}
                  </div>
                )}
              </ScrollArea>

              {/* Equipment guidance hints */}
              {activeGuidance.length > 0 && activeGuidance.map((rule) => (
                <div
                  key={rule.id}
                  data-guidance={rule.id}
                  className={cn(
                    "py-2 px-3 mt-2 rounded-[var(--radius)] text-[length:var(--text-xs)]",
                    rule.level === "warning" ? "bg-[var(--bg-warning,#fef9c3)] text-[var(--text-warning,#92400e)]" : "bg-[var(--bg-info,#eff6ff)] text-[var(--text-info,#1e40af)]",
                  )}
                  role="alert"
                >
                  {rule.message}
                </div>
              ))}

              {/* Section navigation */}
              <div className="flex justify-between mt-2.5 pt-2.5 border-t border-t-[var(--border-light)]">
                {(() => {
                  const idx = EQUIPMENT_SECTIONS.findIndex((s) => s.key === activeSection);
                  const prev = idx > 0 ? EQUIPMENT_SECTIONS[idx - 1] : null;
                  const next = idx < EQUIPMENT_SECTIONS.length - 1 ? EQUIPMENT_SECTIONS[idx + 1] : null;
                  return (
                    <>
                      {prev ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => advanceToSection(prev.key)}>
                          {"\u2190"} {prev.label}
                        </Button>
                      ) : <span />}
                      {next ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => advanceToSection(next.key)}>
                          {next.label} {"\u2192"}
                        </Button>
                      ) : (
                        <Button type="button" variant="outline" size="sm" onClick={onDone}>
                          Done
                        </Button>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
          </>
          )}

          {/* Sticky selection footer */}
          {equipmentCount > 0 && (
            <div className="border-t border-t-[var(--border)] py-2.5 px-3 bg-[var(--panel)]" aria-live="polite">
              <div className="text-[length:var(--text-sm)] font-[number:var(--weight-semibold)] mb-1.5 flex items-center gap-1.5">
                <Badge variant="default" className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-[var(--primary,#3b82f6)] text-white text-[length:var(--text-xs)] font-[number:var(--weight-bold)]">{equipmentCount}</Badge>
                item{equipmentCount !== 1 ? "s" : ""} selected
              </div>
              <div className="flex flex-wrap gap-1 max-md:overflow-x-auto max-md:flex-nowrap max-md:[overflow-scrolling:touch] max-md:pb-0.5">
                {selectedAssetIds.map((assetId) => {
                  const asset = assetById.get(assetId);
                  if (!asset) return null;
                  const conflict = conflicts.get(assetId);
                  return (
                    <span key={assetId} className={cn("inline-flex items-center gap-0.5 py-[3px] px-1.5 rounded-[var(--radius)] bg-[var(--bg-active,#f0f4ff)] border border-[var(--border-light)] text-[length:var(--text-xs)] font-[number:var(--weight-medium)]", conflict && "border-[var(--orange)] bg-[rgba(234,179,8,0.08)]")}>
                      {asset.imageUrl && (
                        <img
                          src={asset.imageUrl}
                          alt=""
                          className="size-[18px] rounded-[3px] object-cover shrink-0"
                        />
                      )}
                      {asset.assetTag}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="bg-none border-none shadow-none cursor-pointer text-[length:var(--text-sm)] text-[var(--text-secondary)] px-0.5 py-0 leading-none h-auto min-h-0 hover:text-[var(--red)] hover:bg-none max-md:min-w-7 max-md:min-h-7 max-md:inline-flex max-md:items-center max-md:justify-center"
                        onClick={() => setSelectedAssetIds((prev) => prev.filter((id) => id !== assetId))}
                        aria-label={`Remove ${asset.assetTag}`}
                      >
                        &times;
                      </Button>
                    </span>
                  );
                })}
                {selectedBulkItems.map((item) => {
                  const sku = bulkById.get(item.bulkSkuId);
                  return (
                    <span key={item.bulkSkuId} className="inline-flex items-center gap-0.5 py-[3px] px-1.5 rounded-[var(--radius)] bg-[var(--bg-active,#f0f4ff)] border border-[var(--border-light)] text-[length:var(--text-xs)] font-[number:var(--weight-medium)]">
                      {sku?.name || item.bulkSkuId}
                      <span className="inline-flex items-center gap-0.5 ml-0.5 text-[length:var(--text-3xs)]">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-[length:var(--text-xs)] font-[number:var(--weight-bold)] h-auto min-h-0 px-0.5 py-0 bg-none border-none shadow-none cursor-pointer leading-none"
                          onClick={() => {
                            if (item.quantity <= 1) setSelectedBulkItems((prev) => prev.filter((i) => i.bulkSkuId !== item.bulkSkuId));
                            else setSelectedBulkItems((prev) => prev.map((i) => i.bulkSkuId === item.bulkSkuId ? { ...i, quantity: i.quantity - 1 } : i));
                          }}
                          aria-label={`Decrease ${sku?.name || "item"} quantity`}
                        >
                          &minus;
                        </Button>
                        <span>{item.quantity}{sku && sku.currentQuantity > 0 ? `/${sku.currentQuantity}` : ""}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-[length:var(--text-xs)] font-[number:var(--weight-bold)] h-auto min-h-0 px-0.5 py-0 bg-none border-none shadow-none cursor-pointer leading-none"
                          onClick={() => setSelectedBulkItems((prev) => prev.map((i) => i.bulkSkuId === item.bulkSkuId ? { ...i, quantity: i.quantity + 1 } : i))}
                          disabled={!!sku && sku.currentQuantity > 0 && item.quantity >= sku.currentQuantity}
                          aria-label={`Increase ${sku?.name || "item"} quantity`}
                        >
                          +
                        </Button>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="bg-none border-none shadow-none cursor-pointer text-[length:var(--text-sm)] text-[var(--text-secondary)] px-0.5 py-0 leading-none h-auto min-h-0 hover:text-[var(--red)] hover:bg-none max-md:min-w-7 max-md:min-h-7 max-md:inline-flex max-md:items-center max-md:justify-center"
                        onClick={() => setSelectedBulkItems((prev) => prev.filter((i) => i.bulkSkuId !== item.bulkSkuId))}
                        aria-label={`Remove ${sku?.name || "item"}`}
                      >
                        &times;
                      </Button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {equipmentCount === 0 && !visible && (
        <div className="flex justify-between items-center">
          <div className="text-xs text-muted-foreground">
            No equipment selected. You can also add equipment after creating.
          </div>
          <Button
            type="button"
            variant="outline" size="sm"
            onClick={onReopen}
          >
            + Add equipment
          </Button>
        </div>
      )}

      {/* When picker is closed but items are selected, show compact summary */}
      {equipmentCount > 0 && !visible && (
        <div className="flex items-center gap-2.5 py-2 flex-wrap max-md:flex-col max-md:items-start max-md:gap-1.5">
          <div className="text-[length:var(--text-sm)] font-[number:var(--weight-semibold)] flex items-center gap-1.5 shrink-0">
            <Badge variant="default" className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-[var(--primary,#3b82f6)] text-white text-[length:var(--text-xs)] font-[number:var(--weight-bold)]">{equipmentCount}</Badge>
            item{equipmentCount !== 1 ? "s" : ""} selected
          </div>
          <div className="flex flex-wrap gap-1 flex-1 min-w-0">
            {selectedAssetIds.map((assetId) => {
              const asset = assetById.get(assetId);
              if (!asset) return null;
              return (
                <span key={assetId} className="inline-flex items-center gap-0.5 py-0.5 px-1.5 rounded-[var(--radius)] bg-[var(--bg-active,#f0f4ff)] border border-[var(--border-light)] text-[length:var(--text-3xs)] font-[number:var(--weight-medium)]">
                  {asset.imageUrl && <img src={asset.imageUrl} alt="" className="size-[18px] rounded-[3px] object-cover shrink-0" />}
                  {asset.assetTag}
                </span>
              );
            })}
            {selectedBulkItems.map((item) => {
              const sku = bulkById.get(item.bulkSkuId);
              return <span key={item.bulkSkuId} className="inline-flex items-center gap-0.5 py-0.5 px-1.5 rounded-[var(--radius)] bg-[var(--bg-active,#f0f4ff)] border border-[var(--border-light)] text-[length:var(--text-3xs)] font-[number:var(--weight-medium)]">{sku?.name || item.bulkSkuId} &times;{item.quantity}</span>;
            })}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onReopen}>Edit</Button>
        </div>
      )}

      {/* Scan-to-add overlay */}
      {showScanner && (
        <div
          className="fixed inset-0 z-[var(--z-scan-feedback)] bg-black/70 flex items-center max-md:items-end justify-center p-4 max-md:p-0"
          role="dialog"
          aria-modal="true"
          aria-label="Scan equipment QR code"
          onClick={(e) => { if (e.target === e.currentTarget) setShowScanner(false); }}
          onKeyDown={(e) => { if (e.key === "Escape") setShowScanner(false); }}
        >
          <div className="bg-[var(--panel,#fff)] rounded-2xl max-md:rounded-b-none p-5 max-w-[440px] w-full max-h-[90vh] max-md:max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold m-0">Scan to add equipment</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-[22px] text-muted-foreground p-1 px-2 leading-none h-auto min-h-0 max-md:min-w-11 max-md:min-h-11 max-md:inline-flex max-md:items-center max-md:justify-center"
                onClick={() => setShowScanner(false)}
                aria-label="Close scanner"
              >
                <XIcon className="size-4" />
              </Button>
            </div>
            <QrScanner
              onScan={handleScan}
              onError={() => showScanFeedbackMsg("Camera not available", "error")}
              active={showScanner}
            />
            {scanFeedback && (
              <div className={cn(
                "text-center py-2 px-3 rounded-md mt-2 text-sm font-semibold animate-in fade-in slide-in-from-top-1",
                scanFeedback.type === "success" && "text-[var(--green,#16a34a)] bg-[var(--green-bg)]",
                scanFeedback.type === "error" && "text-[var(--red,#dc2626)] bg-[var(--red-bg)]"
              )} role="status" aria-live="assertive">
                {scanFeedback.message}
              </div>
            )}
            <div className="text-center text-xs text-muted-foreground mt-3">
              Point camera at a QR code on equipment to add it
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
