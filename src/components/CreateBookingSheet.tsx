"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, ClockIcon, CalendarIcon, PackageIcon, FileTextIcon, BoxesIcon } from "lucide-react";
import { SPORT_CODES, sportLabel, generateEventTitle } from "@/lib/sports";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { useToast } from "@/components/Toast";
import EquipmentPicker from "@/components/EquipmentPicker";
import type { BulkSelection } from "@/components/EquipmentPicker";
import { ConfirmBookingDialog } from "./booking-list/ConfirmBookingDialog";
import {
  roundTo15Min,
  toLocalDateTimeValue,
  formatDate,
  type BookingListConfig,
  type CalendarEvent,
  type FormUser,
  type Location,
  type AvailableAsset,
  type BulkSkuOption,
} from "./booking-list/types";

/* ───── Reducer ───── */

type FormState = {
  tieToEvent: boolean;
  sport: string;
  selectedEvent: CalendarEvent | null;
  title: string;
  requester: string;
  locationId: string;
  startsAt: string;
  endsAt: string;
};

type FormAction =
  | { type: "SET_TIE_TO_EVENT"; value: boolean }
  | { type: "SET_SPORT"; value: string }
  | { type: "SELECT_EVENT"; event: CalendarEvent; title: string; startsAt: string; endsAt: string; locationId?: string }
  | { type: "SET_TITLE"; value: string }
  | { type: "SET_REQUESTER"; value: string }
  | { type: "SET_LOCATION_ID"; value: string }
  | { type: "SET_STARTS_AT"; value: string }
  | { type: "SET_ENDS_AT"; value: string }
  | { type: "RESET"; defaults: Partial<FormState> }
  | { type: "LOAD_DRAFT"; draft: Partial<FormState> };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_TIE_TO_EVENT":
      return { ...state, tieToEvent: action.value, selectedEvent: null };
    case "SET_SPORT":
      return { ...state, sport: action.value, selectedEvent: null };
    case "SELECT_EVENT":
      return {
        ...state,
        selectedEvent: action.event,
        title: action.title,
        startsAt: action.startsAt,
        endsAt: action.endsAt,
        locationId: action.locationId ?? state.locationId,
      };
    case "SET_TITLE":
      return { ...state, title: action.value };
    case "SET_REQUESTER":
      return { ...state, requester: action.value };
    case "SET_LOCATION_ID":
      return { ...state, locationId: action.value };
    case "SET_STARTS_AT":
      return { ...state, startsAt: action.value };
    case "SET_ENDS_AT":
      return { ...state, endsAt: action.value };
    case "RESET":
      return {
        tieToEvent: action.defaults.tieToEvent ?? true,
        sport: "",
        selectedEvent: null,
        title: "",
        requester: action.defaults.requester ?? "",
        locationId: action.defaults.locationId ?? "",
        startsAt: toLocalDateTimeValue(roundTo15Min(new Date())),
        endsAt: toLocalDateTimeValue(roundTo15Min(new Date(Date.now() + 24 * 60 * 60 * 1000))),
      };
    case "LOAD_DRAFT":
      return { ...state, ...action.draft };
    default:
      return state;
  }
}

/* ───── Section type ───── */

type Section = "event" | "details" | "equipment";

/* ───── Props ───── */

export type CreateBookingSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: BookingListConfig;
  users: FormUser[];
  locations: Location[];
  bulkSkus: BulkSkuOption[];
  onCreated: (bookingId: string) => void;
  draftId: string | null;
  onDraftIdChange: (id: string | null) => void;
  /** Pre-fill values from URL params */
  initialTitle?: string;
  initialStartsAt?: string;
  initialEndsAt?: string;
  initialLocationId?: string;
  initialRequester?: string;
  /** Pre-select assets (e.g. from item detail page deep-link) */
  initialAssetIds?: string[];
  /** Auto-fill event tie-in from deep link */
  initialEventId?: string;
  initialSportCode?: string;
};

/* ───── Component ───── */

