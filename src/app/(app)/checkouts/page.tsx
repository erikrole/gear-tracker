"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BookingDetailsSheet from "@/components/BookingDetailsSheet";
import { SPORT_CODES, generateEventTitle, sportLabel } from "@/lib/sports";
import { getAllowedActionsClient } from "@/lib/checkout-actions";
import {
  EQUIPMENT_SECTIONS,
  groupAssetsBySection,
  groupBulkBySection,
  isSectionReachable,
  sectionIndex,
  type EquipmentSectionKey,
} from "@/lib/equipment-sections";

/* ───── Types ───── */

type Checkout = {
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
  event: { id: string; summary: string; sportCode: string | null; opponent: string | null; isHome: boolean | null } | null;
};

type CheckoutUser = { id: string; name: string };
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
  brand: string;
  model: string;
  serialNumber: string;
  type: string;
  locationId: string;
  location?: { name: string };
};
type BulkSkuOption = {
  id: string;
  name: string;
  category: string;
  unit: string;
  locationId: string;
};

type ListResponse = { data: Checkout[]; total: number; limit: number; offset: number };

/* ───── Helpers ───── */

const statusBadge: Record<string, string> = {
  DRAFT: "badge-gray",
  OPEN: "badge-green",
  COMPLETED: "badge-purple",
  CANCELLED: "badge-red",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric" });
}

function toLocalDateTimeValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  const local = new Date(date.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
}

/* ───── Component ───── */

