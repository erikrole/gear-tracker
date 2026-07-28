"use client";

import { FormEvent, type ComponentType, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, CheckCircle2Icon, LayersIcon, PackageIcon, ScanLineIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
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
import {
  persistDraftItemImage,
  type DraftItemImage,
} from "@/lib/item-image-draft";

type ImageStatus = "none" | "saved" | "failed";

type CreatedHandoff = {
  kind: ItemKind;
  label: string;
  href: string;
  openLabel: string;
  successMessage: string;
  description: string;
  createdRecord: boolean;
  imageEndpoint: string | null;
  imageStatus: ImageStatus;
  imageError: string;
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
      <span className="mt-0.5 shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="min-w-0 text-right text-sm font-medium">{children}</div>
    </div>
  );
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
  const [successMsg, setSuccessMsg] = useState("");
  const submittingRef = useRef(false);
  const successTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [createdHandoff, setCreatedHandoff] = useState<CreatedHandoff | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageSearchQuery, setImageSearchQuery] = useState("");
  const [imageDraft, setImageDraft] = useState<DraftItemImage | null>(null);
  const [imageRetrying, setImageRetrying] = useState(false);

  const serializedRef = useRef<SerializedFormHandle>(null);
  const bulkRef = useRef<BulkFormHandle>(null);
  const resetAll = useCallback(() => {
    setError("");
    setSuccessMsg("");
    setKind("standard");
    setCreatedHandoff(null);
    setShowImageModal(false);
    setImageSearchQuery("");
    setImageDraft(null);
    setImageRetrying(false);
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
    if (mode === "another") {
      onCreated();
      resetAll();
      showSuccessMessage(`"${handoff.label}" created. Ready for the next item.`);
      requestAnimationFrame(() => {
        serializedRef.current?.focus();
      });
    } else {
      onOpenChange(false);
      resetAll();
      if (mode === "open") {
        router.push(handoff.href);
      }
    }
  }

  async function persistCreatedImage(endpoint: string) {
    if (!imageDraft) {
      return { imageStatus: "none" as const, imageError: "" };
    }

    try {
      await persistDraftItemImage(endpoint, imageDraft);
      return { imageStatus: "saved" as const, imageError: "" };
    } catch (imageError) {
      return {
        imageStatus: "failed" as const,
        imageError: imageError instanceof Error
          ? imageError.message
          : "The item was created, but its image could not be saved.",
      };
    }
  }

  async function retryCreatedImage() {
    if (!createdHandoff?.imageEndpoint || !imageDraft || imageRetrying) return;
    setImageRetrying(true);
    const imageResult = await persistCreatedImage(createdHandoff.imageEndpoint);
    setCreatedHandoff((current) => current
      ? { ...current, ...imageResult }
      : current);
    setImageRetrying(false);
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
      let bulkHandoffLabel = "Open item";
      let createsCatalogRecord = true;

      if (kind === "standard") {
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
        createsCatalogRecord = payload.createsCatalogRecord;

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

      const createdId = json?.data?.id
        ?? (!createsCatalogRecord ? bulkHandoffHref?.split("/").pop() : undefined);
      if (!createdId) {
        onCreated();
        setError("The item was created, but the server did not return its item link. Refresh the list before continuing.");
        return;
      }

      const imageEndpoint = imageDraft && createsCatalogRecord
        ? kind === "standard"
          ? `/api/assets/${createdId}/image`
          : `/api/bulk-skus/${createdId}/image`
        : null;
      const imageResult = imageEndpoint
        ? await persistCreatedImage(imageEndpoint)
        : { imageStatus: "none" as const, imageError: "" };
      const handoffHref = kind === "standard"
        ? `/items/${createdId}`
        : `/items/bulk-${createdId}`;

      setCreatedHandoff({
        kind,
        label,
        href: handoffHref,
        openLabel: bulkHandoffLabel,
        successMessage: payloadSuccessMessage(label, bulkHandoffLabel),
        description: kind === "standard"
          ? "Open the item to review its identity, booking policy, and activity."
          : kind === "units"
            ? "Open the item to review availability, numbered units, thresholds, and activity."
            : createsCatalogRecord
              ? "Open the item to review availability, stock, thresholds, and activity."
              : "Open the item to review the updated stock and activity.",
        createdRecord: createsCatalogRecord,
        imageEndpoint,
        ...imageResult,
      });
    } catch {
      setError("You are offline or the request could not reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }

  // Every creation path ends in the same explicit handoff.
  const showPostCreate = !!createdHandoff;

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (submitting) return;
        if (!nextOpen && createdHandoff) onCreated();
        onOpenChange(nextOpen);
        if (!nextOpen) resetAll();
      }}
    >
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Add item</SheetTitle>
          <SheetDescription>
            Create a serialized item, numbered item family, or quantity-tracked stock record.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="px-6 py-6">
          {showPostCreate ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-md border border-border/60 bg-background p-5 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[var(--green-bg)] text-[var(--green-text)]">
                    <CheckCircle2Icon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <Badge variant={optionForKind(createdHandoff?.kind ?? kind).badgeVariant} size="sm">
                      {optionForKind(createdHandoff?.kind ?? kind).badge}
                    </Badge>
                    <h3 className="mt-2 text-lg font-semibold tracking-tight text-balance">
                      {createdHandoff?.label ?? "Item"} is ready
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {createdHandoff?.successMessage ?? "Saved successfully."}
                    </p>
                  </div>
                </div>

                <div className="mt-5 divide-y divide-border/70 border-y border-border/70">
                  <SummaryRow label="Status">
                    <Badge variant="gray" size="sm">
                      {createdHandoff?.createdRecord ? "Created" : "Stock updated"}
                    </Badge>
                  </SummaryRow>
                  <SummaryRow label="Tracking">
                    {optionForKind(createdHandoff?.kind ?? kind).title}
                  </SummaryRow>
                  {createdHandoff?.imageStatus !== "none" && (
                    <SummaryRow label="Image">
                      <Badge
                        variant={createdHandoff.imageStatus === "saved" ? "blue" : "red"}
                        size="sm"
                      >
                        {createdHandoff.imageStatus === "saved" ? "Saved" : "Needs attention"}
                      </Badge>
                    </SummaryRow>
                  )}
                  <SummaryRow label="Next">
                    <span className="text-muted-foreground">{createdHandoff?.description}</span>
                  </SummaryRow>
                </div>
              </div>

              {createdHandoff?.imageStatus === "failed" && (
                <Alert variant="destructive">
                  <AlertCircleIcon className="size-4" />
                  <AlertDescription className="flex flex-col items-start gap-3">
                    <span>
                      Item created, but its image needs attention. {createdHandoff.imageError}
                    </span>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10"
                    loading={imageRetrying}
                    onClick={retryCreatedImage}
                  >
                    Retry image
                  </Button>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <form id="new-item-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
              {/* ── Tracking style ── */}
              <section className="flex flex-col gap-3">
                <SectionHeading>Tracking style</SectionHeading>
                <RadioGroup
                  className="grid gap-2"
                  name="item-kind"
                  value={kind}
                  onValueChange={(v) => {
                    setError("");
                    setImageDraft(null);
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
                  image={imageDraft}
                  onChooseImage={(searchQuery) => {
                    setImageSearchQuery(searchQuery);
                    setShowImageModal(true);
                  }}
                  onClearImage={() => setImageDraft(null)}
                  disabled={submitting}
                />
              ) : (
                <BulkItemForm
                  ref={bulkRef}
                  categories={categories}
                  locations={locations}
                  open={open}
                  trackingMode={kind}
                  image={imageDraft}
                  onChooseImage={(searchQuery) => {
                    setImageSearchQuery(searchQuery);
                    setShowImageModal(true);
                  }}
                  onClearImage={() => setImageDraft(null)}
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
              <Button
                variant="outline"
                type="button"
                onClick={() => finishCreatedHandoff("list")}
              >
                Return to list
              </Button>
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
                onClick={() => finishCreatedHandoff("another")}
              >
                Add another item
              </Button>
            </>
          ) : (
            <>
              <div className="flex-1" />
              <Button variant="outline" type="button" disabled={submitting} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" form="new-item-form" loading={submitting}>
                Add item
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>

      <ChooseImageModal
        mode="draft"
        open={showImageModal}
        onClose={() => setShowImageModal(false)}
        initialSelection={imageDraft}
        searchQuery={imageSearchQuery}
        onDraftChanged={setImageDraft}
      />
    </Sheet>
  );
}
