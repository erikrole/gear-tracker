"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCodeImage } from "@/components/QrCodeImage";
import { handleAuthRedirect, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
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
  const savingRef = useRef(false);

  async function handleSave() {
    if (!draft.trim() || draft === sku.binQrCodeValue) { setEditing(false); return; }
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const res = await fetch(`/api/bulk-skus/${sku.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ binQrCodeValue: draft.trim() }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) { toast.error(await parseErrorMessage(res, "Failed to update QR value")); return; }
      const json = await parseJsonSafely<{ data?: Partial<BulkSkuDetail> }>(res);
      if (!json?.data) {
        toast.error("QR value updated, but the response was incomplete. Refresh and try again.");
        return;
      }
      onFieldSaved(json.data);
      toast.success("QR value updated");
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof TypeError ? "You’re offline. Check your connection." : "Failed to update QR value");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="mt-3.5 flex flex-col gap-4 max-w-2xl">
      {/* Item QR */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Item QR</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-start gap-6">
            <QrCodeImage value={sku.binQrCodeValue} size={160} />
            <div className="flex-1 flex flex-col gap-2">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Value</div>
                {editing ? (
                  <div className="flex items-center gap-2">
                    <Input
                      id="bulk-sku-qr-value"
                      name="binQrCodeValue"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="font-mono text-sm"
                      autoFocus
                      disabled={saving}
                    />
                    <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                    <Button size="sm" variant="outline" onClick={() => { setDraft(sku.binQrCodeValue); setEditing(false); }} disabled={saving}>Cancel</Button>
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

      {/* Per-unit QR codes */}
      {sku.trackByNumber && sku.units.length > 0 && (
        <Card>
          <CardHeader>
          <CardTitle className="text-sm font-semibold">Unit QR</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-4">
              Each unit QR uses this item&apos;s QR code plus the unit number: <code className="bg-muted px-1 py-0.5 rounded text-xs">{sku.binQrCodeValue}-&#123;unit#&#125;</code>.
            </p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-4 print:grid-cols-3 print:gap-2">
              {sku.units.slice(0, 50).map((u) => (
                <div
                  key={u.id}
                  className="flex flex-col items-center gap-1.5 rounded-md border border-border/60 bg-background p-2 print:break-inside-avoid print:border-black print:p-1.5"
                >
                  <div className="text-3xl font-black leading-none tabular-nums text-foreground print:text-black">
                    {u.unitNumber}
                  </div>
                  <QrCodeImage value={`${sku.binQrCodeValue}-${u.unitNumber}`} size={92} />
                  <span className="text-[10px] text-muted-foreground font-mono print:text-black">
                    {sku.name}
                  </span>
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
