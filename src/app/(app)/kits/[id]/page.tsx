"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useBreadcrumbLabel } from "@/components/BreadcrumbContext";
import { toast } from "sonner";
import {
  BoxIcon,
  PlusIcon,
  Trash2Icon,
  SearchIcon,
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowLeftIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import EmptyState from "@/components/EmptyState";
import { FadeUp } from "@/components/ui/motion";
import { SaveableField, useSaveField } from "@/components/SaveableField";
import { handleAuthRedirect } from "@/lib/errors";
import { useFetch } from "@/hooks/use-fetch";
import { classifyAssetType, EQUIPMENT_SECTIONS } from "@/lib/equipment-sections";
import type { EquipmentSectionKey } from "@/lib/equipment-sections";

// ── Types ─────────────────────────────────────────────────

type KitMember = {
  id: string; // membership id
  createdAt: string;
  asset: {
    id: string;
    assetTag: string;
    name: string | null;
    type: string;
    brand: string;
    model: string;
    status: string;
    imageUrl: string | null;
    category: { id: string; name: string } | null;
  };
};

type KitBulkMember = {
  id: string;
  quantity: number;
  bulkSku: {
    id: string;
    name: string;
    category: string;
    unit: string;
    imageUrl: string | null;
  };
};

type KitDetail = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  location: { id: string; name: string };
  members: KitMember[];
  bulkMembers: KitBulkMember[];
};

type SearchResult = {
  id: string;
  assetTag: string;
  name: string | null;
  brand: string;
  model: string;
  type: string;
  imageUrl: string | null;
};

// ── Component ─────────────────────────────────────────────

