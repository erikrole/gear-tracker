"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BookingDetailsSheet from "@/components/BookingDetailsSheet";
import { SPORT_CODES, generateEventTitle, sportLabel } from "@/lib/sports";
import { getAllowedBookingActions, type BookingKind } from "@/lib/booking-actions";
import {
  EQUIPMENT_SECTIONS,
  classifyAssetType,
  groupAssetsBySection,
  groupBulkBySection,
  isSectionReachable,
  sectionIndex,
  type EquipmentSectionKey,
} from "@/lib/equipment-sections";
import { getActiveGuidance, type GuidanceContext } from "@/lib/equipment-guidance";

const STATUS_DOT_COLORS: Record<string, string> = {
  AVAILABLE: "#22c55e",
  CHECKED_OUT: "#ef4444",
  RESERVED: "#a855f7",
  MAINTENANCE: "#f59e0b",
  RETIRED: "#9ca3af",
};

/* ───── Types ───── */

export type BookingItem = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  sportCode: string | null;
  createdBy?: string;
  requester: { id: string; name: string };
  location: { id: string; name: string };
  serializedItems: Array<{ asset: { assetTag: string; brand: string; model: string } }>;
  bulkItems: Array<{ bulkSku: { name: string }; plannedQuantity: number }>;
  event?: { id: string; summary: string; sportCode: string | null; opponent: string | null; isHome: boolean | null } | null;
};

type FormUser = { id: string; name: string };
type Location = { id: string; name: string };
type CalendarEvent = {
  id: string;
  summary: string;
  startsAt: string;
  endsAt: string;
  sportCode: string | null;
  isHome: boolean | null;
  opponent: string | null;
  rawLocationText: string | null;
  location: { id: string; name: string } | null;
};
type AvailableAsset = {
  id: string;
  assetTag: string;
  name: string;
  brand: string;
  model: string;
  serialNumber: string;
  type: string;
  computedStatus: string;
  location: { id: string; name: string } | null;
};
type BulkSkuOption = { id: string; name: string; unit: string; category: string; currentQuantity: number };
type ListResponse = { data: BookingItem[]; total: number; limit: number; offset: number };

/* ───── Config ───── */

export type StatusOption = { value: string; label: string };

export type ContextMenuExtra = {
  action: string;
  label: string;
  danger?: boolean;
  opensSheet?: boolean;
  handler?: (bookingId: string, items: BookingItem[], reload: () => Promise<void>) => void | Promise<void>;
};

export type BookingListConfig = {
  kind: BookingKind;
  apiBase: string;
  cancelApiBase?: string;
  label: string;
  labelPlural: string;
  statusBadge: Record<string, string>;
  statusOptions: StatusOption[];
  defaultTieToEvent: boolean;
  hasSportFilter: boolean;
  overdueStatus: string;
  showEventBadge: boolean;
  contextMenuExtras: ContextMenuExtra[];
};

/* ───── Helpers ───── */

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric" });
}

function roundTo15Min(date: Date): Date {
  const ms = date.getTime();
  const fifteen = 15 * 60 * 1000;
  return new Date(Math.ceil(ms / fifteen) * fifteen);
}

function toLocalDateTimeValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  const local = new Date(date.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
}

/* ───── Component ───── */

