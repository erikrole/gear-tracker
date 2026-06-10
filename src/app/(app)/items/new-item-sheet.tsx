"use client";

import { FormEvent, type ComponentType, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, CheckCircle2Icon, ImageIcon, LayersIcon, PackageIcon, ScanLineIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
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
import { handleAuthRedirect, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
import { cn } from "@/lib/utils";

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

type ItemCreateResponse = {
  data?: {
    id?: string;
  };
};

type KindOption = {
  kind: ItemKind;
  id: string;
  title: string;
  badge: string;
  badgeVariant: BadgeProps["variant"];
  description: string;
  outcome: string;
  requirements: string[];
  icon: ComponentType<{ className?: string }>;
};

const KIND_OPTIONS: KindOption[] = [
  {
    kind: "standard",
    id: "kind-standard",
    title: "Standard",
    badge: "Serialized",
    badgeVariant: "blue",
    description: "One specific physical item with its own tag and scan code.",
    outcome: "Creates one item record that can be reserved, checked out, and found by QR.",
    requirements: ["Asset tag", "Category", "Location", "QR code"],
    icon: ScanLineIcon,
  },
  {
    kind: "units",
    id: "kind-units",
    title: "Units",
    badge: "Numbered family",
    badgeVariant: "purple",
    description: "One item family with numbered or scannable units under it.",
    outcome: "Creates a family record plus numbered units for kiosk pickup and return.",
    requirements: ["Name", "Category", "Location", "Family QR"],
    icon: LayersIcon,
  },
  {
    kind: "quantity",
    id: "kind-quantity",
    title: "Quantity",
    badge: "Count stock",
    badgeVariant: "green",
    description: "Count-only stock where individual units are not scanned.",
    outcome: "Creates or updates one stock record and tracks the count on hand.",
    requirements: ["Name or existing item", "Category", "Location", "Stock QR"],
    icon: PackageIcon,
  },
];

function optionForKind(kind: ItemKind) {
  return KIND_OPTIONS.find((option) => option.kind === kind) ?? KIND_OPTIONS[0]!;
}

function payloadSuccessMessage(label: string, openLabel: string) {
  if (openLabel === "Open stock record") {
    return `"${label}" stock updated successfully.`;
  }
  return `"${label}" created successfully.`;
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-2 py-3">
      <span className="mt-0.5 shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <div className="min-w-0 text-right text-sm font-medium">{children}</div>
    </div>
  );
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
  const selectedKind = optionForKind(kind);

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

      const json = await parseJsonSafely<ItemCreateResponse>(res);

      // For serialized items, show image upload prompt before proceeding
      if (kind === "standard" && json?.data?.id) {
        const createdId = json.data.id;
        setCreatedAssetId(createdId);
        setImageSearchSeed(searchSeed);
        setCreatedHandoff({
          kind: "standard",
          label,
          href: `/items/${createdId}`,
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

      const bulkId = json?.data?.id ?? bulkHandoffHref?.split("/").pop();
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
          <div className="flex items-center gap-2">
            <Badge variant={selectedKind.badgeVariant} size="sm">
              {selectedKind.badge}
            </Badge>
            <SheetTitle>Add item</SheetTitle>
          </div>
          <SheetDescription>{selectedKind.outcome}</SheetDescription>
        </SheetHeader>

        <SheetBody className="px-6 py-6">
          {showPostCreate ? (
            <div className="flex flex-col gap-6">
              <div className="rounded-2xl border border-border/50 bg-background/80 px-5 py-7 text-center shadow-[0_12px_50px_rgba(0,0,0,0.05)] dark:shadow-none">
                <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-[var(--green-bg)] text-[var(--green-text)]">
                  <CheckCircle2Icon className="size-6" />
                </div>
                <Badge variant={optionForKind(createdHandoff?.kind ?? kind).badgeVariant} size="sm" className="mt-4">
                  {optionForKind(createdHandoff?.kind ?? kind).badge}
                </Badge>
                <h3 className="mt-3 text-xl font-semibold tracking-tight text-balance">
                  {createdHandoff?.label ?? "Item"} is ready.
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {createdHandoff?.successMessage ?? "Saved successfully."}
                </p>

                <div className="mt-6 divide-y divide-border/70 border-y border-border/70">
                  <SummaryRow label="Status">
                    <Badge variant="green" size="sm">
                      {createdHandoff?.openLabel === "Open stock record" ? "Stock updated" : "Created"}
                    </Badge>
                  </SummaryRow>
                  <SummaryRow label="Tracking">
                    {optionForKind(createdHandoff?.kind ?? kind).title}
                  </SummaryRow>
                  <SummaryRow label="Next">
                    <span className="text-muted-foreground">{createdHandoff?.description}</span>
                  </SummaryRow>
                </div>
              </div>
              {createdHandoff?.kind === "standard" && (
                <div className="flex flex-col items-center gap-1 rounded-xl border border-border/50 bg-muted/20 px-4 py-4">
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
              <div className="rounded-md border border-border/60 bg-background px-3 py-2.5 shadow-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={selectedKind.badgeVariant} size="sm">
                    {selectedKind.title}
                  </Badge>
                  <span className="text-xs font-medium text-muted-foreground">
                    {selectedKind.outcome}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedKind.requirements.map((requirement) => (
                    <Badge key={requirement} variant="outline" size="sm">
                      {requirement}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* ── Tracking style ── */}
              <section className="flex flex-col gap-3">
                <SectionHeading>Tracking style</SectionHeading>
                <RadioGroup
                  className="grid gap-2"
                  name="item-kind"
                  value={kind}
                  onValueChange={(v) => {
                    setError("");
                    setKind(v as ItemKind);
                  }}
                  disabled={submitting}
                >
                  {KIND_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const selected = kind === option.kind;
                    return (
                      <label
                        key={option.kind}
                        htmlFor={option.id}
                        className={cn(
                          "flex cursor-pointer gap-3 rounded-xl border px-3 py-3 shadow-xs transition-[background-color,border-color,box-shadow]",
                          selected
                            ? "border-primary/55 bg-primary/5 shadow-[0_8px_24px_rgba(0,0,0,0.05)]"
                            : "border-border/55 bg-background hover:bg-muted/40",
                        )}
                      >
                        <RadioGroupItem value={option.kind} id={option.id} className="mt-1" />
                        <div className="flex min-w-0 flex-1 gap-3">
                          <div
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-lg",
                              selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                            )}
                          >
                            <Icon className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold">{option.title}</span>
                              <Badge variant={option.badgeVariant} size="sm">
                                {option.badge}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              {option.description}
                            </p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
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
                  name="addAnother"
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
