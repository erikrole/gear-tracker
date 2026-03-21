"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Dices, ScanLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import QrScanner from "@/components/QrScanner";

import type { CategoryOption, Department, Location, ParentSearchResult } from "./types";
import { generateQrCode, useIsMobile, useParentSearch, FISCAL_YEARS } from "./helpers";
import { FormRow, FormRow2Col, SectionHeading } from "./layout";

export interface SerializedFormHandle {
  validate(): string | null;
  getSubmitBody(): Record<string, unknown>;
  reset(keepShared?: boolean): void;
}

interface Props {
  categories: CategoryOption[];
  departments: Department[];
  locations: Location[];
}

export const SerializedItemForm = forwardRef<SerializedFormHandle, Props>(
  function SerializedItemForm({ categories, departments, locations }, ref) {
    // Controlled selects
    const [categoryId, setCategoryId] = useState("__none__");
    const [locationId, setLocationId] = useState("");
    const [departmentId, setDepartmentId] = useState("__none__");
    const [fiscalYear, setFiscalYear] = useState("__none__");

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

    // QR code
    const [qrCodeValue, setQrCodeValue] = useState("");
    const [showScanner, setShowScanner] = useState(false);

    // Settings
    const [availableForBooking, setAvailableForBooking] = useState(true);
    const [isAccessory, setIsAccessory] = useState(false);
    const [parentAsset, setParentAsset] = useState<ParentSearchResult | null>(null);
    const parentSearch = useParentSearch();

    const isMobile = useIsMobile();

    useImperativeHandle(ref, () => ({
      validate() {
        if (!assetTag.trim()) return "Asset tag is required.";
        if (!itemName.trim()) return "Item name is required.";
        if (!brand.trim()) return "Brand is required.";
        if (!model.trim()) return "Model is required.";
        if (!qrCodeValue.trim()) return "QR code is required.";
        if (!categoryId || categoryId === "__none__") return "Please select a category.";
        if (!departmentId || departmentId === "__none__") return "Please select a department.";
        if (!locationId) return "Please select a location.";
        if (isAccessory && !parentAsset) return "Please select a parent item for this accessory.";
        return null;
      },
      getSubmitBody() {
        const notes: Record<string, string> = {};
        const fy = fiscalYear !== "__none__" ? fiscalYear : "";
        if (fy) notes.fiscalYear = fy;

        const resolvedCategoryId = categoryId === "__none__" ? "" : categoryId;
        const resolvedDepartmentId = departmentId === "__none__" ? "" : departmentId;
        const bookingEnabled = isAccessory ? false : availableForBooking;

        return {
          assetTag: assetTag.trim(),
          type: "equipment",
          brand: brand.trim(),
          model: model.trim(),
          qrCodeValue: qrCodeValue.trim(),
          locationId,
          availableForReservation: bookingEnabled,
          availableForCheckout: bookingEnabled,
          availableForCustody: bookingEnabled,
          ...(isAccessory && parentAsset ? { parentAssetId: parentAsset.id } : {}),
          ...(serialNumber.trim() ? { serialNumber: serialNumber.trim() } : {}),
          ...(resolvedCategoryId ? { categoryId: resolvedCategoryId } : {}),
          ...(resolvedDepartmentId ? { departmentId: resolvedDepartmentId } : {}),
          ...(itemName.trim() ? { name: itemName.trim() } : {}),
          ...(purchaseDate ? { purchaseDate } : {}),
          ...(purchasePrice ? { purchasePrice: parseFloat(purchasePrice) } : {}),
          ...(warrantyDate ? { warrantyDate } : {}),
          ...(residualValue ? { residualValue: parseFloat(residualValue) } : {}),
          ...(linkUrl.trim() ? { linkUrl: linkUrl.trim() } : {}),
          ...(uwAssetTag.trim() ? { uwAssetTag: uwAssetTag.trim() } : {}),
          ...(Object.keys(notes).length ? { notes: JSON.stringify(notes) } : {}),
        };
      },
      reset(keepShared = false) {
        if (!keepShared) {
          setCategoryId("__none__");
          setLocationId("");
          setDepartmentId("__none__");
        }
        setFiscalYear("__none__");
        setAssetTag("");
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
        setQrCodeValue("");
        setShowScanner(false);
        setAvailableForBooking(true);
        setIsAccessory(false);
        setParentAsset(null);
        parentSearch.clear();
      },
    }));

    return (
      <>
        {/* ── Identity ── */}
        <section className="space-y-4">
          <SectionHeading>Identity</SectionHeading>

          <FormRow label="Asset tag" required>
            <Input value={assetTag} onChange={(e) => setAssetTag(e.target.value)} placeholder="Unique tag name" required />
          </FormRow>

          <FormRow label="Name" required>
            <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Sony A7III Camera" required />
          </FormRow>

          <FormRow2Col label="Brand / Model" required>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Sony" required />
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. A7III" required />
          </FormRow2Col>

          <FormRow label="Serial number">
            <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="Manufacturer serial (optional)" />
          </FormRow>
        </section>

        {/* ── Organization ── */}
        <section className="space-y-4">
          <SectionHeading>Organization</SectionHeading>

          <FormRow label="Category" required>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select a category</SelectItem>
                {categories.filter((c) => !c.parentId).map((parent) => (
                  <SelectGroup key={parent.id}>
                    <SelectLabel>{parent.name}</SelectLabel>
                    {categories.filter((c) => c.parentId === parent.id).map((child) => (
                      <SelectItem key={child.id} value={child.id}>{child.name}</SelectItem>
                    ))}
                    {categories.filter((c) => c.parentId === parent.id).length === 0 && (
                      <SelectItem value={parent.id}>{parent.name}</SelectItem>
                    )}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </FormRow>

          <FormRow label="Department" required>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select a department</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>

          <FormRow label="Location" required>
            <Select value={locationId} onValueChange={setLocationId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>
        </section>

        {/* ── Tracking ── */}
        <section className="space-y-4">
          <SectionHeading>Tracking</SectionHeading>

          <FormRow label="QR code" required>
            <div className="flex gap-2">
              <Input
                value={qrCodeValue}
                onChange={(e) => setQrCodeValue(e.target.value)}
                placeholder="QR code value"
                required
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Generate QR code"
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

          <FormRow label="UW Asset Tag">
            <Input value={uwAssetTag} onChange={(e) => setUwAssetTag(e.target.value)} placeholder="Asset tag number" />
          </FormRow>
        </section>

        {/* ── Procurement ── */}
        <section className="space-y-4">
          <SectionHeading>Procurement</SectionHeading>

          <FormRow2Col label="Purchase">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} type="date" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Price</Label>
              <Input value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} type="number" min="0" step="0.01" placeholder="0.00" />
            </div>
          </FormRow2Col>

          <FormRow2Col label="Warranty">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input value={warrantyDate} onChange={(e) => setWarrantyDate(e.target.value)} type="date" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Residual value</Label>
              <Input value={residualValue} onChange={(e) => setResidualValue(e.target.value)} type="number" min="0" step="0.01" placeholder="0" />
            </div>
          </FormRow2Col>

          <FormRow label="Fiscal year">
            <Select value={fiscalYear} onValueChange={setFiscalYear}>
              <SelectTrigger>
                <SelectValue placeholder="Select fiscal year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {FISCAL_YEARS.map((fy) => (
                  <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>

          <FormRow label="Link">
            <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} type="url" placeholder="https://..." />
          </FormRow>
        </section>

        {/* ── Settings ── */}
        <section className="space-y-4">
          <SectionHeading>Settings</SectionHeading>

          <div className="space-y-3">
            {/* Accessory toggle */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-medium">Item is an accessory</Label>
                <p className="text-xs text-muted-foreground">Attach to a parent item (e.g. lens → camera body)</p>
              </div>
              <Switch
                checked={isAccessory}
                onCheckedChange={(v) => {
                  setIsAccessory(v);
                  if (!v) {
                    setParentAsset(null);
                    parentSearch.clear();
                  }
                }}
              />
            </div>

            {/* Parent asset search */}
            {isAccessory && (
              <div className="pl-0 space-y-2">
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
                      onClick={() => { setParentAsset(null); parentSearch.clear(); }}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      value={parentSearch.query}
                      onChange={(e) => parentSearch.setQuery(e.target.value)}
                      placeholder="Search parent item by tag, brand, or model..."
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
                  Accessories are not available for independent booking.
                </p>
              </div>
            )}

            {/* Booking availability */}
            {!isAccessory && (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm font-medium">Available for booking</Label>
                  <p className="text-xs text-muted-foreground">Item can be reserved and checked out</p>
                </div>
                <Switch checked={availableForBooking} onCheckedChange={setAvailableForBooking} />
              </div>
            )}
          </div>
        </section>
      </>
    );
  }
);
