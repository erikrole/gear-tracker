"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BulkUnitGrid } from "@/components/BulkUnitGrid";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import type { BulkSkuDetail } from "./types";

export default function BulkSkuUnitsTab({
  sku,
  canEdit,
  onRefresh,
}: {
  sku: BulkSkuDetail;
  canEdit: boolean;
  onRefresh: () => void;
}) {
  const [addingUnits, setAddingUnits] = useState(false);
  const [addCount, setAddCount] = useState(10);
  const [busy, setBusy] = useState(false);

  const units = sku.units ?? [];
  const available = units.filter((u) => u.status === "AVAILABLE").length;
  const checkedOut = units.filter((u) => u.status === "CHECKED_OUT").length;
  const lost = units.filter((u) => u.status === "LOST").length;
  const retired = units.filter((u) => u.status === "RETIRED").length;

  async function handleStatusChange(unitNumber: number, newStatus: "AVAILABLE" | "LOST" | "RETIRED") {
    try {
      const res = await fetch(`/api/bulk-skus/${sku.id}/units/${unitNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) { toast.error(await parseErrorMessage(res, "Failed to update unit")); return; }
      onRefresh();
    } catch {
      toast.error("Network error — try again");
    }
  }

  async function handleAddUnits() {
    if (addCount <= 0) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/bulk-skus/${sku.id}/units`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: addCount }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) { toast.error(await parseErrorMessage(res, "Failed to add units")); return; }
      toast.success(`Added ${addCount} units`);
      setAddingUnits(false);
      onRefresh();
    } catch {
      toast.error("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3.5 space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <CardTitle className="text-sm font-semibold">
              {units.length} units
            </CardTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {available > 0 && <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-[var(--green)]" />{available} available</span>}
              {checkedOut > 0 && <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-[var(--blue)]" />{checkedOut} out</span>}
              {lost > 0 && <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-destructive" />{lost} lost</span>}
              {retired > 0 && <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-muted-foreground" />{retired} retired</span>}
            </div>
          </div>
          {canEdit && (
            addingUnits ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={1} max={500} value={addCount}
                  onChange={(e) => setAddCount(Number(e.target.value))}
                  className="w-20"
                />
                <Button size="sm" onClick={handleAddUnits} disabled={busy}>{busy ? "Adding…" : "Add"}</Button>
                <Button size="sm" variant="outline" onClick={() => setAddingUnits(false)}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setAddingUnits(true)}>
                <PlusIcon className="size-3.5 mr-1" />
                Add units
              </Button>
            )
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {units.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No units yet. Add units to track them individually.</p>
          ) : (
            <>
              <BulkUnitGrid
                units={units}
                onStatusChange={handleStatusChange}
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground mt-3">Right-click a unit to change its status.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