export default function CreateBookingSheet({
  open,
  onOpenChange,
  config,
  users,
  locations,
  bulkSkus,
  onCreated,
  draftId,
  onDraftIdChange,
  initialTitle = "",
  initialStartsAt,
  initialEndsAt,
  initialLocationId,
  initialRequester = "",
  initialAssetIds,
  initialEventId,
  initialSportCode,
}: CreateBookingSheetProps) {
  const { toast } = useToast();

  // ── Form state ──
  const [form, dispatch] = useReducer(formReducer, {
    tieToEvent: config.defaultTieToEvent || !!initialSportCode,
    sport: initialSportCode || "",
    selectedEvent: null,
    title: initialTitle,
    requester: initialRequester,
    locationId: initialLocationId || locations[0]?.id || "",
    startsAt: initialStartsAt || toLocalDateTimeValue(roundTo15Min(new Date())),
    endsAt: initialEndsAt || toLocalDateTimeValue(roundTo15Min(new Date(Date.now() + 24 * 60 * 60 * 1000))),
  });

  // ── Equipment state (needs Dispatch<SetStateAction> for EquipmentPicker) ──
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(initialAssetIds ?? []);
  const [selectedBulkItems, setSelectedBulkItems] = useState<BulkSelection[]>([]);
  const [selectedAssetDetails, setSelectedAssetDetails] = useState<AvailableAsset[]>([]);
  const [showEquipPicker, setShowEquipPicker] = useState(true);

  // ── Kit state ──
  const [kitId, setKitId] = useState<string>("");
  const [kits, setKits] = useState<{ id: string; name: string }[]>([]);

  // ── Fetch kits for the selected location ──
  useEffect(() => {
    if (!form.locationId || !open) {
      setKits([]);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/kits?location_id=${form.locationId}&limit=100`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (controller.signal.aborted) return;
        setKits(
          (json?.data || []).map((k: { id: string; name: string }) => ({
            id: k.id,
            name: k.name,
          })),
        );
      })
      .catch((err) => {
        if (err?.name !== "AbortError") setKits([]);
      });
    return () => controller.abort();
  }, [form.locationId, open]);

  // ── Events + shift ──
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [myShiftForEvent, setMyShiftForEvent] = useState<{
    area: string;
    startsAt: string;
    endsAt: string;
    gearStatus: string;
  } | null>(null);

  // ── Submission ──
  const [createError, setCreateError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const submittingRef = useRef(false);

  // ── Collapsible sections ──
  const [openSection, setOpenSection] = useState<Section>(
    initialAssetIds?.length ? "details" : "event",
  );

  // ── Draft loaded flag ──
  const draftLoadedRef = useRef(false);

  // ── Item count for footer ──
  const itemCount = selectedAssetIds.length + selectedBulkItems.reduce((sum, b) => sum + b.quantity, 0);

  // ── Toggle section (accordion behavior) ──
  function toggleSection(section: Section) {
    setOpenSection((prev) => (prev === section ? prev : section));
  }

  // ── Fetch events when sport selected ──
  useEffect(() => {
    if (!form.sport || !form.tieToEvent || !open) {
      setEvents([]);
      return;
    }
    setEventsLoading(true);
    const controller = new AbortController();
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const params = new URLSearchParams({
      sportCode: form.sport,
      startDate: now.toISOString(),
      endDate: in30.toISOString(),
      limit: "50",
    });
    fetch(`/api/calendar-events?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (controller.signal.aborted) return;
        setEvents(json?.data || []);
        setEventsLoading(false);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          setEventsLoading(false);
          toast("Couldn\u2019t load events \u2014 try again", "error");
        }
      });
    return () => controller.abort();
  }, [form.sport, form.tieToEvent, open]);

  // ── Auto-select event when initialEventId matches a loaded event ──
  const autoSelectedEventRef = useRef(false);
  useEffect(() => {
    if (!initialEventId || autoSelectedEventRef.current || events.length === 0) return;
    const match = events.find((e) => e.id === initialEventId);
    if (match) {
      autoSelectedEventRef.current = true;
      selectEvent(match);
    }
  }, [events, initialEventId]);

  // ── Fetch shift context when event changes ──
  useEffect(() => {
    if (!form.selectedEvent) {
      setMyShiftForEvent(null);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/my-shifts?eventId=${form.selectedEvent.id}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (controller.signal.aborted) return;
        const shifts = json?.data;
        if (shifts?.length > 0) {
          const s = shifts[0];
          setMyShiftForEvent({ area: s.area, startsAt: s.startsAt, endsAt: s.endsAt, gearStatus: s.gear.status });
        } else {
          setMyShiftForEvent(null);
        }
      })
      .catch((err) => {
        if (err?.name !== "AbortError") setMyShiftForEvent(null);
      });
    return () => controller.abort();
  }, [form.selectedEvent]);

  // ── Load draft ──
  useEffect(() => {
    if (!draftId || draftLoadedRef.current || !open) return;
    draftLoadedRef.current = true;
    fetch(`/api/drafts/${draftId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!json?.data) return;
        const d = json.data;
        const draft: Partial<FormState> = {};
        if (d.title && d.title !== "Untitled draft") draft.title = d.title;
        if (d.requesterUserId) draft.requester = d.requesterUserId;
        if (d.locationId) draft.locationId = d.locationId;
        if (d.startsAt) draft.startsAt = toLocalDateTimeValue(new Date(d.startsAt));
        if (d.endsAt) draft.endsAt = toLocalDateTimeValue(new Date(d.endsAt));
        if (d.sportCode) draft.sport = d.sportCode;
        dispatch({ type: "LOAD_DRAFT", draft });
        if (d.serializedAssetIds?.length) setSelectedAssetIds(d.serializedAssetIds);
        if (d.bulkItems?.length) {
          setSelectedBulkItems(
            d.bulkItems.map((bi: { bulkSkuId: string; quantity: number }) => ({
              bulkSkuId: bi.bulkSkuId,
              quantity: bi.quantity,
            })),
          );
        }
      })
      .catch(() => {
        toast("Couldn\u2019t load your draft \u2014 starting fresh", "error");
      });
  }, [draftId, open]);

  // ── Event selection auto-populate ──
  function selectEvent(ev: CalendarEvent) {
    const title = generateEventTitle(ev.sportCode || form.sport, ev.opponent, ev.isHome);
    const start = new Date(new Date(ev.startsAt).getTime() - 2 * 60 * 60 * 1000);
    const end = new Date(new Date(ev.endsAt).getTime() + 2 * 60 * 60 * 1000);
    dispatch({
      type: "SELECT_EVENT",
      event: ev,
      title,
      startsAt: toLocalDateTimeValue(start),
      endsAt: toLocalDateTimeValue(end),
      locationId: ev.location?.id,
    });
  }

  // ── Draft save ──
  const saveDraft = useCallback(async () => {
    const hasData = form.title.trim() || selectedAssetIds.length > 0 || selectedBulkItems.length > 0;
    if (!hasData) return;
    try {
      const payload: Record<string, unknown> = {
        kind: config.kind,
        title: form.title.trim(),
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        serializedAssetIds: selectedAssetIds,
        bulkItems: selectedBulkItems,
      };
      if (draftId) payload.id = draftId;
      if (form.requester) payload.requesterUserId = form.requester;
      if (form.locationId) payload.locationId = form.locationId;
      if (form.selectedEvent) {
        payload.eventId = form.selectedEvent.id;
        payload.sportCode = form.selectedEvent.sportCode || form.sport || undefined;
      } else if (form.sport) {
        payload.sportCode = form.sport;
      }
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = await res.json();
        onDraftIdChange(json.data.id);
        toast("Draft saved", "info");
      }
    } catch {
      toast("Draft couldn\u2019t be saved \u2014 your changes may be lost", "error");
    }
  }, [form, selectedAssetIds, selectedBulkItems, draftId, config.kind, onDraftIdChange]);

  async function deleteDraft() {
    if (!draftId) return;
    try {
      await fetch(`/api/drafts/${draftId}`, { method: "DELETE" });
    } catch {
      /* best-effort */
    }
    onDraftIdChange(null);
  }

  // ── Close handler ──
  async function handleClose() {
    await saveDraft();
    onOpenChange(false);
  }

  // ── Validation ──
  function handleCreateClick() {
    if (!form.title.trim()) {
      setCreateError("Give this booking a name");
      setOpenSection("details");
      return;
    }
    if (!form.requester) {
      setCreateError("Select who this is for");
      setOpenSection("details");
      return;
    }
    if (!form.locationId) {
      setCreateError("Choose a pickup location");
      setOpenSection("details");
      return;
    }
    setCreateError("");
    setShowConfirm(true);
  }

  // ── Submit ──
  async function handleCreateConfirm() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setCreateError("");

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      requesterUserId: form.requester,
      locationId: form.locationId,
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString(),
      serializedAssetIds: selectedAssetIds,
      bulkItems: selectedBulkItems,
    };

    if (kitId) {
      payload.kitId = kitId;
    }

    if (form.selectedEvent) {
      payload.eventId = form.selectedEvent.id;
      payload.sportCode = form.selectedEvent.sportCode || form.sport || undefined;
    } else if (form.sport) {
      payload.sportCode = form.sport;
    }

    try {
      const res = await fetchWithTimeout(config.apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409 && json.data) {
          const msgs: string[] = [];
          const d = json.data as {
            conflicts?: Array<{ assetId: string; conflictingBookingTitle?: string }>;
            unavailableAssets?: Array<{ assetId: string; status: string }>;
            shortages?: Array<{ bulkSkuId: string; requested: number; available: number }>;
          };
          if (d.conflicts?.length) {
            for (const c of d.conflicts) {
              const tag = selectedAssetDetails.find((a) => a.id === c.assetId)?.assetTag || c.assetId;
              msgs.push(`${tag} conflicts with "${c.conflictingBookingTitle || "another booking"}"`);
            }
          }
          if (d.unavailableAssets?.length) {
            for (const u of d.unavailableAssets) {
              const tag = selectedAssetDetails.find((a) => a.id === u.assetId)?.assetTag || u.assetId;
              msgs.push(`${tag} is ${u.status === "MAINTENANCE" ? "in maintenance" : u.status.toLowerCase()}`);
            }
          }
          if (d.shortages?.length) {
            for (const s of d.shortages) {
              const name = bulkSkus.find((sk) => sk.id === s.bulkSkuId)?.name || s.bulkSkuId;
              msgs.push(`${name}: only ${s.available} available (requested ${s.requested})`);
            }
          }
          setCreateError(msgs.length > 0 ? msgs.join(". ") : json.error || "Availability conflict");
        } else {
          setCreateError(json.error || `Couldn\u2019t create this ${config.label} \u2014 please try again`);
        }
        submittingRef.current = false;
        setSubmitting(false);
        setShowConfirm(false);
        return;
      }

      await deleteDraft();

      // Reset
      setShowConfirm(false);
      dispatch({
        type: "RESET",
        defaults: {
          tieToEvent: config.defaultTieToEvent,
          requester: initialRequester,
          locationId: initialLocationId || locations[0]?.id || "",
        },
      });
      setSelectedAssetIds([]);
      setSelectedBulkItems([]);
      setShowEquipPicker(true);
      setKitId("");
      setOpenSection("event");
      submittingRef.current = false;
      setSubmitting(false);
      draftLoadedRef.current = false;

      onOpenChange(false);
      onCreated(json.data.id);
    } catch {
      setCreateError(`Couldn\u2019t create this ${config.label} \u2014 please try again`);
      submittingRef.current = false;
      setSubmitting(false);
      setShowConfirm(false);
    }
  }

  // ── Section summaries ──
  const eventSummary = useMemo(() => {
    if (form.selectedEvent) {
      const ev = form.selectedEvent;
      const name = ev.opponent ? `${ev.isHome ? "vs" : "at"} ${ev.opponent}` : ev.summary;
      return (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground truncate">
          {name}
          {ev.sportCode && <Badge variant="sport" size="sm">{ev.sportCode}</Badge>}
        </span>
      );
    }
    if (!form.tieToEvent) {
      return <span className="text-sm text-muted-foreground">Ad-hoc (no event)</span>;
    }
    return <span className="text-sm text-muted-foreground">No event selected</span>;
  }, [form.selectedEvent, form.tieToEvent]);

  const detailsSummary = useMemo(() => {
    const parts: string[] = [];
    if (form.title.trim()) parts.push(form.title.trim());
    const userName = users.find((u) => u.id === form.requester)?.name;
    if (userName) parts.push(userName);
    if (form.startsAt) {
      const s = new Date(form.startsAt);
      const e = new Date(form.endsAt);
      parts.push(
        `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      );
    }
    return (
      <span className="text-sm text-muted-foreground truncate">
        {parts.length > 0 ? parts.join(" \u00b7 ") : "Not filled in"}
      </span>
    );
  }, [form.title, form.requester, form.startsAt, form.endsAt, users]);

  const equipmentSummary = useMemo(() => {
    if (itemCount === 0) return <span className="text-sm text-muted-foreground">No items selected</span>;
    return (
      <span className="text-sm text-muted-foreground">
        {itemCount} item{itemCount !== 1 ? "s" : ""} selected
      </span>
    );
  }, [itemCount]);

  // ── Warn before unload ──
  useEffect(() => {
    if (!open) return;
    const hasData = form.title.trim() || selectedAssetIds.length > 0 || selectedBulkItems.length > 0;
    if (!hasData) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [open, form.title, selectedAssetIds.length, selectedBulkItems.length]);

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            handleClose();
          }
        }}
      >
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>New {config.label}</SheetTitle>
          </SheetHeader>

          <SheetBody className="px-0 py-0">
            {/* ════════ Event Section ════════ */}
            <Collapsible open={openSection === "event"} onOpenChange={() => toggleSection("event")}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 border-b px-6 py-3 text-left hover:bg-muted/50 transition-colors"
                >
                  <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                    <span className="font-medium text-sm">Event</span>
                    {openSection !== "event" && eventSummary}
                  </div>
                  {openSection === "event" ? (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-3 border-b px-6 py-4">
                  {/* Tie to event toggle */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={`toggle ${form.tieToEvent ? "on" : ""}`}
                      onClick={() => dispatch({ type: "SET_TIE_TO_EVENT", value: !form.tieToEvent })}
                      aria-label="Tie to event"
                    />
                    <span className="text-sm">Link to event</span>
                  </div>

                  {/* Sport + event list */}
                  {form.tieToEvent && (
                    <>
                      <div className="space-y-1">
                        <Label>Sport</Label>
                        <Select value={form.sport} onValueChange={(v) => dispatch({ type: "SET_SPORT", value: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select sport..." />
                          </SelectTrigger>
                          <SelectContent>
                            {SPORT_CODES.map((s) => (
                              <SelectItem key={s.code} value={s.code}>
                                {s.code} - {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {form.sport && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Upcoming events (next 30 days)</Label>
                          {eventsLoading ? (
                            <div className="py-4 text-center text-sm text-muted-foreground">Loading events...</div>
                          ) : events.length === 0 ? (
                            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                              No upcoming events for {sportLabel(form.sport)}. Toggle off &ldquo;Link to event&rdquo; to
                              create without an event.
                            </div>
                          ) : (
                            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-1">
                              {events.map((ev) => (
                                <button
                                  key={ev.id}
                                  type="button"
                                  className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                    form.selectedEvent?.id === ev.id
                                      ? "bg-primary/10 ring-1 ring-primary/30"
                                      : "hover:bg-muted/50"
                                  }`}
                                  onClick={() => selectEvent(ev)}
                                >
                                  <div className="min-w-0">
                                    <div className="font-medium truncate">
                                      {ev.opponent ? `${ev.isHome ? "vs" : "at"} ${ev.opponent}` : ev.summary}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate">
                                      {formatDate(ev.startsAt)}
                                      {ev.rawLocationText ? ` \u00b7 ${ev.rawLocationText}` : ""}
                                      {ev.location ? ` \u00b7 ${ev.location.name}` : ""}
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1">
                                    {ev.isHome !== null && (
                                      <Badge variant="gray" size="sm">
                                        {ev.isHome ? "HOME" : "AWAY"}
                                      </Badge>
                                    )}
                                    {ev.sportCode && (
                                      <Badge variant="sport" size="sm">
                                        {ev.sportCode}
                                      </Badge>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Shift context banner */}
                  {myShiftForEvent && form.selectedEvent && (
                    <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                      <ClockIcon className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <span className="font-medium">Your shift</span>
                        <span className="text-muted-foreground">
                          {" "}
                          {myShiftForEvent.area} &middot;{" "}
                          {new Date(myShiftForEvent.startsAt)
                            .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                            .toLowerCase()}
                          {" \u2013 "}
                          {new Date(myShiftForEvent.endsAt)
                            .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                            .toLowerCase()}
                        </span>
                      </div>
                      {myShiftForEvent.gearStatus !== "none" && (
                        <Badge
                          variant={
                            myShiftForEvent.gearStatus === "checked_out"
                              ? "green"
                              : myShiftForEvent.gearStatus === "reserved"
                                ? "orange"
                                : "gray"
                          }
                        >
                          {myShiftForEvent.gearStatus === "checked_out"
                            ? "Gear out"
                            : myShiftForEvent.gearStatus === "reserved"
                              ? "Gear reserved"
                              : "Draft"}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* ════════ Details Section ════════ */}
            <Collapsible open={openSection === "details"} onOpenChange={() => toggleSection("details")}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 border-b px-6 py-3 text-left hover:bg-muted/50 transition-colors"
                >
                  <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                    <span className="font-medium text-sm">Details</span>
                    {openSection !== "details" && detailsSummary}
                  </div>
                  {openSection === "details" ? (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-3 border-b px-6 py-4">
                  {/* Title */}
                  <div className="space-y-1">
                    <Label>
                      Booking name{form.tieToEvent && form.selectedEvent ? " (auto-filled from event)" : ""}
                    </Label>
                    <Input
                      value={form.title}
                      onChange={(e) => dispatch({ type: "SET_TITLE", value: e.target.value })}
                      placeholder={form.tieToEvent ? "Select an event above..." : "e.g. Game day equipment"}
                      required
                    />
                  </div>

                  {/* Sport (when not tied to event) */}
                  {!form.tieToEvent && (
                    <div className="space-y-1">
                      <Label>Sport (optional)</Label>
                      <Select
                        value={form.sport || "__none__"}
                        onValueChange={(v) => dispatch({ type: "SET_SPORT", value: v === "__none__" ? "" : v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {SPORT_CODES.map((s) => (
                            <SelectItem key={s.code} value={s.code}>
                              {s.code} - {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Requester */}
                  <div className="space-y-1">
                    <Label>{config.requesterLabel}</Label>
                    <Select value={form.requester} onValueChange={(v) => dispatch({ type: "SET_REQUESTER", value: v })} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Location */}
                  <div className="space-y-1">
                    <Label>Location</Label>
                    <Select
                      value={form.locationId}
                      onValueChange={(v) => dispatch({ type: "SET_LOCATION_ID", value: v })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Kit (optional) */}
                  {kits.length > 0 && (
                    <div className="space-y-1">
                      <Label className="flex items-center gap-1.5">
                        <BoxesIcon className="size-3.5" />
                        Kit (optional)
                      </Label>
                      <Select
                        value={kitId || "__none__"}
                        onValueChange={(v) => setKitId(v === "__none__" ? "" : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {kits.map((k) => (
                            <SelectItem key={k.id} value={k.id}>
                              {k.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>{config.startLabel}</Label>
                      <DateTimePicker
                        value={form.startsAt ? new Date(form.startsAt) : undefined}
                        onChange={(d) => dispatch({ type: "SET_STARTS_AT", value: toLocalDateTimeValue(d) })}
                        placeholder="Start date & time"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{config.endLabel}</Label>
                      <DateTimePicker
                        value={form.endsAt ? new Date(form.endsAt) : undefined}
                        onChange={(d) => dispatch({ type: "SET_ENDS_AT", value: toLocalDateTimeValue(d) })}
                        placeholder="End date & time"
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* ════════ Equipment Section ════════ */}
            <Collapsible open={openSection === "equipment"} onOpenChange={() => toggleSection("equipment")}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 border-b px-6 py-3 text-left hover:bg-muted/50 transition-colors"
                >
                  <PackageIcon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                    <span className="font-medium text-sm">Equipment</span>
                    {openSection !== "equipment" && equipmentSummary}
                  </div>
                  {openSection === "equipment" ? (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-b px-6 py-4">
                  <EquipmentPicker
                    bulkSkus={bulkSkus}
                    selectedAssetIds={selectedAssetIds}
                    setSelectedAssetIds={setSelectedAssetIds}
                    selectedBulkItems={selectedBulkItems}
                    setSelectedBulkItems={setSelectedBulkItems}
                    visible={showEquipPicker}
                    onDone={() => setShowEquipPicker(false)}
                    onReopen={() => setShowEquipPicker(true)}
                    startsAt={form.startsAt}
                    endsAt={form.endsAt}
                    locationId={form.locationId}
                    onSelectedAssetsChange={setSelectedAssetDetails}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* ════════ Error Banner ════════ */}
            {createError && (
              <div className="mx-6 mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {createError}
              </div>
            )}
          </SheetBody>

          <SheetFooter>
            <Button variant="outline" onClick={handleClose}>
              Discard
            </Button>
            <Button disabled={submitting} onClick={handleCreateClick}>
              {submitting ? config.actionLabelProgress : config.actionLabel}
              {itemCount > 0 && ` (${itemCount})`}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ════════ Confirm booking dialog ════════ */}
      <ConfirmBookingDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={handleCreateConfirm}
        config={config}
        title={form.title}
        startsAt={new Date(form.startsAt).toISOString()}
        endsAt={new Date(form.endsAt).toISOString()}
        locationName={locations.find((l) => l.id === form.locationId)?.name || ""}
        requesterName={users.find((u) => u.id === form.requester)?.name || ""}
        selectedAssetDetails={selectedAssetDetails}
        selectedBulkItems={selectedBulkItems}
        bulkSkus={bulkSkus}
        submitting={submitting}
      />
    </>
  );
}
