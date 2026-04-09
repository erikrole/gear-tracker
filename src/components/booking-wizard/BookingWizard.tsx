"use client";

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { handleAuthRedirect } from "@/lib/errors";
import { EQUIPMENT_SECTIONS, classifyAssetType } from "@/lib/equipment-sections";
import { getUnsatisfiedRequirements } from "@/lib/equipment-guidance";
import type { EquipmentSectionKey } from "@/lib/equipment-sections";
import type { BulkSelection } from "@/components/EquipmentPicker";
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
import { WizardStep1 } from "./WizardStep1";
import { WizardStep2 } from "./WizardStep2";
import { WizardStep3 } from "./WizardStep3";
import { CheckIcon } from "lucide-react";

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
  actionLabel: "Pick up now",
  actionLabelProgress: "Picking up\u2026",
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

/* ───── Form reducer (reused from CreateBookingSheet) ───── */

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

  // ── Form options (React Query, shared cache with BookingListPage) ──
  const { data: formOpts, isError: formOptsError, refetch: refetchFormOpts } = useQuery({
    queryKey: ["form-options"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/form-options", { signal });
      if (!res.ok) throw new Error("Failed to load form options");
      const json = await res.json();
      return json?.data ?? null;
    },
    staleTime: 5 * 60_000,
    retry: 2,
  });
  const users: FormUser[] = formOpts?.users ?? [];
  const locations: Location[] = formOpts?.locations ?? [];
  const bulkSkus: BulkSkuOption[] = formOpts?.bulkSkus ?? [];

  // ── Current user ──
  const { data: meData } = useQuery({
    queryKey: ["me"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/me", { signal });
      if (!res.ok) return null;
      const json = await res.json();
      return json?.user ?? null;
    },
    staleTime: 5 * 60_000,
  });
  const initialRequester = meData?.id ?? "";

  // ── Step state ──
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // ── Form state ──
  const [form, dispatch] = useReducer(formReducer, {
    tieToEvent: config.defaultTieToEvent || !!initialSportCode,
    sport: initialSportCode || "",
    selectedEvent: null,
    title: initialTitle,
    requester: initialRequester || "",
    locationId: initialLocationId || locations[0]?.id || "",
    startsAt: initialStartsAt || toLocalDateTimeValue(roundTo15Min(new Date())),
    endsAt: initialEndsAt || toLocalDateTimeValue(roundTo15Min(new Date(Date.now() + 24 * 60 * 60 * 1000))),
  });

  // Set requester/location defaults once data loads
  useEffect(() => {
    if (initialRequester && !form.requester) {
      dispatch({ type: "SET_REQUESTER", value: initialRequester });
    }
  }, [initialRequester]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (locations.length > 0 && !form.locationId) {
      dispatch({ type: "SET_LOCATION_ID", value: locations[0].id });
    }
  }, [locations]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Equipment state ──
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(initialAssetIds ?? []);
  const [selectedBulkItems, setSelectedBulkItems] = useState<BulkSelection[]>([]);
  const [selectedAssetDetails, setSelectedAssetDetails] = useState<AvailableAsset[]>([]);
  const [activeSection, setActiveSection] = useState<EquipmentSectionKey>(EQUIPMENT_SECTIONS[0].key);

  // ── Kit state ──
  const [kitId, setKitId] = useState<string>("");
  const { kits } = useKitFetching({ locationId: form.locationId, open: true });

  // ── Events + shift ──
  const { events, eventsLoading, myShiftForEvent, selectEvent } = useEventContext({
    sport: form.sport,
    tieToEvent: form.tieToEvent,
    open: true,
    selectedEvent: form.selectedEvent,
    initialEventId,
    dispatch,
  });

  // ── Draft management ──
  const [draftId, setDraftId] = useState<string | null>(initialDraftId);
  const { saveDraft, deleteDraft } = useDraftManagement({
    draftId,
    open: true,
    form,
    selectedAssetIds,
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
  const submittingRef = useRef(false);

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
  const itemCount = selectedAssetIds.length + selectedBulkItems.reduce((sum, b) => sum + b.quantity, 0);

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
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return "Invalid date — check start and end times";
    if (e <= s) return "End date must be after start date";
    return null;
  }

  // ── Step 2 validation ──
  function validateStep2(): string | null {
    if (itemCount === 0) return "Add at least one piece of equipment";
    if (unsatisfiedRequirements.length > 0) return unsatisfiedRequirements[0].message;
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
      // Advance to next section tab; only go to step 3 from the last tab
      const sectionIdx = EQUIPMENT_SECTIONS.findIndex((s) => s.key === activeSection);
      if (sectionIdx < EQUIPMENT_SECTIONS.length - 1) {
        setCreateError("");
        setActiveSection(EQUIPMENT_SECTIONS[sectionIdx + 1].key);
        return;
      }
      // Last tab — validate and proceed to confirmation
      const error = validateStep2();
      if (error) { setCreateError(error); return; }
      setCreateError("");
      setStep(3);
    }
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
      serializedAssetIds: selectedAssetIds,
      bulkItems: selectedBulkItems,
    };

    if (kitId) payload.kitId = kitId;
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

      if (handleAuthRedirect(res)) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let json: any;
      try { json = await res.json(); } catch {
        setCreateError(`Couldn\u2019t create this ${config.label} \u2014 please try again`);
        submittingRef.current = false;
        setSubmitting(false);
        return;
      }
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
          setStep(2); // Go back to equipment step on conflict
        } else {
          setCreateError(json.error || `Couldn\u2019t create this ${config.label} \u2014 please try again`);
        }
        submittingRef.current = false;
        setSubmitting(false);
        return;
      }

      await deleteDraft();
      toast.success(`${config.label.charAt(0).toUpperCase() + config.label.slice(1)} created`);

      const bookingId = json.data.id;
      if (kind === "CHECKOUT") {
        // Checkout: redirect to scan page — scanning is required before pickup
        router.push(`/scan?checkout=${bookingId}&phase=CHECKOUT`);
      } else {
        const params = new URLSearchParams();
        params.set("tab", "reservations");
        params.set("highlight", bookingId);
        router.push(`/bookings?${params.toString()}`);
      }
    } catch {
      setCreateError(`Couldn\u2019t create this ${config.label} \u2014 please try again`);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  // ── Step labels for progress indicator ──
  const steps = [
    { label: "Details", step: 1 as const },
    { label: "Equipment", step: 2 as const },
    { label: "Confirm", step: 3 as const },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:py-10">
      {/* ── Header ── */}
      <h1 className="text-2xl font-bold mb-1">
        New {config.label}
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        {kind === "CHECKOUT"
          ? "Check out equipment for immediate pickup. Items will be scanned at pickup."
          : "Reserve equipment for later. Browse and pick the gear you need."}
      </p>

      {/* ── Step progress ── */}
      <div className="flex items-center gap-2 mb-8" role="navigation" aria-label="Wizard steps">
        {steps.map((s, i) => (
          <div key={s.step} className="flex items-center gap-2">
            {i > 0 && <div className={`h-px flex-1 min-w-6 ${step > s.step - 1 ? "bg-primary" : "bg-border"}`} />}
            <button
              type="button"
              disabled={s.step > step}
              onClick={() => { if (s.step < step) { setCreateError(""); setStep(s.step); } }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                step === s.step
                  ? "bg-primary text-primary-foreground"
                  : step > s.step
                    ? "bg-primary/10 text-primary cursor-pointer hover:bg-primary/20"
                    : "bg-muted text-muted-foreground cursor-default"
              }`}
            >
              {step > s.step ? (
                <CheckIcon className="size-3.5" />
              ) : (
                <span className="text-xs">{s.step}</span>
              )}
              {s.label}
            </button>
          </div>
        ))}
      </div>

      {/* ── Form options error ── */}
      {formOptsError && (
        <div className="rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive mb-4 flex items-center justify-between">
          <span>Failed to load form data. Dropdowns may be empty.</span>
          <Button variant="outline" size="sm" onClick={() => refetchFormOpts()}>Retry</Button>
        </div>
      )}

      {/* ── Error banner ── */}
      {createError && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive mb-4">
          {createError}
        </div>
      )}

      {/* ── Step content ── */}
      {step === 1 && (
        <WizardStep1
          form={form}
          dispatch={dispatch}
          config={config}
          users={users}
          locations={locations}
          kits={kits}
          kitId={kitId}
          setKitId={setKitId}
          events={events}
          eventsLoading={eventsLoading}
          myShiftForEvent={myShiftForEvent}
          selectEvent={selectEvent}
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
        />
      )}

      {/* ── Footer navigation ── */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t">
        <div>
          {step > 1 && (
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
          )}
          {step === 1 && (
            <Button variant="ghost" onClick={async () => { await saveDraft(); router.back(); }}>
              Save draft & exit
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {step < 3 && (
            <Button onClick={handleNext}>
              {step === 2 && (() => {
                const idx = EQUIPMENT_SECTIONS.findIndex((s) => s.key === activeSection);
                if (idx < EQUIPMENT_SECTIONS.length - 1) {
                  return `Next: ${EQUIPMENT_SECTIONS[idx + 1].label}`;
                }
                return `Review${itemCount > 0 ? ` (${itemCount} item${itemCount !== 1 ? "s" : ""})` : ""}`;
              })()}
              {step === 1 && "Next"}
            </Button>
          )}
          {step === 3 && (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? config.actionLabelProgress : config.actionLabel}
              {itemCount > 0 && ` (${itemCount})`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
