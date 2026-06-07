"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { handleAuthRedirect, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { EQUIPMENT_SECTIONS, classifyAssetType } from "@/lib/equipment-sections";
import { getUnsatisfiedRequirements } from "@/lib/equipment-guidance";
import type { EquipmentSectionKey } from "@/lib/equipment-sections";
import type { BulkSelection, EquipmentPickerSelectionState } from "@/components/EquipmentPicker";
import {
  roundTo15Min,
  toLocalDateTimeValue,
  type FormUser,
  type Location,
  type AvailableAsset,
  type BulkSkuOption,
} from "@/components/booking-list/types";
import type { FormState, FormAction } from "@/components/create-booking/types";
import { useEventContext } from "@/components/create-booking/use-event-context";
import { useDraftManagement } from "@/components/create-booking/use-draft-management";
import { useKitFetching } from "@/components/create-booking/use-kit-fetching";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useFormOptions } from "@/hooks/use-form-options";
import { WizardStep1 } from "./WizardStep1";
import { WizardStep2 } from "./WizardStep2";
import { WizardStep3 } from "./WizardStep3";
import { getStep2PrimaryActionLabel } from "./flow-summary";
import { CheckIcon, AlertCircleIcon, RotateCcwIcon, XIcon } from "lucide-react";

/* ───── Config per kind ───── */

type WizardConfig = {
  kind: "CHECKOUT" | "RESERVATION";
  apiBase: string;
  label: string;
  actionLabel: string;
  actionLabelProgress: string;
  requesterLabel: string;
  startLabel: string;
  endLabel: string;
  defaultTieToEvent: boolean;
};

const CHECKOUT_CONFIG: WizardConfig = {
  kind: "CHECKOUT",
  apiBase: "/api/checkouts",
  label: "checkout",
  actionLabel: "Create pickup",
  actionLabelProgress: "Creating\u2026",
  requesterLabel: "Checked out to",
  startLabel: "Pickup",
  endLabel: "Return by",
  defaultTieToEvent: true,
};

const RESERVATION_CONFIG: WizardConfig = {
  kind: "RESERVATION",
  apiBase: "/api/reservations",
  label: "reservation",
  actionLabel: "Reserve for later",
  actionLabelProgress: "Reserving\u2026",
  requesterLabel: "Reserved for",
  startLabel: "Start",
  endLabel: "End",
  defaultTieToEvent: true,
};

const EMPTY_PICKER_SELECTION_STATE: EquipmentPickerSelectionState = {
  totalSelected: 0,
  resolvedAssetCount: 0,
  bulkQuantity: 0,
  unresolvedAssetCount: 0,
  conflictCount: 0,
  upcomingCommitmentCount: 0,
  turnaroundRiskCount: 0,
  bulkTurnaroundRiskCount: 0,
  checkingAvailability: false,
};

/* ───── Form reducer ───── */

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_TIE_TO_EVENT":
      return { ...state, tieToEvent: action.value, selectedEvents: [] };
    case "SET_SPORT":
      return { ...state, sport: action.value, selectedEvents: [] };
    case "SET_SELECTED_EVENTS":
      return {
        ...state,
        selectedEvents: action.events,
        title: action.title ?? state.title,
        startsAt: action.startsAt ?? state.startsAt,
        endsAt: action.endsAt ?? state.endsAt,
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
    case "SET_NOTES":
      return { ...state, notes: action.value };
    case "RESET":
      return {
        tieToEvent: action.defaults.tieToEvent ?? true,
        sport: "",
        selectedEvents: [],
        title: "",
        requester: action.defaults.requester ?? "",
        locationId: action.defaults.locationId ?? "",
        startsAt: toLocalDateTimeValue(roundTo15Min(new Date())),
        endsAt: toLocalDateTimeValue(roundTo15Min(new Date(Date.now() + 24 * 60 * 60 * 1000))),
        notes: "",
      };
    case "LOAD_DRAFT":
      return { ...state, ...action.draft };
    default:
      return state;
  }
}

