"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { AssetImage } from "@/components/AssetImage";
import { CheckCircle2, Search } from "lucide-react";
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
  const totalItems = (booking.serializedItems?.length ?? 0) + (booking.bulkItems?.length ?? 0);
  const showSearch = totalItems >= 4;

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar + edit button */}
      <div className="flex items-center gap-2">
        {showSearch && (
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search equipment..."
              value={equipSearch}
              onChange={(e) => onEquipSearchChange(e.target.value)}
              className="h-8 pl-8"
            />
          </div>
        )}
        {!showSearch && <div className="flex-1" />}
        {canEditEquipment && (
          <Button variant="outline" size="sm" onClick={onEnterEquipEditMode}>
            Edit
          </Button>
        )}
      </div>

      {/* Serialized items */}
      {filteredSerializedItems.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Serialized Items
          </div>
          <Card elevation="flat">
            <CardContent className="p-0 divide-y divide-border/40">
              {filteredSerializedItems.map((item) => {
                const isReturned = item.allocationStatus === "returned";
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-3 py-2.5 ${isReturned ? "opacity-50" : ""}`}
                  >
                    <AssetImage src={item.asset.imageUrl} alt={item.asset.assetTag} size={36} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/items/${item.asset.id}`}
                        className="text-sm font-semibold text-foreground no-underline hover:text-[var(--wi-red)] transition-colors truncate block"
                      >
                        {item.asset.assetTag}
                      </Link>
                      <div className="text-xs text-muted-foreground truncate">
                        {item.asset.brand} {item.asset.model}
                        {item.asset.serialNumber && ` · ${item.asset.serialNumber}`}
                      </div>
                    </div>
                    {canCheckin && (
                      <div className="shrink-0">
                        {isReturned ? (
                          <CheckCircle2 className="size-4 text-green-600" />
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
                      </div>
                    )}
                    {!canCheckin && isReturned && (
                      <CheckCircle2 className="size-4 text-green-600 shrink-0" />
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bulk items */}
      {filteredBulkItems.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Bulk Items
          </div>
          <Card elevation="flat">
            <CardContent className="p-0 divide-y divide-border/40">
              {filteredBulkItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                  <AssetImage src={item.bulkSku.imageUrl} alt={item.bulkSku.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{item.bulkSku.name}</div>
                    <div className="text-xs text-muted-foreground">{item.bulkSku.category}</div>
                  </div>
                  <Badge variant="secondary" size="sm" className="shrink-0">
                    {item.plannedQuantity} {item.bulkSku.unit}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty state */}
      {filteredSerializedItems.length === 0 && filteredBulkItems.length === 0 && (
        <Empty className="py-10 border-0">
          <EmptyDescription>
            {equipSearch ? "No items match your search" : "No equipment in this booking"}
          </EmptyDescription>
        </Empty>
      )}
    </div>
  );
}
