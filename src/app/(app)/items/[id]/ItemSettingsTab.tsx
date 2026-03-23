"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import type { AssetDetail } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";

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

  // Clean up debounce timeout on unmount
  useEffect(() => () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); }, []);

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
    <div className="mt-3.5 max-w-2xl">
      <Card className="border-border/40 shadow-none">
        <CardHeader>
          <CardTitle>Accessories{accessories.length > 0 ? ` (${accessories.length})` : ""}</CardTitle>
          {canEdit && !attaching && (
            <Button variant="outline" size="sm" onClick={() => setAttaching(true)}>
              Attach accessory
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {attaching && (
            <div className="mb-1">
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
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setAttaching(false); setSearchQuery(""); setSearchResults([]); }}>
                Cancel
              </Button>
            </div>
          )}

          {accessories.length === 0 && !attaching && (
            <Empty className="py-6 border-0">
              <EmptyDescription>No accessories attached to this item.</EmptyDescription>
            </Empty>
          )}

          {accessories.length > 0 && (
            <div className="divide-y divide-border/30">
              {accessories.map((acc) => (
                <div key={acc.id} className="flex justify-between items-center py-2.5 min-h-[44px]">
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
    </div>
  );
}
