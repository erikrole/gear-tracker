"use client";

import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Minus, Plus, Search, TriangleAlert, X } from "lucide-react";
import type { AvailableAsset, BulkSkuOption, ConflictData } from "./types";

type Props = {
  conflictError: ConflictData | null;
  editSerializedIds: string[];
  editBulkItems: { bulkSkuId: string; quantity: number }[];
  addingItems: boolean;
  pickerTab: "serialized" | "bulk";
  pickerSearch: string;
  pickerAssets: AvailableAsset[];
  pickerBulkSkus: BulkSkuOption[];
  equipSaving: boolean;
  resolveAssetName: (assetId: string) => string;
  resolveSkuName: (skuId: string) => string;
  resolveSkuMaxQty: (skuId: string) => number;
  onRemoveSerializedItem: (assetId: string) => void;
  onAddSerializedItem: (assetId: string) => void;
  onUpdateBulkQty: (skuId: string, qty: number) => void;
  onRemoveBulkItem: (skuId: string) => void;
  onAddBulkItem: (skuId: string) => void;
  onSetAddingItems: (v: boolean) => void;
  onSetPickerTab: (v: "serialized" | "bulk") => void;
  onSetPickerSearch: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

export default function BookingEquipmentEditor({
  conflictError,
  editSerializedIds,
  editBulkItems,
  addingItems,
  pickerTab,
  pickerSearch,
  pickerAssets,
  pickerBulkSkus,
  equipSaving,
  resolveAssetName,
  resolveSkuName,
  resolveSkuMaxQty,
  onRemoveSerializedItem,
  onAddSerializedItem,
  onUpdateBulkQty,
  onRemoveBulkItem,
  onAddBulkItem,
  onSetAddingItems,
  onSetPickerTab,
  onSetPickerSearch,
  onSave,
  onCancel,
}: Props) {
  return (
    <div className="divide-y divide-border/30">
      {/* Conflict error */}
      {conflictError?.conflicts && conflictError.conflicts.length > 0 && (
        <div className="px-5 pt-4">
          <Alert variant="destructive">
            <TriangleAlert className="size-4" />
            <AlertDescription>
              <strong className="block mb-1">Scheduling conflict</strong>
              {conflictError.conflicts.map((c, i) => (
                <div key={i} className="text-xs">
                  {c.conflictingBookingTitle ? `"${c.conflictingBookingTitle}"` : "Another booking"}{" "}
                  ({formatDateTime(c.startsAt)} {"\u2013"} {formatDateTime(c.endsAt)})
                </div>
              ))}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Current serialized items */}
      {editSerializedIds.length > 0 && (
        <div className="px-5 py-4 space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Serialized Items ({editSerializedIds.length})
          </div>
          {editSerializedIds.map((assetId) => (
            <div key={assetId} className="flex items-center justify-between py-1.5">
              <span className="text-sm truncate mr-3">{resolveAssetName(assetId)}</span>
              <Button variant="destructive" size="sm" onClick={() => onRemoveSerializedItem(assetId)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Current bulk items with qty steppers */}
      {editBulkItems.length > 0 && (
        <div className="px-5 py-4 space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Bulk Items ({editBulkItems.length})
          </div>
          {editBulkItems.map((item) => {
            const maxQty = resolveSkuMaxQty(item.bulkSkuId);
            return (
              <div key={item.bulkSkuId} className="flex items-center gap-2 py-1.5">
                <div className="flex-1 min-w-0">
                  <span className="text-sm truncate block">{resolveSkuName(item.bulkSkuId)}</span>
                  {maxQty < 100 && (
                    <span className="text-[10px] text-muted-foreground">{item.quantity}/{maxQty} available</span>
                  )}
                </div>
                <div className="inline-flex items-center rounded-md border border-border overflow-hidden">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-none border-r border-border"
                    aria-label={`Decrease quantity for ${resolveSkuName(item.bulkSkuId)}`}
                    disabled={item.quantity <= 1}
                    onClick={() => onUpdateBulkQty(item.bulkSkuId, Math.max(1, item.quantity - 1))}
                  >
                    <Minus className="size-3" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={maxQty}
                    value={item.quantity}
                    aria-label={`Quantity for ${resolveSkuName(item.bulkSkuId)}`}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || 1;
                      onUpdateBulkQty(item.bulkSkuId, Math.min(maxQty, Math.max(1, v)));
                    }}
                    className="h-8 w-12 rounded-none border-0 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-none border-l border-border"
                    aria-label={`Increase quantity for ${resolveSkuName(item.bulkSkuId)}`}
                    disabled={item.quantity >= maxQty}
                    onClick={() => onUpdateBulkQty(item.bulkSkuId, Math.min(maxQty, item.quantity + 1))}
                  >
                    <Plus className="size-3" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => onRemoveBulkItem(item.bulkSkuId)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add items picker */}
      <div className="px-5 py-4">
        {!addingItems ? (
          <Button
            className="w-full"
            onClick={() => { onSetAddingItems(true); onSetPickerSearch(""); }}
          >
            + Add items
          </Button>
        ) : (
          <div className="space-y-3">
            <ToggleGroup
              type="single"
              value={pickerTab}
              onValueChange={(v) => { if (v) onSetPickerTab(v as "serialized" | "bulk"); }}
              className="h-8"
            >
              <ToggleGroupItem value="serialized" className="h-7 text-xs px-3">
                Assets
              </ToggleGroupItem>
              <ToggleGroupItem value="bulk" className="h-7 text-xs px-3">
                Bulk items
              </ToggleGroupItem>
            </ToggleGroup>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder={pickerTab === "serialized" ? "Search by tag, brand, model..." : "Search bulk items..."}
                value={pickerSearch}
                onChange={(e) => onSetPickerSearch(e.target.value)}
                className="h-8 pl-8"
                autoFocus
              />
            </div>

            <div className="max-h-60 overflow-y-auto rounded-md border border-border">
              {pickerTab === "serialized" ? (
                pickerAssets.length === 0 ? (
                  <Empty className="py-6 border-0">
                    <EmptyDescription>
                      {pickerSearch ? "No matching assets" : "No available assets"}
                    </EmptyDescription>
                  </Empty>
                ) : (
                  pickerAssets.slice(0, 50).map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left border-b border-border/30 last:border-0 hover:bg-muted/50 transition-colors"
                      onClick={() => onAddSerializedItem(asset.id)}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{asset.assetTag}</div>
                        <div className="text-xs text-muted-foreground truncate">{asset.brand} {asset.model}</div>
                      </div>
                    </button>
                  ))
                )
              ) : (
                pickerBulkSkus.length === 0 ? (
                  <Empty className="py-6 border-0">
                    <EmptyDescription>
                      {pickerSearch ? "No matching bulk items" : "No available bulk items"}
                    </EmptyDescription>
                  </Empty>
                ) : (
                  pickerBulkSkus.slice(0, 50).map((sku) => (
                    <button
                      key={sku.id}
                      type="button"
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left border-b border-border/30 last:border-0 hover:bg-muted/50 transition-colors"
                      onClick={() => onAddBulkItem(sku.id)}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{sku.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{sku.category} {"\u00b7"} {sku.unit}</div>
                      </div>
                    </button>
                  ))
                )
              )}
            </div>

            <Button variant="outline" size="sm" onClick={() => onSetAddingItems(false)}>
              Done adding
            </Button>
          </div>
        )}
      </div>

      {/* Save / Cancel equip edit */}
      <div className="px-5 py-4 flex gap-2">
        <Button disabled={equipSaving} onClick={onSave}>
          {equipSaving ? "Saving..." : "Save equipment"}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
