"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, ImageIcon } from "lucide-react";
import { toast } from "sonner";
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

import type { NewItemSheetProps, ItemKind } from "./new-item-sheet/types";
import { SectionHeading, SuccessFlash } from "@/components/form-layout";
import { SerializedItemForm, type SerializedFormHandle } from "./new-item-sheet/SerializedItemForm";
import { BulkItemForm, type BulkFormHandle } from "./new-item-sheet/BulkItemForm";

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
  const successTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Image upload post-creation (serialized items only)
  const [createdAssetId, setCreatedAssetId] = useState<string | null>(null);
  const [createdLabel, setCreatedLabel] = useState("");
  const [showImageModal, setShowImageModal] = useState(false);

  const serializedRef = useRef<SerializedFormHandle>(null);
  const bulkRef = useRef<BulkFormHandle>(null);

  const resetAll = useCallback(() => {
    setError("");
    setSuccessMsg("");
    setKind("serialized");
    setCreatedAssetId(null);
    setCreatedLabel("");
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

  function proceedAfterImage() {
    onCreated();
    if (addAnother) {
      serializedRef.current?.reset(true);
      setCreatedAssetId(null);
      setCreatedLabel("");
      showSuccessMessage(`"${createdLabel}" created — ready for next item`);
    } else {
      onOpenChange(false);
      resetAll();
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    try {
      let res: globalThis.Response;
      let label = "";

      if (kind === "serialized") {
        const validationError = serializedRef.current?.validate();
        if (validationError) {
          setError(validationError);
          return;
        }
        const body = serializedRef.current!.getSubmitBody();
        label = (body.assetTag as string) || (body.name as string) || "Asset";

        setSubmitting(true);
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

        setSubmitting(true);
        res = await fetch(payload.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload.body),
        });
      }

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to create item");
        setSubmitting(false);
        return;
      }

      setSubmitting(false);

      // For serialized items, show image upload prompt before proceeding
      if (kind === "serialized" && json.data?.id) {
        setCreatedAssetId(json.data.id);
        setCreatedLabel(label);
        return; // Don't close yet — show image upload prompt
      }

      // Bulk items: proceed immediately (no image upload)
      onCreated();
      if (addAnother) {
        bulkRef.current?.reset();
        showSuccessMessage(`"${label}" created — ready for next item`);
      } else {
        toast.success(`"${label}" added to inventory`);
        onOpenChange(false);
        resetAll();
      }
    } catch {
      setError("Network error");
      setSubmitting(false);
    }
  }

  // Post-creation success state (serialized only)
  const showPostCreate = kind === "serialized" && createdAssetId;

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetAll(); }}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>New item</SheetTitle>
          <SheetDescription>Add a new item to your inventory.</SheetDescription>
        </SheetHeader>

        <SheetBody className="px-6 py-6">
          {showPostCreate ? (
            <div className="flex flex-col gap-6">
              <SuccessFlash message={`"${createdLabel}" created successfully!`} />
              <div className="flex flex-col items-center gap-1 py-4">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setShowImageModal(true)}
                >
                  <ImageIcon className="size-4" />
                  Add Image
                </Button>
                <p className="text-xs text-muted-foreground">
                  You can also add an image later from the item detail page.
                </p>
              </div>
            </div>
          ) : (
            <form id="new-item-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
              {/* ── Item type ── */}
              <section className="flex flex-col gap-3">
                <SectionHeading>Item type</SectionHeading>
                <RadioGroup value={kind} onValueChange={(v) => setKind(v as ItemKind)}>
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

              {kind === "serialized" ? (
                <SerializedItemForm
                  ref={serializedRef}
                  categories={categories}
                  departments={departments}
                  locations={locations}
                />
              ) : (
                <BulkItemForm
                  ref={bulkRef}
                  categories={categories}
                  locations={locations}
                  open={open}
                />
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircleIcon className="size-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </form>
          )}
        </SheetBody>

        <SheetFooter>
          {showPostCreate ? (
            <>
              <div className="flex-1" />
              {addAnother && (
                <Button variant="outline" type="button" onClick={proceedAfterImage}>
                  Add Another
                </Button>
              )}
              {createdAssetId && (
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    toast.success(`"${createdLabel}" added to inventory`);
                    onCreated();
                    onOpenChange(false);
                    resetAll();
                    router.push(`/items/${createdAssetId}`);
                  }}
                >
                  View Item
                </Button>
              )}
              <Button
                type="button"
                onClick={() => {
                  toast.success(`"${createdLabel}" added to inventory`);
                  onCreated();
                  onOpenChange(false);
                  resetAll();
                }}
              >
                Done
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="add-another"
                  checked={addAnother}
                  onCheckedChange={(v) => setAddAnother(!!v)}
                />
                <Label htmlFor="add-another" className="text-sm cursor-pointer">Add another</Label>
              </div>
              <div className="flex-1" />
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" form="new-item-form" disabled={submitting}>
                {submitting ? "Adding..." : "Add"}
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
            proceedAfterImage();
          }}
        />
      )}
    </Sheet>
  );
}
