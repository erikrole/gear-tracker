"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
const BookingDetailsSheet = dynamic(() => import("@/components/BookingDetailsSheet"), { ssr: false });
import { generateEventTitle } from "@/lib/sports";
import { useToast } from "@/components/Toast";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import type { BulkSelection } from "@/components/EquipmentPicker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmBookingDialog } from "./booking-list/ConfirmBookingDialog";

import {
  SortHeader,
  BookingFilters,
  BookingTableRow,
  BookingMobileCard,
  CreateBookingCard,
  roundTo15Min,
  toLocalDateTimeValue,
  type BookingItem,
  type BookingListConfig,
  type StatusOption,
  type ContextMenuExtra,
  type FormUser,
  type Location,
  type CalendarEvent,
  type AvailableAsset,
  type BulkSkuOption,
  type ListResponse,
} from "./booking-list";

/* ───── Re-exports for backward compatibility ───── */
export type { BookingItem, BookingListConfig, StatusOption, ContextMenuExtra };

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

  // ── Draft state ──
  const [draftId, setDraftId] = useState<string | null>(urlParams.get("draftId"));
  const draftLoadedRef = useRef(false);

  // ── Create form state ──
  const [showCreate, setShowCreate] = useState(
    urlParams.get("create") === "true" || !!urlParams.get("title") || !!urlParams.get("draftId")
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

  // ── Shift context (integration) ──
  const [myShiftForEvent, setMyShiftForEvent] = useState<{
    area: string;
    startsAt: string;
    endsAt: string;
    gearStatus: string;
  } | null>(null);

  // ── Equipment picker state ──
  const [availableAssets, setAvailableAssets] = useState<AvailableAsset[]>([]);
  const [bulkSkus, setBulkSkus] = useState<BulkSkuOption[]>([]);
  const [showEquipPicker, setShowEquipPicker] = useState(true);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [selectedBulkItems, setSelectedBulkItems] = useState<BulkSelection[]>([]);

  // ── Sheet + menu ──
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

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
      .catch(() => { toast("Failed to load filter options", "error"); });
    fetch("/api/me")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (json?.user) {
          setCurrentUserId(json.user.id || "");
          setCurrentUserRole(json.user.role || "");
          if (!createRequester && json.user.id) {
            setCreateRequester(json.user.id);
          }
          if (urlParams.get("mine") === "true" && json.user.id) {
            setUserFilter(json.user.id);
          }
        }
      })
      .catch(() => { toast("Couldn\u2019t verify your session \u2014 some features may be limited", "error"); });
  }, []);

  // Load draft data when draftId is present
  useEffect(() => {
    if (!draftId || draftLoadedRef.current) return;
    draftLoadedRef.current = true;
    fetch(`/api/drafts/${draftId}`)
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (!json?.data) return;
        const d = json.data;
        if (d.title && d.title !== "Untitled draft") setCreateTitle(d.title);
        if (d.requesterUserId) setCreateRequester(d.requesterUserId);
        if (d.locationId) setCreateLocationId(d.locationId);
        if (d.startsAt) setCreateStartsAt(toLocalDateTimeValue(new Date(d.startsAt)));
        if (d.endsAt) setCreateEndsAt(toLocalDateTimeValue(new Date(d.endsAt)));
        if (d.sportCode) setCreateSport(d.sportCode);
        if (d.serializedAssetIds?.length) setSelectedAssetIds(d.serializedAssetIds);
        if (d.bulkItems?.length) {
          setSelectedBulkItems(d.bulkItems.map((bi: { bulkSkuId: string; quantity: number }) => ({
            bulkSkuId: bi.bulkSkuId,
            quantity: bi.quantity,
          })));
        }
      })
      .catch(() => { toast("Couldn\u2019t load your draft \u2014 starting fresh", "error"); });
  }, [draftId]);

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
      .catch(() => { setEventsLoading(false); toast("Couldn\u2019t load events \u2014 try again", "error"); });
  }, [createSport, tieToEvent]);

  // Fetch shift context when event changes
  useEffect(() => {
    if (!selectedEvent) {
      setMyShiftForEvent(null);
      return;
    }
    fetch(`/api/my-shifts?eventId=${selectedEvent.id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        const shifts = json?.data;
        if (shifts?.length > 0) {
          const s = shifts[0];
          setMyShiftForEvent({
            area: s.area,
            startsAt: s.startsAt,
            endsAt: s.endsAt,
            gearStatus: s.gear.status,
          });
        } else {
          setMyShiftForEvent(null);
        }
      })
      .catch(() => setMyShiftForEvent(null));
  }, [selectedEvent]);

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

  // ── Draft save / discard ──

  async function saveDraft() {
    const hasData = createTitle.trim() || selectedAssetIds.length > 0 || selectedBulkItems.length > 0;
    if (!hasData) return;

    try {
      const payload: Record<string, unknown> = {
        kind: config.kind,
        title: createTitle.trim(),
        startsAt: new Date(createStartsAt).toISOString(),
        endsAt: new Date(createEndsAt).toISOString(),
        serializedAssetIds: selectedAssetIds,
        bulkItems: selectedBulkItems,
      };
      if (draftId) payload.id = draftId;
      if (createRequester) payload.requesterUserId = createRequester;
      if (createLocationId) payload.locationId = createLocationId;
      if (selectedEvent) {
        payload.eventId = selectedEvent.id;
        payload.sportCode = selectedEvent.sportCode || createSport || undefined;
      } else if (createSport) {
        payload.sportCode = createSport;
      }

      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = await res.json();
        setDraftId(json.data.id);
        toast("Draft saved", "info");
      }
    } catch {
      toast("Draft couldn\u2019t be saved \u2014 your changes may be lost", "error");
    }
  }

  async function deleteDraft() {
    if (!draftId) return;
    try {
      await fetch(`/api/drafts/${draftId}`, { method: "DELETE" });
    } catch {
      /* best-effort */
    }
    setDraftId(null);
  }

  function handleCloseCreate() {
    saveDraft();
    setShowCreate(false);
  }

  // ── Create booking ──

  function handleCreateClick() {
    if (!createTitle.trim()) { setCreateError("Give this booking a name"); return; }
    if (!createRequester) { setCreateError("Select who this is for"); return; }
    if (!createLocationId) { setCreateError("Choose a pickup location"); return; }
    setCreateError("");
    setShowConfirm(true);
  }

  async function handleCreateConfirm() {
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
          setCreateError(json.error || `Couldn\u2019t create this ${config.label} \u2014 please try again`);
        }
        setSubmitting(false);
        setShowConfirm(false);
        return;
      }

      await deleteDraft();

      // Reset form
      setShowConfirm(false);
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
      setDraftId(null);

      setSelectedBookingId(json.data.id);
      await reload();
    } catch {
      setCreateError(`Couldn\u2019t create this ${config.label} \u2014 please try again`);
      setSubmitting(false);
      setShowConfirm(false);
    }
  }

  // ── Menu handlers ──

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
      toast("Network error \u2014 please try again.", "error");
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

  return (
    <>
      <div className="page-header">
        <h1>{config.labelPlural}</h1>
        <Button onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Close" : `New ${config.label}`}
        </Button>
      </div>

      {/* ════════ Create booking card ════════ */}
      {showCreate && (
        <CreateBookingCard
          config={config}
          tieToEvent={tieToEvent}
          onTieToEventChange={(v) => { setTieToEvent(v); setSelectedEvent(null); }}
          createSport={createSport}
          onCreateSportChange={(v) => { setCreateSport(v); setSelectedEvent(null); }}
          events={events}
          eventsLoading={eventsLoading}
          selectedEvent={selectedEvent}
          onSelectEvent={selectEvent}
          myShiftForEvent={myShiftForEvent}
          createTitle={createTitle}
          onCreateTitleChange={setCreateTitle}
          createRequester={createRequester}
          onCreateRequesterChange={setCreateRequester}
          createLocationId={createLocationId}
          onCreateLocationIdChange={setCreateLocationId}
          createStartsAt={createStartsAt}
          onCreateStartsAtChange={setCreateStartsAt}
          createEndsAt={createEndsAt}
          onCreateEndsAtChange={setCreateEndsAt}
          users={users}
          locations={locations}
          availableAssets={availableAssets}
          bulkSkus={bulkSkus}
          showEquipPicker={showEquipPicker}
          onShowEquipPickerChange={setShowEquipPicker}
          selectedAssetIds={selectedAssetIds}
          onSelectedAssetIdsChange={setSelectedAssetIds}
          selectedBulkItems={selectedBulkItems}
          onSelectedBulkItemsChange={setSelectedBulkItems}
          createError={createError}
          submitting={submitting}
          onCreate={handleCreateClick}
          onClose={handleCloseCreate}
        />
      )}

      {/* ════════ Filter bar + list ════════ */}
      <Card>
        <BookingFilters
          config={config}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(0); }}
          statusFilter={statusFilter}
          onStatusFilterChange={(v) => { setStatusFilter(v); setPage(0); }}
          specialFilter={specialFilter}
          onSpecialFilterChange={(v) => { setSpecialFilter(v); setPage(0); }}
          sportFilter={sportFilter}
          onSportFilterChange={(v) => { setSportFilter(v); setPage(0); }}
          sportCodesInUse={sportCodesInUse}
          locationFilter={locationFilter}
          onLocationFilterChange={(v) => { setLocationFilter(v); setPage(0); }}
          locations={locations}
          userFilter={userFilter}
          onUserFilterChange={(v) => { setUserFilter(v); setPage(0); }}
          users={users}
        />

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
                  {items.map((item) => (
                    <BookingTableRow
                      key={item.id}
                      item={item}
                      overdueStatus={config.overdueStatus}
                      onClick={() => setSelectedBookingId(item.id)}
                      menuProps={{
                        currentUserId, currentUserRole, config, extendingId,
                        onViewDetails: (id) => setSelectedBookingId(id),
                        onExtend: handleExtendFromMenu,
                        items, reload,
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="booking-mobile-list">
              {items.map((item) => (
                <BookingMobileCard
                  key={item.id}
                  item={item}
                  overdueStatus={config.overdueStatus}
                  onClick={() => setSelectedBookingId(item.id)}
                  menuProps={{
                    currentUserId, currentUserRole, config, extendingId,
                    onViewDetails: (id) => setSelectedBookingId(id),
                    onExtend: handleExtendFromMenu,
                    items, reload,
                  }}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <span>Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}</span>
                <div className="pagination-btns">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ════════ Booking details sheet ════════ */}
      <BookingDetailsSheet
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        onUpdated={reload}
        currentUserRole={currentUserRole}
      />

      {/* ════════ Confirm booking dialog ════════ */}
      <ConfirmBookingDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={handleCreateConfirm}
        config={config}
        title={createTitle}
        startsAt={new Date(createStartsAt).toISOString()}
        endsAt={new Date(createEndsAt).toISOString()}
        locationName={locations.find((l) => l.id === createLocationId)?.name || ""}
        requesterName={users.find((u) => u.id === createRequester)?.name || ""}
        selectedAssetIds={selectedAssetIds}
        availableAssets={availableAssets}
        selectedBulkItems={selectedBulkItems}
        bulkSkus={bulkSkus}
        submitting={submitting}
      />
    </>
  );
}
