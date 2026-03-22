"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
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
import { OperationalOverview, BookingKindTab, CalendarTab } from "./ItemBookingsTab";
import ActivityFeed from "./ItemHistoryTab";
import { AccessoriesSection } from "./ItemSettingsTab";

/* ── Tab Definitions ──────────────────────────────────────── */

type TabKey = "info" | "checkouts" | "reservations" | "calendar" | "insights" | "history";

const tabDefs: Array<{ key: TabKey; label: string }> = [
  { key: "info", label: "Info" },
  { key: "checkouts", label: "Checkouts" },
  { key: "reservations", label: "Reservations" },
  { key: "calendar", label: "Calendar" },
  { key: "insights", label: "Insights" },
  { key: "history", label: "History" },
];

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
            {copied ? (
              <Check className="size-3 text-green-600 dark:text-green-400" />
            ) : (
              <Copy className="size-3" />
            )}
            {serialNumber}
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
  const confirmDialog = useConfirm();
  const { toast } = useToast();
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("info");
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
          {/* Hero image — kept square */}
          {asset.imageUrl ? (
            <button
              className={`asset-hero-image aspect-square ${canEdit ? "cursor-pointer" : "cursor-default"}`}
              onClick={() => canEdit && setImageModalOpen(true)}
              title={canEdit ? "Change image" : undefined}
            >
              <Image src={asset.imageUrl} alt={asset.assetTag} width={200} height={200} sizes="100px" className="aspect-square object-cover rounded-lg" unoptimized={!asset.imageUrl.includes(".public.blob.vercel-storage.com")} />
              {canEdit && (
                <div className="asset-hero-image-overlay">
                  <PencilIcon className="size-5" />
                </div>
              )}
            </button>
          ) : canEdit ? (
            <button className="asset-hero-image asset-hero-image-empty aspect-square" onClick={() => setImageModalOpen(true)} title="Add image">
              <ImageIcon className="size-8 text-[var(--text-tertiary)]" />
            </button>
          ) : null}
          <div>
            <div className="flex gap-12 items-baseline">
              <h1 className="mb-0">{asset.assetTag}</h1>
              {asset.metadata?.uwAssetTag && (
                <span className="text-base text-secondary font-medium">
                  UW {asset.metadata.uwAssetTag}
                </span>
              )}
            </div>
            {asset.name && (
              <div className="text-base text-secondary mt-2">{asset.name}</div>
            )}
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

      {/* Status line */}
      <div className="mb-16 mt-8 flex items-center gap-2 flex-wrap">
        <StatusLine asset={asset} />
        {asset.serialNumber && <SerialBadge serialNumber={asset.serialNumber} />}
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList>
          {tabDefs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {tab.label}
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
          <AccessoriesSection asset={asset} canEdit={canEdit} onRefresh={loadAsset} />
        </>
      )}

      {/* Checkouts / Reservations tabs */}
      {(activeTab === "checkouts" || activeTab === "reservations") && (
        <BookingKindTab
          kind={activeTab === "checkouts" ? "CHECKOUT" : "RESERVATION"}
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
        <Card className="mt-14">
          <CardHeader><CardTitle>Activity Log</CardTitle></CardHeader>
          <CardContent className="p-16">
            <ActivityFeed assetId={asset.id} />
          </CardContent>
        </Card>
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
