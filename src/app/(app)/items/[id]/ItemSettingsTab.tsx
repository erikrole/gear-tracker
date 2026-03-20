"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import type { AssetDetail } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Empty, EmptyDescription } from "@/components/ui/empty";

/* ── Settings Tab ───────────────────────────────────────── */

export function SettingsTab({ asset, canEdit, onRefresh }: { asset: AssetDetail; canEdit: boolean; onRefresh: () => void }) {
  const [saving, setSaving] = useState(false);

  async function toggleSetting(field: string, currentValue: boolean) {
    setSaving(true);
    await fetch(`/api/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !currentValue }),
    });
    setSaving(false);
    onRefresh();
  }

  const toggles = [
    { field: "availableForReservation", label: "Available for reservation", value: asset.availableForReservation, help: "When enabled, this item can be included in reservations." },
    { field: "availableForCheckout", label: "Available for check out", value: asset.availableForCheckout, help: "When enabled, this item can be checked out to users." },
    { field: "availableForCustody", label: "Available for custody", value: asset.availableForCustody, help: "When enabled, this item can be taken into custody by a user." },
  ];

  return (
    <Card className="mt-14">
      <CardHeader><CardTitle>Policy Settings</CardTitle></CardHeader>
      <CardContent className="p-16">
        <p className="text-sm text-muted-foreground mb-4 m-0">
          These settings control whether this item is eligible for certain operations. They do not reflect the current real-time status.
        </p>
        {toggles.map((t) => (
          <div key={t.field} className="flex items-start gap-3 mb-4">
            <Switch
              checked={t.value}
              onCheckedChange={() => canEdit && toggleSetting(t.field, t.value)}
              disabled={saving || !canEdit}
              className="mt-0.5"
            />
            <div>
              <Label className="text-sm font-medium">{t.label}</Label>
              <p className="text-xs text-muted-foreground mt-0.5 m-0">{t.help}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ── Accessories Section ────────────────────────────────── */

export function AccessoriesSection({
  asset, canEdit, onRefresh,
}: {
  asset: AssetDetail;
  canEdit: boolean;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const confirmDialog = useConfirm();
  const [attaching, setAttaching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; assetTag: string; brand: string; model: string }>>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Is this item itself an accessory? If so, don't show the attach section.
  const isChild = !!asset.parentAsset;
  const accessories = asset.accessories ?? [];

  function handleSearch(q: string) {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/assets?q=${encodeURIComponent(q.trim())}&limit=10&show_accessories=true`);
        if (res.ok) {
          const json = await res.json();
          // Filter out self, current accessories, and items that are already children
          const existing = new Set([asset.id, ...accessories.map((a) => a.id)]);
          setSearchResults(
            (json.data || [])
              .filter((a: { id: string; parentAssetId?: string | null }) => !existing.has(a.id) && !a.parentAssetId)
              .slice(0, 5)
              .map((a: { id: string; assetTag: string; brand: string; model: string }) => ({
                id: a.id, assetTag: a.assetTag, brand: a.brand, model: a.model,
              }))
          );
        }
      } catch { /* ignore */ }
      setSearching(false);
    }, 300);
  }

  async function attachAccessory(childId: string) {
    try {
      const res = await fetch(`/api/assets/${asset.id}/accessories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childAssetId: childId }),
      });
      if (res.ok) {
        toast("Accessory attached", "success");
        setAttaching(false);
        setSearchQuery("");
        setSearchResults([]);
        onRefresh();
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Failed to attach", "error");
      }
    } catch {
      toast("Network error", "error");
    }
  }

  async function detachAccessory(childId: string, childTag: string) {
    const ok = await confirmDialog({
      title: "Detach accessory",
      message: `Detach ${childTag} from this item? It will become a standalone item again.`,
      confirmLabel: "Detach",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/assets/${childId}/accessories`, { method: "DELETE" });
      if (res.ok) {
        toast("Accessory detached", "success");
        onRefresh();
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Failed to detach", "error");
      }
    } catch {
      toast("Network error", "error");
    }
  }

  // Don't render for items that are themselves accessories
  if (isChild) return null;

  return (
    <Card className="mt-14">
      <CardHeader className="flex justify-between items-center">
        <CardTitle>Accessories{accessories.length > 0 ? ` (${accessories.length})` : ""}</CardTitle>
        {canEdit && !attaching && (
          <Button variant="outline" size="sm" onClick={() => setAttaching(true)}>
            + Attach
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-16">
        {attaching && (
          <div className="mb-16">
            <Input
              type="text"
              placeholder="Search by asset tag, brand, or model..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
            />
            {searching && <div className="text-sm text-muted-foreground mt-2">Searching...</div>}
            {searchResults.length > 0 && (
              <div className="mt-2 rounded-md border divide-y">
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 flex justify-between items-center text-sm transition-colors"
                    onClick={() => attachAccessory(r.id)}
                  >
                    <span className="font-mono font-medium">{r.assetTag}</span>
                    <span className="text-muted-foreground">{r.brand} {r.model}</span>
                  </button>
                ))}
              </div>
            )}
            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <div className="text-sm text-muted-foreground mt-2">No matching items found</div>
            )}
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { setAttaching(false); setSearchQuery(""); setSearchResults([]); }}>
              Cancel
            </Button>
          </div>
        )}

        {accessories.length === 0 && !attaching && (
          <Empty className="py-8 border-0">
            <EmptyDescription>No accessories attached to this item.</EmptyDescription>
          </Empty>
        )}

        {accessories.length > 0 && (
          <div className="data-list">
            {accessories.map((acc) => (
              <div key={acc.id} className="data-list-row flex justify-between items-center">
                <div>
                  <Link href={`/items/${acc.id}`} className="font-mono text-sm font-medium">
                    {acc.assetTag}
                  </Link>
                  <span className="text-sm text-muted-foreground ml-2">{acc.brand} {acc.model}</span>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => detachAccessory(acc.id, acc.assetTag)}
                    title="Detach accessory"
                  >
                    Detach
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
