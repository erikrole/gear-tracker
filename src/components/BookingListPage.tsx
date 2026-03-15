"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
const BookingDetailsSheet = dynamic(() => import("@/components/BookingDetailsSheet"), { ssr: false });
import { SPORT_CODES, generateEventTitle, sportLabel } from "@/lib/sports";
import { getAllowedBookingActions, type BookingKind } from "@/lib/booking-actions";
import { formatDateShort } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { FilterChip } from "@/components/FilterChip";
import EquipmentPicker from "@/components/EquipmentPicker";
import type { PickerAsset, PickerBulkSku, BulkSelection } from "@/components/EquipmentPicker";

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
type AvailableAsset = PickerAsset;
type BulkSkuOption = PickerBulkSku;
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

function formatDateCol(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase(),
    day: d.toLocaleDateString("en-US", { weekday: "short" }),
  };
}

function formatDuration(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const hours = Math.round(ms / (1000 * 60 * 60));
  if (hours < 1) return "< 1 hour";
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""}`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days !== 1 ? "s" : ""}`;
  const weeks = Math.round(days / 7);
  return `${weeks} week${weeks !== 1 ? "s" : ""}`;
}

type SortKey = "title" | "startsAt" | "endsAt";
type SortDir = "asc" | "desc";

function toSortParam(key: SortKey, dir: SortDir): string {
  if (key === "startsAt") return dir === "asc" ? "oldest" : "";
  if (key === "endsAt") return dir === "asc" ? "endsAt" : "endsAt_desc";
  return dir === "asc" ? "title" : "title_desc";
}

function parseSortParam(s: string): { key: SortKey; dir: SortDir } | null {
  if (s === "oldest") return { key: "startsAt", dir: "asc" };
  if (s === "" || !s) return { key: "startsAt", dir: "desc" };
  if (s === "title") return { key: "title", dir: "asc" };
  if (s === "title_desc") return { key: "title", dir: "desc" };
  if (s === "endsAt") return { key: "endsAt", dir: "asc" };
  if (s === "endsAt_desc") return { key: "endsAt", dir: "desc" };
  return null;
}

