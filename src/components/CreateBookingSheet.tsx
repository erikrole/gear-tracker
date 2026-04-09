"use client";

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
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
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, PackageIcon } from "lucide-react";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { useToast } from "@/components/Toast";
import EquipmentPicker from "@/components/EquipmentPicker";
import type { BulkSelection } from "@/components/EquipmentPicker";
import { classifyAssetType } from "@/lib/equipment-sections";
import { getUnsatisfiedRequirements } from "@/lib/equipment-guidance";
import type { EquipmentSectionKey } from "@/lib/equipment-sections";
import { ConfirmBookingDialog } from "./booking-list/ConfirmBookingDialog";
import {
  roundTo15Min,
  toLocalDateTimeValue,
  type BookingListConfig,
  type FormUser,
  type Location,
  type AvailableAsset,
  type BulkSkuOption,
} from "./booking-list/types";
import type { FormState, FormAction, Section } from "./create-booking/types";
import { useEventContext } from "./create-booking/use-event-context";
import { useDraftManagement } from "./create-booking/use-draft-management";
import { useKitFetching } from "./create-booking/use-kit-fetching";
import { EventSection } from "./create-booking/EventSection";
import { DetailsSection } from "./create-booking/DetailsSection";

/* ───── Reducer ───── */

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
  const { kits } = useKitFetching({ locationId: form.locationId, open });

  // ── Events + shift (extracted hook) ──
  const { events, eventsLoading, myShiftForEvent, selectEvent } = useEventContext({
    sport: form.sport,
    tieToEvent: form.tieToEvent,
    open,
    selectedEvent: form.selectedEvent,
    initialEventId,
    dispatch,
  });

  // ── Submission ──
  const [createError, setCreateError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const submittingRef = useRef(false);

  // ── Collapsible sections ──
  const [openSection, setOpenSection] = useState<Section>(
    initialAssetIds?.length ? "details" : "event",
  );

  // ── Item count for footer ──
  const itemCount = selectedAssetIds.length + selectedBulkItems.reduce((sum, b) => sum + b.quantity, 0);

  // ── Draft management (extracted hook) ──
  const { saveDraft, deleteDraft, resetDraftLoaded } = useDraftManagement({
    draftId,
    open,
    form,
    selectedAssetIds,
    selectedBulkItems,
    dispatch,
    setSelectedAssetIds,
    setSelectedBulkItems,
    setSelectedAssetDetails,
    setKitId,
    onDraftIdChange,
    config,
  });

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
    // Check equipment requirement rules (e.g., camera body requires batteries)
    if (selectedAssetDetails.length > 0) {
      const sectionKeys = [...new Set(
        selectedAssetDetails.map((a) => classifyAssetType(a.type, a.categoryName))
      )] as EquipmentSectionKey[];
      if (selectedBulkItems.length > 0) sectionKeys.push("batteries"); // bulk batteries count
      const unsatisfied = getUnsatisfiedRequirements(sectionKeys);
      if (unsatisfied.length > 0) {
        setCreateError(unsatisfied[0].message);
        return;
      }
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
      resetDraftLoaded();

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
      const name = ev.opponent ? `${ev.isHome === false ? "at" : "vs"} ${ev.opponent}` : ev.summary;
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
            <Accordion type="single" value={openSection} onValueChange={(v) => v && setOpenSection(v as Section)}>
              {/* ════════ Event Section ════════ */}
              <EventSection
                tieToEvent={form.tieToEvent}
                sport={form.sport}
                selectedEvent={form.selectedEvent}
                events={events}
                eventsLoading={eventsLoading}
                myShiftForEvent={myShiftForEvent}
                openSection={openSection}
                eventSummary={eventSummary}
                dispatch={dispatch}
                selectEvent={selectEvent}
              />

              {/* ════════ Details Section ════════ */}
              <DetailsSection
                form={form}
                dispatch={dispatch}
                users={users}
                locations={locations}
                kits={kits}
                kitId={kitId}
                setKitId={setKitId}
                config={config}
                openSection={openSection}
                detailsSummary={detailsSummary}
              />

              {/* ════════ Equipment Section ════════ */}
              <AccordionItem value="equipment">
                <AccordionTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-6 py-3 text-left hover:bg-muted/50 transition-colors"
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
                </AccordionTrigger>
                <AccordionContent>
                  <div className="px-6 py-4">
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
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* ════════ Error Banner ════════ */}
            {createError && (
              <div className="mx-6 mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {createError}
              </div>
            )}
          </SheetBody>

          <SheetFooter>
            <Button variant="outline" onClick={handleClose}>
              Save Draft
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