/* ───── Component ───── */

export type BookingWizardProps = {
  kind: "CHECKOUT" | "RESERVATION";
};

export function BookingWizard({ kind }: BookingWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const config = kind === "CHECKOUT" ? CHECKOUT_CONFIG : RESERVATION_CONFIG;

  // ── URL params ──
  const initialTitle = searchParams.get("title") || "";
  const initialStartsAt = searchParams.get("startsAt") || undefined;
  const initialEndsAt = searchParams.get("endsAt") || undefined;
  const initialLocationId = searchParams.get("locationId") || undefined;
  const initialAssetIds = searchParams.get("newFor") ? [searchParams.get("newFor")!] : undefined;
  const initialEventId = searchParams.get("eventId") || undefined;
  const initialSportCode = searchParams.get("sportCode") || undefined;
  const initialDraftId = searchParams.get("draftId") || null;
  const initialRequesterUserId = searchParams.get("requesterUserId") || undefined;

  // ── Form options ──
  const { data: formOpts, isError: formOptsError, refetch: refetchFormOpts } = useFormOptions();
  const users: FormUser[] = formOpts?.users ?? [];
  const locations: Location[] = formOpts?.locations ?? [];
  const bulkSkus: BulkSkuOption[] = formOpts?.bulkSkus ?? [];

  // ── Current user ──
  const { data: meData } = useCurrentUser();
  const initialRequester = initialRequesterUserId ?? meData?.id ?? "";

  // ── Existing drafts (for resume banner) ──
  // Persist dismissal for 1 hour via sessionStorage so it doesn't reappear on every reload.
  const draftBannerKey = `wi:draftBannerDismissed:${kind}`;
  const [draftBannerDismissed, setDraftBannerDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    const ts = window.sessionStorage.getItem(draftBannerKey);
    if (!ts) return false;
    return Date.now() - Number(ts) < 60 * 60 * 1000;
  });
  const dismissDraftBanner = useCallback(() => {
    setDraftBannerDismissed(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(draftBannerKey, String(Date.now()));
    }
  }, [draftBannerKey]);
  const { data: draftsData } = useQuery({
    queryKey: ["drafts"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/drafts", { signal });
      if (handleAuthRedirect(res)) return null;
      if (!res.ok) return null;
      const json = await parseJsonSafely<{ data?: Array<{ id: string; kind: string; title: string; itemCount: number; updatedAt: string }> }>(res);
      return json?.data ?? null;
    },
    staleTime: 30_000,
    enabled: !initialDraftId, // skip if already resuming a draft
  });
  const existingDrafts: Array<{ id: string; kind: string; title: string; itemCount: number; updatedAt: string }> =
    (draftsData ?? []).filter((d: { kind: string }) => d.kind === kind);

  // ── Step state ──
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // ── Form state ──
  const [form, dispatch] = useReducer(formReducer, {
    tieToEvent: config.defaultTieToEvent || !!initialSportCode,
    sport: initialSportCode || "",
    selectedEvents: [],
    title: initialTitle,
    requester: initialRequester || "",
    locationId: initialLocationId || locations[0]?.id || "",
    startsAt: initialStartsAt || toLocalDateTimeValue(roundTo15Min(new Date())),
    endsAt: initialEndsAt || toLocalDateTimeValue(roundTo15Min(new Date(Date.now() + 24 * 60 * 60 * 1000))),
    notes: "",
  });

  useEffect(() => {
    if (initialRequester && !form.requester) {
      dispatch({ type: "SET_REQUESTER", value: initialRequester });
    }
  }, [initialRequester]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (locations.length > 0 && !form.locationId) {
      dispatch({ type: "SET_LOCATION_ID", value: locations[0]!.id });
    }
  }, [locations]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Equipment state ──
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(initialAssetIds ?? []);
  const [selectedBulkItems, setSelectedBulkItems] = useState<BulkSelection[]>([]);
  const [selectedAssetDetails, setSelectedAssetDetails] = useState<AvailableAsset[]>([]);
  const [pickerSelectionState, setPickerSelectionState] = useState<EquipmentPickerSelectionState>(
    EMPTY_PICKER_SELECTION_STATE,
  );
  const resolvedSelectedAssetIds = useMemo(
    () => selectedAssetDetails.map((asset) => asset.id),
    [selectedAssetDetails],
  );
  const [activeSection, setActiveSection] = useState<EquipmentSectionKey>(EQUIPMENT_SECTIONS[0]!.key);

  // ── Kit state ──
  const [kitId, setKitId] = useState<string>("");
  const { kits, kitsLoading, kitsLoadError, retryKits } = useKitFetching({ locationId: form.locationId, open: true });

  // ── Events + shift ──
  const { events, eventsLoading, eventsLoadError, retryEvents, myShiftForEvent, toggleEvent } = useEventContext({
    sport: form.sport,
    tieToEvent: form.tieToEvent,
    open: true,
    selectedEvents: form.selectedEvents,
    initialEventId,
    dispatch,
  });

  // ── Draft management ──
  const [draftId, setDraftId] = useState<string | null>(initialDraftId);
  const { saveDraft, deleteDraft } = useDraftManagement({
    draftId,
    open: true,
    form,
    selectedAssetIds: resolvedSelectedAssetIds,
    selectedBulkItems,
    dispatch,
    setSelectedAssetIds,
    setSelectedBulkItems,
    setSelectedAssetDetails,
    setKitId,
    onDraftIdChange: setDraftId,
    config: { apiBase: config.apiBase } as never,
  });

  // ── Submission state ──
  const [createError, setCreateError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const submittingRef = useRef(false);

  // Clears the error banner whenever the user edits any step-1 field.
  const step1Dispatch = useCallback((action: FormAction) => {
    setCreateError("");
    dispatch(action);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Equipment requirement check ──
  const unsatisfiedRequirements = useMemo(() => {
    if (selectedAssetDetails.length === 0) return [];
    const sectionKeys = [...new Set(
      selectedAssetDetails.map((a) => classifyAssetType(a.type, a.categoryName))
    )] as EquipmentSectionKey[];
    if (selectedBulkItems.length > 0) sectionKeys.push("batteries");
    return getUnsatisfiedRequirements(sectionKeys);
  }, [selectedAssetDetails, selectedBulkItems]);

  // ── Item count ──
  const itemCount = selectedAssetDetails.length + selectedBulkItems.reduce((sum, b) => sum + b.quantity, 0);

  // ── Warn before unload ──
  useEffect(() => {
    const hasData = form.title.trim() || selectedAssetIds.length > 0 || selectedBulkItems.length > 0;
    if (!hasData) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [form.title, selectedAssetIds.length, selectedBulkItems.length]);

  // ── Step 1 validation ──
  function validateStep1(): string | null {
    if (!form.title.trim()) return "Give this booking a name";
    if (!form.requester) return "Select who this is for";
    if (!form.locationId) return "Choose a pickup location";
    const s = new Date(form.startsAt);
    const e = new Date(form.endsAt);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return "Invalid date. Check start and end times";
    if (e <= s) return "End date must be after start date";
    return null;
  }

  // ── Step 2 validation ──
  function validateStep2(): string | null {
    if (itemCount === 0) return "Add at least one piece of equipment";
    if (unsatisfiedRequirements.length > 0) return unsatisfiedRequirements[0]!.message;
    return null;
  }

  // ── Navigation ──
  function handleNext() {
    if (step === 1) {
      const error = validateStep1();
      if (error) { setCreateError(error); return; }
      setCreateError("");
      setStep(2);
    } else if (step === 2) {
      if (itemCount === 0 && pickerSelectionState.unresolvedAssetCount > 0) {
        setCreateError("Remove unavailable selected items or pick replacement equipment before review");
        return;
      }
      if (itemCount > 0) {
        const error = validateStep2();
        if (error) { setCreateError(error); return; }
        setCreateError("");
        setStep(3);
        return;
      }
      const sectionIdx = EQUIPMENT_SECTIONS.findIndex((s) => s.key === activeSection);
      if (sectionIdx < EQUIPMENT_SECTIONS.length - 1) {
        setCreateError("");
        setActiveSection(EQUIPMENT_SECTIONS[sectionIdx + 1]!.key);
        return;
      }
      const error = validateStep2();
      if (error) { setCreateError(error); return; }
      setCreateError("");
      setStep(3);
    }
  }

  function getStep2PrimaryLabel() {
    return getStep2PrimaryActionLabel({
      ...pickerSelectionState,
      itemCount,
      activeSection,
    });
  }

  function handleBack() {
    setCreateError("");
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  }

  // ── Submit ──
  async function handleSubmit() {
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
      serializedAssetIds: resolvedSelectedAssetIds,
      bulkItems: selectedBulkItems,
    };

    if (kitId) payload.kitId = kitId;
    if (form.notes.trim()) payload.notes = form.notes.trim();
    if (form.selectedEvents.length > 0) {
      // Multi-event contract (D-031): client always sends `eventIds[]` sorted chronologically.
      // Server picks ordinal 0 as the canonical Booking.eventId and writes a BookingEvent
      // junction row per id. Legacy `eventId` field is mutually exclusive — never sent here.
      payload.eventIds = form.selectedEvents.map((e) => e.id);
      payload.sportCode = form.selectedEvents[0]!.sportCode || form.sport || undefined;
    } else if (form.sport) {
      payload.sportCode = form.sport;
    }

    try {
      const res = await fetchWithTimeout(config.apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) await saveDraft();
      if (handleAuthRedirect(res)) return;

      const json = await parseJsonSafely<{
        error?: string;
        data?: {
          id?: string;
          refNumber?: string | null;
          conflicts?: Array<{ assetId: string; conflictingBookingTitle?: string }>;
          unavailableAssets?: Array<{ assetId: string; status: string }>;
          shortages?: Array<{ bulkSkuId: string; requested: number; available: number }>;
        };
      }>(res);
      if (!res.ok) {
        if (res.status === 409 && json?.data) {
          const msgs: string[] = [];
          const d = json.data;
          // Auto-remove conflicting/unavailable assets so user doesn't have to find them manually
          const tagFor = (id: string) => selectedAssetDetails.find((a) => a.id === id)?.assetTag || id;
          const conflictingAssetIds = new Set<string>([
            ...(d.conflicts?.map((c) => c.assetId) ?? []),
            ...(d.unavailableAssets?.map((u) => u.assetId) ?? []),
          ]);
          msgs.push(
            ...(d.conflicts?.map((c) => `${tagFor(c.assetId)} conflicts with \u201c${c.conflictingBookingTitle || "another booking"}\u201d`) ?? []),
            ...(d.unavailableAssets?.map((u) => `${tagFor(u.assetId)} is ${u.status === "MAINTENANCE" ? "in maintenance" : u.status.toLowerCase()}`) ?? []),
            ...(d.shortages?.map((s) => `${bulkSkus.find((sk) => sk.id === s.bulkSkuId)?.name || s.bulkSkuId}: only ${s.available} available (requested ${s.requested})`) ?? []),
          );
          if (conflictingAssetIds.size > 0) {
            setSelectedAssetIds((prev) => prev.filter((id) => !conflictingAssetIds.has(id)));
          }
          const removedCount = conflictingAssetIds.size;
          const conflictMessage = msgs.length > 0 ? msgs.join(". ") : json?.error || "Availability conflict";
          const removalNote = removedCount > 0
            ? `${removedCount} item${removedCount !== 1 ? "s" : ""} removed from your selection.`
            : "";
          setCreateError(removalNote ? `${conflictMessage}. ${removalNote}` : conflictMessage);
          setStep(2);
        } else {
          setCreateError(json?.error || await parseErrorMessage(res, `Couldn\u2019t create this ${config.label}. Please try again`));
        }
        submittingRef.current = false;
        setSubmitting(false);
        return;
      }

      await deleteDraft();
      const created = json?.data;
      if (!created?.id) {
        setCreateError(`${config.label} was created, but the response was incomplete. Refresh the list to find it.`);
        return;
      }
      const refNumber = created.refNumber ?? undefined;
      toast.success(`${config.label.charAt(0).toUpperCase() + config.label.slice(1)}${refNumber ? ` ${refNumber}` : ""} created`, {
        description: kind === "CHECKOUT"
          ? "Opened Bookings with this pickup highlighted."
          : "Opened Bookings with this reservation highlighted.",
      });

      const bookingId = created.id;
      if (kind === "CHECKOUT") {
        const params = new URLSearchParams();
        params.set("tab", "checkouts");
        params.set("highlight", bookingId);
        router.push(`/bookings?${params.toString()}`);
      } else {
        const params = new URLSearchParams();
        params.set("tab", "reservations");
        params.set("highlight", bookingId);
        router.push(`/bookings?${params.toString()}`);
      }
    } catch {
      setCreateError(`Couldn\u2019t create this ${config.label}. Please try again`);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const steps = [
    { label: "Details", step: 1 as const },
    { label: "Equipment", step: 2 as const },
    { label: "Confirm", step: 3 as const },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:py-10">

      {/* ── Header ── */}
      <PageHeader
        title={`New ${config.label}`}
        description={
          kind === "CHECKOUT"
            ? "Check out equipment for immediate pickup. Items will be scanned at pickup."
            : "Reserve equipment for later. Browse and pick the gear you need."
        }
      >
        <Badge variant={kind === "CHECKOUT" ? "red" : "blue"} size="sm">
          {kind === "CHECKOUT" ? "Checkout" : "Reservation"}
        </Badge>
      </PageHeader>

      {/* ── Existing drafts banner ── */}
      {!draftBannerDismissed && existingDrafts.length > 0 && (
        <div className="mb-6 rounded-sm border border-border bg-muted/40 overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <RotateCcwIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">
                {existingDrafts.length === 1
                  ? "You have an unfinished draft"
                  : `You have ${existingDrafts.length} unfinished drafts`}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={dismissDraftBanner}
              aria-label="Dismiss"
            >
              <XIcon />
            </Button>
          </div>
          <div className="divide-y divide-border">
            {existingDrafts.slice(0, 3).map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{d.title || "Untitled draft"}</p>
                  {d.itemCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {d.itemCount} item{d.itemCount !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
                <Button variant="outline" size="sm" asChild className="shrink-0">
                  <a href={`/${kind === "CHECKOUT" ? "checkouts" : "reservations"}/new?draftId=${d.id}`}>
                    Resume
                  </a>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Step progress ── */}
      <div
        className="mb-8 grid grid-cols-3 gap-1 rounded-md border border-border/60 bg-card/70 p-1 shadow-xs"
        role="navigation"
        aria-label="Wizard steps"
      >
        {steps.map((s) => {
          const isActive = step === s.step;
          const isDone = step > s.step;
          const isLocked = s.step > step;
          return (
            <Button
              key={s.step}
              type="button"
              variant={isActive ? "default" : "ghost"}
              disabled={isLocked}
              onClick={() => { if (isDone) { setCreateError(""); setStep(s.step); } }}
              className={cn(
                "h-auto justify-start rounded-sm px-3 py-2.5 text-left",
                isDone && "hover:bg-muted/60",
                isLocked && "cursor-default",
              )}
            >
              {/* Step number / check */}
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center text-[11px] font-black",
                  isLocked && "opacity-30",
                )}
              >
                {isDone ? <CheckIcon /> : s.step}
              </span>

              {/* Label */}
              <span
                className={cn(
                  "text-[11px] font-bold uppercase tracking-wider",
                  isLocked && "opacity-30",
                )}
              >
                {s.label}
              </span>
            </Button>
          );
        })}
      </div>

      {/* ── Form options error ── */}
      {formOptsError && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>Failed to load form data. Dropdowns may be empty.</span>
          <Button variant="outline" size="sm" onClick={() => refetchFormOpts()} className="shrink-0">
            Retry
          </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* ── Error banner ── */}
      {createError && (
        <Alert variant="destructive" className="mb-5">
          <AlertCircleIcon />
          <AlertDescription>{createError}</AlertDescription>
        </Alert>
      )}

      {/* ── Step content ── */}
      {step === 1 && (
        <WizardStep1
          form={form}
          dispatch={step1Dispatch}
          config={config}
          users={users}
          locations={locations}
          kits={kits}
          kitsLoading={kitsLoading}
          kitsLoadError={kitsLoadError}
          kitId={kitId}
          setKitId={setKitId}
          onRetryKits={retryKits}
          events={events}
          eventsLoading={eventsLoading}
          eventsLoadError={eventsLoadError}
          onRetryEvents={retryEvents}
          myShiftForEvent={myShiftForEvent}
          toggleEvent={toggleEvent}
        />
      )}

      {step === 2 && (
        <WizardStep2
          kind={kind}
          form={form}
          bulkSkus={bulkSkus}
          selectedAssetIds={selectedAssetIds}
          setSelectedAssetIds={setSelectedAssetIds}
          selectedBulkItems={selectedBulkItems}
          setSelectedBulkItems={setSelectedBulkItems}
          onSelectedAssetsChange={setSelectedAssetDetails}
          onSelectionStateChange={setPickerSelectionState}
          selectionState={pickerSelectionState}
          itemCount={itemCount}
          activeSection={activeSection}
          onActiveSectionChange={setActiveSection}
        />
      )}

      {step === 3 && (
        <WizardStep3
          config={config}
          form={form}
          users={users}
          locations={locations}
          selectedAssetDetails={selectedAssetDetails}
          selectedBulkItems={selectedBulkItems}
          bulkSkus={bulkSkus}
          itemCount={itemCount}
          selectionState={pickerSelectionState}
        />
      )}

      {/* ── Footer navigation ── */}
      <div className="flex items-center justify-between mt-10 pt-5 border-t border-border">
        <div>
          {step > 1 && (
            <Button
              variant="outline"
              onClick={handleBack}
              size="sm"
              className="text-xs font-bold uppercase tracking-wider"
            >
              ← Back
            </Button>
          )}
          {step === 1 && (
            <Button
              variant="ghost"
              size="sm"
              disabled={savingDraft}
              loading={savingDraft}
              onClick={async () => {
                setSavingDraft(true);
                await saveDraft();
                setSavingDraft(false);
                router.back();
              }}
              className="text-xs text-muted-foreground"
            >
              {savingDraft ? "Saving..." : "Save draft & exit"}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {step < 3 && (
            <Button
              onClick={handleNext}
              size="sm"
              className="text-xs font-bold uppercase tracking-wider"
            >
              {step === 2 && getStep2PrimaryLabel()}
              {step === 1 && "Next \u2192"}
            </Button>
          )}
          {step === 3 && (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              loading={submitting}
              variant="brand"
              size="sm"
              className="text-xs font-bold uppercase tracking-wider"
            >
              {submitting ? config.actionLabelProgress : config.actionLabel}
              {itemCount > 0 && ` (${itemCount})`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
