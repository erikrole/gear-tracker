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

function buildImageSearchSeed(name?: unknown, brand?: unknown, model?: unknown, fallback?: unknown) {
  const productName = typeof name === "string" ? name.trim() : "";
  const brandText = typeof brand === "string" ? brand.trim() : "";
  const modelText = typeof model === "string" ? model.trim() : "";
  const fallbackText = typeof fallback === "string" ? fallback.trim() : "";
  const productLower = productName.toLowerCase();
  const metadata = [brandText, modelText].filter((part) => part && !productLower.includes(part.toLowerCase()));
  return [productName, ...metadata].filter(Boolean).join(" ")
    || [brandText, modelText].filter(Boolean).join(" ")
    || fallbackText;
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
  const [kind, setKind] = useState<ItemKind>("standard");
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
  const [imageSearchSeed, setImageSearchSeed] = useState("");

  const serializedRef = useRef<SerializedFormHandle>(null);
  const bulkRef = useRef<BulkFormHandle>(null);

  const resetAll = useCallback(() => {
    setError("");
    setSuccessMsg("");
    setKind("standard");
    setAddAnother(false);
    setCreatedAssetId(null);
    setCreatedHandoff(null);
    setShowImageModal(false);
    setImageSearchSeed("");
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
      showSuccessMessage(`"${handoff.label}" created. Ready for the next item.`);
      requestAnimationFrame(() => {
        if (handoff.kind === "standard") serializedRef.current?.focus();
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
      let searchSeed = "";
      let bulkHandoffHref: string | null = null;
      let bulkHandoffLabel = "Open item";

      if (kind === "standard") {
        const validationError = serializedRef.current?.validate();
        if (validationError) {
          setError(validationError);
          return;
        }
        const body = serializedRef.current!.getSubmitBody();
        label = (body.assetTag as string) || (body.name as string) || "Asset";
        searchSeed = buildImageSearchSeed(body.name, body.brand, body.model, body.assetTag);

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
      if (kind === "standard" && json.data?.id) {
        setCreatedAssetId(json.data.id);
        setImageSearchSeed(searchSeed);
        setCreatedHandoff({
          kind: "standard",
          label,
          href: `/items/${json.data.id}`,
          openLabel: "Open item",
          successMessage: `"${label}" created successfully.`,
          description: "Open the item record to finish photos, QR details, policy settings, and booking context.",
        });
        return; // Don't close yet — show image upload prompt
      }

      if (kind === "standard") {
        onCreated();
        setError("The item was created, but the server did not return an item link. Refresh the list before creating another asset.");
        return;
      }

      const bulkId = json.data?.id ?? bulkHandoffHref?.split("/").pop();
      const handoffHref = bulkId ? `/items/bulk-${bulkId}` : "/items";
      if (addAnother) {
        onCreated();
        bulkRef.current?.reset();
        showSuccessMessage(`"${label}" created. Ready for the next item.`);
        requestAnimationFrame(() => bulkRef.current?.focus());
      } else {
        setCreatedHandoff({
          kind,
          label,
          href: handoffHref,
          openLabel: bulkHandoffLabel,
          successMessage: payloadSuccessMessage(label, bulkHandoffLabel),
          description: kind === "units"
            ? "Open the item to review availability, units, QR details, thresholds, and activity."
            : "Open the item to review availability, stock, thresholds, and activity.",
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
          <SheetTitle>Add item</SheetTitle>
          <SheetDescription>Choose how this item is tracked, then choose the next step.</SheetDescription>
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
              {createdHandoff?.kind === "standard" && (
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
              {/* ── Tracking style ── */}
              <section className="flex flex-col gap-3">
                <SectionHeading>Tracking style</SectionHeading>
                <RadioGroup
                  value={kind}
                  onValueChange={(v) => {
                    setError("");
                    setKind(v as ItemKind);
                  }}
                  disabled={submitting}
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="standard" id="kind-standard" className="mt-0.5" />
                    <div>
                      <Label htmlFor="kind-standard" className="font-medium cursor-pointer">Standard</Label>
                      <p className="text-xs text-muted-foreground">
                        One physical item with its own identity. Examples: camera body, lens, laptop.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="units" id="kind-units" className="mt-0.5" />
                    <div>
                      <Label htmlFor="kind-units" className="font-medium cursor-pointer">Units</Label>
                      <p className="text-xs text-muted-foreground">
                        One item with many scannable units. Examples: batteries, radios, card readers.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="quantity" id="kind-quantity" className="mt-0.5" />
                    <div>
                      <Label htmlFor="kind-quantity" className="font-medium cursor-pointer">Quantity</Label>
                      <p className="text-xs text-muted-foreground">
                        One item tracked by count only. Examples: tape, zip ties, cleaning supplies.
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

              {kind === "standard" ? (
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
                  trackingMode={kind}
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
                  Add another item
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
                {submitting ? "Adding..." : "Add item"}
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
          searchQuery={imageSearchSeed}
          onImageChanged={() => {
            setShowImageModal(false);
            finishCreatedHandoff(addAnother ? "another" : "list");
          }}
        />
      )}
    </Sheet>
  );
}
