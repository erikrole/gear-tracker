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

  // ── Form options ──
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

  // ── Existing drafts (for resume banner) ──
  const [draftBannerDismissed, setDraftBannerDismissed] = useState(false);
  const { data: draftsData } = useQuery({
    queryKey: ["drafts"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/drafts", { signal });
      if (!res.ok) return null;
      const json = await res.json();
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
  });

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
  const { events, eventsLoading, myShiftForEvent, toggleEvent } = useEventContext({
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
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return "Invalid date \u2014 check start and end times";
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
      const sectionIdx = EQUIPMENT_SECTIONS.findIndex((s) => s.key === activeSection);
      if (sectionIdx < EQUIPMENT_SECTIONS.length - 1) {
        setCreateError("");
        setActiveSection(EQUIPMENT_SECTIONS[sectionIdx + 1].key);
        return;
      }
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
    if (form.selectedEvents.length > 0) {
      // Send multi-event list; API derives primary + junction rows.
      payload.eventIds = form.selectedEvents.map((e) => e.id);
      payload.sportCode = form.selectedEvents[0].sportCode || form.sport || undefined;
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

      let json: Record<string, unknown>;
      try { json = await res.json() as Record<string, unknown>; } catch {
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
          // Auto-remove conflicting/unavailable assets so user doesn't have to find them manually
          const conflictingAssetIds = new Set<string>();
          if (d.conflicts?.length) {
            for (const c of d.conflicts) {
              conflictingAssetIds.add(c.assetId);
              const tag = selectedAssetDetails.find((a) => a.id === c.assetId)?.assetTag || c.assetId;
              msgs.push(`${tag} conflicts with \u201c${c.conflictingBookingTitle || "another booking"}\u201d`);
            }
          }
          if (d.unavailableAssets?.length) {
            for (const u of d.unavailableAssets) {
              conflictingAssetIds.add(u.assetId);
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
          if (conflictingAssetIds.size > 0) {
            setSelectedAssetIds((prev) => prev.filter((id) => !conflictingAssetIds.has(id)));
          }
          const removedCount = conflictingAssetIds.size;
          const removedSuffix = removedCount > 0 ? ` \u2014 ${removedCount} item${removedCount !== 1 ? "s" : ""} removed from your selection` : "";
          setCreateError((msgs.length > 0 ? msgs.join(". ") : (json.error as string | undefined) || "Availability conflict") + removedSuffix);
          setStep(2);
        } else {
          setCreateError((json.error as string | undefined) || `Couldn\u2019t create this ${config.label} \u2014 please try again`);
        }
        submittingRef.current = false;
        setSubmitting(false);
        return;
      }

      await deleteDraft();
      const created = json.data as { id: string; refNumber?: string | null };
      const refNumber = created.refNumber ?? undefined;
      toast.success(`${config.label.charAt(0).toUpperCase() + config.label.slice(1)} created${refNumber ? ` \u2014 ${refNumber}` : ""}`);

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
      setCreateError(`Couldn\u2019t create this ${config.label} \u2014 please try again`);
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
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1
            className="text-[2rem] font-black uppercase leading-none tracking-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            New {config.label}
          </h1>
          <span
            className="shrink-0 mt-1 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] border"
            style={
              kind === "CHECKOUT"
                ? { borderColor: "var(--wi-red)", color: "var(--wi-red)" }
                : { borderColor: "var(--blue)", color: "var(--blue)" }
            }
          >
            {kind}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {kind === "CHECKOUT"
            ? "Check out equipment for immediate pickup. Items will be scanned at pickup."
            : "Reserve equipment for later. Browse and pick the gear you need."}
        </p>
      </div>

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
            <button
              type="button"
              onClick={() => setDraftBannerDismissed(true)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              <XIcon className="size-3.5" />
            </button>
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
        className="grid grid-cols-3 border border-border mb-8 overflow-hidden"
        style={{ borderRadius: "4px" }}
        role="navigation"
        aria-label="Wizard steps"
      >
        {steps.map((s, i) => {
          const isActive = step === s.step;
          const isDone = step > s.step;
          const isLocked = s.step > step;
          return (
            <button
              key={s.step}
              type="button"
              disabled={isLocked}
              onClick={() => { if (isDone) { setCreateError(""); setStep(s.step); } }}
              className={[
                "relative flex items-center gap-2 px-4 py-3 text-left transition-colors",
                i < steps.length - 1 ? "border-r border-border" : "",
                isActive ? "bg-foreground text-background" : "",
                isDone ? "cursor-pointer hover:bg-muted/60" : "",
                isLocked ? "cursor-default" : "",
              ].join(" ")}
            >
              {/* Step number / check */}
              <span
                className={[
                  "flex size-5 shrink-0 items-center justify-center text-[11px] font-black",
                  isActive ? "text-background" : "",
                  isDone ? "" : "",
                  isLocked ? "opacity-30" : "",
                ].join(" ")}
                style={isDone ? { color: "var(--wi-red)" } : undefined}
              >
                {isDone ? <CheckIcon className="size-3.5" /> : s.step}
              </span>

              {/* Label */}
              <span
                className={[
                  "text-[11px] font-bold uppercase tracking-wider",
                  isLocked ? "opacity-30" : "",
                ].join(" ")}
              >
                {s.label}
              </span>

              {/* Active bottom bar */}
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ backgroundColor: "var(--wi-red)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Form options error ── */}
      {formOptsError && (
        <div className="flex items-center justify-between gap-3 rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive mb-5">
          <span>Failed to load form data. Dropdowns may be empty.</span>
          <Button variant="outline" size="sm" onClick={() => refetchFormOpts()} className="shrink-0">
            Retry
          </Button>
        </div>
      )}

      {/* ── Error banner ── */}
      {createError && (
        <div className="flex items-start gap-2.5 rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive mb-5">
          <AlertCircleIcon className="size-4 shrink-0 mt-0.5" />
          <span>{createError}</span>
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
      <div className="flex items-center justify-between mt-10 pt-5 border-t border-border">
        <div>
          {step > 1 && (
            <Button
              variant="outline"
              onClick={handleBack}
              className="rounded-sm text-xs font-bold uppercase tracking-wider"
            >
              ← Back
            </Button>
          )}
          {step === 1 && (
            <Button
              variant="ghost"
              onClick={async () => { await saveDraft(); router.back(); }}
              className="text-xs text-muted-foreground"
            >
              Save draft & exit
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {step < 3 && (
            <Button
              onClick={handleNext}
              className="rounded-sm bg-foreground text-background hover:bg-foreground/85 text-xs font-bold uppercase tracking-wider px-5"
            >
              {step === 2 && (() => {
                const idx = EQUIPMENT_SECTIONS.findIndex((s) => s.key === activeSection);
                if (idx < EQUIPMENT_SECTIONS.length - 1) {
                  return `Next: ${EQUIPMENT_SECTIONS[idx + 1].label}`;
                }
                return `Review${itemCount > 0 ? ` (${itemCount} item${itemCount !== 1 ? "s" : ""})` : ""}`;
              })()}
              {step === 1 && "Next \u2192"}
            </Button>
          )}
          {step === 3 && (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-sm text-white text-xs font-bold uppercase tracking-wider px-5 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "var(--wi-red)" }}
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
