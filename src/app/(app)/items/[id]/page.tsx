"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
const BookingDetailsSheet = dynamic(() => import("@/components/BookingDetailsSheet"), { ssr: false });
const ItemInsightsTab = dynamic(() => import("./ItemInsightsTab"), { ssr: false });
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PencilIcon, ImageIcon, Copy, Check } from "lucide-react";

import type { AssetDetail, CategoryOption } from "./types";
import ChooseImageModal from "@/components/ChooseImageModal";
import ItemInfoCard from "./ItemInfoTab";
import type { DepartmentOption } from "./ItemInfoTab";
import { OperationalOverview, BookingsTab, CalendarTab, SettingsTab } from "./ItemBookingsTab";
import ActivityFeed from "./ItemHistoryTab";
import { AccessoriesSection } from "./ItemSettingsTab";

/* ── Tab Definitions ──────────────────────────────────────── */

type TabKey = "info" | "bookings" | "calendar" | "insights" | "history" | "accessories" | "settings";

const tabDefs: Array<{ key: TabKey; label: string }> = [
  { key: "info", label: "Info" },
  { key: "bookings", label: "Bookings" },
  { key: "calendar", label: "Calendar" },
  { key: "insights", label: "Insights" },
  { key: "history", label: "History" },
  { key: "accessories", label: "Accessories" },
  { key: "settings", label: "Settings" },
];

/* ── Inline Editable Title ──────────────────────────────── */

function InlineTitle({
  value,
  canEdit,
  onSave,
  className,
  placeholder,
}: {
  value: string;
  canEdit: boolean;
  onSave: (v: string) => Promise<void>;
  className?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  async function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed || trimmed === value) { setDraft(value); return; }
    try { await onSave(trimmed); } catch { setDraft(value); }
  }

  if (!canEdit) {
    return <span className={className}>{value || placeholder}</span>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        className={`${className} bg-transparent border-none outline-none ring-1 ring-ring rounded px-1 -mx-1`}
      />
    );
  }

  return (
    <span
      className={`${className} cursor-pointer hover:bg-muted/60 rounded px-1 -mx-1 transition-colors`}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {value || <span className="text-muted-foreground">{placeholder}</span>}
    </span>
  );
}

/* ── Status Line ────────────────────────────────────────── */

function StatusLine({ asset }: { asset: AssetDetail }) {
  const s = asset.computedStatus;
  const b = asset.activeBooking;

  if (s === "AVAILABLE") {
    return <Badge variant="green">Available</Badge>;
  }
  if (s === "CHECKED_OUT" && b) {
    const href = `/checkouts/${b.id}`;
    if (b.status === "DRAFT") {
      return (
        <Badge variant="blue" asChild>
          <Link href={href} className="no-underline">Checking out</Link>
        </Badge>
      );
    }
    return (
      <Badge variant="blue" asChild>
        <Link href={href} className="no-underline">Checked out by {b.requesterName}</Link>
      </Badge>
    );
  }
  if (s === "RESERVED" && b) {
    return (
      <Badge variant="purple" asChild>
        <Link href={`/reservations/${b.id}`} className="no-underline">Reserved by {b.requesterName}</Link>
      </Badge>
    );
  }
  if (s === "MAINTENANCE") {
    return <Badge variant="orange">Needs Maintenance</Badge>;
  }
  if (s === "RETIRED") {
    return <Badge variant="gray">Retired</Badge>;
  }
  return <Badge variant="gray">{s}</Badge>;
}

/* ── Serial Number Badge ───────────────────────────────── */