export default function BookingListPage({ config }: { config: BookingListConfig }) {
  // ── List state ──
  const [items, setItems] = useState<BookingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sportFilter, setSportFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  // ── Form options ──
  const [users, setUsers] = useState<FormUser[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // ── Create form state ──
  const [showCreate, setShowCreate] = useState(false);
  const [tieToEvent, setTieToEvent] = useState(config.defaultTieToEvent);
  const [createSport, setCreateSport] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createLocationId, setCreateLocationId] = useState("");
  const [createRequester, setCreateRequester] = useState("");
  const [createStartsAt, setCreateStartsAt] = useState(() => toLocalDateTimeValue(roundTo15Min(new Date())));
  const [createEndsAt, setCreateEndsAt] = useState(() => toLocalDateTimeValue(roundTo15Min(new Date(Date.now() + 24 * 60 * 60 * 1000))));
  const [createError, setCreateError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Equipment picker state ──
  const [availableAssets, setAvailableAssets] = useState<AvailableAsset[]>([]);
  const [bulkSkus, setBulkSkus] = useState<BulkSkuOption[]>([]);
  const [showEquipPicker, setShowEquipPicker] = useState(true);
  const [activeSection, setActiveSection] = useState<EquipmentSectionKey>(EQUIPMENT_SECTIONS[0].key);
  const [highestReached, setHighestReached] = useState<EquipmentSectionKey>(EQUIPMENT_SECTIONS[0].key);
  const [equipSearch, setEquipSearch] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [selectedBulkItems, setSelectedBulkItems] = useState<{ bulkSkuId: string; quantity: number }[]>([]);

  // ── Sheet + context menu ──
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; item: BookingItem } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  const limit = 20;

  // ── Data fetching ──

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(page * limit));
      if (search) params.set("q", search);
      if (sort) params.set("sort", sort);
      if (statusFilter) params.set("status", statusFilter);
      if (config.hasSportFilter && sportFilter) params.set("sport_code", sportFilter);
      if (locationFilter) params.set("location_id", locationFilter);
      const res = await fetch(`${config.apiBase}?${params}`);
      if (res.ok) {
        const json: ListResponse = await res.json();
        setItems(json.data ?? []);
        setTotal(json.total ?? 0);
      }
    } catch { /* network */ }
    setLoading(false);
  }, [page, search, sort, statusFilter, sportFilter, locationFilter, config.apiBase, config.hasSportFilter]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    fetch("/api/form-options")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (!json?.data) return;
        setUsers(json.data.users || []);
        setLocations(json.data.locations || []);
        setCreateLocationId(json.data.locations?.[0]?.id || "");
        setAvailableAssets(json.data.availableAssets || []);
        setBulkSkus(json.data.bulkSkus || []);
      })
      .catch(() => { /* form-options unavailable */ });
    fetch("/api/me")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (json?.user) {
          setCurrentUserId(json.user.id || "");
          setCurrentUserRole(json.user.role || "");
          if (!createRequester && json.user.id) {
            setCreateRequester(json.user.id);
          }
        }
      })
      .catch(() => { /* auth unavailable */ });
  }, []);

  // Fetch events when sport selected
  useEffect(() => {
    if (!createSport || !tieToEvent) {
      setEvents([]);
      return;
    }
    setEventsLoading(true);
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const params = new URLSearchParams({
      sportCode: createSport,
      startDate: now.toISOString(),
      endDate: in30.toISOString(),
      limit: "50",
    });
    fetch(`/api/calendar-events?${params}`)
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        setEvents(json?.data || []);
        setEventsLoading(false);
      })
      .catch(() => setEventsLoading(false));
  }, [createSport, tieToEvent]);

  // ── Event selection auto-populate ──

  function selectEvent(ev: CalendarEvent) {
    setSelectedEvent(ev);
    const title = generateEventTitle(ev.sportCode || createSport, ev.opponent, ev.isHome);
    setCreateTitle(title);
    const start = new Date(new Date(ev.startsAt).getTime() - 2 * 60 * 60 * 1000);
    const end = new Date(new Date(ev.endsAt).getTime() + 2 * 60 * 60 * 1000);
    setCreateStartsAt(toLocalDateTimeValue(start));
    setCreateEndsAt(toLocalDateTimeValue(end));
    if (ev.location) {
      setCreateLocationId(ev.location.id);
    }
  }

  // ── Create booking ──

  async function handleCreate() {
    if (!createTitle.trim()) { setCreateError("Title is required"); return; }
    if (!createRequester) { setCreateError("User is required"); return; }
    if (!createLocationId) { setCreateError("Location is required"); return; }

    setSubmitting(true);
    setCreateError("");

    const payload: Record<string, unknown> = {
      title: createTitle.trim(),
      requesterUserId: createRequester,
      locationId: createLocationId,
      startsAt: new Date(createStartsAt).toISOString(),
      endsAt: new Date(createEndsAt).toISOString(),
      serializedAssetIds: selectedAssetIds,
      bulkItems: selectedBulkItems,
    };

    if (selectedEvent) {
      payload.eventId = selectedEvent.id;
      payload.sportCode = selectedEvent.sportCode || createSport || undefined;
    } else if (createSport) {
      payload.sportCode = createSport;
    }

    try {
      const res = await fetch(config.apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409 && json.data) {
          const msgs: string[] = [];
          const d = json.data as { conflicts?: Array<{ assetId: string; conflictingBookingTitle?: string }>; unavailableAssets?: Array<{ assetId: string; status: string }>; shortages?: Array<{ bulkSkuId: string; requested: number; available: number }> };
          if (d.conflicts?.length) {
            for (const c of d.conflicts) {
              const tag = availableAssets.find((a) => a.id === c.assetId)?.assetTag || c.assetId;
              msgs.push(`${tag} conflicts with "${c.conflictingBookingTitle || "another booking"}"`);
            }
          }
          if (d.unavailableAssets?.length) {
            for (const u of d.unavailableAssets) {
              const tag = availableAssets.find((a) => a.id === u.assetId)?.assetTag || u.assetId;
              msgs.push(`${tag} is ${u.status === "MAINTENANCE" ? "in maintenance" : u.status.toLowerCase()}`);
            }
          }
          if (d.shortages?.length) {
            for (const s of d.shortages) {
              const name = bulkSkus.find((sk) => sk.id === s.bulkSkuId)?.name || s.bulkSkuId;
              msgs.push(`${name}: only ${s.available} available (requested ${s.requested})`);
            }
          }
          setCreateError(msgs.length > 0 ? msgs.join(". ") : (json.error || "Availability conflict"));
        } else {
          setCreateError(json.error || `Failed to create ${config.label}`);
        }
        setSubmitting(false);
        return;
      }

      // Reset form
      setShowCreate(false);
      setCreateTitle("");
      setCreateSport("");
      setSelectedEvent(null);
      setCreateStartsAt(toLocalDateTimeValue(roundTo15Min(new Date())));
      setCreateEndsAt(toLocalDateTimeValue(roundTo15Min(new Date(Date.now() + 24 * 60 * 60 * 1000))));
      setSelectedAssetIds([]);
      setSelectedBulkItems([]);
      setShowEquipPicker(true);
      setActiveSection(EQUIPMENT_SECTIONS[0].key);
      setHighestReached(EQUIPMENT_SECTIONS[0].key);
      setEquipSearch("");
      setSubmitting(false);

      setSelectedBookingId(json.data.id);
      await reload();
    } catch {
      setCreateError(`Failed to create ${config.label}`);
      setSubmitting(false);
    }
  }

  // ── Context menu ──

  function handleContextMenu(e: React.MouseEvent, item: BookingItem) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, item });
  }

  function handleOverflow(e: React.MouseEvent, item: BookingItem) {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setCtxMenu({ x: rect.right - 180, y: rect.bottom + 4, item });
  }

  useEffect(() => {
    if (!ctxMenu) return;
    function close(e: MouseEvent) {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
      }
    }
    function closeKey(e: KeyboardEvent) {
      if (e.key === "Escape") setCtxMenu(null);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeKey);
    };
  }, [ctxMenu]);

  function ctxAction(fn: () => void) {
    setCtxMenu(null);
    fn();
  }

  async function handleExtendFromMenu(bookingId: string, days: number) {
    const item = items.find((i) => i.id === bookingId);
    if (!item) return;
    const extended = new Date(new Date(item.endsAt).getTime() + days * 24 * 60 * 60 * 1000);
    try {
      await fetch(`/api/bookings/${bookingId}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endsAt: extended.toISOString() }),
      });
      await reload();
    } catch { /* network */ }
  }

  // ── Derived ──

  const totalPages = Math.ceil(total / limit);

  const sportCodesInUse = useMemo(() => {
    if (!config.hasSportFilter) return [];
    const codes = new Set<string>();
    for (const item of items) {
      if (item.sportCode) codes.add(item.sportCode);
    }
    return Array.from(codes).sort();
  }, [items, config.hasSportFilter]);

  // Equipment section grouping
  const assetsBySection = useMemo(() => groupAssetsBySection(availableAssets), [availableAssets]);
  const bulkBySection = useMemo(() => groupBulkBySection(bulkSkus), [bulkSkus]);

  const sectionAssets = useMemo(() => {
    if (!activeSection) return [];
    const q = equipSearch.toLowerCase();
    return (assetsBySection[activeSection] || []).filter((a) => {
      if (selectedAssetIds.includes(a.id)) return false;
      if (!q) return true;
      return (
        a.assetTag.toLowerCase().includes(q) ||
        a.brand.toLowerCase().includes(q) ||
        a.model.toLowerCase().includes(q) ||
        a.serialNumber.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q)
      );
    });
  }, [assetsBySection, activeSection, selectedAssetIds, equipSearch]);

  const sectionBulk = useMemo(() => {
    if (!activeSection) return [];
    const q = equipSearch.toLowerCase();
    const existingSkuIds = new Set(selectedBulkItems.map((i) => i.bulkSkuId));
    return (bulkBySection[activeSection] || []).filter((s) => {
      if (existingSkuIds.has(s.id)) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
    });
  }, [bulkBySection, activeSection, selectedBulkItems, equipSearch]);

  const sectionCounts = useMemo(() => {
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
      const asset = availableAssets.find((a) => a.id === id);
      if (asset) keys.add(classifyAssetType(asset.type, (asset as Record<string, unknown>).categoryName as string | null | undefined));
    }
    for (const item of selectedBulkItems) {
      const sku = bulkSkus.find((s) => s.id === item.bulkSkuId);
      if (sku) keys.add(classifyAssetType(sku.category, (sku as Record<string, unknown>).categoryName as string | null | undefined));
    }
    return Array.from(keys);
  }, [selectedAssetIds, selectedBulkItems, availableAssets, bulkSkus]);

  const activeGuidance = useMemo(() => {
    if (!activeSection) return [];
    const ctx: GuidanceContext = { selectedSectionKeys, activeSection };
    return getActiveGuidance(ctx);
  }, [selectedSectionKeys, activeSection]);

  function advanceToSection(key: EquipmentSectionKey) {
    setActiveSection(key);
    setEquipSearch("");
    if (sectionIndex(key) > sectionIndex(highestReached)) {
      setHighestReached(key);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>{config.labelPlural}</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Close" : `New ${config.label}`}
        </button>
      </div>

      {/* ════════ Create booking card ════════ */}
      {showCreate && (
        <div className="create-card">
          <div className="create-card-header">
            <h2>Create {config.label}</h2>
          </div>

          <div className="create-card-body">
            {/* Tie to event toggle */}
            <div className="toggle-row">
              <button
                type="button"
                className={`toggle ${tieToEvent ? "on" : ""}`}
                onClick={() => { setTieToEvent(!tieToEvent); setSelectedEvent(null); }}
                aria-label="Tie to event"
              />
              <span className="toggle-label">Tie to event</span>
            </div>

            {/* Event selection flow */}
            {tieToEvent && (
              <>
                <div className="field-compact">
                  <label>Sport</label>
                  <select
                    value={createSport}
                    onChange={(e) => { setCreateSport(e.target.value); setSelectedEvent(null); }}
                  >
                    <option value="">Select sport...</option>
                    {SPORT_CODES.map((s) => (
                      <option key={s.code} value={s.code}>{s.code} - {s.label}</option>
                    ))}
                  </select>
                </div>

                {createSport && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                      Upcoming events (next 30 days)
                    </label>
                    {eventsLoading ? (
                      <div style={{ padding: 16, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
                        Loading events...
                      </div>
                    ) : events.length === 0 ? (
                      <div style={{ padding: 16, textAlign: "center", color: "var(--text-secondary)", fontSize: 13, border: "1px solid var(--border-light)", borderRadius: "var(--radius)" }}>
                        No upcoming events for {sportLabel(createSport)}. Toggle off &ldquo;Tie to event&rdquo; to create without an event, or add events via the Events page.
                      </div>
                    ) : (
                      <div style={{ maxHeight: 240, overflowY: "auto" }}>
                        {events.map((ev) => (
                          <div
                            key={ev.id}
                            className={`event-row ${selectedEvent?.id === ev.id ? "selected" : ""}`}
                            onClick={() => selectEvent(ev)}
                          >
                            <div className="event-row-main">
                              <div className="event-row-title">
                                {ev.opponent
                                  ? `${ev.isHome ? "vs" : "at"} ${ev.opponent}`
                                  : ev.summary}
                              </div>
                              <div className="event-row-meta">
                                {formatDate(ev.startsAt)}
                                {ev.rawLocationText ? ` · ${ev.rawLocationText}` : ""}
                                {ev.location ? ` · ${ev.location.name}` : ""}
                              </div>
                            </div>
                            {ev.isHome !== null && (
                              <span className="badge badge-gray" style={{ fontSize: 10 }}>
                                {ev.isHome ? "HOME" : "AWAY"}
                              </span>
                            )}
                            {ev.sportCode && (
                              <span className="badge-sport">{ev.sportCode}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Title */}
            <div className="field-compact">
              <label>Title {tieToEvent && selectedEvent ? "(auto-generated, editable)" : ""}</label>
              <input
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder={tieToEvent ? "Select an event above..." : "e.g. Game day equipment"}
                required
              />
            </div>

            {/* Sport (when not tied to event) */}
            {!tieToEvent && (
              <div className="field-compact">
                <label>Sport (optional)</label>
                <select value={createSport} onChange={(e) => setCreateSport(e.target.value)}>
                  <option value="">None</option>
                  {SPORT_CODES.map((s) => (
                    <option key={s.code} value={s.code}>{s.code} - {s.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Requester + Location */}
            <div className="field-row">
              <div className="field-compact">
                <label>User</label>
                <select value={createRequester} onChange={(e) => setCreateRequester(e.target.value)} required>
                  <option value="">Select...</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="field-compact">
                <label>Location</label>
                <select value={createLocationId} onChange={(e) => setCreateLocationId(e.target.value)} required>
                  <option value="">Select...</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>

            {/* Dates */}
            <div className="field-row">
              <div className="field-compact">
                <label>From</label>
                <input
                  type="datetime-local"
                  step={900}
                  value={createStartsAt}
                  onChange={(e) => setCreateStartsAt(e.target.value)}
                />
              </div>
              <div className="field-compact">
                <label>To</label>
                <input
                  type="datetime-local"
                  step={900}
                  value={createEndsAt}
                  onChange={(e) => setCreateEndsAt(e.target.value)}
                />
              </div>
            </div>

            {/* Equipment picker — sectioned flow */}
            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                  Equipment{equipmentCount > 0 ? ` (${equipmentCount} selected)` : ""}
                </label>
                {showEquipPicker && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => { setShowEquipPicker(false); setEquipSearch(""); }}
                    style={{ minHeight: 32 }}
                  >
                    Done adding
                  </button>
                )}
              </div>

              {/* Persistent selected items summary */}
              {equipmentCount > 0 && (
                <div style={{ marginBottom: 8, border: "1px solid var(--border-light)", borderRadius: "var(--radius)", padding: "6px 10px" }}>
                  {selectedAssetIds.map((assetId) => {
                    const asset = availableAssets.find((a) => a.id === assetId);
                    if (!asset) return null;
                    return (
                      <div key={assetId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0", minHeight: 36, gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 600, fontSize: 12 }}>{asset.assetTag}</span>
                          <span style={{ fontSize: 11, color: "var(--text-secondary)", marginLeft: 6 }}>{asset.name || `${asset.brand} ${asset.model}`}</span>
                        </div>
                        <button type="button" style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 14, padding: "2px 6px" }}
                          onClick={() => setSelectedAssetIds((prev) => prev.filter((id) => id !== assetId))}>&times;</button>
                      </div>
                    );
                  })}
                  {selectedBulkItems.map((item) => {
                    const sku = bulkSkus.find((s) => s.id === item.bulkSkuId);
                    return (
                      <div key={item.bulkSkuId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0", minHeight: 36, gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 600, fontSize: 12 }}>{sku?.name || item.bulkSkuId}</span>
                          <span style={{ fontSize: 11, color: "var(--text-secondary)", marginLeft: 6 }}>&times;{item.quantity}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <div className="qty-stepper" style={{ flexShrink: 0 }}>
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
                          <button type="button" style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 14, padding: "2px 6px" }}
                            onClick={() => setSelectedBulkItems((prev) => prev.filter((i) => i.bulkSkuId !== item.bulkSkuId))}>&times;</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Sectioned picker */}
              {showEquipPicker && (
                <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                  {/* Section tabs */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 0, borderBottom: "1px solid var(--border)" }}>
                    {EQUIPMENT_SECTIONS.map((sec) => {
                      const reachable = isSectionReachable(sec.key, highestReached);
                      const isActive = activeSection === sec.key;
                      return (
                        <button
                          key={sec.key}
                          type="button"
                          disabled={!reachable}
                          onClick={() => { if (reachable) { setActiveSection(sec.key); setEquipSearch(""); } }}
                          style={{
                            flex: "1 1 auto",
                            padding: "8px 10px",
                            fontSize: 11,
                            fontWeight: isActive ? 700 : 400,
                            background: isActive ? "var(--bg-active, #f0f4ff)" : "transparent",
                            border: "none",
                            borderBottom: isActive ? "2px solid var(--primary, #3b82f6)" : "2px solid transparent",
                            cursor: reachable ? "pointer" : "default",
                            color: isActive ? "var(--primary, #3b82f6)" : reachable ? "var(--text-secondary)" : "var(--text-secondary)",
                            opacity: reachable ? 1 : 0.4,
                            whiteSpace: "nowrap",
                            minHeight: 36,
                            pointerEvents: reachable ? "auto" : "none",
                          }}
                        >
                          {sec.label}
                          {sectionCounts[sec.key] > 0 && (
                            <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>({sectionCounts[sec.key]})</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Active section content */}
                  {activeSection && (
                    <div style={{ padding: 10 }}>
                      <input
                        placeholder="Search this section..."
                        value={equipSearch}
                        onChange={(e) => setEquipSearch(e.target.value)}
                        style={{
                          width: "100%", padding: "8px 12px", border: "1px solid var(--border)",
                          borderRadius: "var(--radius)", fontSize: 13, outline: "none", boxSizing: "border-box",
                        }}
                      />

                      <div style={{ maxHeight: 220, overflowY: "auto", marginTop: 6 }}>
                        {/* Serialized assets */}
                        {sectionAssets.length > 0 && (
                          <>
                            {sectionBulk.length > 0 && (
                              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-secondary)", padding: "6px 0 2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Assets</div>
                            )}
                            {sectionAssets.slice(0, 50).map((asset) => {
                              const isAvailable = asset.computedStatus === "AVAILABLE";
                              const dotColor = STATUS_DOT_COLORS[asset.computedStatus] || "#9ca3af";
                              const statusLabel = asset.computedStatus.replace("_", " ").toLowerCase();
                              return (
                                <div
                                  key={asset.id}
                                  className="equip-picker-item"
                                  data-unavailable={!isAvailable || undefined}
                                  onClick={() => {
                                    if (!isAvailable) return;
                                    setSelectedAssetIds((prev) => prev.includes(asset.id) ? prev : [...prev, asset.id]);
                                  }}
                                  style={!isAvailable ? { cursor: "default" } : undefined}
                                >
                                  <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: dotColor, flexShrink: 0, marginTop: 5 }} title={statusLabel} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, opacity: isAvailable ? 1 : 0.5 }}>
                                      {asset.assetTag}
                                    </div>
                                    <div className="equip-picker-meta" style={{ opacity: isAvailable ? 1 : 0.5 }}>
                                      {asset.name || `${asset.brand} ${asset.model}`}
                                      {asset.serialNumber ? ` · SN: ${asset.serialNumber}` : ""}
                                      {asset.location ? ` · ${asset.location.name}` : ""}
                                      {!isAvailable && ` · ${statusLabel}`}
                                    </div>
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
                              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-secondary)", padding: "8px 0 2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bulk Items</div>
                            )}
                            {sectionBulk.slice(0, 50).map((sku) => (
                              <div
                                key={sku.id}
                                className="equip-picker-item"
                                onClick={() => setSelectedBulkItems((prev) =>
                                  prev.some((i) => i.bulkSkuId === sku.id) ? prev : [...prev, { bulkSkuId: sku.id, quantity: 1 }]
                                )}
                              >
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>{sku.name}</div>
                                  <div className="equip-picker-meta">{sku.category} &middot; {sku.unit}</div>
                                </div>
                              </div>
                            ))}
                          </>
                        )}

                        {sectionAssets.length === 0 && sectionBulk.length === 0 && (
                          <div style={{ padding: 16, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
                            {equipSearch ? "No matching items in this section" : "No available items in this section"}
                          </div>
                        )}
                      </div>

                      {/* Equipment guidance hints */}
                      {activeGuidance.length > 0 && activeGuidance.map((rule) => (
                        <div
                          key={rule.id}
                          data-guidance={rule.id}
                          style={{
                            padding: "6px 10px", marginBottom: 4, borderRadius: "var(--radius)", fontSize: 12,
                            background: rule.level === "warning" ? "var(--bg-warning, #fef9c3)" : "var(--bg-info, #eff6ff)",
                            color: rule.level === "warning" ? "var(--text-warning, #92400e)" : "var(--text-info, #1e40af)",
                          }}
                        >
                          {rule.message}
                        </div>
                      ))}

                      {/* Section navigation */}
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border-light)" }}>
                        {(() => {
                          const idx = EQUIPMENT_SECTIONS.findIndex((s) => s.key === activeSection);
                          const prev = idx > 0 ? EQUIPMENT_SECTIONS[idx - 1] : null;
                          const next = idx < EQUIPMENT_SECTIONS.length - 1 ? EQUIPMENT_SECTIONS[idx + 1] : null;
                          return (
                            <>
                              {prev ? (
                                <button type="button" className="btn btn-sm" onClick={() => advanceToSection(prev.key)} style={{ minHeight: 32 }}>
                                  &larr; {prev.label}
                                </button>
                              ) : <span />}
                              {next ? (
                                <button type="button" className="btn btn-sm" onClick={() => advanceToSection(next.key)} style={{ minHeight: 32 }}>
                                  {next.label} &rarr;
                                </button>
                              ) : (
                                <button type="button" className="btn btn-sm" onClick={() => { setShowEquipPicker(false); setEquipSearch(""); }} style={{ minHeight: 32 }}>
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

              {equipmentCount === 0 && !showEquipPicker && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    No equipment selected. You can also add equipment after creating.
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => { setShowEquipPicker(true); setActiveSection(EQUIPMENT_SECTIONS[0].key); }}
                    style={{ minHeight: 32 }}
                  >
                    + Add equipment
                  </button>
                </div>
              )}
            </div>

            {createError && (
              <div style={{ color: "var(--red)", fontSize: 13, marginTop: 4 }}>{createError}</div>
            )}
          </div>

          <div className="create-card-footer">
            <button className="btn" onClick={() => setShowCreate(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={submitting}
              onClick={handleCreate}
              style={{ minHeight: 44 }}
            >
              {submitting ? "Creating..." : `Create ${config.label}`}
            </button>
          </div>
        </div>
      )}

      {/* ════════ Filter bar ════════ */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: 8 }}>
          <h2>All {config.labelPlural.toLowerCase()}</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft: "auto", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Search by title or requester..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, minHeight: 36, minWidth: 200 }}
            />

            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "white", minHeight: 36 }}
            >
              <option value="">All statuses</option>
              {config.statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {config.hasSportFilter && sportCodesInUse.length > 0 && (
              <select
                value={sportFilter}
                onChange={(e) => { setSportFilter(e.target.value); setPage(0); }}
                style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "white", minHeight: 36 }}
              >
                <option value="">All sports</option>
                {SPORT_CODES.map((s) => (
                  <option key={s.code} value={s.code}>{s.code}</option>
                ))}
              </select>
            )}

            {locations.length > 1 && (
              <select
                value={locationFilter}
                onChange={(e) => { setLocationFilter(e.target.value); setPage(0); }}
                style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "white", minHeight: 36 }}
              >
                <option value="">All locations</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}

            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(0); }}
              style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "white", minHeight: 36 }}
            >
              <option value="">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="title">Title A–Z</option>
            </select>
          </div>
        </div>

        {/* ════════ Booking list ════════ */}
        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="empty-state">No {config.labelPlural.toLowerCase()} found</div>
        ) : (
          <>
            <div className="checkout-table-desktop">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Requester</th>
                    <th>Period</th>
                    <th>Location</th>
                    <th>Items</th>
                    <th>Status</th>
                    <th style={{ width: 44 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const isOverdue = item.status === config.overdueStatus && new Date(item.endsAt) < new Date();
                    return (
                      <tr
                        key={item.id}
                        style={{ cursor: "pointer" }}
                        onClick={() => setSelectedBookingId(item.id)}
                        onContextMenu={(e) => handleContextMenu(e, item)}
                      >
                        <td>
                          <div style={{ fontWeight: 500 }}>
                            <span className="row-link">{item.title}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, display: "flex", gap: 6, alignItems: "center" }}>
                            {item.requester?.name ?? "Unknown"}
                            {" · "}
                            {formatShortDate(item.startsAt)} &ndash; {formatShortDate(item.endsAt)}
                            {item.sportCode && <span className="badge-sport">{item.sportCode}</span>}
                            {config.showEventBadge && item.event && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>event</span>}
                          </div>
                        </td>
                        <td className="hide-mobile">{item.requester?.name ?? "Unknown"}</td>
                        <td className="hide-mobile">{formatDate(item.startsAt)} &ndash; {formatDate(item.endsAt)}</td>
                        <td className="hide-mobile">{item.location?.name ?? "\u2014"}</td>
                        <td className="hide-mobile">{(item.serializedItems?.length ?? 0) + (item.bulkItems?.length ?? 0)}</td>
                        <td>
                          <span className={`badge ${isOverdue ? "badge-red" : (config.statusBadge[item.status] || "badge-gray")}`}>
                            {isOverdue ? "overdue" : item.status.toLowerCase()}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button className="overflow-btn" onClick={(e) => handleOverflow(e, item)}>
                            &middot;&middot;&middot;
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <span>Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}</span>
                <div className="pagination-btns">
                  <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                  <button className="btn btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ════════ Context menu ════════ */}
      {ctxMenu && (() => {
        const actor = { id: currentUserId, role: currentUserRole };
        const ctxAllowed = new Set(
          getAllowedBookingActions(actor, {
            status: ctxMenu.item.status,
            requester: ctxMenu.item.requester,
            createdBy: ctxMenu.item.createdBy,
          }, config.kind)
        );
        return (
          <div
            ref={ctxRef}
            className="ctx-menu"
            style={{ top: ctxMenu.y, left: ctxMenu.x }}
          >
            <button
              className="ctx-menu-item"
              onClick={() => ctxAction(() => setSelectedBookingId(ctxMenu.item.id))}
            >
              View details
            </button>

            {ctxAllowed.has("edit") && (
              <button
                className="ctx-menu-item"
                onClick={() => ctxAction(() => setSelectedBookingId(ctxMenu.item.id))}
              >
                Edit
              </button>
            )}

            {ctxAllowed.has("extend") && (
              <>
                <div className="ctx-menu-sep" />
                <button
                  className="ctx-menu-item"
                  onClick={() => ctxAction(() => handleExtendFromMenu(ctxMenu.item.id, 1))}
                >
                  Extend +1 day
                </button>
                <button
                  className="ctx-menu-item"
                  onClick={() => ctxAction(() => handleExtendFromMenu(ctxMenu.item.id, 7))}
                >
                  Extend +1 week
                </button>
              </>
            )}

            {config.contextMenuExtras.map((extra) =>
              ctxAllowed.has(extra.action) ? (
                <span key={extra.action}>
                  <div className="ctx-menu-sep" />
                  <button
                    className={`ctx-menu-item${extra.danger ? " danger" : ""}`}
                    onClick={() => ctxAction(() => {
                      if (extra.opensSheet) setSelectedBookingId(ctxMenu.item.id);
                      else extra.handler?.(ctxMenu.item.id, items, reload);
                    })}
                  >
                    {extra.label}
                  </button>
                </span>
              ) : null
            )}
          </div>
        );
      })()}

      {/* ════════ Booking details sheet ════════ */}
      <BookingDetailsSheet
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        onUpdated={reload}
        currentUserRole={currentUserRole}
      />
    </>
  );
}