export default function CheckoutsPage() {
  // ── List state ──
  const [items, setItems] = useState<Checkout[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [sportFilter, setSportFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  // ── Form options ──
  const [users, setUsers] = useState<CheckoutUser[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // ── Create form state ──
  const [showCreate, setShowCreate] = useState(false);
  const [tieToEvent, setTieToEvent] = useState(true);
  const [createSport, setCreateSport] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createLocationId, setCreateLocationId] = useState("");
  const [createRequester, setCreateRequester] = useState("");
  const [createStartsAt, setCreateStartsAt] = useState(toLocalDateTimeValue(new Date()));
  const [createEndsAt, setCreateEndsAt] = useState(toLocalDateTimeValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [createError, setCreateError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Equipment picker state ──
  const [availableAssets, setAvailableAssets] = useState<AvailableAsset[]>([]);
  const [bulkSkus, setBulkSkus] = useState<BulkSkuOption[]>([]);
  const [showEquipPicker, setShowEquipPicker] = useState(false);
  const [activeSection, setActiveSection] = useState<EquipmentSectionKey | null>(null);
  const [highestReached, setHighestReached] = useState<EquipmentSectionKey>(EQUIPMENT_SECTIONS[0].key);
  const [equipSearch, setEquipSearch] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [selectedBulkItems, setSelectedBulkItems] = useState<{ bulkSkuId: string; quantity: number }[]>([]);

  // ── Sheet + context menu ──
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; checkout: Checkout } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  const limit = 20;

  // ── Data fetching ──

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(page * limit));
      if (statusFilter) params.set("status", statusFilter);
      if (sportFilter) params.set("sport_code", sportFilter);
      if (locationFilter) params.set("location_id", locationFilter);
      const res = await fetch(`/api/checkouts?${params}`);
      if (res.ok) {
        const json: ListResponse = await res.json();
        setItems(json.data ?? []);
        setTotal(json.total ?? 0);
      }
    } catch { /* network */ }
    setLoading(false);
  }, [page, statusFilter, sportFilter, locationFilter]);

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
      });
    fetch("/api/me")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (json?.user) {
          setCurrentUserId(json.user.id || "");
          setCurrentUserRole(json.user.role || "");
        }
      });
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
    // Auto-populate title
    const title = generateEventTitle(
      ev.sportCode || createSport,
      ev.opponent,
      ev.isHome
    );
    setCreateTitle(title);

    // Auto-populate dates: event start minus 2h, event end plus 2h
    const start = new Date(new Date(ev.startsAt).getTime() - 2 * 60 * 60 * 1000);
    const end = new Date(new Date(ev.endsAt).getTime() + 2 * 60 * 60 * 1000);
    setCreateStartsAt(toLocalDateTimeValue(start));
    setCreateEndsAt(toLocalDateTimeValue(end));

    // Auto-populate location from event mapping
    if (ev.location) {
      setCreateLocationId(ev.location.id);
    }
  }

  // ── Create checkout ──

  async function handleCreate() {
    if (!createTitle.trim()) { setCreateError("Title is required"); return; }
    if (!createRequester) { setCreateError("Requester is required"); return; }
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
      const res = await fetch("/api/checkouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        setCreateError(json.error || "Failed to create checkout");
        setSubmitting(false);
        return;
      }

      // Reset form
      setShowCreate(false);
      setCreateTitle("");
      setCreateSport("");
      setSelectedEvent(null);
      setCreateStartsAt(toLocalDateTimeValue(new Date()));
      setCreateEndsAt(toLocalDateTimeValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
      setSelectedAssetIds([]);
      setSelectedBulkItems([]);
      setShowEquipPicker(false);
      setActiveSection(null);
      setHighestReached(EQUIPMENT_SECTIONS[0].key);
      setEquipSearch("");
      setSubmitting(false);

      // Open the sheet immediately for adding items
      setSelectedBookingId(json.data.id);
      await reload();
    } catch {
      setCreateError("Failed to create checkout");
      setSubmitting(false);
    }
  }

  // ── Context menu ──

  function handleContextMenu(e: React.MouseEvent, checkout: Checkout) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, checkout });
  }

  function handleOverflow(e: React.MouseEvent, checkout: Checkout) {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setCtxMenu({ x: rect.right - 180, y: rect.bottom + 4, checkout });
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
    const c = items.find((i) => i.id === bookingId);
    if (!c) return;
    const extended = new Date(new Date(c.endsAt).getTime() + days * 24 * 60 * 60 * 1000);
    try {
      await fetch(`/api/bookings/${bookingId}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endsAt: extended.toISOString() }),
      });
      await reload();
    } catch { /* network */ }
  }

  async function handleCancelFromMenu(bookingId: string) {
    const c = items.find((i) => i.id === bookingId);
    if (!c || !confirm(`Cancel "${c.title}"?`)) return;
    try {
      await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" });
      await reload();
    } catch { /* network */ }
  }

  // ── Derived ──

  const totalPages = Math.ceil(total / limit);
  const sportCodesInUse = useMemo(() => {
    const codes = new Set<string>();
    for (const item of items) {
      if (item.sportCode) codes.add(item.sportCode);
    }
    return Array.from(codes).sort();
  }, [items]);

  // Equipment section grouping
  const assetsBySection = useMemo(
    () => groupAssetsBySection(availableAssets),
    [availableAssets]
  );
  const bulkBySection = useMemo(
    () => groupBulkBySection(bulkSkus),
    [bulkSkus]
  );

  // Filtered items for active section
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

  // Section counts (total available, not filtered)
  const sectionCounts = useMemo(() => {
    const counts: Record<EquipmentSectionKey, number> = {
      camera_body: 0, accessories: 0, lenses: 0, batteries: 0, other: 0,
    };
    for (const key of Object.keys(counts) as EquipmentSectionKey[]) {
      counts[key] = (assetsBySection[key]?.length || 0) + (bulkBySection[key]?.length || 0);
    }
    return counts;
  }, [assetsBySection, bulkBySection]);

  const equipmentCount = selectedAssetIds.length + selectedBulkItems.length;

  // Check if any camera body is selected (for battery hint)
  const hasBodySelected = useMemo(() => {
    return selectedAssetIds.some((id) => {
      const asset = availableAssets.find((a) => a.id === id);
      return asset && (assetsBySection.camera_body || []).some((a) => a.id === id);
    });
  }, [selectedAssetIds, availableAssets, assetsBySection]);

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
        <h1>Check-outs</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Close" : "New check-out"}
        </button>
      </div>

      {/* ════════ Create checkout card ════════ */}
      {showCreate && (
        <div className="create-card">
          <div className="create-card-header">
            <h2>Create check-out</h2>
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
                <label>Requester</label>
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
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    if (showEquipPicker) {
                      setShowEquipPicker(false);
                      setActiveSection(null);
                      setEquipSearch("");
                    } else {
                      setShowEquipPicker(true);
                      setActiveSection(EQUIPMENT_SECTIONS[0].key);
                      setHighestReached(EQUIPMENT_SECTIONS[0].key);
                      setEquipSearch("");
                    }
                  }}
                  style={{ minHeight: 32 }}
                >
                  {showEquipPicker ? "Done adding" : "+ Add equipment"}
                </button>
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
                          <span style={{ fontSize: 11, color: "var(--text-secondary)", marginLeft: 6 }}>{asset.brand} {asset.model}</span>
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
                        {/* Serialized assets in this section */}
                        {sectionAssets.length > 0 && (
                          <>
                            {sectionBulk.length > 0 && (
                              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-secondary)", padding: "6px 0 2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Assets</div>
                            )}
                            {sectionAssets.slice(0, 50).map((asset) => (
                              <div
                                key={asset.id}
                                className="equip-picker-item"
                                onClick={() => setSelectedAssetIds((prev) => prev.includes(asset.id) ? prev : [...prev, asset.id])}
                              >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>{asset.assetTag}</div>
                                  <div className="equip-picker-meta">
                                    {asset.brand} {asset.model}
                                    {asset.serialNumber ? ` · SN: ${asset.serialNumber}` : ""}
                                    {asset.location ? ` · ${asset.location.name}` : ""}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </>
                        )}

                        {/* Bulk items in this section */}
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

                      {/* Battery hint */}
                      {activeSection === "batteries" && hasBodySelected && (
                        <div style={{ padding: "6px 10px", marginBottom: 4, background: "var(--bg-warning, #fef9c3)", borderRadius: "var(--radius)", fontSize: 12, color: "var(--text-warning, #92400e)" }}>
                          You selected a camera body — don&apos;t forget batteries and chargers.
                        </div>
                      )}

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
                                <button type="button" className="btn btn-sm" onClick={() => { setShowEquipPicker(false); setActiveSection(null); setEquipSearch(""); }} style={{ minHeight: 32 }}>
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
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  No equipment selected. You can also add equipment after creating.
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
              {submitting ? "Creating..." : "Create checkout"}
            </button>
          </div>
        </div>
      )}

      {/* ════════ Filter bar ════════ */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: 8 }}>
          <h2>All check-outs</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "white", minHeight: 36 }}
            >
              <option value="">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            {sportCodesInUse.length > 0 && (
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
          </div>
        </div>

        {/* ════════ Checkout list ════════ */}
        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="empty-state">No check-outs found</div>
        ) : (
          <>
            {/* Desktop table */}
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
                  {items.map((c) => {
                    const isOverdue = c.status === "OPEN" && new Date(c.endsAt) < new Date();
                    return (
                      <tr
                        key={c.id}
                        style={{ cursor: "pointer" }}
                        onClick={() => setSelectedBookingId(c.id)}
                        onContextMenu={(e) => handleContextMenu(e, c)}
                      >
                        <td>
                          <div style={{ fontWeight: 500 }}>
                            <span className="row-link">{c.title}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, display: "flex", gap: 6, alignItems: "center" }}>
                            {c.requester.name}
                            {" · "}
                            {formatShortDate(c.startsAt)} &ndash; {formatShortDate(c.endsAt)}
                            {c.sportCode && <span className="badge-sport">{c.sportCode}</span>}
                            {c.event && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>event</span>}
                          </div>
                        </td>
                        <td className="hide-mobile">{c.requester.name}</td>
                        <td className="hide-mobile">{formatDate(c.startsAt)} &ndash; {formatDate(c.endsAt)}</td>
                        <td className="hide-mobile">{c.location.name}</td>
                        <td className="hide-mobile">{c.serializedItems.length + c.bulkItems.length}</td>
                        <td>
                          <span className={`badge ${isOverdue ? "badge-red" : (statusBadge[c.status] || "badge-gray")}`}>
                            {isOverdue ? "overdue" : c.status.toLowerCase()}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button className="overflow-btn" onClick={(e) => handleOverflow(e, c)}>
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
          getAllowedActionsClient(actor, {
            status: ctxMenu.checkout.status,
            requester: ctxMenu.checkout.requester,
            createdBy: ctxMenu.checkout.createdBy,
          })
        );
        return (
          <div
            ref={ctxRef}
            className="ctx-menu"
            style={{ top: ctxMenu.y, left: ctxMenu.x }}
          >
            <button
              className="ctx-menu-item"
              onClick={() => ctxAction(() => setSelectedBookingId(ctxMenu.checkout.id))}
            >
              View details
            </button>

            {ctxAllowed.has("edit") && (
              <button
                className="ctx-menu-item"
                onClick={() => ctxAction(() => setSelectedBookingId(ctxMenu.checkout.id))}
              >
                Edit
              </button>
            )}

            {ctxAllowed.has("extend") && (
              <>
                <div className="ctx-menu-sep" />
                <button
                  className="ctx-menu-item"
                  onClick={() => ctxAction(() => handleExtendFromMenu(ctxMenu.checkout.id, 1))}
                >
                  Extend +1 day
                </button>
                <button
                  className="ctx-menu-item"
                  onClick={() => ctxAction(() => handleExtendFromMenu(ctxMenu.checkout.id, 7))}
                >
                  Extend +1 week
                </button>
              </>
            )}

            {ctxAllowed.has("checkin") && (
              <>
                <div className="ctx-menu-sep" />
                <button
                  className="ctx-menu-item"
                  onClick={() => ctxAction(() => setSelectedBookingId(ctxMenu.checkout.id))}
                >
                  Check in
                </button>
              </>
            )}

            {ctxAllowed.has("cancel") && (
              <>
                <div className="ctx-menu-sep" />
                <button
                  className="ctx-menu-item danger"
                  onClick={() => ctxAction(() => handleCancelFromMenu(ctxMenu.checkout.id))}
                >
                  Cancel checkout
                </button>
              </>
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
