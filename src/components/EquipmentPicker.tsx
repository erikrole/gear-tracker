"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EQUIPMENT_SECTIONS,
  classifyAssetType,
  groupAssetsBySection,
  groupBulkBySection,
  sectionIndex,
  type EquipmentSectionKey,
} from "@/lib/equipment-sections";
import { getActiveGuidance, type GuidanceContext } from "@/lib/equipment-guidance";
import QrScanner from "@/components/QrScanner";

/* ───── Status dot colors ───── */

const STATUS_DOT_COLORS: Record<string, string> = {
  AVAILABLE: "var(--green)",
  CHECKED_OUT: "var(--red)",
  RESERVED: "#a855f7",
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
  const [highestReached, setHighestReached] = useState<EquipmentSectionKey>(EQUIPMENT_SECTIONS[0].key);
  const [searchBySection, setSearchBySection] = useState<Record<EquipmentSectionKey, string>>({
    cameras: "", lenses: "", batteries: "", accessories: "", others: "",
  });
  const [showScanner, setShowScanner] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const scanFeedbackTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // ── Availability preview state ──
  const [conflicts, setConflicts] = useState<Map<string, ConflictInfo>>(new Map());
  const [conflictsLoading, setConflictsLoading] = useState(false);
  const availDebounce = useRef<ReturnType<typeof setTimeout>>(null);

  // ── Section grouping ──
  const assetsBySection = useMemo(() => groupAssetsBySection(assets), [assets]);
  const bulkBySection = useMemo(() => groupBulkBySection(bulkSkus), [bulkSkus]);

  const equipSearch = searchBySection[activeSection] || "";

  const sectionAssets = useMemo(() => {
    if (!activeSection) return [];
    const q = equipSearch.toLowerCase();
    return (assetsBySection[activeSection] || []).filter((a) => {
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
  }, [assetsBySection, activeSection, equipSearch]);

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
      const asset = assets.find((a) => a.id === id);
      if (asset) {
        const sec = classifyAssetType(asset.type, asset.categoryName);
        counts[sec]++;
      }
    }
    for (const item of selectedBulkItems) {
      const sku = bulkSkus.find((s) => s.id === item.bulkSkuId);
      if (sku) {
        const sec = classifyAssetType(sku.category, sku.categoryName);
        counts[sec]++;
      }
    }
    return counts;
  }, [selectedAssetIds, selectedBulkItems, assets, bulkSkus]);

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
      const asset = assets.find((a) => a.id === id);
      if (asset) keys.add(classifyAssetType(asset.type, asset.categoryName));
    }
    for (const item of selectedBulkItems) {
      const sku = bulkSkus.find((s) => s.id === item.bulkSkuId);
      if (sku) keys.add(classifyAssetType(sku.category, sku.categoryName));
    }
    return Array.from(keys);
  }, [selectedAssetIds, selectedBulkItems, assets, bulkSkus]);

  const activeGuidance = useMemo(() => {
    if (!activeSection) return [];
    const ctx: GuidanceContext = { selectedSectionKeys, activeSection };
    return getActiveGuidance(ctx);
  }, [selectedSectionKeys, activeSection]);

  // ── Availability preview ──

  const fetchConflicts = useCallback(async () => {
    if (!startsAt || !endsAt || !locationId) {
      setConflicts(new Map());
      return;
    }
    const allAssetIds = assets.map((a) => a.id);
    if (allAssetIds.length === 0) return;

    setConflictsLoading(true);
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
      }
    } catch {
      // Availability check failed — silently degrade, show status dots only
    }
    setConflictsLoading(false);
  }, [startsAt, endsAt, locationId, assets]);

  useEffect(() => {
    if (availDebounce.current) clearTimeout(availDebounce.current);
    availDebounce.current = setTimeout(fetchConflicts, 500);
    return () => { if (availDebounce.current) clearTimeout(availDebounce.current); };
  }, [fetchConflicts]);

  // ── Helpers ──

  function advanceToSection(key: EquipmentSectionKey) {
    setActiveSection(key);
    if (sectionIndex(key) > sectionIndex(highestReached)) {
      setHighestReached(key);
    }
  }

  function setSearch(value: string) {
    setSearchBySection((prev) => ({ ...prev, [activeSection]: value }));
  }

  function toggleAsset(id: string) {
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function selectAllAvailable() {
    const availableIds = sectionAssets
      .filter((a) => a.computedStatus === "AVAILABLE" && !conflicts.has(a.id))
      .map((a) => a.id);
    setSelectedAssetIds((prev) => {
      const existing = new Set(prev);
      const toAdd = availableIds.filter((id) => !existing.has(id));
      return [...prev, ...toAdd];
    });
  }

  function deselectAllInSection() {
    const sectionIds = new Set((assetsBySection[activeSection] || []).map((a) => a.id));
    setSelectedAssetIds((prev) => prev.filter((id) => !sectionIds.has(id)));
    // Also remove bulk items in this section
    const sectionBulkIds = new Set((bulkBySection[activeSection] || []).map((s) => s.id));
    setSelectedBulkItems((prev) => prev.filter((i) => !sectionBulkIds.has(i.bulkSkuId)));
  }

  // ── Scan-to-add ──

  function handleScanToAdd(value: string) {
    // Parse bg://item/<uuid> or bg://case/<uuid> format
    const bgMatch = value.match(/^bg:\/\/(item|case)\/(.+)$/);
    const searchValue = bgMatch ? bgMatch[2] : value;

    // Find matching asset
    const asset = assets.find((a) =>
      a.qrCodeValue === value ||
      a.id === searchValue ||
      a.primaryScanCode === value ||
      a.assetTag.toLowerCase() === searchValue.toLowerCase()
    );

    if (asset) {
      // Add asset if not already selected
      setSelectedAssetIds((prev) => {
        if (prev.includes(asset.id)) return prev;
        return [...prev, asset.id];
      });
      // Navigate to the asset's section
      const section = classifyAssetType(asset.type, asset.categoryName);
      setActiveSection(section);
      showScanFeedback(`Added ${asset.assetTag}`, "success");
      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(100);
      return;
    }

    // Check bulk SKUs
    const sku = bulkSkus.find((s) => s.binQrCodeValue === value);
    if (sku) {
      setSelectedBulkItems((prev) => {
        if (prev.some((i) => i.bulkSkuId === sku.id)) return prev;
        return [...prev, { bulkSkuId: sku.id, quantity: 1 }];
      });
      const section = classifyAssetType(sku.category, sku.categoryName);
      setActiveSection(section);
      showScanFeedback(`Added ${sku.name}`, "success");
      if (navigator.vibrate) navigator.vibrate(100);
      return;
    }

    showScanFeedback("Item not found", "error");
    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
  }

  function showScanFeedback(message: string, type: "success" | "error") {
    setScanFeedback({ message, type });
    if (scanFeedbackTimer.current) clearTimeout(scanFeedbackTimer.current);
    scanFeedbackTimer.current = setTimeout(() => setScanFeedback(null), 2500);
  }

  function formatConflictDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  // ── Section counts for display ──
  const currentSectionSelected = selectedCountBySection[activeSection] || 0;

  return (
    <div className="equip-picker-wrap">
      <div className="equip-picker-header">
        <label className="equip-picker-label">
          Equipment{equipmentCount > 0 ? ` (${equipmentCount} selected)` : ""}
        </label>
        <div className="equip-picker-header-actions">
          {visible && (
            <>
              <button
                type="button"
                className="btn btn-sm btn-scan-add"
                onClick={() => setShowScanner(true)}
                title="Scan QR to add item"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="1" width="5" height="5" rx="1" />
                  <rect x="10" y="1" width="5" height="5" rx="1" />
                  <rect x="1" y="10" width="5" height="5" rx="1" />
                  <rect x="10" y="10" width="2" height="2" />
                  <path d="M13 10h2v5h-5v-2" />
                </svg>
                Scan
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={onDone}
              >
                Done adding
              </button>
            </>
          )}
        </div>
      </div>

      {/* Selected items summary strip */}
      {equipmentCount > 0 && (
        <div className="equip-selected-box">
          {selectedAssetIds.map((assetId) => {
            const asset = assets.find((a) => a.id === assetId);
            if (!asset) return null;
            const conflict = conflicts.get(assetId);
            return (
              <div key={assetId} className={`equip-selected-row${conflict ? " equip-selected-conflict" : ""}`}>
                <div className="flex-truncate">
                  <span className="equip-selected-tag">{asset.assetTag}</span>
                  <span className="equip-selected-detail">{asset.name || `${asset.brand} ${asset.model}`}</span>
                  {conflict && (
                    <span className="equip-conflict-badge-sm" title={`Conflicts with "${conflict.conflictingBookingTitle}"`}>
                      {"\u26a0"}
                    </span>
                  )}
                </div>
                <button type="button" className="remove-btn"
                  onClick={() => setSelectedAssetIds((prev) => prev.filter((id) => id !== assetId))}>&times;</button>
              </div>
            );
          })}
          {selectedBulkItems.map((item) => {
            const sku = bulkSkus.find((s) => s.id === item.bulkSkuId);
            return (
              <div key={item.bulkSkuId} className="equip-selected-row">
                <div className="flex-truncate">
                  <span className="equip-selected-tag">{sku?.name || item.bulkSkuId}</span>
                  <span className="equip-selected-detail">&times;{item.quantity}</span>
                </div>
                <div className="bulk-actions">
                  <div className="qty-stepper">
                    <button type="button" onClick={() => {
                      if (item.quantity <= 1) setSelectedBulkItems((prev) => prev.filter((i) => i.bulkSkuId !== item.bulkSkuId));
                      else setSelectedBulkItems((prev) => prev.map((i) => i.bulkSkuId === item.bulkSkuId ? { ...i, quantity: i.quantity - 1 } : i));
                    }}>&minus;</button>
                    <input type="number" min={1} value={item.quantity} onChange={(e) => {
                      const qty = parseInt(e.target.value) || 1;
                      if (qty <= 0) setSelectedBulkItems((prev) => prev.filter((i) => i.bulkSkuId !== item.bulkSkuId));
                      else setSelectedBulkItems((prev) => prev.map((i) => i.bulkSkuId === item.bulkSkuId ? { ...i, quantity: qty } : i));
                    }} />
                    <button type="button" onClick={() => setSelectedBulkItems((prev) => prev.map((i) => i.bulkSkuId === item.bulkSkuId ? { ...i, quantity: i.quantity + 1 } : i))}>+</button>
                  </div>
                  <button type="button" className="remove-btn"
                    onClick={() => setSelectedBulkItems((prev) => prev.filter((i) => i.bulkSkuId !== item.bulkSkuId))}>&times;</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sectioned picker */}
      {visible && (
        <div className="section-picker">
          {/* Section tabs */}
          <div className="section-tabs">
            {EQUIPMENT_SECTIONS.map((sec) => {
              const isActive = activeSection === sec.key;
              const selCount = selectedCountBySection[sec.key] || 0;
              return (
                <button
                  key={sec.key}
                  type="button"
                  className={`section-tab${isActive ? " active" : ""}`}
                  onClick={() => setActiveSection(sec.key)}
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
            <div className="section-content">
              {/* Search + section actions */}
              <div className="picker-toolbar">
                <input
                  className="picker-search"
                  placeholder={`Search ${EQUIPMENT_SECTIONS.find((s) => s.key === activeSection)?.label.toLowerCase() || "items"}...`}
                  value={equipSearch}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {equipSearch && (
                  <button type="button" className="picker-search-clear" onClick={() => setSearch("")}>&times;</button>
                )}
              </div>

              {/* Section bulk actions */}
              <div className="picker-section-actions">
                <button
                  type="button"
                  className="btn btn-xs"
                  onClick={selectAllAvailable}
                  title="Select all available items in this section"
                >
                  Select all available
                </button>
                {currentSectionSelected > 0 && (
                  <button
                    type="button"
                    className="btn btn-xs"
                    onClick={deselectAllInSection}
                  >
                    Deselect section ({currentSectionSelected})
                  </button>
                )}
                {equipSearch && (
                  <span className="picker-match-count">
                    {sectionAssets.length + sectionBulk.length} of {(assetsBySection[activeSection]?.length || 0) + (bulkBySection[activeSection]?.length || 0)} items
                  </span>
                )}
                {conflictsLoading && (
                  <span className="picker-avail-loading">Checking availability...</span>
                )}
              </div>

              <div className="picker-scroll">
                {/* Serialized assets */}
                {sectionAssets.length > 0 && (
                  <>
                    {sectionBulk.length > 0 && (
                      <div className="section-subheading">Assets</div>
                    )}
                    {sectionAssets.map((asset) => {
                      const isSelected = selectedAssetIds.includes(asset.id);
                      const isAvailable = asset.computedStatus === "AVAILABLE";
                      const conflict = conflicts.get(asset.id);
                      const dotColor = conflict
                        ? "var(--orange)"
                        : STATUS_DOT_COLORS[asset.computedStatus] || "var(--text-muted)";
                      const statusLabel = asset.computedStatus.replace("_", " ").toLowerCase();
                      return (
                        <label
                          key={asset.id}
                          className={`equip-picker-item equip-picker-checkbox-row${isSelected ? " equip-picker-item-selected" : ""}${conflict ? " equip-picker-item-conflict" : ""}`}
                          data-unavailable={!isAvailable && !conflict ? true : undefined}
                        >
                          <input
                            type="checkbox"
                            className="equip-checkbox"
                            checked={isSelected}
                            onChange={() => toggleAsset(asset.id)}
                            disabled={!isAvailable && !conflict}
                          />
                          <span className="equip-picker-dot" style={{ backgroundColor: dotColor }} title={conflict ? "scheduling conflict" : statusLabel} />
                          <div className="flex-truncate">
                            <div className="asset-tag-label">
                              {asset.assetTag}
                            </div>
                            <div className="equip-picker-meta">
                              {asset.name || `${asset.brand} ${asset.model}`}
                              {asset.serialNumber ? ` \u00b7 SN: ${asset.serialNumber}` : ""}
                              {asset.location ? ` \u00b7 ${asset.location.name}` : ""}
                              {!isAvailable && !conflict && ` \u00b7 ${statusLabel}`}
                            </div>
                            {conflict && (
                              <div className="equip-conflict-badge">
                                {"\u26a0"} Reserved: {conflict.conflictingBookingTitle || "another booking"} ({formatConflictDate(conflict.startsAt)}{"\u2013"}{formatConflictDate(conflict.endsAt)})
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </>
                )}

                {/* Bulk items */}
                {sectionBulk.length > 0 && (
                  <>
                    {sectionAssets.length > 0 && (
                      <div className="section-subheading">Bulk Items</div>
                    )}
                    {sectionBulk.map((sku) => {
                      const isSelected = selectedBulkItems.some((i) => i.bulkSkuId === sku.id);
                      return (
                        <div
                          key={sku.id}
                          className={`equip-picker-item${isSelected ? " equip-picker-item-selected" : ""}`}
                          onClick={() => {
                            if (isSelected) return;
                            setSelectedBulkItems((prev) =>
                              prev.some((i) => i.bulkSkuId === sku.id) ? prev : [...prev, { bulkSkuId: sku.id, quantity: 1 }]
                            );
                          }}
                        >
                          <div>
                            <div className="bulk-sku-name">{sku.name}</div>
                            <div className="equip-picker-meta">{sku.category} {"\u00b7"} {sku.unit}</div>
                          </div>
                          {isSelected && (
                            <span className="equip-picker-added-badge">Added</span>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}

                {sectionAssets.length === 0 && sectionBulk.length === 0 && (
                  <div className="empty-message">
                    {equipSearch ? "No matching items in this section" : "No available items in this section"}
                  </div>
                )}
              </div>

              {/* Equipment guidance hints */}
              {activeGuidance.length > 0 && activeGuidance.map((rule) => (
                <div
                  key={rule.id}
                  data-guidance={rule.id}
                  className={`guidance-hint ${rule.level === "warning" ? "guidance-warning" : "guidance-info"}`}
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
                        <button type="button" className="btn btn-sm" onClick={() => advanceToSection(prev.key)}>
                          {"\u2190"} {prev.label}
                        </button>
                      ) : <span />}
                      {next ? (
                        <button type="button" className="btn btn-sm" onClick={() => advanceToSection(next.key)}>
                          {next.label} {"\u2192"}
                        </button>
                      ) : (
                        <button type="button" className="btn btn-sm" onClick={onDone}>
                          Done
                        </button>
                      )}
                    </>
                  );
                })()}
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
          <button
            type="button"
            className="btn btn-sm"
            onClick={onReopen}
          >
            + Add equipment
          </button>
        </div>
      )}

      {/* Scan-to-add overlay */}
      {showScanner && (
        <div className="scan-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowScanner(false); }}>
          <div className="scan-overlay-content">
            <div className="scan-overlay-header">
              <h3>Scan to add equipment</h3>
              <button type="button" className="scan-overlay-close" onClick={() => setShowScanner(false)}>&times;</button>
            </div>
            <QrScanner
              onScan={handleScanToAdd}
              onError={() => showScanFeedback("Camera not available", "error")}
              active={showScanner}
            />
            {scanFeedback && (
              <div className={`scan-feedback scan-feedback-${scanFeedback.type}`}>
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
