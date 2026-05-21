"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { handleAuthRedirect, isAbortError, parseErrorMessage } from "@/lib/errors";
import type { AssetDetail } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import EmptyState from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Boxes, Link2, MemoryStick, Paperclip, Search, Unlink } from "lucide-react";
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
  const [searchError, setSearchError] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  // Clean up debounce timeout on unmount
  useEffect(() => () => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchAbortRef.current?.abort();
  }, []);

  // Is this item itself an attachment? If so, don't show the attach section.
  const isChild = !!asset.parentAsset;
  const attachments = asset.accessories ?? [];
  const attachmentGroups = groupAttachments(attachments);

  function handleSearch(q: string) {
    setSearchQuery(q);
    setSearchError("");
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchAbortRef.current?.abort();
    if (q.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      const controller = new AbortController();
      searchAbortRef.current = controller;
      setSearching(true);
      try {
        const res = await fetch(`/api/assets?q=${encodeURIComponent(q.trim())}&limit=10&show_accessories=true`, {
          signal: controller.signal,
        });
        if (handleAuthRedirect(res)) return;
        if (res.ok) {
          const json = await res.json();
          if (controller.signal.aborted) return;
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
        } else {
          setSearchResults([]);
          setSearchError("Search failed");
        }
      } catch (err) {
        if (!isAbortError(err)) {
          setSearchResults([]);
          setSearchError("Search failed");
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
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
      <div className="mt-3.5 max-w-3xl">
        <Card className="border-border/40 shadow-none">
          <CardHeader>
            <div>
              <CardTitle>Attachment Relationship</CardTitle>
              <CardDescription>This item travels with a parent item and cannot own attachments.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="rounded-md bg-muted/40 px-4 py-3 text-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Parent item</div>
              <div className="mt-1">
                <Link href={`/items/${asset.parentAsset!.id}`} className="text-primary hover:underline font-mono font-medium">
                  {asset.parentAsset!.assetTag}
                </Link>
                {slotLabel ? ` as ${slotLabel}` : ""}. It cannot have its own attachments.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-3.5 max-w-4xl space-y-3">
      <div className={attachments.length > 0 ? "grid gap-2 sm:grid-cols-3" : "grid gap-2 sm:grid-cols-2"}>
        <div className="rounded-md border border-border/40 bg-card px-3 py-2 shadow-none">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Paperclip className="size-3.5" aria-hidden="true" />
            Attached
          </div>
          <div className="mt-1 text-xl font-bold tabular-nums" style={{ fontFamily: "var(--font-heading)" }}>{attachments.length}</div>
        </div>
        <div className="rounded-md border border-border/40 bg-card px-3 py-2 shadow-none">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <MemoryStick className="size-3.5" aria-hidden="true" />
            SD Cards
          </div>
          <div className="mt-1 text-xl font-bold tabular-nums" style={{ fontFamily: "var(--font-heading)" }}>
            {attachmentGroups.find((group) => group.key === "sd-card")?.items.length ?? 0}
          </div>
        </div>
        {attachments.length > 0 && (
          <div className="rounded-md border border-border/40 bg-card px-3 py-2 shadow-none">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Boxes className="size-3.5" aria-hidden="true" />
              Attached Items
            </div>
            <div className="mt-1 text-sm font-medium">Travel with this item</div>
          </div>
        )}
      </div>

      <Card className="border-border/40 shadow-none">
        <CardHeader>
          <div>
            <CardTitle>Attachments{attachments.length > 0 ? ` (${attachments.length})` : ""}</CardTitle>
            <CardDescription>Items physically tied to this asset, such as SD cards, cages, and fixed rigging.</CardDescription>
          </div>
          {canEdit && !attaching && (
            <Button variant="outline" size="sm" className="active:scale-[0.96] transition-transform" onClick={() => setAttaching(true)}>
              <Link2 className="size-3.5" aria-hidden="true" />
              Add attachment
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {attaching && (
            <div className="mb-3 rounded-md border border-border/50 bg-muted/25 p-3">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search asset tag, brand, or model"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-8"
                  autoFocus
                />
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              </div>
              {searching && <div className="text-sm text-muted-foreground mt-2">Searching...</div>}
              {searchError && !searching && (
                <div className="text-sm text-destructive mt-2">{searchError}</div>
              )}
              {searchResults.length > 0 && (
                <div className="mt-2 rounded-md border divide-y">
                  {searchResults.map((r) => (
                    <button
                      key={r.id}
                      className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                      onClick={() => attachAccessory(r.id)}
                    >
                      <span className="font-mono font-medium">{r.assetTag}</span>
                      <span className="text-muted-foreground">{r.brand} {r.model}</span>
                    </button>
                  ))}
                </div>
              )}
              {searchQuery.length >= 2 && !searching && !searchError && searchResults.length === 0 && (
                <div className="text-sm text-muted-foreground mt-2">No matching items found</div>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 active:scale-[0.96] transition-transform"
                onClick={() => {
                  searchAbortRef.current?.abort();
                  setAttaching(false);
                  setSearchQuery("");
                  setSearchResults([]);
                  setSearchError("");
                }}
              >
                Cancel
              </Button>
            </div>
          )}

          {attachments.length === 0 && !attaching && (
            <EmptyState
              inline
              icon="box"
              title="No attached items"
              description="Add fixed accessories only when they should travel with this item instead of being checked out on their own."
              actionLabel={canEdit ? "Add attachment" : undefined}
              onAction={canEdit ? () => setAttaching(true) : undefined}
            />
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
                  <div className="overflow-hidden rounded-md border border-border/40 divide-y divide-border/30">
                    {group.items.map((acc) => {
                      const slotLabel = getSdCardSlotLabel(acc, asset.assetTag);
                      const kind = getAttachmentKind(acc);
                      return (
                        <div key={acc.id} className="flex min-h-14 items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-muted/35">
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
                              className="shrink-0 text-muted-foreground hover:text-destructive active:scale-[0.96] transition-[color,transform]"
                            >
                              <Unlink className="size-3.5" aria-hidden="true" />
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
