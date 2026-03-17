"use client";

import { formatDateTime } from "@/lib/format";
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
    <>
      {/* Conflict error */}
      {conflictError?.conflicts && conflictError.conflicts.length > 0 && (
        <div className="sheet-section sheet-section-no-pb">
          <div className="conflict-error">
            <strong>Scheduling conflict</strong>
            {conflictError.conflicts.map((c, i) => (
              <div key={i}>
                {c.conflictingBookingTitle ? `"${c.conflictingBookingTitle}"` : "Another booking"}{" "}
                ({formatDateTime(c.startsAt)} {"\u2013"} {formatDateTime(c.endsAt)})
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current serialized items */}
      {editSerializedIds.length > 0 && (
        <div className="sheet-section">
          <div className="sheet-section-title">
            Serialized Items ({editSerializedIds.length})
          </div>
          {editSerializedIds.map((assetId) => (
            <div
              key={assetId}
              className="equip-edit-row"
            >
              <span className="equip-edit-name">
                {resolveAssetName(assetId)}
              </span>
              <button
                className="btn btn-sm btn-danger-outline"
                onClick={() => onRemoveSerializedItem(assetId)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Current bulk items with qty steppers */}
      {editBulkItems.length > 0 && (
        <div className="sheet-section">
          <div className="sheet-section-title">
            Bulk Items ({editBulkItems.length})
          </div>
          {editBulkItems.map((item) => (
            <div
              key={item.bulkSkuId}
              className="equip-edit-row"
            >
              <span className="equip-edit-name-flex">
                {resolveSkuName(item.bulkSkuId)}
              </span>
              <div className="qty-stepper">
                <button onClick={() => onUpdateBulkQty(item.bulkSkuId, item.quantity - 1)}>
                  &minus;
                </button>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => onUpdateBulkQty(item.bulkSkuId, parseInt(e.target.value) || 1)}
                />
                <button onClick={() => onUpdateBulkQty(item.bulkSkuId, item.quantity + 1)}>
                  +
                </button>
              </div>
              <button
                className="btn btn-sm btn-danger-outline"
                onClick={() => onRemoveBulkItem(item.bulkSkuId)}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add items picker */}
      <div className="sheet-section">
        {!addingItems ? (
          <button
            className="btn btn-full"
            onClick={() => { onSetAddingItems(true); onSetPickerSearch(""); }}
          >
            + Add items
          </button>
        ) : (
          <div>
            <div className="picker-tabs">
              <button
                className={`filter-chip ${pickerTab === "serialized" ? "active" : ""}`}
                onClick={() => onSetPickerTab("serialized")}
              >
                Assets
              </button>
              <button
                className={`filter-chip ${pickerTab === "bulk" ? "active" : ""}`}
                onClick={() => onSetPickerTab("bulk")}
              >
                Bulk items
              </button>
            </div>
            <input
              placeholder={pickerTab === "serialized" ? "Search by tag, brand, model..." : "Search bulk items..."}
              value={pickerSearch}
              onChange={(e) => onSetPickerSearch(e.target.value)}
              className="picker-search"
              autoFocus
            />
            <div className="equip-picker-list">
              {pickerTab === "serialized" ? (
                pickerAssets.length === 0 ? (
                  <div className="empty-message">
                    {pickerSearch ? "No matching assets" : "No available assets"}
                  </div>
                ) : (
                  pickerAssets.slice(0, 50).map((asset) => (
                    <div
                      key={asset.id}
                      className="equip-picker-item"
                      onClick={() => onAddSerializedItem(asset.id)}
                    >
                      <div>
                        <div className="picker-item-name">{asset.assetTag}</div>
                        <div className="equip-picker-meta">{asset.brand} {asset.model}</div>
                      </div>
                    </div>
                  ))
                )
              ) : (
                pickerBulkSkus.length === 0 ? (
                  <div className="empty-message">
                    {pickerSearch ? "No matching bulk items" : "No available bulk items"}
                  </div>
                ) : (
                  pickerBulkSkus.slice(0, 50).map((sku) => (
                    <div
                      key={sku.id}
                      className="equip-picker-item"
                      onClick={() => onAddBulkItem(sku.id)}
                    >
                      <div>
                        <div className="picker-item-name">{sku.name}</div>
                        <div className="equip-picker-meta">{sku.category} {"\u00b7"} {sku.unit}</div>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
            <button
              className="btn btn-sm btn-mt"
              onClick={() => onSetAddingItems(false)}
            >
              Done adding
            </button>
          </div>
        )}
      </div>

      {/* Save / Cancel equip edit */}
      <div className="sheet-section">
        <div className="action-row">
          <button
            className="btn btn-primary"
            disabled={equipSaving}
            onClick={onSave}
          >
            {equipSaving ? "Saving..." : "Save equipment"}
          </button>
          <button
            className="btn"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
