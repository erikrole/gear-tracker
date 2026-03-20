"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { BookingDetail, SerializedItem, BulkItem } from "./types";

type Props = {
  booking: BookingDetail;
  equipSearch: string;
  onEquipSearchChange: (v: string) => void;
  filteredSerializedItems: SerializedItem[];
  filteredBulkItems: BulkItem[];
  canEditEquipment: boolean;
  canCheckin: boolean;
  checkinLoading: boolean;
  onEnterEquipEditMode: () => void;
  onCheckinItem: (assetId: string) => void;
};

export default function BookingItems({
  booking,
  equipSearch,
  onEquipSearchChange,
  filteredSerializedItems,
  filteredBulkItems,
  canEditEquipment,
  canCheckin,
  checkinLoading,
  onEnterEquipEditMode,
  onCheckinItem,
}: Props) {
  return (
    <>
      <div className="sheet-section sheet-equip-bar">
        <input
          className="picker-search"
          placeholder="Search equipment..."
          value={equipSearch}
          onChange={(e) => onEquipSearchChange(e.target.value)}
          style={{ flex: 1 }}
        />
        {canEditEquipment && (
          <Button variant="outline" size="sm" onClick={onEnterEquipEditMode}>
            Edit
          </Button>
        )}
        {!canEditEquipment && booking.kind === "CHECKOUT" && (
          <span className="text-hint">
            View only
          </span>
        )}
      </div>

      {filteredSerializedItems.length > 0 && (
        <div className="sheet-section">
          <div className="sheet-section-title">Serialized Items</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Brand/Model</th>
                <th>Serial</th>
                {canCheckin && <th className="col-status">Status</th>}
              </tr>
            </thead>
            <tbody>
              {filteredSerializedItems.map((item) => (
                <tr key={item.id} className={item.allocationStatus === "returned" ? "returned-row" : undefined}>
                  <td className="cell-bold">
                    <Link href={`/items/${item.asset.id}`} className="row-link">{item.asset.assetTag}</Link>
                  </td>
                  <td>{item.asset.brand} {item.asset.model}</td>
                  <td className="cell-mono">{item.asset.serialNumber}</td>
                  {canCheckin && (
                    <td>
                      {item.allocationStatus === "returned" ? (
                        <span className="badge badge-purple badge-purple-sm">returned</span>
                      ) : (
                        <Button
                          variant="outline"
                          size="xs"
                          disabled={checkinLoading}
                          onClick={(e) => { e.stopPropagation(); onCheckinItem(item.asset.id); }}
                        >
                          Return
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filteredBulkItems.length > 0 && (
        <div className="sheet-section">
          <div className="sheet-section-title">Bulk Items</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {filteredBulkItems.map((item) => (
                <tr key={item.id}>
                  <td className="cell-bold">{item.bulkSku.name}</td>
                  <td>{item.bulkSku.category}</td>
                  <td>{item.plannedQuantity} {item.bulkSku.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(filteredSerializedItems.length === 0 && filteredBulkItems.length === 0) && (
        <div className="py-10 px-5 text-center text-muted-foreground">
          {equipSearch ? "No items match your search" : "No equipment in this booking"}
        </div>
      )}
    </>
  );
}
