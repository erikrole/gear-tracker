"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BookingDetailsSheet from "@/components/BookingDetailsSheet";
import { SPORT_CODES, generateEventTitle, sportLabel } from "@/lib/sports";
import { getAllowedActionsClient } from "@/lib/checkout-actions";

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
      serializedAssetIds: [],
      bulkItems: [],
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
