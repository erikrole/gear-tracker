"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import ChooseImageModal from "@/components/ChooseImageModal";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";

import type { NewItemSheetProps, ItemKind } from "./new-item-sheet/types";
import { SectionHeading, SuccessFlash } from "@/components/form-layout";
import { SerializedItemForm, type SerializedFormHandle } from "./new-item-sheet/SerializedItemForm";
import { BulkItemForm, type BulkFormHandle } from "./new-item-sheet/BulkItemForm";

type CreatedHandoff = {
  kind: ItemKind;
  label: string;
  href: string;
  openLabel: string;
  successMessage: string;
  description: string;
};

function payloadSuccessMessage(label: string, openLabel: string) {
  if (openLabel === "Open stock record") {
    return `"${label}" stock updated successfully.`;
  }
  return `"${label}" created successfully.`;
}

export function NewItemSheet({
  open,
  onOpenChange,
  locations,
  departments,
  categories,
  onCreated,
}: NewItemSheetProps) {
  const router = useRouter();
  const [kind, setKind] = useState<ItemKind>("serialized");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [addAnother, setAddAnother] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const submittingRef = useRef(false);
  const successTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Image upload post-creation (serialized items only)
  const [createdAssetId, setCreatedAssetId] = useState<string | null>(null);
  const [createdHandoff, setCreatedHandoff] = useState<CreatedHandoff | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  const serializedRef = useRef<SerializedFormHandle>(null);
  const bulkRef = useRef<BulkFormHandle>(null);

  const resetAll = useCallback(() => {
    setError("");
    setSuccessMsg("");
    setKind("serialized");
    setAddAnother(false);
    setCreatedAssetId(null);
    setCreatedHandoff(null);
    setShowImageModal(false);
    serializedRef.current?.reset();
    bulkRef.current?.reset();
  }, []);

  function showSuccessMessage(msg: string) {
    setSuccessMsg(msg);
    clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccessMsg(""), 3000);
  }

  useEffect(() => () => clearTimeout(successTimer.current), []);

  function finishCreatedHandoff(mode: "another" | "open" | "list") {
    if (!createdHandoff) return;
    const handoff = createdHandoff;
    onCreated();
    if (mode === "another") {
      setKind(handoff.kind);
      setError("");
      setCreatedAssetId(null);
      setCreatedHandoff(null);
      setShowImageModal(false);
      serializedRef.current?.reset(true);
      bulkRef.current?.reset();
      showSuccessMessage(`"${handoff.label}" created. Ready for the next ${handoff.kind === "serialized" ? "asset" : "bulk item"}.`);
      requestAnimationFrame(() => {
        if (handoff.kind === "serialized") serializedRef.current?.focus();
        else bulkRef.current?.focus();
      });
    } else {
      onOpenChange(false);
      resetAll();
      if (mode === "open") {
        router.push(handoff.href);
      }
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (submittingRef.current) return;

    try {
      let res: globalThis.Response;
      let label = "";
      let bulkHandoffHref: string | null = null;
      let bulkHandoffLabel = "Open bulk record";

      if (kind === "serialized") {
        const validationError = serializedRef.current?.validate();
        if (validationError) {
          setError(validationError);
          return;
        }
        const body = serializedRef.current!.getSubmitBody();
        label = (body.assetTag as string) || (body.name as string) || "Asset";

        setSubmitting(true);
        submittingRef.current = true;
        res = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        const validationError = bulkRef.current?.validate();
        if (validationError) {
          setError(validationError);
          return;
        }
        const payload = bulkRef.current!.getSubmitPayload();
        if (!payload) return;
        label = payload.label;
        bulkHandoffHref = payload.handoffHref ?? null;
        bulkHandoffLabel = payload.openLabel ?? bulkHandoffLabel;

        setSubmitting(true);
        submittingRef.current = true;
        res = await fetch(payload.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload.body),
        });
      }

      if (handleAuthRedirect(res)) return;

      if (!res.ok) {
        setError(await parseErrorMessage(res, "Failed to create item. Please try again."));
        return;
      }

      const json = await res.json().catch(() => ({}));

      // For serialized items, show image upload prompt before proceeding
      if (kind === "serialized" && json.data?.id) {
        setCreatedAssetId(json.data.id);
        setCreatedHandoff({
          kind: "serialized",
          label,
          href: `/items/${json.data.id}`,
          openLabel: "Open item",
          successMessage: `"${label}" created successfully.`,
          description: "Open the item record to finish photos, QR details, policy settings, and booking context.",
        });
        return; // Don't close yet — show image upload prompt
      }

      if (kind === "serialized") {
        onCreated();
        setError("The item was created, but the server did not return an item link. Refresh the list before creating another asset.");
        return;
      }

      const bulkId = json.data?.id ?? bulkHandoffHref?.split("/").pop();
      const handoffHref = bulkId ? `/bulk-inventory/${bulkId}` : "/bulk-inventory";
      if (addAnother) {
        onCreated();
        bulkRef.current?.reset();
        showSuccessMessage(`"${label}" created. Ready for the next bulk item.`);
        requestAnimationFrame(() => bulkRef.current?.focus());
      } else {
        setCreatedHandoff({
          kind: "bulk",
          label,
          href: handoffHref,
          openLabel: bulkHandoffLabel,
          successMessage: payloadSuccessMessage(label, bulkHandoffLabel),
          description: "Open the bulk record to review stock, numbered units, QR labels, thresholds, and activity.",
        });
      }
    } catch {
      setError("You are offline or the request could not reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }

  // Post-creation success state (serialized only)
  const showPostCreate = !!createdHandoff;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (submitting) return; onOpenChange(v); if (!v) resetAll(); }}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>New asset</SheetTitle>
          <SheetDescription>Create serialized gear or bulk stock, then choose the next step.</SheetDescription>
        </SheetHeader>

        <SheetBody className="px-6 py-6">
          {showPostCreate ? (
            <div className="flex flex-col gap-6">
              <SuccessFlash message={createdHandoff?.successMessage ?? "Saved successfully."} />
              <div className="rounded-md border border-border/70 bg-muted/20 p-4">
                <p className="text-sm font-medium">Next step</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {createdHandoff?.description}
                </p>
              </div>
              {createdHandoff?.kind === "serialized" && (
                <div className="flex flex-col items-center gap-1 py-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => setShowImageModal(true)}
                  >
                    <ImageIcon className="size-4" />
                    Add image
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    You can also add an image later from the item detail page.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <form id="new-item-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
              {/* ── Item type ── */}
              <section className="flex flex-col gap-3">
                <SectionHeading>Item type</SectionHeading>
                <RadioGroup
                  value={kind}
                  onValueChange={(v) => {
                    setError("");
                    setKind(v as ItemKind);
                  }}
                  disabled={submitting}
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="serialized" id="kind-serialized" className="mt-0.5" />
                    <div>
                      <Label htmlFor="kind-serialized" className="font-medium cursor-pointer">As an individual item</Label>
                      <p className="text-xs text-muted-foreground">
                        Recommended for unique, high-cost items (cameras, computers, etc.)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="bulk" id="kind-bulk" className="mt-0.5" />
                    <div>
                      <Label htmlFor="kind-bulk" className="font-medium cursor-pointer">As a bulk item</Label>
                      <p className="text-xs text-muted-foreground">
                        Recommended for low-cost items (batteries, cables, sandbags, etc.)
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </section>

              <Separator />

              {successMsg && <SuccessFlash message={successMsg} />}

              {error && (
                <Alert variant="destructive">
                  <AlertCircleIcon className="size-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {kind === "serialized" ? (
                <SerializedItemForm
                  ref={serializedRef}
                  categories={categories}
                  departments={departments}
                  locations={locations}
                  disabled={submitting}
                />
              ) : (
                <BulkItemForm
                  ref={bulkRef}
                  categories={categories}
                  locations={locations}
                  open={open}
                  disabled={submitting}
                />
              )}
            </form>
          )}
        </SheetBody>

        <SheetFooter>
          {showPostCreate ? (
            <>
              <div className="flex-1" />
              {addAnother && (
                <Button variant="outline" type="button" onClick={() => finishCreatedHandoff("another")}>
                  Add another asset
                </Button>
              )}
              {createdHandoff && (
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => finishCreatedHandoff("open")}
                >
                  {createdHandoff.openLabel}
                </Button>
              )}
              <Button
                type="button"
                onClick={() => finishCreatedHandoff("list")}
              >
                Return to list
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="add-another"
                  checked={addAnother}
                  disabled={submitting}
                  onCheckedChange={(v) => setAddAnother(!!v)}
                />
                <Label htmlFor="add-another" className="text-sm cursor-pointer">Add another</Label>
              </div>
              <div className="flex-1" />
              <Button variant="outline" type="button" disabled={submitting} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" form="new-item-form" disabled={submitting}>
                {submitting ? "Adding..." : "Add asset"}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>

      {/* Image upload modal — renders on top of the sheet */}
      {createdAssetId && (
        <ChooseImageModal
          open={showImageModal}
          onClose={() => setShowImageModal(false)}
          assetId={createdAssetId}
          currentImageUrl={null}
          onImageChanged={() => {
            setShowImageModal(false);
            finishCreatedHandoff(addAnother ? "another" : "list");
          }}
        />
      )}
    </Sheet>
  );
}