function SerialBadge({ serialNumber }: { serialNumber: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(serialNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="font-mono cursor-pointer select-none gap-1.5"
            onClick={handleCopy}
          >
            <span className="text-muted-foreground uppercase text-[0.6rem] font-semibold tracking-wider">SN</span>
            {serialNumber}
            {copied ? (
              <Check className="size-3 text-green-600 dark:text-green-400" />
            ) : (
              <Copy className="size-3 text-muted-foreground" />
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied!" : "Click to copy serial number"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ── Actions Dropdown ───────────────────────────────────── */

function ActionsMenu({
  asset,
  onAction,
}: {
  asset: AssetDetail;
  onAction: (action: string) => void;
}) {
  const canDelete = !asset.hasBookingHistory;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onAction("duplicate")}>
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("maintenance")}>
          {asset.status === "MAINTENANCE" ? "Clear Maintenance" : "Needs Maintenance"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("retire")}>
          Retire
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={!canDelete}
          title={!canDelete ? "Item has booking history \u2014 use Retire instead" : "Permanently delete this item"}
          onSelect={() => onAction("delete")}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Main Page ──────────────────────────────────────────── */

export default function ItemDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmDialog = useConfirm();
  const { toast } = useToast();
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const initialTab = (searchParams.get("tab") as TabKey) || "info";
  const [activeTab, setActiveTab] = useState<TabKey>(
    tabDefs.some((t) => t.key === initialTab) ? initialTab : "info"
  );
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [fetchError, setFetchError] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const loadAsset = useCallback(() => {
    fetch(`/api/assets/${id}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((json) => { if (json?.data) setAsset(json.data); else setFetchError(true); })
      .catch(() => setFetchError(true));
  }, [id]);

  const loadCategories = useCallback(() => {
    fetch("/api/categories")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json) setCategories(json.data || []); })
      .catch(() => {});
  }, []);

  const loadDepartments = useCallback(() => {
    fetch("/api/departments")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json) setDepartments(json.data || []); })
      .catch(() => {});
  }, []);

  const loadLocations = useCallback(() => {
    fetch("/api/locations")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json) setLocations(json.data || []); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadAsset();
    fetch("/api/me")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json?.user?.role) setCurrentUserRole(json.user.role); })
      .catch(() => {});
    loadCategories();
    loadDepartments();
    loadLocations();
  }, [loadAsset, loadCategories, loadDepartments, loadLocations]);

  // Live countdown tick every 60 seconds + refresh on tab focus
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    function onVisibilityChange() {
      if (document.visibilityState === "visible") setNow(new Date());
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const canEdit = currentUserRole === "ADMIN" || currentUserRole === "STAFF";

  // URL-synced tab switching
  function switchTab(tab: TabKey) {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "info") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  }

  // Keyboard shortcuts: 1-6 to switch tabs
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= tabDefs.length) {
        e.preventDefault();
        switchTab(tabDefs[num - 1].key);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveHeaderField(field: string, value: string) {
    if (!asset) return;
    const body: Record<string, unknown> = { [field]: value || null };
    const res = await fetch(`/api/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Save failed");
    setAsset((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  const [actionBusy, setActionBusy] = useState(false);

  async function handleAction(action: string) {
    if (!asset || actionBusy) return;
    setActionBusy(true);
    try {
      if (action === "duplicate") {
        const res = await fetch(`/api/assets/${asset.id}/duplicate`, { method: "POST" });
        if (res.ok) {
          const json = await res.json();
          router.push(`/items/${json.data.id}`);
        } else {
          const json = await res.json().catch(() => ({}));
          toast((json as Record<string, string>).error || "Duplicate failed", "error");
        }
      } else if (action === "retire") {
        const ok = await confirmDialog({
          title: "Retire item",
          message: "Retire this item? It will no longer be available for bookings.",
          confirmLabel: "Retire",
          variant: "danger",
        });
        if (!ok) { setActionBusy(false); return; }
        const res = await fetch(`/api/assets/${asset.id}/retire`, { method: "POST" });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          toast((json as Record<string, string>).error || "Retire failed", "error");
        }
        loadAsset();
      } else if (action === "maintenance") {
        const res = await fetch(`/api/assets/${asset.id}/maintenance`, { method: "POST" });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          toast((json as Record<string, string>).error || "Action failed", "error");
        }
        loadAsset();
      } else if (action === "delete") {
        const ok = await confirmDialog({
          title: "Delete item",
          message: "Permanently delete this item? This cannot be undone.",
          confirmLabel: "Delete",
          variant: "danger",
        });
        if (!ok) { setActionBusy(false); return; }
        const res = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
        if (res.ok) {
          router.push("/items");
        } else {
          const json = await res.json().catch(() => ({}));
          toast((json as Record<string, string>).error || "Delete failed", "error");
        }
      }
    } catch {
      toast("Network error \u2014 please try again.", "error");
    }
    setActionBusy(false);
  }

  if (fetchError) {
    return <div className="py-10 px-5 text-center text-muted-foreground">Item not found or failed to load. <Link href="/items">Back to items</Link></div>;
  }

  if (!asset) {
    return (
      <div>
        {/* Header skeleton */}
        <div className="page-header mb-0">
          <div className="flex gap-16 items-center">
            <Skeleton className="size-[80px] rounded-lg shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        {/* Status badge skeleton */}
        <div className="mb-16 mt-8 flex gap-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        {/* Tabs skeleton */}
        <Skeleton className="h-9 w-full max-w-[500px] mb-14" />
        {/* Content skeleton */}
        <div className="details-grid mt-0">
          <Card className="details-card">
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <div className="space-y-0">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-3 border-b border-border/50"
                >
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-40" />
                </div>
              ))}
            </div>
          </Card>
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header mb-0">
        <div className="flex gap-16 items-center">
          {/* Hero image — larger square */}
          {asset.imageUrl ? (
            <button
              className={`asset-hero-image aspect-square ${canEdit ? "cursor-pointer" : "cursor-default"}`}
              style={{ width: 120, height: 120 }}
              onClick={() => canEdit && setImageModalOpen(true)}
              title={canEdit ? "Change image" : undefined}
            >
              <Image src={asset.imageUrl} alt={asset.assetTag} width={240} height={240} sizes="120px" className="aspect-square object-cover rounded-lg" unoptimized={!asset.imageUrl.includes(".public.blob.vercel-storage.com")} />
              {canEdit && (
                <div className="asset-hero-image-overlay">
                  <PencilIcon className="size-5" />
                </div>
              )}
            </button>
          ) : canEdit ? (
            <button className="asset-hero-image asset-hero-image-empty aspect-square" style={{ width: 120, height: 120 }} onClick={() => setImageModalOpen(true)} title="Add image">
              <ImageIcon className="size-8 text-[var(--text-tertiary)]" />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex gap-12 items-baseline">
              <InlineTitle
                value={asset.assetTag}
                canEdit={canEdit}
                onSave={(v) => saveHeaderField("assetTag", v)}
                className="text-2xl font-bold tracking-tight"
              />
              {asset.metadata?.uwAssetTag && (
                <span className="text-base text-secondary font-medium">
                  UW {asset.metadata.uwAssetTag}
                </span>
              )}
            </div>
            <InlineTitle
              value={asset.name || ""}
              canEdit={canEdit}
              onSave={(v) => saveHeaderField("name", v)}
              className="text-base text-secondary mt-2 block"
              placeholder="Add item name"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && <ActionsMenu asset={asset} onAction={handleAction} />}
          <Button variant={asset.availableForReservation ? "default" : "outline"} asChild>
            <Link href={`/reservations?newFor=${asset.id}`}>Reserve</Link>
          </Button>
          <Button variant={asset.computedStatus !== "CHECKED_OUT" && asset.availableForCheckout ? "default" : "outline"} asChild>
            <Link href={`/checkouts?newFor=${asset.id}`}>Check out</Link>
          </Button>
        </div>
      </div>

      {/* Properties strip — Notion-style inline badges below title */}
      <div className="mt-6 mb-6 flex items-center gap-2 flex-wrap">
        <StatusLine asset={asset} />
        {asset.location && <Badge variant="outline">{asset.location.name}</Badge>}
        {asset.category && <Badge variant="outline">{asset.category.name}</Badge>}
        {asset.department && <Badge variant="outline">{asset.department.name}</Badge>}
        {asset.serialNumber && <SerialBadge serialNumber={asset.serialNumber} />}
        {asset.updatedAt && (
          <span className="text-xs text-muted-foreground ml-auto">
            Updated {new Date(asset.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        )}
      </div>

      {/* Parent banner — shown when this item is an accessory */}
      {asset.parentAsset && (
        <div className="mb-4 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
          Accessory of{" "}
          <Link href={`/items/${asset.parentAsset.id}`} className="font-medium">
            {asset.parentAsset.assetTag}
          </Link>
          <span className="text-muted-foreground ml-2">{asset.parentAsset.brand} {asset.parentAsset.model}</span>
        </div>
      )}

      {/* Tabs — sticky on scroll */}
      <Tabs value={activeTab} onValueChange={(v) => switchTab(v as TabKey)}>
        <TabsList className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
          {tabDefs.map((tab, i) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {tab.label}
              <kbd className="ml-1 hidden sm:inline-block text-[10px] text-muted-foreground/50 font-mono">{i + 1}</kbd>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Info tab — dashboard layout */}
      {activeTab === "info" && (
        <>
          <div className="details-grid mt-14">
            <ItemInfoCard
              asset={asset}
              canEdit={canEdit}
              currentUserRole={currentUserRole}
              categories={categories}
              departments={departments}
              onFieldSaved={(partial) => setAsset((prev) => prev ? { ...prev, ...partial } : prev)}
              onRefresh={loadAsset}
              locations={locations}
              onCategoriesChanged={loadCategories}
              onDepartmentsChanged={loadDepartments}
            />
            <OperationalOverview asset={asset} now={now} canEdit={canEdit} onSelectBooking={setSelectedBookingId} onRefresh={loadAsset} />
          </div>
        </>
      )}

      {/* Bookings tab — merged checkouts + reservations */}
      {activeTab === "bookings" && (
        <BookingsTab
          history={asset.history}
          asset={asset}
          now={now}
          onSelectBooking={setSelectedBookingId}
        />
      )}

      {/* Calendar tab */}
      {activeTab === "calendar" && (
        <CalendarTab asset={asset} onSelectBooking={setSelectedBookingId} />
      )}

      {/* Insights tab — utilization dashboard */}
      {activeTab === "insights" && (
        <ItemInsightsTab assetId={asset.id} />
      )}

      {/* History tab — full activity feed from audit log */}
      {activeTab === "history" && (
        <Card className="mt-14 border-border/40 shadow-none max-w-3xl">
          <CardHeader><CardTitle>Activity Log</CardTitle></CardHeader>
          <CardContent className="p-4">
            <ActivityFeed assetId={asset.id} />
          </CardContent>
        </Card>
      )}

      {/* Accessories tab */}
      {activeTab === "accessories" && (
        <AccessoriesSection asset={asset} canEdit={canEdit} onRefresh={loadAsset} />
      )}

      {/* Settings tab */}
      {activeTab === "settings" && (
        <SettingsTab asset={asset} canEdit={canEdit} onRefresh={loadAsset} />
      )}

      <BookingDetailsSheet
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        onUpdated={loadAsset}
        currentUserRole={currentUserRole}
      />

      <ChooseImageModal
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        assetId={asset.id}
        currentImageUrl={asset.imageUrl}
        onImageChanged={(newUrl) => setAsset((prev) => prev ? { ...prev, imageUrl: newUrl } : prev)}
      />
    </>
  );
}
