"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AlertCircleIcon } from "lucide-react";
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

import type { NewItemSheetProps, ItemKind } from "./new-item-sheet/types";
import { SectionHeading, SuccessFlash } from "./new-item-sheet/layout";
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
  const [kind, setKind] = useState<ItemKind>("serialized");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [addAnother, setAddAnother] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const successTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const serializedRef = useRef<SerializedFormHandle>(null);
  const bulkRef = useRef<BulkFormHandle>(null);

  const resetAll = useCallback(() => {
    setError("");
    setSuccessMsg("");
    setKind("serialized");
    serializedRef.current?.reset();
    bulkRef.current?.reset();
  }, []);

  function showSuccessMessage(msg: string) {
    setSuccessMsg(msg);
    clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccessMsg(""), 3000);
  }

  useEffect(() => () => clearTimeout(successTimer.current), []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    try {
      let res: globalThis.Response;
      let createdLabel = "";

      if (kind === "serialized") {
        const validationError = serializedRef.current?.validate();
        if (validationError) {
          setError(validationError);
          return;
        }
        const body = serializedRef.current!.getSubmitBody();
        createdLabel = (body.assetTag as string) || (body.name as string) || "Asset";

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
        createdLabel = payload.label;

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
      onCreated();

      if (addAnother) {
        serializedRef.current?.reset(true);
        bulkRef.current?.reset();
        showSuccessMessage(`"${createdLabel}" created — ready for next item`);
      } else {
        onOpenChange(false);
        resetAll();
      }
    } catch {
      setError("Network error");
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetAll(); }}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>New item</SheetTitle>
          <SheetDescription>Add a new item to your inventory.</SheetDescription>
        </SheetHeader>

        <SheetBody className="px-6 py-6">
          <form id="new-item-form" onSubmit={handleSubmit} className="space-y-6">
            {/* ── Item type ── */}
            <section className="space-y-3">
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
        </SheetBody>

        <SheetFooter>
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
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
