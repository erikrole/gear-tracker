"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import type { BulkSkuDetail } from "./types";

export default function BulkSkuSettingsTab({
  sku,
  onRefresh,
}: {
  sku: BulkSkuDetail;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function toggleActive() {
    setBusy(true);
    try {
      const res = await fetch(`/api/bulk-skus/${sku.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !sku.active }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) { toast.error(await parseErrorMessage(res, "Failed to update")); return; }
      toast.success(sku.active ? "SKU archived" : "SKU unarchived");
      onRefresh();
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/bulk-skus/${sku.id}`, { method: "DELETE" });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        toast.error(await parseErrorMessage(res, "Cannot delete this SKU"));
        setConfirmDelete(false);
        return;
      }
      toast.success(`${sku.name} deleted`);
      router.push("/items");
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3.5 max-w-xl space-y-4">
      {/* Archive toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Active</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Archived SKUs are hidden from booking flows but retain history.
              </p>
            </div>
            <Switch checked={sku.active} onCheckedChange={toggleActive} disabled={busy} />
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          {!confirmDelete ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Delete SKU</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Permanently removes this SKU. Cannot be undone. Blocked if booking history exists.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                Delete
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-destructive">
                Delete &ldquo;{sku.name}&rdquo;? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={handleDelete} disabled={busy}>
                  {busy ? "Deleting…" : "Yes, delete permanently"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
