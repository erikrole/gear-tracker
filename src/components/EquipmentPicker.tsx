"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { usePickerSearch } from "@/components/equipment-picker/use-picker-search";
import {
  useConflictCheck,
  type BulkTurnaroundRiskInfo,
  type ConflictInfo,
  type TurnaroundRiskInfo,
  type UpcomingCommitmentInfo,
} from "@/components/equipment-picker/use-conflict-check";
import {
  EQUIPMENT_SECTIONS,
  classifyAssetType,
  groupBulkBySection,
  type EquipmentSectionKey,
} from "@/lib/equipment-sections";
import {
  AlertCircleIcon,
  CameraIcon,
  CheckCircle2Icon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { handleAuthRedirect, isAbortError, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
import { getBatteryCompatibilitySummaries } from "@/lib/battery-compatibility";
import { AssetImage } from "@/components/AssetImage";
import QrScanner from "@/components/QrScanner";

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
  currentHolder?: { bookingId: string; bookingTitle: string; holderName: string; endsAt?: string | null } | null;
};

export type PickerBulkSku = {
  id: string;
  name: string;
  unit: string;
  category: string;
  currentQuantity: number;
  availableQuantity?: number;
  minThreshold?: number | null;
  trackByNumber?: boolean;
  binQrCodeValue?: string | null;
  categoryName?: string | null;
  imageUrl?: string | null;
};

export type BulkSelection = {
  bulkSkuId: string;
  quantity: number;
};

export type EquipmentPickerSelectionState = {
  totalSelected: number;
  resolvedAssetCount: number;
  bulkQuantity: number;
  unresolvedAssetCount: number;
  conflictCount: number;
  checkingAvailability: boolean;
};

export type EquipmentPickerProps = {
  bulkSkus: PickerBulkSku[];
  selectedAssetIds: string[];
  setSelectedAssetIds: Dispatch<SetStateAction<string[]>>;
  selectedBulkItems: BulkSelection[];
  setSelectedBulkItems: Dispatch<SetStateAction<BulkSelection[]>>;
  /** Booking window start (ISO string) — used for availability conflict check */
  startsAt?: string;
  /** Booking window end (ISO string) — used for availability conflict check */
  endsAt?: string;
  /** Location filter for availability check */
  locationId?: string;
  /** Booking to exclude when editing equipment on an existing booking */
  excludeBookingId?: string;
  /** Pre-selected assets to seed the display cache (search mode) */
  initialSelectedAssets?: PickerAsset[];
  /** Called when selection changes with resolved asset objects */
  onSelectedAssetsChange?: (assets: PickerAsset[]) => void;
  /** Called when selection state changes with counts used by parent flow chrome */
  onSelectionStateChange?: (state: EquipmentPickerSelectionState) => void;
  /** Controlled active section (for parent tab-advance logic) */
  activeSection?: EquipmentSectionKey;
  /** Called when active section changes */
  onActiveSectionChange?: (section: EquipmentSectionKey) => void;
};

export { type BulkTurnaroundRiskInfo, type ConflictInfo, type TurnaroundRiskInfo, type UpcomingCommitmentInfo };

function formatUpcomingStart(startsAt: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(startsAt));
}

function upcomingCommitmentLabel(commitment: UpcomingCommitmentInfo) {
  return `Back before ${formatUpcomingStart(commitment.startsAt)}`;
}

function upcomingCommitmentTitle(commitment: UpcomingCommitmentInfo) {
  return commitment.bookingTitle
    ? `Needed next for ${commitment.bookingTitle}`
    : "Needed next by another booking";
}

function primaryRisk<T extends { severity: "warning" | "critical" }>(risks: T[] | undefined) {
  if (!risks || risks.length === 0) return undefined;
  return risks.find((risk) => risk.severity === "critical") ?? risks[0];
}

function riskLabel(risks: Array<{ message: string; severity: "warning" | "critical" }> | undefined) {
  const risk = primaryRisk(risks);
  if (!risk) return null;
  return risks && risks.length > 1 ? `${risk.message} +${risks.length - 1}` : risk.message;
}

function riskTitle(risks: Array<{ message: string }> | undefined) {
  return risks?.map((risk) => risk.message).join(" · ") || "Turnaround risk";
}

function statusText(status: string) {
  return status.replace(/_/g, " ").toLowerCase();
}

function getBulkAvailable(sku: PickerBulkSku) {
  return Math.max(0, sku.availableQuantity ?? sku.currentQuantity);
}

function bulkQuantityHint(sku: PickerBulkSku) {
  return sku.trackByNumber
    ? "units scan at pickup"
    : "count only";
}