function getStatusVisual(status: string, isOverdue: boolean): { dot: string; label: string; className: string } {
  if (isOverdue) return { dot: "var(--red)", label: "Overdue", className: "status-overdue" };
  switch (status) {
    case "OPEN":
    case "DRAFT":
    case "BOOKED":
      return { dot: "var(--green)", label: status === "BOOKED" ? "Booked" : status === "DRAFT" ? "Draft" : "Open", className: "status-active" };
    case "CANCELLED":
      return { dot: "var(--text-muted)", label: "Cancelled", className: "status-cancelled" };
    case "COMPLETED":
      return { dot: "var(--text-muted)", label: "Completed", className: "status-completed" };
    default:
      return { dot: "var(--text-muted)", label: status.toLowerCase(), className: "" };
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function SortHeader({ label, sortKey, currentSort, onSort }: {
  label: string;
  sortKey: SortKey;
  currentSort: string;
  onSort: (param: string) => void;
}) {
  const parsed = parseSortParam(currentSort);
  const isActive = parsed?.key === sortKey;
  const dir = isActive ? parsed.dir : null;

  function handleClick() {
    if (!isActive) {
      // First click: sort ascending (except startsAt defaults desc)
      onSort(toSortParam(sortKey, sortKey === "startsAt" ? "desc" : "asc"));
    } else {
      // Toggle direction
      onSort(toSortParam(sortKey, dir === "asc" ? "desc" : "asc"));
    }
  }

  return (
    <th className="sort-header" onClick={handleClick}>
      <span className="sort-header-inner">
        {label}
        {isActive && (
          <span className="sort-arrow">{dir === "asc" ? "\u2191" : "\u2193"}</span>
        )}
      </span>
    </th>
  );
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
  const { toast } = useToast();
  const urlParams = useSearchParams();

  // ── List state ──
  const [items, setItems] = useState<BookingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("");
  const [statusFilter, setStatusFilter] = useState(urlParams.get("status") || "");
  const [sportFilter, setSportFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [specialFilter, setSpecialFilter] = useState(urlParams.get("filter") || "");

  // ── Form options ──
  const [users, setUsers] = useState<FormUser[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // ── Create form state ──
  const [showCreate, setShowCreate] = useState(
    urlParams.get("create") === "true" || !!urlParams.get("title")
  );
  const [tieToEvent, setTieToEvent] = useState(config.defaultTieToEvent);
  const [createSport, setCreateSport] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [createTitle, setCreateTitle] = useState(urlParams.get("title") || "");
  const [createLocationId, setCreateLocationId] = useState("");
  const [createRequester, setCreateRequester] = useState("");
  const [createStartsAt, setCreateStartsAt] = useState(() => {
    const p = urlParams.get("startsAt");
    return p ? toLocalDateTimeValue(new Date(p)) : toLocalDateTimeValue(roundTo15Min(new Date()));
  });
  const [createEndsAt, setCreateEndsAt] = useState(() => {
    const p = urlParams.get("endsAt");
    return p ? toLocalDateTimeValue(new Date(p)) : toLocalDateTimeValue(roundTo15Min(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  });
  const [createError, setCreateError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Equipment picker state ──
  const [availableAssets, setAvailableAssets] = useState<AvailableAsset[]>([]);
  const [bulkSkus, setBulkSkus] = useState<BulkSkuOption[]>([]);
  const [showEquipPicker, setShowEquipPicker] = useState(true);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [selectedBulkItems, setSelectedBulkItems] = useState<BulkSelection[]>([]);

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
    setLoadError(false);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(page * limit));
      if (search) params.set("q", search);
      if (sort) params.set("sort", sort);
      if (specialFilter) params.set("filter", specialFilter);
      if (!specialFilter && statusFilter) params.set("status", statusFilter);
      if (config.hasSportFilter && sportFilter) params.set("sport_code", sportFilter);
      if (locationFilter) params.set("location_id", locationFilter);
      if (userFilter) params.set("requester_id", userFilter);
      const res = await fetch(`${config.apiBase}?${params}`);
      if (res.ok) {
        const json: ListResponse = await res.json();
        setItems(json.data ?? []);
        setTotal(json.total ?? 0);
      } else {
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  }, [page, search, sort, statusFilter, sportFilter, locationFilter, userFilter, specialFilter, config.apiBase, config.hasSportFilter]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    fetch("/api/form-options")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (!json?.data) return;
        setUsers(json.data.users || []);
        setLocations(json.data.locations || []);
        const urlLocId = urlParams.get("locationId");
        setCreateLocationId(urlLocId || json.data.locations?.[0]?.id || "");
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
          // Initialize "mine" filter from URL
          if (urlParams.get("mine") === "true" && json.user.id) {
            setUserFilter(json.user.id);
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

  const [extendingId, setExtendingId] = useState<string | null>(null);

  async function handleExtendFromMenu(bookingId: string, days: number) {
    const item = items.find((i) => i.id === bookingId);
    if (!item || extendingId) return;
    setExtendingId(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endsAt: new Date(new Date(item.endsAt).getTime() + days * 24 * 60 * 60 * 1000).toISOString() }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Extend failed", "error");
      }
      await reload();
    } catch {
      toast("Network error — please try again.", "error");
    }
    setExtendingId(null);
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

  const equipmentCount = selectedAssetIds.length + selectedBulkItems.length;

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
                  <div className="event-section">
                    <label className="event-section-label">
                      Upcoming events (next 30 days)
                    </label>
                    {eventsLoading ? (
                      <div className="empty-message">
                        Loading events...
                      </div>
                    ) : events.length === 0 ? (
                      <div className="empty-message-bordered">
                        No upcoming events for {sportLabel(createSport)}. Toggle off {"\u201c"}Tie to event{"\u201d"} to create without an event, or add events via the Events page.
                      </div>
                    ) : (
                      <div className="event-scroll">
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
                              <span className="badge badge-gray badge-gray-sm">
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

            {/* Equipment picker */}
            <EquipmentPicker
              assets={availableAssets}
              bulkSkus={bulkSkus}
              selectedAssetIds={selectedAssetIds}
              setSelectedAssetIds={setSelectedAssetIds}
              selectedBulkItems={selectedBulkItems}
              setSelectedBulkItems={setSelectedBulkItems}
              visible={showEquipPicker}
              onDone={() => setShowEquipPicker(false)}
              onReopen={() => setShowEquipPicker(true)}
              startsAt={createStartsAt}
              endsAt={createEndsAt}
              locationId={createLocationId}
            />

            {createError && (
              <div className="alert-error">{createError}</div>
            )}
          </div>

          <div className="create-card-footer">
            <button className="btn" onClick={() => setShowCreate(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={submitting}
              onClick={handleCreate}
            >
              {submitting ? "Creating..." : `Create ${config.label}`}
            </button>
          </div>
        </div>
      )}

      {/* ════════ Filter bar ════════ */}
      <div className="card">
        <div className="card-header filter-chip-bar">
          <h2 style={{ margin: 0, whiteSpace: "nowrap" }}>All {config.labelPlural.toLowerCase()}</h2>
          <input
            type="text"
            className="form-input filter-chip-search"
            placeholder="Search by title or requester..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
          <div className="filter-chips">
            {specialFilter ? (
              <button
                type="button"
                className="filter-chip filter-chip-active"
                onClick={() => { setSpecialFilter(""); setPage(0); }}
              >
                <span className="filter-chip-label">Showing:</span>
                <span className="filter-chip-value">{specialFilter === "overdue" ? "Overdue" : "Due today"}</span>
                <span className="filter-chip-clear">&times;</span>
              </button>
            ) : (
              <FilterChip
                label="Status"
                value={statusFilter}
                displayValue={config.statusOptions.find((s) => s.value === statusFilter)?.label}
                options={config.statusOptions}
                onSelect={(v) => { setStatusFilter(v); setPage(0); }}
                onClear={() => { setStatusFilter(""); setPage(0); }}
              />
            )}
            {config.hasSportFilter && sportCodesInUse.length > 0 && (
              <FilterChip
                label="Sport"
                value={sportFilter}
                options={SPORT_CODES.map((s) => ({ value: s.code, label: s.code }))}
                onSelect={(v) => { setSportFilter(v); setPage(0); }}
                onClear={() => { setSportFilter(""); setPage(0); }}
              />
            )}
            {locations.length > 1 && (
              <FilterChip
                label="Location"
                value={locationFilter}
                displayValue={locations.find((l) => l.id === locationFilter)?.name}
                options={locations.map((l) => ({ value: l.id, label: l.name }))}
                onSelect={(v) => { setLocationFilter(v); setPage(0); }}
                onClear={() => { setLocationFilter(""); setPage(0); }}
              />
            )}
            {users.length > 0 && (
              <FilterChip
                label="User"
                value={userFilter}
                displayValue={users.find((u) => u.id === userFilter)?.name}
                options={users.map((u) => ({ value: u.id, label: u.name }))}
                onSelect={(v) => { setUserFilter(v); setPage(0); }}
                onClear={() => { setUserFilter(""); setPage(0); }}
              />
            )}
            {(statusFilter || sportFilter || locationFilter || userFilter || specialFilter) && (
              <button
                type="button"
                className="filter-chip-clear-all"
                onClick={() => { setStatusFilter(""); setSportFilter(""); setLocationFilter(""); setUserFilter(""); setSpecialFilter(""); setPage(0); }}
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* ════════ Booking list ════════ */}
        {loading ? (
          <SkeletonTable rows={6} cols={5} />
        ) : loadError ? (
          <EmptyState icon="clipboard" title={`Failed to load ${config.labelPlural.toLowerCase()}`} description="Check your connection and try again." actionLabel="Retry" onAction={reload} />
        ) : items.length === 0 ? (
          <EmptyState icon="clipboard" title={`No ${config.labelPlural.toLowerCase()} found`} description="Try adjusting your search or filters." />
        ) : (
          <>
            {/* Desktop table */}
            <div className="booking-table-wrap">
              <table className="data-table booking-table">
                <thead>
                  <tr>
                    <SortHeader label="Name" sortKey="title" currentSort={sort} onSort={(s) => { setSort(s); setPage(0); }} />
                    <SortHeader label="From" sortKey="startsAt" currentSort={sort} onSort={(s) => { setSort(s); setPage(0); }} />
                    <SortHeader label="To" sortKey="endsAt" currentSort={sort} onSort={(s) => { setSort(s); setPage(0); }} />
                    <th className="hide-mobile">Duration</th>
                    <th className="hide-mobile">User</th>
                    <th className="hide-mobile">Items</th>
                    <th className="col-overflow"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const isOverdue = item.status === config.overdueStatus && new Date(item.endsAt) < new Date();
                    const sv = getStatusVisual(item.status, isOverdue);
                    const from = formatDateCol(item.startsAt);
                    const to = formatDateCol(item.endsAt);
                    return (
                      <tr
                        key={item.id}
                        className={`${sv.className} cursor-pointer`}
                        onClick={() => setSelectedBookingId(item.id)}
                        onContextMenu={(e) => handleContextMenu(e, item)}
                      >
                        <td>
                          <div className="booking-name-cell">
                            <span className="row-link">{item.title}</span>
                            <span className="booking-status-line">
                              <span className="status-dot" style={{ background: sv.dot }} />
                              <span className="status-label">{sv.label}</span>
                            </span>
                          </div>
                        </td>
                        <td className="hide-mobile">
                          <div className="date-cell">
                            <span className="date-main">{from.date}</span>
                            <span className="date-sub">{from.day} {from.time}</span>
                          </div>
                        </td>
                        <td className="hide-mobile">
                          <div className="date-cell">
                            <span className="date-main">{to.date}</span>
                            <span className="date-sub">{to.day} {to.time}</span>
                          </div>
                        </td>
                        <td className="hide-mobile">{formatDuration(item.startsAt, item.endsAt)}</td>
                        <td className="hide-mobile">{item.requester?.name ?? "Unknown"}</td>
                        <td className="hide-mobile">{(item.serializedItems?.length ?? 0) + (item.bulkItems?.length ?? 0)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button className="overflow-btn" onClick={(e) => handleOverflow(e, item)}>
                            {"\u2026"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="booking-mobile-list">
              {items.map((item) => {
                const isOverdue = item.status === config.overdueStatus && new Date(item.endsAt) < new Date();
                const sv = getStatusVisual(item.status, isOverdue);
                return (
                  <div
                    key={item.id}
                    className={`booking-mobile-card ${sv.className}`}
                    onClick={() => setSelectedBookingId(item.id)}
                  >
                    <div className="booking-mobile-top">
                      <div className="booking-mobile-name">
                        <span className="row-link">{item.title}</span>
                        <span className="booking-status-line">
                          <span className="status-dot" style={{ background: sv.dot }} />
                          <span className="status-label">{sv.label}</span>
                        </span>
                      </div>
                      <button
                        className="overflow-btn"
                        onClick={(e) => { e.stopPropagation(); handleOverflow(e, item); }}
                      >
                        {"\u2026"}
                      </button>
                    </div>
                    <div className="booking-mobile-meta">
                      <span>{formatDateShort(item.startsAt)} {"\u2013"} {formatDateShort(item.endsAt)}</span>
                      <span>{"\u00b7"}</span>
                      <span>{item.requester?.name ?? "Unknown"}</span>
                      <span>{"\u00b7"}</span>
                      <span>{formatDuration(item.startsAt, item.endsAt)}</span>
                    </div>
                  </div>
                );
              })}
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
                  disabled={extendingId === ctxMenu.item.id}
                >
                  {extendingId === ctxMenu.item.id ? "Extending..." : "Extend +1 day"}
                </button>
                <button
                  className="ctx-menu-item"
                  onClick={() => ctxAction(() => handleExtendFromMenu(ctxMenu.item.id, 7))}
                  disabled={extendingId === ctxMenu.item.id}
                >
                  {extendingId === ctxMenu.item.id ? "Extending..." : "Extend +1 week"}
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
