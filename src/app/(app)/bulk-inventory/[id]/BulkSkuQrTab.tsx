"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCodeImage } from "@/components/QrCodeImage";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import type { BulkSkuDetail } from "./types";

export default function BulkSkuQrTab({
  sku,
  canEdit,
  onFieldSaved,
}: {
  sku: BulkSkuDetail;
  canEdit: boolean;
  onFieldSaved: (partial: Partial<BulkSkuDetail>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(sku.binQrCodeValue);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!draft.trim() || draft === sku.binQrCodeValue) { setEditing(false); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/bulk-skus/${sku.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ binQrCodeValue: draft.trim() }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) { toast.error(await parseErrorMessage(res, "Failed to update QR value")); return; }
      const json = await res.json();
      onFieldSaved(json.data);
      toast.success("QR value updated");
      setEditing(false);
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3.5 space-y-4 max-w-2xl">
      {/* Bin QR */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Bin QR Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-6">
            <QrCodeImage value={sku.binQrCodeValue} size={160} />
            <div className="flex-1 space-y-2">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Value</div>
                {editing ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="font-mono text-sm"
                      autoFocus
                    />
                    <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                    <Button size="sm" variant="outline" onClick={() => { setDraft(sku.binQrCodeValue); setEditing(false); }}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{sku.binQrCodeValue}</span>
                    {canEdit && (
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditing(true)}>Edit</Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-unit QR codes (numbered SKUs only) */}
      {sku.trackByNumber && sku.units.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Unit QR Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-4">
              Each unit&apos;s QR value is derived as <code className="bg-muted px-1 py-0.5 rounded text-xs">{sku.binQrCodeValue}-&#123;unit#&#125;</code>.
            </p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4">
              {sku.units.slice(0, 50).map((u) => (
                <div key={u.id} className="flex flex-col items-center gap-1.5">
                  <QrCodeImage value={`${sku.binQrCodeValue}-${u.unitNumber}`} size={90} />
                  <span className="text-xs text-muted-foreground font-mono">#{u.unitNumber}</span>
                </div>
              ))}
              {sku.units.length > 50 && (
                <div className="flex items-center justify-center text-xs text-muted-foreground col-span-full">
                  Showing first 50 of {sku.units.length} units
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