function selectedBulkQuantityText(sku: PickerBulkSku, quantity: number) {
  return sku.trackByNumber
    ? `${quantity} requested · units scan at pickup`
    : `${quantity} requested`;
}

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
  excludeBookingId,
  initialSelectedAssets,
  onSelectedAssetsChange,
  onSelectionStateChange,
  activeSection: controlledSection,
  onActiveSectionChange,
}: EquipmentPickerProps) {
  const [internalSection, setInternalSection] = useState<EquipmentSectionKey>(EQUIPMENT_SECTIONS[0]!.key);
  const activeSection = controlledSection ?? internalSection;
  const setActiveSection = (sec: EquipmentSectionKey) => {
    setInternalSection(sec);
    onActiveSectionChange?.(sec);
  };
  const activeSectionMeta = EQUIPMENT_SECTIONS.find((s) => s.key === activeSection) ?? EQUIPMENT_SECTIONS[0]!;
  const [sectionSearchBySection, setSectionSearchBySection] = useState<Record<EquipmentSectionKey, string>>({
    cameras: "",
    lenses: "",
    batteries: "",
    audio: "",
    tripods: "",
    lighting: "",
    other: "",
  });
  const sectionSearch = sectionSearchBySection[activeSection] ?? "";
  const setSectionSearch = (value: string) => {
    setSectionSearchBySection((prev) => ({ ...prev, [activeSection]: value }));
  };
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [scanLookupBusy, setScanLookupBusy] = useState(false);
  const [cacheVersion, setCacheVersion] = useState(0);

  // Asset cache so we can display selected items even after switching sections
  const [selectedAssetsCache] = useState<Map<string, PickerAsset>>(() => {
    const m = new Map<string, PickerAsset>();
    if (initialSelectedAssets) for (const a of initialSelectedAssets) m.set(a.id, a);
    return m;
  });

  const rememberAsset = useCallback((asset: PickerAsset) => {
    const existing = selectedAssetsCache.get(asset.id);
    if (
      existing?.assetTag === asset.assetTag &&
      existing?.computedStatus === asset.computedStatus &&
      existing?.imageUrl === asset.imageUrl
    ) {
      return;
    }
    selectedAssetsCache.set(asset.id, asset);
    setCacheVersion((version) => version + 1);
  }, [selectedAssetsCache]);

  // ── Data hooks ──
  const { sectionResults, total, sectionCounts, searchLoading, searchError, retry: retrySearch } = usePickerSearch({
    activeSection,
    equipSearch: sectionSearch,
    onlyAvailable,
  });

  const bulkById = useMemo(() => new Map(bulkSkus.map((s) => [s.id, s])), [bulkSkus]);
  const bulkBySection = useMemo(() => groupBulkBySection(bulkSkus), [bulkSkus]);

  // ── Section data ──
  const sectionBulk = useMemo(() => {
    const q = sectionSearch.toLowerCase();
    return (bulkBySection[activeSection] || []).filter((s) =>
      !q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    );
  }, [bulkBySection, activeSection, sectionSearch]);

  const conflictPreviewAssetIds = useMemo(() => {
    return Array.from(new Set([...sectionResults.map((asset) => asset.id), ...selectedAssetIds]));
  }, [sectionResults, selectedAssetIds]);

  const bulkPreviewItems = useMemo(() => {
    const quantities = new Map<string, number>();
    for (const item of selectedBulkItems) quantities.set(item.bulkSkuId, item.quantity);
    for (const sku of sectionBulk) {
      if (!quantities.has(sku.id)) quantities.set(sku.id, 1);
    }
    return Array.from(quantities, ([bulkSkuId, quantity]) => ({ bulkSkuId, quantity }));
  }, [sectionBulk, selectedBulkItems]);

  const {
    conflicts,
    upcomingCommitments,
    turnaroundRisks,
    bulkTurnaroundRisks,
    checking: conflictsLoading,
  } = useConflictCheck({
    startsAt,
    endsAt,
    locationId,
    assetIds: conflictPreviewAssetIds,
    bulkItems: bulkPreviewItems,
    excludeBookingId,
  });

  useEffect(() => {
    for (const asset of sectionResults) rememberAsset(asset);
  }, [sectionResults, rememberAsset]);

  // Hydrate deep-linked or draft-selected IDs that are outside the currently loaded section.
  useEffect(() => {
    const missingIds = selectedAssetIds.filter((id) => !selectedAssetsCache.has(id));
    if (missingIds.length === 0) return;
    const controller = new AbortController();
    async function hydrateSelectedAssets() {
      try {
        const params = new URLSearchParams();
        params.set("ids", missingIds.join(","));
        params.set("limit", String(missingIds.length));
        const res = await fetch(`/api/assets/picker-search?${params}`, { signal: controller.signal });
        if (handleAuthRedirect(res)) return;
        if (!res.ok) return;
        const json = await parseJsonSafely<{ data?: { assets?: PickerAsset[] } }>(res);
        const assets = json?.data?.assets ?? [];
        for (const asset of assets) rememberAsset(asset);
      } catch (err) {
        if (isAbortError(err)) return;
      }
    }
    hydrateSelectedAssets();
    return () => controller.abort();
  }, [rememberAsset, selectedAssetIds, selectedAssetsCache]);

  // Delay showing the "Checking availability..." indicator to avoid flicker on fast checks.
  const [deferredConflictsLoading, setDeferredConflictsLoading] = useState(false);
  useEffect(() => {
    if (conflictsLoading) {
      const t = setTimeout(() => setDeferredConflictsLoading(true), 200);
      return () => clearTimeout(t);
    }
    setDeferredConflictsLoading(false);
  }, [conflictsLoading]);

  // ── Indexed lookups ──
  const assetById = useMemo(() => {
    const m = new Map<string, PickerAsset>();
    for (const a of sectionResults) m.set(a.id, a);
    selectedAssetsCache.forEach((a, id) => { if (!m.has(id)) m.set(id, a); });
    return m;
  }, [sectionResults, selectedAssetsCache, cacheVersion]);

  const selectedIdSet = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds]);

  const visibleAvailableAssetIds = useMemo(() => {
    return sectionResults
      .filter((asset) => asset.computedStatus === "AVAILABLE" && !conflicts.has(asset.id))
      .map((asset) => asset.id);
  }, [conflicts, sectionResults]);

  // ── Selected count per section (for tab badges) ──
  const selectedBySection = useMemo(() => {
    const c: Record<EquipmentSectionKey, number> = { cameras: 0, lenses: 0, batteries: 0, audio: 0, tripods: 0, lighting: 0, other: 0 };
    for (const id of selectedAssetIds) {
      const a = selectedAssetsCache.get(id) ?? assetById.get(id);
      if (a) c[classifyAssetType(a.type, a.categoryName)]++;
    }
    for (const item of selectedBulkItems) {
      const sku = bulkById.get(item.bulkSkuId);
      if (sku) c[classifyAssetType(sku.category, sku.categoryName)]++;
    }
    return c;
  }, [selectedAssetIds, selectedBulkItems, assetById, bulkById, selectedAssetsCache, cacheVersion]);

  // ── Resolved selected items for shelf display ──
  const resolvedSelectedAssets = useMemo(() => {
    return selectedAssetIds
      .map((id) => selectedAssetsCache.get(id) ?? assetById.get(id))
      .filter((a): a is PickerAsset => !!a);
  }, [selectedAssetIds, assetById, selectedAssetsCache, cacheVersion]);

  const unresolvedSelectedAssetIds = useMemo(() => {
    return selectedAssetIds.filter((id) => !assetById.has(id) && !selectedAssetsCache.has(id));
  }, [assetById, selectedAssetIds, selectedAssetsCache, cacheVersion]);

  // ── Notify parent of resolved asset details ──
  useEffect(() => {
    if (!onSelectedAssetsChange) return;
    onSelectedAssetsChange(resolvedSelectedAssets);
  }, [resolvedSelectedAssets, onSelectedAssetsChange]);

  const batteryGuidance = useMemo(
    () => getBatteryCompatibilitySummaries({
      cameraAssets: resolvedSelectedAssets,
      bulkSkus,
    }),
    [bulkSkus, resolvedSelectedAssets],
  );
  const visibleBatteryGuidance = useMemo(
    () => activeSection === "batteries"
      ? batteryGuidance
      : batteryGuidance.filter((item) => item.isLow),
    [activeSection, batteryGuidance],
  );

  // ── Helpers ──

  function toggleAsset(id: string, asset?: PickerAsset) {
    if (asset) rememberAsset(asset);
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function setBulkQty(bulkSkuId: string, qty: number) {
    const sku = bulkById.get(bulkSkuId);
    const maxQty = sku ? getBulkAvailable(sku) : Number.POSITIVE_INFINITY;
    const nextQty = Math.min(Math.max(0, qty), maxQty);

    if (nextQty <= 0) {
      setSelectedBulkItems((prev) => prev.filter((i) => i.bulkSkuId !== bulkSkuId));
    } else {
      setSelectedBulkItems((prev) => {
        const existing = prev.find((i) => i.bulkSkuId === bulkSkuId);
        if (existing) return prev.map((i) => i.bulkSkuId === bulkSkuId ? { ...i, quantity: nextQty } : i);
        return [...prev, { bulkSkuId, quantity: nextQty }];
      });
    }
  }

  function selectVisibleAvailable() {
    for (const asset of sectionResults) rememberAsset(asset);
    setSelectedAssetIds((prev) => Array.from(new Set([...prev, ...visibleAvailableAssetIds])));
  }

  function clearCurrentSection() {
    const assetIdsInSection = new Set(
      selectedAssetIds.filter((id) => {
        const asset = selectedAssetsCache.get(id) ?? assetById.get(id);
        return asset && classifyAssetType(asset.type, asset.categoryName) === activeSection;
      }),
    );
    const bulkIdsInSection = new Set(
      (bulkBySection[activeSection] || []).map((sku) => sku.id),
    );
    setSelectedAssetIds((prev) => prev.filter((id) => !assetIdsInSection.has(id)));
    setSelectedBulkItems((prev) => prev.filter((item) => !bulkIdsInSection.has(item.bulkSkuId)));
  }

  function clearAllSelections() {
    setSelectedAssetIds([]);
    setSelectedBulkItems([]);
  }

  const findBulkScanMatch = useCallback((scanValue: string) => {
    const normalized = scanValue.trim().toLowerCase();
    if (!normalized) return null;
    return bulkSkus.find((sku) =>
      sku.binQrCodeValue?.toLowerCase() === normalized ||
      sku.id.toLowerCase() === normalized ||
      sku.name.toLowerCase() === normalized
    ) ?? null;
  }, [bulkSkus]);

  const handleScan = useCallback(async (rawValue: string) => {
    const value = rawValue.trim();
    if (!value || scanLookupBusy) return;
    setScanLookupBusy(true);
    setScanFeedback(null);

    const itemMatch = value.match(/^bg:\/\/item\/(.+)$/i);
    const scannedId = itemMatch?.[1];
    const bulkMatch = findBulkScanMatch(value);
    if (bulkMatch) {
      const current = selectedBulkItems.find((item) => item.bulkSkuId === bulkMatch.id)?.quantity ?? 0;
      const available = getBulkAvailable(bulkMatch);
      setActiveSection(classifyAssetType(bulkMatch.category, bulkMatch.categoryName));
      if (available === 0 || current >= available) {
        setScanFeedback({ kind: "error", message: `No available ${bulkMatch.name} left to add` });
        setScanLookupBusy(false);
        return;
      }
      setBulkQty(bulkMatch.id, current + 1);
      setScanFeedback({ kind: "success", message: `Requested ${current + 1} ${bulkMatch.name}` });
      setScanLookupBusy(false);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (scannedId) {
        params.set("ids", scannedId);
      } else {
        params.set("qr", value);
      }
      params.set("limit", "1");
      const res = await fetch(`/api/assets/picker-search?${params}`);
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        setScanFeedback({ kind: "error", message: await parseErrorMessage(res, "Could not look up that scan code") });
        return;
      }
      const json = await parseJsonSafely<{ data?: { assets?: PickerAsset[] } }>(res);
      const asset = json?.data?.assets?.[0] ?? null;
      if (!asset) {
        setScanFeedback({ kind: "error", message: "No matching item found in inventory" });
        return;
      }
      rememberAsset(asset);
      setActiveSection(classifyAssetType(asset.type, asset.categoryName));
      if (asset.computedStatus !== "AVAILABLE") {
        setScanFeedback({
          kind: "error",
          message: `${asset.assetTag} is ${statusText(asset.computedStatus)} and cannot be added`,
        });
        return;
      }
      if (selectedAssetIds.includes(asset.id)) {
        setScanFeedback({ kind: "success", message: `${asset.assetTag} is already selected` });
        return;
      }
      setSelectedAssetIds((prev) => prev.includes(asset.id) ? prev : [...prev, asset.id]);
      setScanFeedback({ kind: "success", message: `Added ${asset.assetTag}` });
    } catch {
      setScanFeedback({ kind: "error", message: "Scan lookup failed. Check the connection and try again." });
    } finally {
      setScanLookupBusy(false);
    }
  }, [findBulkScanMatch, rememberAsset, scanLookupBusy, selectedAssetIds, selectedBulkItems]);

  const bulkQuantity = selectedBulkItems.reduce((s, i) => s + i.quantity, 0);
  const selectedConflictCount = resolvedSelectedAssets.filter((asset) => conflicts.has(asset.id)).length;
  const totalSelected = selectedAssetIds.length + bulkQuantity;
  const currentSectionSelected = selectedBySection[activeSection] || 0;
  const visibleCount = sectionResults.length + sectionBulk.length;
  const matchingCount = total + sectionBulk.length;
  const visibleLabel = sectionSearch
    ? `${matchingCount} matching ${activeSectionMeta.label.toLowerCase()}`
    : `${visibleCount} visible`;
  const emptyDescription = sectionSearch
    ? "Clear search or switch sections."
    : onlyAvailable
      ? "Show unavailable gear or switch sections."
      : "Try another equipment section.";

  useEffect(() => {
    if (!onSelectionStateChange) return;
    onSelectionStateChange({
      totalSelected,
      resolvedAssetCount: resolvedSelectedAssets.length,
      bulkQuantity,
      unresolvedAssetCount: unresolvedSelectedAssetIds.length,
      conflictCount: selectedConflictCount,
      checkingAvailability: conflictsLoading,
    });
  }, [
    bulkQuantity,
    conflictsLoading,
    onSelectionStateChange,
    resolvedSelectedAssets.length,
    selectedConflictCount,
    totalSelected,
    unresolvedSelectedAssetIds.length,
  ]);

  // ── Render ──

  return (
    <div className="overflow-hidden rounded-md border border-border/60 bg-card/70 shadow-xs">
      {/* ── Section tabs ── */}
      <Tabs value={activeSection} onValueChange={(value) => { setActiveSection(value as EquipmentSectionKey); }}>
        <TabsList className="overflow-x-auto bg-background px-1">
          {EQUIPMENT_SECTIONS.map((sec) => {
            const selectedCount = selectedBySection[sec.key] || 0;
            const sectionTotal = sectionCounts?.[sec.key];
            return (
              <TabsTrigger
                key={sec.key}
                value={sec.key}
                className="min-h-11 shrink-0 gap-1.5 px-3"
              >
                {sec.label}
                {selectedCount > 0 ? (
                  <Badge variant="secondary" size="sm" className="h-4 min-w-4 px-1 text-[10px]">
                    {selectedCount}
                  </Badge>
                ) : sectionTotal !== undefined ? (
                  <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                    {sectionTotal}
                  </span>
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* ── Search + action bar ── */}
      <div className="flex flex-col gap-2 border-b border-border/60 bg-background p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={`equipment-picker-search-${activeSection}`}
              name={`equipment-picker-search-${activeSection}`}
              placeholder={`Search ${activeSectionMeta.label.toLowerCase()}`}
              value={sectionSearch}
              onChange={(e) => setSectionSearch(e.target.value)}
              className="h-10 pl-8 pr-8"
            />
            {sectionSearch && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSectionSearch("")}
                className="absolute right-0 top-1/2 size-10 -translate-y-1/2"
                aria-label="Clear equipment search"
              >
                <XIcon />
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground shadow-xs">
              <Checkbox
                checked={onlyAvailable}
                onCheckedChange={(checked) => setOnlyAvailable(checked === true)}
                aria-label="Show available equipment only"
              />
              Available only
            </label>
            <Button type="button" variant="outline" size="sm" onClick={() => setScannerOpen((open) => !open)}>
              <CameraIcon data-icon="inline-start" />
              Scan
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{visibleLabel}</span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={selectVisibleAvailable}
              disabled={visibleAvailableAssetIds.length === 0}
              className="h-10 text-xs"
            >
              Select visible available
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearCurrentSection}
              disabled={currentSectionSelected === 0}
              className="h-10 text-xs"
            >
              Clear section
            </Button>
          </div>
        </div>
      </div>

      {scannerOpen && (
        <div className="border-b border-border/60 bg-background p-3">
          <div className="flex items-center justify-between gap-3 pb-3">
            <div>
              <p className="text-sm font-semibold">Scan to add</p>
              <p className="text-xs text-muted-foreground">Scan a QR code or barcode to add it without leaving this step.</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10"
              onClick={() => setScannerOpen(false)}
              aria-label="Close scanner"
            >
              <XIcon />
            </Button>
          </div>
          <QrScanner onScan={handleScan} onError={(message) => setScanFeedback({ kind: "error", message })} active={scannerOpen} />
          {scanFeedback && (
            <Alert
              variant={scanFeedback.kind === "error" ? "destructive" : "default"}
              className="mt-3 py-2.5"
            >
              {scanFeedback.kind === "error" ? <AlertCircleIcon /> : <CheckCircle2Icon />}
              <AlertDescription>{scanFeedback.message}</AlertDescription>
            </Alert>
          )}
          {scanLookupBusy && (
            <p className="mt-2 text-xs text-muted-foreground">Looking up scanned item...</p>
          )}
        </div>
      )}

      {visibleBatteryGuidance.length > 0 && (
        <div className="flex flex-col gap-2 border-b border-border/60 bg-background px-3 py-2">
          {visibleBatteryGuidance.map((item) => (
            <Alert
              key={item.ruleId}
              className={cn(
                "rounded-md py-2.5",
                item.isLow
                  ? "border-orange-500/30 bg-orange-500/[0.06]"
                  : "border-blue-500/20 bg-blue-500/[0.05]",
              )}
            >
              <AlertTitle className="text-sm">
                {item.isLow ? `Low ${item.label}` : `Recommended ${item.label}`}
              </AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground">
                {item.availableQuantity} available
                {item.isLow ? `, threshold ${item.threshold}` : ""}
                {item.cameraModels.length > 0 ? ` for ${item.cameraModels.join(", ")}` : ""}.
                {" "}Add the quantity needed now; exact battery units are scanned at pickup.
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* ── Item list ── */}
      <div className="max-h-[28rem] overflow-y-auto bg-background">
        {searchLoading ? (
          <Empty className="min-h-64 border-0">
            <EmptyHeader>
              <EmptyTitle>Loading equipment</EmptyTitle>
              <EmptyDescription>Fetching {activeSectionMeta.label.toLowerCase()}...</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : searchError ? (
          <Empty className="min-h-64 border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon"><AlertCircleIcon /></EmptyMedia>
              <EmptyTitle>Equipment did not load</EmptyTitle>
              <EmptyDescription>Check the connection and try again.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" variant="outline" size="sm" onClick={retrySearch}>
                Retry
              </Button>
            </EmptyContent>
          </Empty>
        ) : sectionResults.length === 0 && sectionBulk.length === 0 ? (
          <Empty className="min-h-64 border-0">
            <EmptyHeader>
              <EmptyTitle>
                {sectionSearch ? "No matching equipment" : onlyAvailable ? "Nothing available right now" : "No items in this section"}
              </EmptyTitle>
              <EmptyDescription>{emptyDescription}</EmptyDescription>
            </EmptyHeader>
            {(sectionSearch || onlyAvailable) && (
              <EmptyContent className="flex-row flex-wrap justify-center">
                {sectionSearch && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setSectionSearch("")}>
                    Clear search
                  </Button>
                )}
                {onlyAvailable && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setOnlyAvailable(false)}>
                    Show unavailable
                  </Button>
                )}
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <ItemGroup aria-label={`${activeSectionMeta.label} equipment`}>
            {sectionResults.map((asset, index) => {
              const isSelected = selectedIdSet.has(asset.id);
              const conflict = conflicts.get(asset.id);
              const upcoming = upcomingCommitments.get(asset.id);
              const risks = turnaroundRisks.get(asset.id);
              const risk = primaryRisk(risks);
              const riskText = riskLabel(risks);
              const isAvailable = asset.computedStatus === "AVAILABLE";
              const isUnavailable = !isAvailable && !isSelected;
              const holder = asset.currentHolder;

              return (
                <div key={asset.id}>
                  {index > 0 && <ItemSeparator />}
                  <Item
                    size="sm"
                    className={cn(
                      "min-h-[56px] rounded-none px-3",
                      isSelected && "bg-green-500/[0.06]",
                      isUnavailable && "opacity-60",
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={isUnavailable}
                      onCheckedChange={() => toggleAsset(asset.id, asset)}
                      aria-label={`${isSelected ? "Remove" : "Add"} ${asset.assetTag}`}
                    />
                    <ItemMedia variant="default">
                      <AssetImage src={asset.imageUrl} alt={asset.assetTag} size={40} />
                    </ItemMedia>
                    <ItemContent>
                      <button
                        type="button"
                        disabled={isUnavailable}
                        onClick={() => toggleAsset(asset.id, asset)}
                        className={cn(
                          "min-w-0 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                          isUnavailable ? "cursor-default" : "cursor-pointer",
                        )}
                      >
                        <ItemTitle className="w-full max-w-full">
                          <span className="truncate">{asset.assetTag}</span>
                        </ItemTitle>
                        <ItemDescription className="truncate text-xs">
                          {[asset.brand, asset.model].filter(Boolean).join(" ") || asset.name}
                        </ItemDescription>
                        {isUnavailable && holder && (
                          <p className="mt-0.5 truncate text-[10px] text-muted-foreground/80">
                            Held by {holder.holderName}
                            {holder.endsAt && ` · Returns ${new Date(holder.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                          </p>
                        )}
                        {upcoming && !conflict && !isUnavailable && (
                          <p className="mt-0.5 truncate text-[10px] text-blue-600 dark:text-blue-400">
                            {upcomingCommitmentLabel(upcoming)}
                            {upcoming.bookingTitle ? ` · ${upcoming.bookingTitle}` : ""}
                          </p>
                        )}
                        {riskText && !conflict && !isUnavailable && (
                          <p className={cn(
                            "mt-0.5 truncate text-[10px]",
                            risk?.severity === "critical"
                              ? "text-red-600 dark:text-red-400"
                              : "text-orange-600 dark:text-orange-400",
                          )}>
                            {riskText}
                          </p>
                        )}
                      </button>
                    </ItemContent>
                    <ItemActions className="ml-auto">
                      {isUnavailable && !holder && (
                        <Badge variant="secondary" size="sm" className="shrink-0">
                          {statusText(asset.computedStatus)}
                        </Badge>
                      )}
                      {conflict && (
                        <Badge variant="orange" size="sm" className="shrink-0">Conflict</Badge>
                      )}
                      {!conflict && upcoming && (
                        <Badge
                          variant="blue"
                          size="sm"
                          className="shrink-0"
                          title={upcomingCommitmentTitle(upcoming)}
                        >
                          Next use
                        </Badge>
                      )}
                      {!conflict && risk && (
                        <Badge
                          variant={risk.severity === "critical" ? "red" : "orange"}
                          size="sm"
                          className="shrink-0"
                          title={riskTitle(risks)}
                        >
                          Turnaround
                        </Badge>
                      )}
                      {isSelected && !conflict ? (
                        <CheckCircle2Icon className="size-5 shrink-0 text-green-500" />
                      ) : null}
                    </ItemActions>
                  </Item>
                </div>
              );
            })}

            {sectionBulk.map((sku, index) => {
              const current = selectedBulkItems.find((i) => i.bulkSkuId === sku.id)?.quantity ?? 0;
              const available = getBulkAvailable(sku);
              const noneAvailable = available === 0;
              const hasSeparator = sectionResults.length > 0 || index > 0;
              const risks = bulkTurnaroundRisks.get(sku.id);
              const riskText = riskLabel(risks);

              return (
                <div key={sku.id}>
                  {hasSeparator && <ItemSeparator />}
                  <Item
                    size="sm"
                    className={cn(
                      "min-h-[56px] rounded-none px-3",
                      current > 0 && "bg-green-500/[0.06]",
                      noneAvailable && current === 0 && "opacity-60",
                    )}
                  >
                    <ItemMedia variant="default">
                      <AssetImage src={sku.imageUrl} alt={sku.name} size={40} />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="truncate">{sku.name}</ItemTitle>
                      <ItemDescription className={cn("text-xs", noneAvailable && "text-destructive")}>
                        {noneAvailable
                          ? "None available"
                          : `${available} available · ${bulkQuantityHint(sku)}`}
                      </ItemDescription>
                      {riskText && (
                        <p className="mt-0.5 truncate text-[10px] text-orange-600 dark:text-orange-400">
                          {riskText}
                        </p>
                      )}
                    </ItemContent>
                    <ItemActions className="ml-auto">
                      {risks && risks.length > 0 && (
                        <Badge variant="orange" size="sm" className="shrink-0" title={riskTitle(risks)}>
                          Turnaround
                        </Badge>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-10"
                        onClick={() => setBulkQty(sku.id, current - 1)}
                        disabled={current === 0}
                        aria-label={`Remove one ${sku.name}`}
                      >
                        <MinusIcon />
                      </Button>
                      <span className="min-w-7 text-center text-sm font-medium tabular-nums">{current}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-10"
                        onClick={() => setBulkQty(sku.id, current + 1)}
                        disabled={current >= available}
                        aria-label={`Add one ${sku.name}`}
                      >
                        <PlusIcon />
                      </Button>
                    </ItemActions>
                  </Item>
                </div>
              );
            })}
          </ItemGroup>
        )}
      </div>

      {/* ── Selected items shelf ── */}
      {totalSelected > 0 && (
        <div className="border-t border-border/60 bg-muted/20">
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="text-xs font-semibold text-muted-foreground">Selected</span>
            <Badge variant="secondary" size="sm" className="tabular-nums">
              {totalSelected}
            </Badge>
            <div className="ml-auto flex items-center gap-2">
              {deferredConflictsLoading && (
                <span className="text-[10px] text-muted-foreground">
                  Checking availability...
                </span>
              )}
              <Button type="button" variant="ghost" size="sm" className="h-10 text-xs" onClick={clearAllSelections}>
                Clear all
              </Button>
            </div>
          </div>
          <ItemGroup>
            {resolvedSelectedAssets.map((asset, index) => (
              <div key={asset.id}>
                {index > 0 && <ItemSeparator />}
                <Item size="sm" className="rounded-none px-3 py-2">
                  <ItemMedia variant="default">
                    <AssetImage src={asset.imageUrl} alt={asset.assetTag} size={32} />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle className="truncate">{asset.assetTag}</ItemTitle>
                    <ItemDescription className="truncate text-xs">{asset.brand} {asset.model}</ItemDescription>
                    {upcomingCommitments.has(asset.id) && !conflicts.has(asset.id) && (
                      <p className="truncate text-[10px] text-blue-600 dark:text-blue-400">
                        {upcomingCommitmentLabel(upcomingCommitments.get(asset.id)!)}
                        {upcomingCommitments.get(asset.id)!.bookingTitle ? ` · ${upcomingCommitments.get(asset.id)!.bookingTitle}` : ""}
                      </p>
                    )}
                    {turnaroundRisks.has(asset.id) && !conflicts.has(asset.id) && (
                      <p className={cn(
                        "truncate text-[10px]",
                        primaryRisk(turnaroundRisks.get(asset.id))?.severity === "critical"
                          ? "text-red-600 dark:text-red-400"
                          : "text-orange-600 dark:text-orange-400",
                      )}>
                        {riskLabel(turnaroundRisks.get(asset.id))}
                      </p>
                    )}
                  </ItemContent>
                  <ItemActions>
                    {conflicts.has(asset.id) && (
                      <Badge variant="orange" size="sm" className="shrink-0">Conflict</Badge>
                    )}
                    {upcomingCommitments.has(asset.id) && !conflicts.has(asset.id) && (
                      <Badge
                        variant="blue"
                        size="sm"
                        className="shrink-0"
                        title={upcomingCommitmentTitle(upcomingCommitments.get(asset.id)!)}
                      >
                        Next use
                      </Badge>
                    )}
                    {turnaroundRisks.has(asset.id) && !conflicts.has(asset.id) && (
                      <Badge
                        variant={primaryRisk(turnaroundRisks.get(asset.id))?.severity === "critical" ? "red" : "orange"}
                        size="sm"
                        className="shrink-0"
                        title={riskTitle(turnaroundRisks.get(asset.id))}
                      >
                        Turnaround
                      </Badge>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-10"
                      onClick={() => toggleAsset(asset.id)}
                      aria-label={`Remove ${asset.assetTag}`}
                    >
                      <XIcon />
                    </Button>
                  </ItemActions>
                </Item>
              </div>
            ))}
            {unresolvedSelectedAssetIds.map((id, index) => {
              const previousRows = resolvedSelectedAssets.length + index;
              return (
                <div key={id}>
                  {previousRows > 0 && <ItemSeparator />}
                  <Item size="sm" className="rounded-none px-3 py-2">
                    <ItemMedia variant="icon">
                      <AlertCircleIcon className="size-4 text-orange-500" />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="truncate">Unavailable selected item</ItemTitle>
                      <ItemDescription className="truncate text-xs">
                        This item could not be loaded. Remove it and pick another item.
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-10"
                        onClick={() => toggleAsset(id)}
                        aria-label="Remove unavailable selected item"
                      >
                        <XIcon />
                      </Button>
                    </ItemActions>
                  </Item>
                </div>
              );
            })}
            {selectedBulkItems.map((item, index) => {
              const sku = bulkById.get(item.bulkSkuId);
              if (!sku) return null;
              const previousRows = resolvedSelectedAssets.length + unresolvedSelectedAssetIds.length + index;
              const risks = bulkTurnaroundRisks.get(item.bulkSkuId);
              return (
                <div key={item.bulkSkuId}>
                  {previousRows > 0 && <ItemSeparator />}
                  <Item size="sm" className="rounded-none px-3 py-2">
                    <ItemMedia variant="default">
                      <AssetImage src={sku.imageUrl} alt={sku.name} size={32} />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="truncate">{sku.name}</ItemTitle>
                      <ItemDescription className="text-xs">
                        {selectedBulkQuantityText(sku, item.quantity)}
                      </ItemDescription>
                      {risks && risks.length > 0 && (
                        <p className="truncate text-[10px] text-orange-600 dark:text-orange-400">
                          {riskLabel(risks)}
                        </p>
                      )}
                    </ItemContent>
                    <ItemActions>
                      {risks && risks.length > 0 && (
                        <Badge variant="orange" size="sm" className="shrink-0" title={riskTitle(risks)}>
                          Turnaround
                        </Badge>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-10"
                        onClick={() => setBulkQty(sku.id, 0)}
                        aria-label={`Remove ${sku.name}`}
                      >
                        <XIcon />
                      </Button>
                    </ItemActions>
                  </Item>
                </div>
              );
            })}
          </ItemGroup>
        </div>
      )}
    </div>
  );
}
