"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import Image from "next/image";
import { Dices, ImageIcon, ScanLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import QrScanner from "@/components/QrScanner";

import type { Department, Location, ParentSearchResult } from "./types";
import type { CategoryOption } from "@/types/category";
import { generateQrCode, useIsMobile, useParentSearch, FISCAL_YEARS } from "./helpers";
import { FormRow, FormRow2Col } from "@/components/form-layout";
import { FormCombobox, CategoryCombobox } from "@/components/FormCombobox";
import { handleAuthRedirect, parseJsonSafely } from "@/lib/errors";
import { buildSerializedItemSubmitBody, isValidUsdPriceInput } from "./serialized-submit";
import { FormSection } from "./FormSection";
import { getRepeatTagBase, summarizeRepeatTags, type RepeatTagSummary } from "./repeat-tags";

export interface SerializedFormHandle {
  validate(): string | null;
  getSubmitBody(): Record<string, unknown>;
  getPendingImageFile(): File | null;
  reset(keepShared?: boolean): void;
  focus(): void;
}

interface Props {
  categories: CategoryOption[];
  departments: Department[];
  locations: Location[];
  disabled?: boolean;
}

type AssetSearchResponse = {
  data?: Array<{
    assetTag?: string | null;
  }>;
};

const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_PHOTO_SIZE = 4.5 * 1024 * 1024;

export const SerializedItemForm = forwardRef<SerializedFormHandle, Props>(
  function SerializedItemForm({ categories, departments, locations, disabled = false }, ref) {
    // Controlled selects — empty string = no selection (no __none__ sentinels)
    const [categoryId, setCategoryId] = useState("");
    const [locationId, setLocationId] = useState("");
    const [departmentId, setDepartmentId] = useState("");
    const [fiscalYear, setFiscalYear] = useState("");

    // Text inputs (controlled for imperative access)
    const [assetTag, setAssetTag] = useState("");
    const [itemName, setItemName] = useState("");
    const [brand, setBrand] = useState("");
    const [model, setModel] = useState("");
    const [serialNumber, setSerialNumber] = useState("");
    const [purchaseDate, setPurchaseDate] = useState("");
    const [purchasePrice, setPurchasePrice] = useState("");
    const [warrantyDate, setWarrantyDate] = useState("");
    const [residualValue, setResidualValue] = useState("");
    const [linkUrl, setLinkUrl] = useState("");
    const [uwAssetTag, setUwAssetTag] = useState("");
    const [userNotes, setUserNotes] = useState("");

    // Asset tag uniqueness check
    const [assetTagError, setAssetTagError] = useState("");
    const [assetTagSummary, setAssetTagSummary] = useState<RepeatTagSummary | null>(null);
    const assetTagCheckRef = useRef(0);
    const assetTagInputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
      const trimmed = assetTag.trim();
      if (!trimmed) {
        setAssetTagError("");
        setAssetTagSummary(null);
        return;
      }

      const id = ++assetTagCheckRef.current;
      const debounce = setTimeout(async () => {
        const repeatBase = getRepeatTagBase(trimmed);
        try {
          const res = await fetch(`/api/assets?q=${encodeURIComponent(repeatBase)}&limit=200&include_accessories=true`);
          if (id !== assetTagCheckRef.current) return; // stale
          if (handleAuthRedirect(res)) return;
          if (!res.ok) return;
          const data = await parseJsonSafely<AssetSearchResponse>(res);
          const match = data?.data?.some((a) => a.assetTag === trimmed);
          setAssetTagError(match ? "Asset tag already in use" : "");
          setAssetTagSummary(summarizeRepeatTags(trimmed, data?.data ?? []));
        } catch { /* network error — skip */ }
      }, 160);

      return () => clearTimeout(debounce);
    }, [assetTag]);

    // QR code
    const [qrCodeValue, setQrCodeValue] = useState("");
    const [showScanner, setShowScanner] = useState(false);

    // Settings — three independent booking toggles matching detail page
    const [availableForReservation, setAvailableForReservation] = useState(true);
    const [availableForCheckout, setAvailableForCheckout] = useState(true);
    const [availableForCustody, setAvailableForCustody] = useState(true);
    const [isAccessory, setIsAccessory] = useState(false);
    const [parentAsset, setParentAsset] = useState<ParentSearchResult | null>(null);
    const parentSearch = useParentSearch();

    const isMobile = useIsMobile();
    const assetTagRequired = !isAccessory;
    const identityDescription = isAccessory
      ? "Attachments can leave the visible asset tag blank. A quiet internal tag is generated from the parent item, attachment identity, and QR code."
      : "Fast intake needs the asset tag, category, location, and QR code. Product details can be filled in later.";

    // Optional photo selected before create. The server upload still happens after
    // asset creation because the image endpoint is asset-id based.
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
    const [photoError, setPhotoError] = useState("");
    const photoInputRef = useRef<HTMLInputElement>(null);

    const clearPhoto = useCallback(() => {
      setPhotoFile(null);
      setPhotoError("");
      setPhotoPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return "";
      });
      if (photoInputRef.current) photoInputRef.current.value = "";
    }, []);

    useEffect(() => () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    }, [photoPreviewUrl]);

    function handlePhotoChange(file: File | null) {
      setPhotoError("");
      setPhotoFile(null);
      setPhotoPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return "";
      });
      if (!file) return;

      if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
        setPhotoError("Upload a JPG, PNG, WebP, or GIF image.");
        if (photoInputRef.current) photoInputRef.current.value = "";
        return;
      }
      if (file.size > MAX_PHOTO_SIZE) {
        setPhotoError("Upload an image smaller than 4.5 MB.");
        if (photoInputRef.current) photoInputRef.current.value = "";
        return;
      }

      setPhotoFile(file);
      setPhotoPreviewUrl(URL.createObjectURL(file));
    }

    // Build combobox options
    const departmentOptions = departments.map((d) => ({ value: d.id, label: d.name }));
    const locationOptions = locations.map((l) => ({ value: l.id, label: l.name }));
    const fiscalYearOptions = FISCAL_YEARS.map((fy) => ({ value: fy, label: fy }));

    useImperativeHandle(ref, () => ({
      validate() {
        if (assetTagRequired && !assetTag.trim()) return "Asset tag is required.";
        if (assetTag.trim() && assetTagError) return assetTagError;
        if (!qrCodeValue.trim()) return "QR code is required.";
        if (!categoryId) return "Please select a category.";
        if (!locationId) return "Please select a location.";
        if (!isValidUsdPriceInput(purchasePrice)) return "Enter purchase price as a USD amount, for example 1299.99.";
        if (photoError) return photoError;
        if (isAccessory && !parentAsset) return "Please select a parent item for this attachment.";
        return null;
      },
      getSubmitBody() {
        return buildSerializedItemSubmitBody({
          assetTag,
          itemName,
          brand,
          model,
          serialNumber,
          qrCodeValue,
          locationId,
          categoryId,
          departmentId,
          purchaseDate,
          purchasePrice,
          warrantyDate,
          residualValue,
          linkUrl,
          uwAssetTag,
          fiscalYear,
          userNotes,
          availableForReservation,
          availableForCheckout,
          availableForCustody,
          isAccessory,
          parentAssetId: parentAsset?.id,
          parentAsset: parentAsset
            ? {
                assetTag: parentAsset.assetTag,
                name: parentAsset.name,
                brand: parentAsset.brand,
                model: parentAsset.model,
              }
            : undefined,
        });
      },
      getPendingImageFile() {
        return photoFile;
      },
      reset(keepShared = false) {
        if (!keepShared) {
          setCategoryId("");
          setLocationId("");
          setDepartmentId("");
        }
        setFiscalYear("");
        setAssetTag("");
        setAssetTagError("");
        setAssetTagSummary(null);
        setItemName("");
        setBrand("");
        setModel("");
        setSerialNumber("");
        setPurchaseDate("");
        setPurchasePrice("");
        setWarrantyDate("");
        setResidualValue("");
        setLinkUrl("");
        setUwAssetTag("");
        setUserNotes("");
        setQrCodeValue("");
        setShowScanner(false);
        setAvailableForReservation(true);
        setAvailableForCheckout(true);
        setAvailableForCustody(true);
        setIsAccessory(false);
        setParentAsset(null);
        parentSearch.clear();
        clearPhoto();
      },
      focus() {
        assetTagInputRef.current?.focus();
      },
    }));

    return (
      <fieldset disabled={disabled} className="contents">
        <FormSection
          title="Identity"
          badge="Fast intake"
          badgeVariant="blue"
          description={identityDescription}
        >
          <FormRow label="Asset tag" htmlFor="new-item-asset-tag" required={assetTagRequired}>
            <Input
              id="new-item-asset-tag"
              name="assetTag"
              ref={assetTagInputRef}
              value={assetTag}
              onChange={(e) => { setAssetTag(e.target.value); setAssetTagError(""); setAssetTagSummary(null); }}
              placeholder={isAccessory ? "Optional for attachments" : "Unique tag name"}
              autoComplete="off"
              required={assetTagRequired}
              className={assetTagError ? "border-destructive" : undefined}
            />
            {assetTagError && <p className="text-sm text-destructive mt-1">{assetTagError}</p>}
            {isAccessory && !assetTag.trim() && (
              <p className="mt-1 text-sm text-muted-foreground">
                Leave blank to generate an internal tag. The physical label can stay QR-only with your parent number beside it.
              </p>
            )}
            {!assetTagError && assetTagSummary && assetTag.trim() && (
              <p className="mt-1 text-sm text-muted-foreground">
                {`${assetTagSummary.existingCount} existing ${assetTagSummary.base} ${assetTagSummary.existingCount === 1 ? "item" : "items"}. Suggested next tag: ${assetTagSummary.nextTag}.`}
              </p>
            )}
          </FormRow>

          <FormRow label="Name" htmlFor="new-item-name">
            <Input id="new-item-name" name="name" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Sony A7III Camera" autoComplete="off" />
          </FormRow>

          <FormRow2Col label="Brand / Model">
            <Input id="new-item-brand" name="brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Sony" aria-label="Brand" autoComplete="off" />
            <Input id="new-item-model" name="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. A7III" aria-label="Model" autoComplete="off" />
          </FormRow2Col>

          <FormRow label="Serial number" htmlFor="new-item-serial-number">
            <Input id="new-item-serial-number" name="serialNumber" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="Manufacturer serial (optional)" autoComplete="off" />
          </FormRow>
        </FormSection>

        <FormSection
          title="Organization"
          badge="Required"
          badgeVariant="orange"
          description="Category and location keep the new item discoverable and available in the right place."
        >
          <FormRow label="Category" htmlFor="new-item-category" required>
            <CategoryCombobox id="new-item-category" value={categoryId} onValueChange={setCategoryId} categories={categories} />
          </FormRow>

          <FormRow label="Department" htmlFor="new-item-department">
            <FormCombobox
              id="new-item-department"
              value={departmentId}
              onValueChange={setDepartmentId}
              options={departmentOptions}
              placeholder="Select a department"
              searchPlaceholder="Search departments..."
              emptyLabel="No department found."
            />
          </FormRow>

          <FormRow label="Location" htmlFor="new-item-location" required>
            <FormCombobox
              id="new-item-location"
              value={locationId}
              onValueChange={setLocationId}
              options={locationOptions}
              placeholder="Select a location"
              searchPlaceholder="Search locations..."
              emptyLabel="No location found."
            />
          </FormRow>
        </FormSection>

        <FormSection
          title="Tracking"
          badge="Scan identity"
          badgeVariant="purple"
          description="QR code is the scan value operators will use to find this item later."
        >
          <FormRow label="QR code" htmlFor="new-item-qr-code" required>
            <div className="flex gap-2">
              <Input
                id="new-item-qr-code"
                name="qrCodeValue"
                value={qrCodeValue}
                onChange={(e) => setQrCodeValue(e.target.value)}
                placeholder="QR code value"
                autoComplete="off"
                required
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Generate QR code"
                aria-label="Generate QR code"
                onClick={() => setQrCodeValue(generateQrCode())}
              >
                <Dices className="size-4" />
              </Button>
              {isMobile && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Scan QR code"
                  aria-label="Scan QR code"
                  onClick={() => setShowScanner((v) => !v)}
                >
                  <ScanLine className="size-4" />
                </Button>
              )}
            </div>
            {showScanner && (
              <div className="mt-2">
                <QrScanner
                  active={showScanner}
                  onScan={(value) => {
                    setQrCodeValue(value);
                    setShowScanner(false);
                  }}
                  onError={() => setShowScanner(false)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 w-full text-xs"
                  onClick={() => setShowScanner(false)}
                >
                  Close scanner
                </Button>
              </div>
            )}
          </FormRow>

          <FormRow label="UW Asset Tag" htmlFor="new-item-uw-asset-tag">
            <Input id="new-item-uw-asset-tag" name="uwAssetTag" value={uwAssetTag} onChange={(e) => setUwAssetTag(e.target.value)} placeholder="Asset tag number" autoComplete="off" />
          </FormRow>
        </FormSection>

        <FormSection
          title="Procurement"
          badge="Optional"
          badgeVariant="secondary"
          description="Use these fields when purchase or warranty details are already known."
        >
          <FormRow2Col label="Purchase">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-item-purchase-date" className="text-xs text-muted-foreground">Date</Label>
              <Input id="new-item-purchase-date" name="purchaseDate" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} type="date" autoComplete="off" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-item-purchase-price" className="text-xs text-muted-foreground">Price (USD)</Label>
              <div className="flex rounded-md border border-input bg-background shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
                <span className="flex items-center border-r px-3 text-sm text-muted-foreground">$</span>
                <Input
                  id="new-item-purchase-price"
                  name="purchasePrice"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  autoComplete="off"
                  aria-label="Purchase price in US dollars"
                  className="border-0 shadow-none focus-visible:ring-0"
                />
              </div>
            </div>
          </FormRow2Col>

          <FormRow2Col label="Warranty">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-item-warranty-date" className="text-xs text-muted-foreground">Date</Label>
              <Input id="new-item-warranty-date" name="warrantyDate" value={warrantyDate} onChange={(e) => setWarrantyDate(e.target.value)} type="date" autoComplete="off" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-item-residual-value" className="text-xs text-muted-foreground">Residual value</Label>
              <Input id="new-item-residual-value" name="residualValue" value={residualValue} onChange={(e) => setResidualValue(e.target.value)} type="number" min="0" step="0.01" placeholder="0" autoComplete="off" />
            </div>
          </FormRow2Col>

          <FormRow label="Fiscal year" htmlFor="new-item-fiscal-year">
            <FormCombobox
              id="new-item-fiscal-year"
              value={fiscalYear}
              onValueChange={setFiscalYear}
              options={fiscalYearOptions}
              placeholder="Select fiscal year"
              searchPlaceholder="Search..."
              emptyLabel="No match."
              allowClear
            />
          </FormRow>

          <FormRow label="Link" htmlFor="new-item-link-url">
            <Input id="new-item-link-url" name="linkUrl" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} type="url" placeholder="https://..." autoComplete="off" />
          </FormRow>
        </FormSection>

        <FormSection
          title="Photo"
          badge="Optional"
          badgeVariant="secondary"
          description="Upload a product photo now, or add search and URL images after the item is created."
        >
          <FormRow label="Photo upload" htmlFor="new-item-photo">
            <div className="flex flex-col gap-3">
              <Input
                id="new-item-photo"
                ref={photoInputRef}
                name="imageFile"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
                autoComplete="off"
              />
              {photoError && <p className="text-sm text-destructive">{photoError}</p>}
              {photoFile && (
                <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-2">
                  <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded bg-background">
                    {photoPreviewUrl ? (
                      <Image src={photoPreviewUrl} alt="" fill sizes="56px" className="object-contain" unoptimized />
                    ) : (
                      <ImageIcon className="size-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{photoFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(photoFile.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0"
                    onClick={clearPhoto}
                    aria-label="Remove selected photo"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          </FormRow>
        </FormSection>

        <FormSection title="Notes" badge="Optional" badgeVariant="secondary">
          <FormRow label="Notes" htmlFor="new-item-notes">
            <Textarea
              id="new-item-notes"
              name="notes"
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              placeholder="Add notes about this item (optional)"
              autoComplete="off"
              rows={3}
              className="resize-none"
            />
          </FormRow>
        </FormSection>

        <FormSection
          title="Settings"
          badge="Policy"
          badgeVariant="gray"
          description="These toggles control future workflow eligibility, not current status."
        >
          <div className="flex flex-col gap-3">
            {/* Attachment toggle */}
            <div className="flex items-center justify-between gap-1">
              <div>
                <Label htmlFor="new-item-is-accessory" className="text-sm font-medium">Item is an attachment</Label>
                <p className="text-xs text-muted-foreground">Tie to a parent item, such as a camera SD card, cage, or fixed part.</p>
              </div>
              <Switch
                id="new-item-is-accessory"
                name="isAccessory"
                checked={isAccessory}
                onCheckedChange={(v) => {
                  setIsAccessory(v);
                  if (v) {
                    setAvailableForReservation(false);
                    setAvailableForCheckout(false);
                    setAvailableForCustody(false);
                  } else {
                    setParentAsset(null);
                    parentSearch.clear();
                    setAvailableForReservation(true);
                    setAvailableForCheckout(true);
                    setAvailableForCustody(true);
                  }
                }}
              />
            </div>

            {/* Parent asset search */}
            {isAccessory && (
              <div className="pl-0 flex flex-col gap-2">
                {parentAsset ? (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                    <span className="flex-1 truncate">
                      <span className="font-medium">{parentAsset.assetTag}</span>
                      {" — "}
                      {parentAsset.name || `${parentAsset.brand} ${parentAsset.model}`}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      aria-label="Clear parent item"
                      onClick={() => { setParentAsset(null); parentSearch.clear(); }}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Label htmlFor="new-item-parent-search" className="sr-only">Parent item search</Label>
                    <Input
                      id="new-item-parent-search"
                      name="parentAssetSearch"
                      value={parentSearch.query}
                      onChange={(e) => parentSearch.setQuery(e.target.value)}
                      placeholder="Search parent item by tag, brand, or model..."
                      autoComplete="off"
                    />
                    {parentSearch.searching && (
                      <p className="text-xs text-muted-foreground px-1">Searching...</p>
                    )}
                    {parentSearch.results.length > 0 && (
                      <div className="rounded-md border divide-y text-sm">
                        {parentSearch.results.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                            onClick={() => {
                              setParentAsset(item);
                              parentSearch.clear();
                            }}
                          >
                            <span className="font-medium">{item.assetTag}</span>
                            {" — "}
                            {item.name || `${item.brand} ${item.model}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <p className="text-xs text-muted-foreground">
                  Attachments are tracked as inventory but are not available for independent booking.
                </p>
              </div>
            )}

            {/* Booking availability — three independent toggles matching detail page */}
            {!isAccessory && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-1">
                  <div>
                    <Label htmlFor="new-item-available-for-reservation" className="text-sm font-medium">Available for reservation</Label>
                    <p className="text-xs text-muted-foreground">Item is available to be used in reservations</p>
                  </div>
                  <Switch id="new-item-available-for-reservation" name="availableForReservation" checked={availableForReservation} onCheckedChange={setAvailableForReservation} />
                </div>
                <div className="flex items-center justify-between gap-1">
                  <div>
                    <Label htmlFor="new-item-available-for-checkout" className="text-sm font-medium">Available for check out</Label>
                    <p className="text-xs text-muted-foreground">Item is available to be used in check-outs</p>
                  </div>
                  <Switch id="new-item-available-for-checkout" name="availableForCheckout" checked={availableForCheckout} onCheckedChange={setAvailableForCheckout} />
                </div>
                <div className="flex items-center justify-between gap-1">
                  <div>
                    <Label htmlFor="new-item-available-for-custody" className="text-sm font-medium">Available for custody</Label>
                    <p className="text-xs text-muted-foreground">Item can be taken into custody by a user</p>
                  </div>
                  <Switch id="new-item-available-for-custody" name="availableForCustody" checked={availableForCustody} onCheckedChange={setAvailableForCustody} />
                </div>
              </div>
            )}
          </div>
        </FormSection>
      </fieldset>
    );
  }
);
