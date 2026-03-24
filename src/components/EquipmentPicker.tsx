"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
};

export type BulkSelection = {
  bulkSkuId: string;
  quantity: number;
};

type ConflictInfo = {
  assetId: string;
  conflictingBookingTitle?: string;
  startsAt: string;
  endsAt: string;
};

export type EquipmentPickerProps = {
  assets: PickerAsset[];
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
}: EquipmentPickerProps) {
  // ── Internal UI state ──
  const [activeSection, setActiveSection] = useState<EquipmentSectionKey>(EQUIPMENT_SECTIONS[0].key);
  const [searchBySection, setSearchBySection] = useState<Record<EquipmentSectionKey, string>>({
    cameras: "", lenses: "", batteries: "", accessories: "", others: "",
  });
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const scanFeedbackTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // ── Availability preview state ──
  const [conflicts, setConflicts] = useState<Map<string, ConflictInfo>>(new Map());
  const [conflictsLoading, setConflictsLoading] = useState(false);
  const [conflictsError, setConflictsError] = useState(false);
  const availDebounce = useRef<ReturnType<typeof setTimeout>>(null);

  // ── Indexed lookups (O(1) instead of O(n)) ──
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const bulkById = useMemo(() => new Map(bulkSkus.map((s) => [s.id, s])), [bulkSkus]);
  const selectedIdSet = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds]);

  // ── Section grouping ──
  const assetsBySection = useMemo(() => groupAssetsBySection(assets), [assets]);
  const bulkBySection = useMemo(() => groupBulkBySection(bulkSkus), [bulkSkus]);

  const equipSearch = searchBySection[activeSection] || "";

  const sectionAssets = useMemo(() => {
    if (!activeSection) return [];
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
  }, [assetsBySection, activeSection, equipSearch, onlyAvailable]);

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
      const asset = assetById.get(id);
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
  }, [selectedAssetIds, selectedBulkItems, assetById, bulkById]);

  const sectionTotalCounts = useMemo(() => {
    const counts: Record<EquipmentSectionKey, number> = {
      cameras: 0, lenses: 0, batteries: 0, accessories: 0, others: 0,
    };
    for (const key of Object.keys(counts) as EquipmentSectionKey[]) {
      counts[key] = (assetsBySection[key]?.length || 0) + (bulkBySection[key]?.length || 0);
    }
    return counts;
  }, [assetsBySection, bulkBySection]);

  const equipmentCount = selectedAssetIds.length + selectedBulkItems.length;

  const selectedSectionKeys = useMemo(() => {
    const keys = new Set<EquipmentSectionKey>();
    for (const id of selectedAssetIds) {
      const asset = assetById.get(id);
      if (asset) keys.add(classifyAssetType(asset.type, asset.categoryName));
    }
    for (const item of selectedBulkItems) {
      const sku = bulkById.get(item.bulkSkuId);
      if (sku) keys.add(classifyAssetType(sku.category, sku.categoryName));
    }
    return Array.from(keys);
  }, [selectedAssetIds, selectedBulkItems, assetById, bulkById]);

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

  // ── Availability preview ──

  const abortRef = useRef<AbortController | null>(null);

  const fetchConflicts = useCallback(async () => {
    if (!startsAt || !endsAt || !locationId) {
      setConflicts(new Map());
      return;
    }
    const allAssetIds = assets.map((a) => a.id);
    if (allAssetIds.length === 0) return;

    // Abort any in-flight request to prevent stale data overwriting fresh
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setConflictsLoading(true);
    setConflictsError(false);
    try {
      const res = await fetch("/api/availability/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          serializedAssetIds: allAssetIds,
          bulkItems: [],
        }),
        signal: controller.signal,
      });
      if (res.ok) {
        const json = await res.json();
        const data = json.data as {
          conflicts?: Array<{ assetId: string; conflictingBookingTitle?: string; startsAt: string; endsAt: string }>;
        };
        const map = new Map<string, ConflictInfo>();
        if (data.conflicts) {
          for (const c of data.conflicts) {
            map.set(c.assetId, {
              assetId: c.assetId,
              conflictingBookingTitle: c.conflictingBookingTitle,
              startsAt: c.startsAt,
              endsAt: c.endsAt,
            });
          }
        }
        setConflicts(map);
      } else {
        setConflictsError(true);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setConflictsError(true);
    }
    setConflictsLoading(false);
  }, [startsAt, endsAt, locationId, assets]);

  useEffect(() => {
    if (availDebounce.current) clearTimeout(availDebounce.current);
    availDebounce.current = setTimeout(fetchConflicts, 500);
    return () => {
      if (availDebounce.current) clearTimeout(availDebounce.current);
      abortRef.current?.abort();
    };
  }, [fetchConflicts]);

  // Clean up scan feedback timer on unmount
  useEffect(() => {
    return () => { if (scanFeedbackTimer.current) clearTimeout(scanFeedbackTimer.current); };
  }, []);

  // ── Helpers ──

  function advanceToSection(key: EquipmentSectionKey) {
    setActiveSection(key);
  }

  function setSearch(value: string) {
    setSearchBySection((prev) => ({ ...prev, [activeSection]: value }));
  }

  function toggleAsset(id: string) {
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
    const sectionIds = new Set((assetsBySection[activeSection] || []).map((a) => a.id));
    setSelectedAssetIds((prev) => prev.filter((id) => !sectionIds.has(id)));
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

  // ── Scan-to-add ──

  function handleScanToAdd(value: string) {
    const bgMatch = value.match(/^bg:\/\/(item|case)\/(.+)$/);
    const searchValue = bgMatch ? bgMatch[2] : value;

    const asset = assets.find((a) =>
      a.qrCodeValue === value ||
      a.id === searchValue ||
      a.primaryScanCode === value ||
      a.assetTag.toLowerCase() === searchValue.toLowerCase()
    );

    if (asset) {
      // BRK-001: Check computedStatus — don't add unavailable items via scan
      const isAvailable = asset.computedStatus === "AVAILABLE";
      const hasConflict = conflicts.has(asset.id);
      if (!isAvailable && !hasConflict) {
        const statusLabel = asset.computedStatus.replace("_", " ").toLowerCase();
        showScanFeedbackMsg(`${asset.assetTag} is ${statusLabel}`, "error");
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        // Still navigate to the section so user can see the item
        setActiveSection(classifyAssetType(asset.type, asset.categoryName));
        return;
      }

      // BRK-002: Guard inside callback to prevent duplicate IDs from rapid scans
      let wasAdded = false;
      setSelectedAssetIds((prev) => {
        if (prev.includes(asset.id)) return prev;
        wasAdded = true;
        return [...prev, asset.id];
      });
      const section = classifyAssetType(asset.type, asset.categoryName);
      setActiveSection(section);
      // Use callback result for feedback — selectedIdSet may be stale under rapid scans
      const alreadySelected = selectedIdSet.has(asset.id);
      showScanFeedbackMsg(
        alreadySelected && !wasAdded ? `${asset.assetTag} already selected` : `Added ${asset.assetTag}`,
        alreadySelected && !wasAdded ? "error" : "success",
      );
      if (navigator.vibrate) navigator.vibrate(alreadySelected && !wasAdded ? [50, 50] : 100);
      return;
    }

    const sku = bulkSkus.find((s) => s.binQrCodeValue === value);
    if (sku) {
      // BRK-002: Guard inside callback for bulk items too
      let wasAdded = false;
      setSelectedBulkItems((prev) => {
        if (prev.some((i) => i.bulkSkuId === sku.id)) return prev;
        wasAdded = true;
        return [...prev, { bulkSkuId: sku.id, quantity: 1 }];
      });
      const section = classifyAssetType(sku.category, sku.categoryName);
      setActiveSection(section);
      const alreadySelected = selectedBulkItems.some((i) => i.bulkSkuId === sku.id);
      showScanFeedbackMsg(
        alreadySelected && !wasAdded ? `${sku.name} already selected` : `Added ${sku.name}`,
        alreadySelected && !wasAdded ? "error" : "success",
      );
      if (navigator.vibrate) navigator.vibrate(alreadySelected && !wasAdded ? [50, 50] : 100);
      return;
    }

    showScanFeedbackMsg("No matching item — check this location\u2019s inventory", "error");
    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
  }

  function showScanFeedbackMsg(message: string, type: "success" | "error") {
    setScanFeedback({ message, type });
    if (scanFeedbackTimer.current) clearTimeout(scanFeedbackTimer.current);
    scanFeedbackTimer.current = setTimeout(() => setScanFeedback(null), 2500);
  }

  function formatConflictDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const currentSectionSelected = selectedCountBySection[activeSection] || 0;

  return (
    <div className="equip-picker-wrap">
      <div className="equip-picker-header">
        <label className="equip-picker-label">
          Equipment
        </label>
        <div className="equip-picker-header-actions">
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
        <div className="section-picker" role="region" aria-label="Equipment picker">
          {/* Section tabs */}
          <div className="section-tabs" role="tablist" aria-label="Equipment sections">
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
                    "section-tab",
                    isActive && "active",
                  )}
                  onClick={() => setActiveSection(sec.key)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                >
                  {sec.label}
                  {selCount > 0 ? (
                    <span className="section-tab-count section-tab-count-selected">({selCount})</span>
                  ) : sectionTotalCounts[sec.key] > 0 ? (
                    <span className="section-tab-count">({sectionTotalCounts[sec.key]})</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Active section content */}
          {activeSection && (
            <div
              className="section-content"
              role="tabpanel"
              id={`picker-panel-${activeSection}`}
              aria-labelledby={`picker-tab-${activeSection}`}
            >
              {/* Search + "Only available" filter */}
              <div className="picker-toolbar">
                <div className="picker-search-wrap">
                  <SearchIcon className="picker-search-icon size-3.5" aria-hidden="true" />
                  <input
                    className="picker-search"
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
                      className="picker-search-clear"
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
                    "picker-filter-chip",
                    onlyAvailable && "picker-filter-chip-active",
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
                <div className="picker-col-header">
                  <div className="picker-col-header-check">
                    <Checkbox
                      checked={allSectionSelected ? true : someSectionSelected ? "indeterminate" : false}
                      onCheckedChange={toggleAllInSection}
                      aria-label={allSectionSelected ? "Deselect all items in section" : "Select all available items in section"}
                    />
                  </div>
                  <span className="picker-col-header-label">Item</span>
                  {currentSectionSelected > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="picker-col-header-deselect"
                      onClick={deselectAllInSection}
                    >
                      Deselect ({currentSectionSelected})
                    </Button>
                  )}
                  {equipSearch && (
                    <span className="picker-match-count" aria-live="polite">
                      {sectionAssets.length + sectionBulk.length} results
                    </span>
                  )}
                  {conflictsLoading && (
                    <span className="picker-avail-loading" aria-live="polite">Checking availability...</span>
                  )}
                  {conflictsError && !conflictsLoading && (
                    <button
                      type="button"
                      className="picker-avail-loading text-[var(--orange)] underline cursor-pointer"
                      onClick={fetchConflicts}
                      aria-live="polite"
                    >
                      Availability unavailable — retry
                    </button>
                  )}
                </div>
              )}

              <div className="picker-scroll" role="listbox" aria-label={`${EQUIPMENT_SECTIONS.find((s) => s.key === activeSection)?.label || "Items"} list`}>
                {/* Serialized assets */}
                {sectionAssets.length > 0 && (
                  <>
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
                            "picker-row",
                            isSelected && "picker-row-selected",
                            conflict && "picker-row-conflict",
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
                            className="picker-row-dot"
                            style={{ backgroundColor: dotColor }}
                            title={conflict ? "Scheduling conflict" : statusLabel}
                            aria-hidden="true"
                          />
                          <div className="picker-row-info">
                            <div className="picker-row-name">
                              {asset.assetTag}
                            </div>
                            <div className="picker-row-meta">
                              {asset.name || `${asset.brand} ${asset.model}`}
                              {asset.serialNumber ? ` \u00b7 ${asset.serialNumber}` : ""}
                              {asset.location ? ` \u00b7 ${asset.location.name}` : ""}
                              {!isAvailable && !conflict && ` \u00b7 ${statusLabel}`}
                            </div>
                            {conflict && (
                              <div className="picker-row-conflict-detail">
                                {"\u26a0"} {conflict.conflictingBookingTitle || "another booking"} ({formatConflictDate(conflict.startsAt)}{"\u2013"}{formatConflictDate(conflict.endsAt)})
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Bulk items */}
                {sectionBulk.length > 0 && (
                  <>
                    {sectionAssets.length > 0 && (
                      <div className="section-subheading" role="separator">Bulk Items</div>
                    )}
                    {sectionBulk.map((sku) => {
                      const isSelected = selectedBulkItems.some((i) => i.bulkSkuId === sku.id);
                      return (
                        <div
                          key={sku.id}
                          role="option"
                          aria-selected={isSelected}
                          tabIndex={0}
                          className={cn(
                            "picker-row picker-row-bulk",
                            isSelected && "picker-row-selected",
                          )}
                          onClick={() => {
                            if (isSelected) return;
                            setSelectedBulkItems((prev) =>
                              prev.some((i) => i.bulkSkuId === sku.id) ? prev : [...prev, { bulkSkuId: sku.id, quantity: 1 }]
                            );
                          }}
                          onKeyDown={(e) => {
                            if (isSelected) return;
                            if (e.key === " " || e.key === "Enter") {
                              e.preventDefault();
                              setSelectedBulkItems((prev) =>
                                prev.some((i) => i.bulkSkuId === sku.id) ? prev : [...prev, { bulkSkuId: sku.id, quantity: 1 }]
                              );
                            }
                          }}
                        >
                          <div className="picker-row-info">
                            <div className="picker-row-name">{sku.name}</div>
                            <div className="picker-row-meta">{sku.category} {"\u00b7"} {sku.unit}</div>
                          </div>
                          {isSelected && (
                            <Badge variant="green" size="sm">Added</Badge>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}

                {sectionAssets.length === 0 && sectionBulk.length === 0 && (
                  <div className="picker-empty" role="status">
                    {equipSearch
                      ? "No matching items"
                      : onlyAvailable && (sectionTotalCounts[activeSection] || 0) > 0
                        ? <>No available items in this section — <button type="button" className="underline cursor-pointer" onClick={() => setOnlyAvailable(false)}>show all</button></>
                        : onlyAvailable
                          ? "No available items in this section"
                          : "No items in this section"}
                  </div>
                )}
              </div>

              {/* Equipment guidance hints */}
              {activeGuidance.length > 0 && activeGuidance.map((rule) => (
                <div
                  key={rule.id}
                  data-guidance={rule.id}
                  className={cn(
                    "guidance-hint",
                    rule.level === "warning" ? "guidance-warning" : "guidance-info",
                  )}
                  role="alert"
                >
                  {rule.message}
                </div>
              ))}

              {/* Section navigation */}
              <div className="section-nav">
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

          {/* Sticky selection footer */}
          {equipmentCount > 0 && (
            <div className="picker-footer" aria-live="polite">
              <div className="picker-footer-count">
                <Badge variant="default" className="picker-footer-badge">{equipmentCount}</Badge>
                item{equipmentCount !== 1 ? "s" : ""} selected
              </div>
              <div className="picker-footer-items">
                {selectedAssetIds.map((assetId) => {
                  const asset = assetById.get(assetId);
                  if (!asset) return null;
                  const conflict = conflicts.get(assetId);
                  return (
                    <span key={assetId} className={cn("picker-footer-tag", conflict && "picker-footer-tag-conflict")}>
                      {asset.assetTag}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="picker-footer-tag-remove"
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
                    <span key={item.bulkSkuId} className="picker-footer-tag">
                      {sku?.name || item.bulkSkuId}
                      <span className="picker-footer-tag-qty">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="picker-footer-tag-qty-btn"
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
                          className="picker-footer-tag-qty-btn"
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
                        className="picker-footer-tag-remove"
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
        <div className="equip-empty-hint">
          <div className="equip-empty-text">
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
        <div className="picker-closed-summary">
          <div className="picker-closed-summary-count">
            <Badge variant="default" className="picker-footer-badge">{equipmentCount}</Badge>
            item{equipmentCount !== 1 ? "s" : ""} selected
          </div>
          <div className="picker-closed-summary-tags">
            {selectedAssetIds.map((assetId) => {
              const asset = assetById.get(assetId);
              if (!asset) return null;
              return <span key={assetId} className="picker-footer-tag picker-footer-tag-compact">{asset.assetTag}</span>;
            })}
            {selectedBulkItems.map((item) => {
              const sku = bulkById.get(item.bulkSkuId);
              return <span key={item.bulkSkuId} className="picker-footer-tag picker-footer-tag-compact">{sku?.name || item.bulkSkuId} &times;{item.quantity}</span>;
            })}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onReopen}>Edit</Button>
        </div>
      )}

      {/* Scan-to-add overlay */}
      {showScanner && (
        <div
          className="scan-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Scan equipment QR code"
          onClick={(e) => { if (e.target === e.currentTarget) setShowScanner(false); }}
          onKeyDown={(e) => { if (e.key === "Escape") setShowScanner(false); }}
        >
          <div className="scan-overlay-content">
            <div className="scan-overlay-header">
              <h3>Scan to add equipment</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="scan-overlay-close"
                onClick={() => setShowScanner(false)}
                aria-label="Close scanner"
              >
                <XIcon className="size-4" />
              </Button>
            </div>
            <QrScanner
              onScan={handleScanToAdd}
              onError={() => showScanFeedbackMsg("Camera not available", "error")}
              active={showScanner}
            />
            {scanFeedback && (
              <div className={cn("scan-feedback", `scan-feedback-${scanFeedback.type}`)} role="status" aria-live="assertive">
                {scanFeedback.message}
              </div>
            )}
            <div className="scan-overlay-hint">
              Point camera at a QR code on equipment to add it
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
