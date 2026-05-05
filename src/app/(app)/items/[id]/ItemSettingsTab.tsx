"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import type { AssetDetail } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import {
  getAttachmentKind,
  getSdCardSlotLabel,
  groupAttachments,
} from "@/lib/asset-attachments";

/* ── Attachments Section ────────────────────────────────── */

export function AccessoriesSection({
  asset, canEdit, onRefresh,
}: {
  asset: AssetDetail;
  canEdit: boolean;
  onRefresh: () => void;
}) {
  const confirmDialog = useConfirm();
  const [attaching, setAttaching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; assetTag: string; brand: string; model: string }>>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up debounce timeout on unmount
  useEffect(() => () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); }, []);

  // Is this item itself an attachment? If so, don't show the attach section.
  const isChild = !!asset.parentAsset;
  const attachments = asset.accessories ?? [];
  const attachmentGroups = groupAttachments(attachments);

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
          // Filter out self, current attachments, and items that are already children
          const existing = new Set([asset.id, ...attachments.map((a) => a.id)]);
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
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success("Attachment added");
        setAttaching(false);
        setSearchQuery("");
        setSearchResults([]);
        onRefresh();
      } else {
        const msg = await parseErrorMessage(res, "Failed to attach");
        toast.error(msg);
      }
    } catch {
      toast.error("Network error");
    }
  }

  async function detachAccessory(childId: string, childTag: string) {
    const ok = await confirmDialog({
      title: "Detach item",
      message: `Detach ${childTag} from this item? It will become a standalone item again.`,
      confirmLabel: "Detach",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/assets/${childId}/accessories`, { method: "DELETE" });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success("Attachment detached");
        onRefresh();
      } else {
        const msg = await parseErrorMessage(res, "Failed to detach");
        toast.error(msg);
      }
    } catch {
      toast.error("Network error");
    }
  }

  // For items that are themselves attachments, show parent info
  if (isChild) {
    const slotLabel = getSdCardSlotLabel(asset, asset.parentAsset?.assetTag);
    return (
      <div className="mt-3.5 max-w-2xl">
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <Empty className="py-6 border-0">
              <EmptyDescription>
                This item is attached to{" "}
                <Link href={`/items/${asset.parentAsset!.id}`} className="text-primary hover:underline font-mono font-medium">
                  {asset.parentAsset!.assetTag}
                </Link>
                {slotLabel ? ` as ${slotLabel}` : ""}. It cannot have its own attachments.
              </EmptyDescription>
            </Empty>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-3.5 max-w-2xl">
      <Card className="border-border/40">
        <CardHeader>
          <CardTitle>Attachments{attachments.length > 0 ? ` (${attachments.length})` : ""}</CardTitle>
          {canEdit && !attaching && (
            <Button variant="outline" size="sm" onClick={() => setAttaching(true)}>
              Add attachment
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

          {attachments.length === 0 && !attaching && (
            <Empty className="py-6 border-0">
              <EmptyDescription>No attachments tied to this item.</EmptyDescription>
            </Empty>
          )}

          {attachments.length > 0 && (
            <div className="space-y-5">
              {attachmentGroups.map((group) => (
                <section key={group.key} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{group.label}</h3>
                    <Badge variant={group.key === "sd-card" ? "blue" : group.key === "camera-rig" ? "purple" : "gray"} size="sm">
                      {group.items.length}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{group.description}</p>
                  <div className="divide-y divide-border/30">
                    {group.items.map((acc) => {
                      const slotLabel = getSdCardSlotLabel(acc, asset.assetTag);
                      const kind = getAttachmentKind(acc);
                      return (
                        <div key={acc.id} className="flex justify-between items-center gap-3 py-2.5 min-h-[44px]">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <Link href={`/items/${acc.id}`} className="font-mono text-sm font-medium hover:underline">
                                {acc.assetTag}
                              </Link>
                              {slotLabel && (
                                <Badge variant="blue" size="sm">{slotLabel}</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground truncate">
                              {[acc.name, acc.brand, acc.model].filter(Boolean).join(" ") || acc.type}
                              {kind === "sd-card" ? " · not individually checked out" : ""}
                            </div>
                          </div>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => detachAccessory(acc.id, acc.assetTag)}
                              title="Detach item"
                              className="shrink-0"
                            >
                              Detach
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
