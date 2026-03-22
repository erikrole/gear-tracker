"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";
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
    <div className="divide-y divide-border/30">
      {/* Search bar + edit button */}
      <div className="px-5 py-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search equipment..."
            value={equipSearch}
            onChange={(e) => onEquipSearchChange(e.target.value)}
            className="h-8 pl-8"
          />
        </div>
        {canEditEquipment && (
          <Button variant="outline" size="sm" onClick={onEnterEquipEditMode}>
            Edit
          </Button>
        )}
        {!canEditEquipment && booking.kind === "CHECKOUT" && (
          <span className="text-xs text-muted-foreground">View only</span>
        )}
      </div>

      {/* Serialized items table */}
      {filteredSerializedItems.length > 0 && (
        <div className="px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Serialized Items
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Brand/Model</TableHead>
                <TableHead>Serial</TableHead>
                {canCheckin && <TableHead className="w-[90px]">Status</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSerializedItems.map((item) => (
                <TableRow
                  key={item.id}
                  className={item.allocationStatus === "returned" ? "opacity-55" : undefined}
                >
                  <TableCell className="font-semibold">
                    <Link href={`/items/${item.asset.id}`} className="hover:underline hover:text-primary">
                      {item.asset.assetTag}
                    </Link>
                  </TableCell>
                  <TableCell>{item.asset.brand} {item.asset.model}</TableCell>
                  <TableCell className="font-mono text-xs">{item.asset.serialNumber}</TableCell>
                  {canCheckin && (
                    <TableCell>
                      {item.allocationStatus === "returned" ? (
                        <Badge variant="purple" size="sm">returned</Badge>
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
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Bulk items table */}
      {filteredBulkItems.length > 0 && (
        <div className="px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Bulk Items
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBulkItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-semibold">{item.bulkSku.name}</TableCell>
                  <TableCell>{item.bulkSku.category}</TableCell>
                  <TableCell>{item.plannedQuantity} {item.bulkSku.unit}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