export default function KitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { setBreadcrumbLabel } = useBreadcrumbLabel();
  const queryClient = useQueryClient();

  const kitUrl = `/api/kits/${id}`;
  const { data: kit, loading, error: loadError, reload: reloadKit } = useFetch<KitDetail>({
    url: kitUrl,
    transform: (json) => (json as any).data as KitDetail,
  });

  // Set breadcrumb label when kit loads
  useEffect(() => {
    if (kit?.name) setBreadcrumbLabel(kit.name);
  }, [kit?.name, setBreadcrumbLabel]);

  // Helper to optimistically update kit in the React Query cache
  const setKit = useCallback(
    (updater: KitDetail | ((prev: KitDetail | null) => KitDetail | null)) => {
      queryClient.setQueryData(["fetch", kitUrl], (prev: Record<string, unknown> | undefined) => {
        const prevKit = prev ? (prev as any).data as KitDetail : null;
        const next = typeof updater === "function" ? updater(prevKit) : updater;
        return next ? { data: next } : prev;
      });
    },
    [queryClient, kitUrl],
  );

  // Add member search
  const [addSearch, setAddSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const searchAbort = useRef<AbortController | null>(null);

  // Remove member
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<KitMember | null>(null);

  // Delete kit
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Inline save handlers ────────────────────────────────

  const saveName = useSaveField(
    useCallback(async (value: string) => {
      const res = await fetch(`/api/kits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to save");
      }
      const { data } = await res.json();
      setKit(data);
    }, [id])
  );

  const saveDescription = useSaveField(
    useCallback(async (value: string) => {
      const res = await fetch(`/api/kits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: value || null }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) throw new Error("Failed to save");
      const { data } = await res.json();
      setKit(data);
    }, [id])
  );

  // ── Search for assets to add ────────────────────────────

  useEffect(() => {
    if (!addSearch.trim() || addSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      searchAbort.current?.abort();
      const controller = new AbortController();
      searchAbort.current = controller;
      setSearching(true);
      try {
        const res = await fetch(
          `/api/assets?q=${encodeURIComponent(addSearch.trim())}&limit=10`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (controller.signal.aborted) return;
        // Filter out assets already in kit
        const existingIds = new Set(kit?.members.map((m) => m.asset.id) ?? []);
        setSearchResults(
          (json.data ?? []).filter((a: SearchResult) => !existingIds.has(a.id))
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [addSearch, kit?.members]);

  // ── Add member ──────────────────────────────────────────

  async function handleAddMember(assetId: string) {
    setAddingIds((s) => new Set(s).add(assetId));
    try {
      const res = await fetch(`/api/kits/${id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetIds: [assetId] }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to add item");
      }
      const { data } = await res.json();
      setKit(data);
      setSearchResults((r) => r.filter((a) => a.id !== assetId));
      toast.success("Item added to kit");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAddingIds((s) => { const n = new Set(s); n.delete(assetId); return n; });
    }
  }

  // ── Remove member ───────────────────────────────────────

  async function handleRemoveMember(member: KitMember) {
    setRemovingId(member.id);
    try {
      const res = await fetch(`/api/kits/${id}/members/${member.id}`, { method: "DELETE" });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) throw new Error("Failed to remove item");
      setKit((prev) =>
        prev ? { ...prev, members: prev.members.filter((m) => m.id !== member.id) } : prev
      );
      toast.success(`Removed ${member.asset.assetTag}`);
    } catch {
      toast.error("Failed to remove item");
    } finally {
      setRemovingId(null);
      setRemoveTarget(null);
    }
  }

  // ── Archive / Restore ───────────────────────────────────

  async function handleToggleActive() {
    if (!kit) return;
    try {
      const res = await fetch(`/api/kits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !kit.active }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) throw new Error("Failed to update");
      const { data } = await res.json();
      setKit(data);
      toast.success(data.active ? "Kit restored" : "Kit archived");
    } catch {
      toast.error("Failed to update kit");
    }
  }

  // ── Delete kit ──────────────────────────────────────────

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/kits/${id}`, { method: "DELETE" });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Kit deleted");
      router.replace("/kits");
    } catch {
      toast.error("Failed to delete kit");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  // ── Group members by section ────────────────────────────

  const groupedMembers = kit
    ? groupMembersBySection(kit.members)
    : null;

  // ── Loading state ───────────────────────────────────────

  if (loading) {
    return (
      <>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-8">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4">
          <Card className="flex flex-col gap-4 p-6">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-20 w-full" />
          </Card>
          <Card className="flex flex-col gap-3 p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </Card>
        </div>
      </>
    );
  }

  if (loadError || !kit) {
    return (
      <Card>
        <EmptyState
          icon="wifi-off"
          title="Failed to load kit"
          description="Check your connection and try again."
          actionLabel="Back to Kits"
          actionHref="/kits"
        />
      </Card>
    );
  }

  return (
    <FadeUp>
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Back to kits" onClick={() => router.push("/kits")}>
            <ArrowLeftIcon className="size-4" />
          </Button>
          <BoxIcon className="size-5 text-muted-foreground" />
          <h1>{kit.name}</h1>
          {!kit.active && <Badge variant="outline">Archived</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleToggleActive}>
            {kit.active ? (
              <><ArchiveIcon className="mr-2 size-4" />Archive</>
            ) : (
              <><ArchiveRestoreIcon className="mr-2 size-4" />Restore</>
            )}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2Icon className="mr-2 size-4" />Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kit Info</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <SaveableField label="Name" status={saveName.status} htmlFor="kit-name">
              <Input
                id="kit-name"
                defaultValue={kit.name}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val && val !== kit.name) saveName.save(val);
                }}
              />
            </SaveableField>
            <SaveableField label="Description" status={saveDescription.status} htmlFor="kit-desc">
              <Input
                id="kit-desc"
                defaultValue={kit.description ?? ""}
                placeholder="Optional description"
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val !== (kit.description ?? "")) saveDescription.save(val);
                }}
              />
            </SaveableField>
            <SaveableField label="Location">
              <Badge variant="secondary">{kit.location.name}</Badge>
            </SaveableField>
            <SaveableField label="Created">
              <span className="text-sm">{new Date(kit.createdAt).toLocaleDateString()}</span>
            </SaveableField>
          </CardContent>
        </Card>

        {/* Members Card */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              Equipment ({kit.members.length} item{kit.members.length !== 1 ? "s" : ""})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Add member search */}
            <div className="flex flex-col gap-2">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search items to add…"
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  className="pl-9 pr-9"
                />
                {addSearch && (
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => { setAddSearch(""); setSearchResults([]); }}
                  >
                    <XIcon className="size-4" />
                  </button>
                )}
              </div>
              {searching && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
                  <Spinner className="size-3.5" /> Searching…
                </div>
              )}
              {searchResults.length > 0 && (
                <ScrollArea className="border rounded-md divide-y max-h-[240px]">
                  {searchResults.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between px-3 py-2 hover:bg-muted/50"
                    >
                      <div>
                        <span className="font-medium text-sm">{asset.assetTag}</span>
                        <span className="text-muted-foreground text-sm ml-2">
                          {asset.brand} {asset.model}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={addingIds.has(asset.id)}
                        onClick={() => handleAddMember(asset.id)}
                      >
                        {addingIds.has(asset.id) ? (
                          <Spinner className="size-3.5" />
                        ) : (
                          <><PlusIcon className="size-3.5 mr-1" />Add</>
                        )}
                      </Button>
                    </div>
                  ))}
                </ScrollArea>
              )}
              {addSearch.trim().length >= 2 && !searching && searchResults.length === 0 && (
                <p className="text-sm text-muted-foreground px-1">No matching items found.</p>
              )}
            </div>

            {/* Members grouped by section */}
            {kit.members.length === 0 ? (
              <EmptyState
                icon="box"
                title="No items in this kit"
                description="Search above to add equipment to this kit."
              />
            ) : (
              groupedMembers &&
              EQUIPMENT_SECTIONS.filter((s) => (groupedMembers[s.key]?.length ?? 0) > 0).map(
                (section) => (
                  <div key={section.key}>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">
                      {section.label} ({groupedMembers[section.key].length})
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tag</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[60px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupedMembers[section.key].map((member) => (
                          <TableRow key={member.id}>
                            <TableCell className="font-medium">
                              {member.asset.assetTag}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {member.asset.brand} {member.asset.model}
                            </TableCell>
                            <TableCell>
                              <AssetStatusBadge status={member.asset.status} />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                disabled={removingId === member.id}
                                onClick={() => setRemoveTarget(member)}
                              >
                                {removingId === member.id ? (
                                  <Spinner />
                                ) : (
                                  <Trash2Icon className="size-4" />
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              )
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bulk members section */}
      {(kit.bulkMembers?.length > 0 || kit.active) && (
        <div className="mt-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Bulk Items</CardTitle>
            </CardHeader>
            <CardContent>
              {kit.bulkMembers?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kit.bulkMembers.map((bm) => (
                      <TableRow key={bm.id}>
                        <TableCell className="font-medium">{bm.bulkSku.name}</TableCell>
                        <TableCell className="text-muted-foreground">{bm.bulkSku.category}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" size="sm">{bm.quantity} {bm.bulkSku.unit}</Badge>
                        </TableCell>
                        <TableCell>
                          {kit.active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={async () => {
                                try {
                                  await fetch(`/api/kits/${kit.id}/bulk-members?membershipId=${bm.id}`, { method: "DELETE" });
                                  setKit((prev) => prev ? { ...prev, bulkMembers: prev.bulkMembers.filter((m) => m.id !== bm.id) } : prev);
                                  toast.success("Bulk item removed from kit");
                                } catch {
                                  toast.error("Failed to remove bulk item");
                                }
                              }}
                            >
                              <Trash2Icon className="size-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No bulk items in this kit. Add batteries or consumables below.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Remove member confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={(v) => { if (!v) setRemoveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from kit?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{removeTarget?.asset.assetTag}</strong> from this kit?
              The item won&apos;t be deleted — just removed from the kit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeTarget && handleRemoveMember(removeTarget)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete kit confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete kit?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{kit.name}</strong> and remove all member
              associations. The items themselves won&apos;t be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Spinner data-icon="inline-start" />}
              Delete Kit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FadeUp>
  );
}

// ── Helpers ───────────────────────────────────────────────

function AssetStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    AVAILABLE: { label: "Available", variant: "default" },
    MAINTENANCE: { label: "Maintenance", variant: "outline" },
    RETIRED: { label: "Retired", variant: "secondary" },
  };
  const info = map[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

function groupMembersBySection(members: KitMember[]): Record<EquipmentSectionKey, KitMember[]> {
  const groups: Record<EquipmentSectionKey, KitMember[]> = {
    cameras: [],
    lenses: [],
    batteries: [],
    accessories: [],
    others: [],
  };
  for (const member of members) {
    const section = classifyAssetType(
      member.asset.type,
      member.asset.category?.name
    );
    groups[section].push(member);
  }
  return groups;
}
