"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, PlusIcon } from "lucide-react";
import EmptyState from "@/components/EmptyState";
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
  onUnitsAdded,
}: {
  sku: BulkSkuDetail;
  canEdit: boolean;
  onRefresh: () => void;
  onUnitsAdded?: (count: number) => void;
}) {
  const [addingUnits, setAddingUnits] = useState(false);
  const [addCount, setAddCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const addBusyRef = useRef(false);
  const statusBusyRef = useRef(new Set<string>());

  const units = sku.units ?? [];
  const available = units.filter((u) => u.status === "AVAILABLE").length;
  const checkedOut = units.filter((u) => u.status === "CHECKED_OUT").length;
  const lost = units.filter((u) => u.status === "LOST").length;
  const retired = units.filter((u) => u.status === "RETIRED").length;
  const printedLabels = units.filter((u) => !!u.labelPrintedAt).length;

  async function handleExportLabels() {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/bulk-skus/${sku.id}/units/labels?scope=unprinted`);
      if (handleAuthRedirect(res)) return;
      if (!res.ok) { toast.error(await parseErrorMessage(res, "Failed to build label CSV")); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `brother-labels-${sku.id}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Label CSV downloaded. Mark printed from Battery Ops.");
    } catch (err) {
      toast.error(err instanceof TypeError ? "You’re offline. Check your connection." : "Failed to export labels. Try again.");
    } finally {
      setExporting(false);
    }
  }

  async function handleStatusChange(unitNumber: number, newStatus: "AVAILABLE" | "LOST" | "RETIRED") {
    const key = `${unitNumber}:${newStatus}`;
    if (statusBusyRef.current.has(key)) return;
    statusBusyRef.current.add(key);
    try {
      const res = await fetch(`/api/bulk-skus/${sku.id}/units/${unitNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) { toast.error(await parseErrorMessage(res, "Failed to update unit")); return; }
      onRefresh();
    } catch (err) {
      toast.error(err instanceof TypeError ? "You’re offline. Check your connection." : "Failed to update unit. Try again.");
    } finally {
      statusBusyRef.current.delete(key);
    }
  }

  async function handleAddUnits() {
    if (addCount <= 0) return;
    if (addBusyRef.current) return;
    addBusyRef.current = true;
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
      onUnitsAdded?.(addCount);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof TypeError ? "You’re offline. Check your connection." : "Failed to add units. Try again.");
    } finally {
      addBusyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="mt-3.5 flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <CardTitle className="text-sm font-semibold">
              {units.length} units
            </CardTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {available > 0 && <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-[var(--green)]" />{available} available</span>}
              {checkedOut > 0 && <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-[var(--blue)]" />{checkedOut} out</span>}
              {lost > 0 && <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-destructive" />{lost} missing</span>}
              {retired > 0 && <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-muted-foreground" />{retired} retired</span>}
              {sku.trackByNumber && units.length > 0 && (
                <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-muted-foreground/60" />{printedLabels} labeled</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
          {sku.trackByNumber && units.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleExportLabels} disabled={exporting}>
              <Download className="size-3.5 mr-1" />
              {exporting ? "Exporting…" : "Brother CSV"}
            </Button>
          )}
          {canEdit && (
            addingUnits ? (
              <div className="flex items-center gap-2">
                <Input
                  id="bulk-sku-add-units-count"
                  name="addUnitsCount"
                  type="number" min={1} max={500} value={addCount}
                  onChange={(e) => setAddCount(Number(e.target.value))}
                  className="w-20"
                  disabled={busy}
                />
                <Button size="sm" onClick={handleAddUnits} disabled={busy}>{busy ? "Adding…" : "Add"}</Button>
                <Button size="sm" variant="outline" onClick={() => setAddingUnits(false)} disabled={busy}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setAddingUnits(true)}>
                <PlusIcon className="size-3.5 mr-1" />
                Add units
              </Button>
            )
          )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {units.length === 0 ? (
            <EmptyState
              inline
              icon="box"
              title="No units yet"
              description="Add units to track this item family individually."
              actionLabel={canEdit ? "Add units" : undefined}
              onAction={canEdit ? () => setAddingUnits(true) : undefined}
            />
          ) : (
            <>
              <BulkUnitGrid
                units={units}
                onStatusChange={handleStatusChange}
                disabled={!canEdit}
              />
              {canEdit && (
                <p className="text-xs text-muted-foreground mt-3">
                  Open a unit&apos;s menu to mark it available, missing, or retired. Checked-out units return through check-in.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
