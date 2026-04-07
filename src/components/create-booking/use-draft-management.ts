"use client";

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { useToast } from "@/components/Toast";
import { toLocalDateTimeValue } from "../booking-list/types";
import type { BulkSelection } from "@/components/EquipmentPicker";
import type { AvailableAsset, BookingListConfig } from "../booking-list/types";
import type { FormState, FormAction } from "./types";

export function useDraftManagement({
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
}: {
  draftId: string | null;
  open: boolean;
  form: FormState;
  selectedAssetIds: string[];
  selectedBulkItems: BulkSelection[];
  dispatch: Dispatch<FormAction>;
  setSelectedAssetIds: Dispatch<SetStateAction<string[]>>;
  setSelectedBulkItems: Dispatch<SetStateAction<BulkSelection[]>>;
  setSelectedAssetDetails: Dispatch<SetStateAction<AvailableAsset[]>>;
  setKitId: Dispatch<SetStateAction<string>>;
  onDraftIdChange: (id: string | null) => void;
  config: BookingListConfig;
}) {
  const { toast } = useToast();
  const draftLoadedRef = useRef(false);

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

  // ── Delete draft ──
  async function deleteDraft() {
    if (!draftId) return;
    try {
      await fetch(`/api/drafts/${draftId}`, { method: "DELETE" });
    } catch {
      /* best-effort */
    }
    onDraftIdChange(null);
  }

  // Expose resetDraftLoaded so parent can clear it after successful submission
  function resetDraftLoaded() {
    draftLoadedRef.current = false;
  }

  return { saveDraft, deleteDraft, resetDraftLoaded };
}
