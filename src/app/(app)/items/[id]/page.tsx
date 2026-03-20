"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
const BookingDetailsSheet = dynamic(() => import("@/components/BookingDetailsSheet"), { ssr: false });
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";

import type { AssetDetail, CategoryOption } from "./types";
import ChooseImageModal from "@/components/ChooseImageModal";
import ItemInfoCard from "./ItemInfoTab";
import { OperationalOverview, BookingKindTab, CalendarTab } from "./ItemBookingsTab";
import ActivityFeed from "./ItemHistoryTab";
import { SettingsTab, AccessoriesSection } from "./ItemSettingsTab";

/* ── Tab Definitions ──────────────────────────────────────── */

type TabKey = "info" | "checkouts" | "reservations" | "calendar" | "history" | "settings";

const tabDefs: Array<{ key: TabKey; label: string }> = [
  { key: "info", label: "Info" },
  { key: "checkouts", label: "Checkouts" },
  { key: "reservations", label: "Reservations" },
  { key: "calendar", label: "Calendar" },
  { key: "history", label: "History" },
  { key: "settings", label: "Settings" },
];

/* ── Status Line ────────────────────────────────────────── */

function StatusLine({ asset }: { asset: AssetDetail }) {
  const s = asset.computedStatus;
  const b = asset.activeBooking;

  if (s === "AVAILABLE") {
    return <span className="status-text status-text-available">Available</span>;
  }
  if (s === "CHECKED_OUT" && b) {
    const href = `/checkouts/${b.id}`;
    if (b.status === "DRAFT") {
      return (
        <Link href={href} className="status-text status-text-checking-out no-underline">
          Checking out
        </Link>
      );
    }
    return (
      <Link href={href} className="status-text status-text-checked-out no-underline">
        Checked out by {b.requesterName}
      </Link>
    );
  }
  if (s === "RESERVED" && b) {
    return (
      <Link href={`/reservations/${b.id}`} className="status-text status-text-reserved no-underline">
        Reserved by {b.requesterName}
      </Link>
    );
  }
  if (s === "MAINTENANCE") {
    return <span className="status-text status-text-maintenance">Needs Maintenance</span>;
  }
  if (s === "RETIRED") {
    return <span className="status-text status-text-retired">Retired</span>;
  }
  return <span className="text-secondary text-base">{s}</span>;
}

/* ── Actions Dropdown ───────────────────────────────────── */

function ActionsMenu({
  asset,
  onAction,
}: {
  asset: AssetDetail;
  onAction: (action: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const canDelete = !asset.hasBookingHistory;

  return (
    <div ref={ref} className="relative">
      <Button variant="outline" className="header-action-btn" onClick={() => setOpen((v) => !v)}>Actions</Button>
      {open && (
        <div className="ctx-menu ctx-menu-anchor">
          <button className="ctx-menu-item" onClick={() => { setOpen(false); onAction("duplicate"); }}>
            Duplicate
          </button>
          <button className="ctx-menu-item" onClick={() => { setOpen(false); onAction("maintenance"); }}>
            {asset.status === "MAINTENANCE" ? "Clear Maintenance" : "Needs Maintenance"}
          </button>
          <button className="ctx-menu-item" onClick={() => { setOpen(false); onAction("retire"); }}>
            Retire
          </button>
          <div className="ctx-menu-sep" />
          <button
            className="ctx-menu-item danger"
            disabled={!canDelete}
            title={!canDelete ? "Item has booking history \u2014 use Retire instead" : "Permanently delete this item"}
            onClick={() => { if (canDelete) { setOpen(false); onAction("delete"); } }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
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

  useEffect(() => {
    loadAsset();
    fetch("/api/me")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json?.user?.role) setCurrentUserRole(json.user.role); })
      .catch(() => {});
    loadCategories();
  }, [loadAsset, loadCategories]);

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

  const historyByMonth = useMemo(() => {
    if (!asset) return [] as Array<{ month: string; items: AssetDetail["history"] }>;
    const groups = new Map<string, AssetDetail["history"]>();
    for (const item of asset.history) {
      const month = new Date(item.booking.startsAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });
      groups.set(month, [...(groups.get(month) || []), item]);
    }
    return Array.from(groups.entries()).map(([month, items]) => ({ month, items }));
  }, [asset]);

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
    return <div className="flex items-center justify-center py-10"><Spinner className="size-8" /></div>;
  }

  return (
    <>
      <div className="breadcrumb"><Link href="/items">Items</Link> <span>{"\u203a"}</span> {asset.assetTag}</div>
      <div className="page-header mb-0">
        <div className="flex gap-16 items-center">
          {/* Hero image */}
          {asset.imageUrl ? (
            <button
              className="asset-hero-image"
              onClick={() => canEdit && setImageModalOpen(true)}
              title={canEdit ? "Change image" : undefined}
              style={{ cursor: canEdit ? "pointer" : "default" }}
            >
              <Image src={asset.imageUrl} alt={asset.assetTag} width={200} height={200} sizes="100px" unoptimized={!asset.imageUrl.includes(".public.blob.vercel-storage.com")} />
              {canEdit && (
                <div className="asset-hero-image-overlay">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                </div>
              )}
            </button>
          ) : canEdit ? (
            <button className="asset-hero-image asset-hero-image-empty" onClick={() => setImageModalOpen(true)} title="Add image">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--text-tertiary)" }}>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
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
        <div className="header-actions">
          {canEdit && <ActionsMenu asset={asset} onAction={handleAction} />}
          <Button variant={asset.availableForReservation ? "default" : "outline"} className="header-action-btn" asChild>
            <Link href={`/reservations?newFor=${asset.id}`} className="no-underline">Reserve</Link>
          </Button>
          <Button variant={asset.computedStatus !== "CHECKED_OUT" && asset.availableForCheckout ? "default" : "outline"} className="header-action-btn" asChild>
            <Link href={`/checkouts?newFor=${asset.id}`} className="no-underline">Check out</Link>
          </Button>
        </div>
      </div>

      {/* Status line */}
      <div className="mb-16 mt-8">
        <StatusLine asset={asset} />
      </div>

      {/* Parent banner — shown when this item is an accessory */}
      {asset.parentAsset && (
        <div className="mb-16 p-8 text-sm" style={{ background: "var(--bg-muted)", borderRadius: 6, border: "1px solid var(--border)" }}>
          Accessory of{" "}
          <Link href={`/items/${asset.parentAsset.id}`} className="font-medium">
            {asset.parentAsset.assetTag}
          </Link>
          <span className="text-secondary ml-4">{asset.parentAsset.brand} {asset.parentAsset.model}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="item-tabs">
        {tabDefs.map((tab) => (
          <button
            key={tab.key}
            className={`item-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Info tab — dashboard layout */}
      {activeTab === "info" && (
        <>
          <div className="details-grid mt-14">
            <ItemInfoCard
              asset={asset}
              canEdit={canEdit}
              currentUserRole={currentUserRole}
              categories={categories}
              onFieldSaved={(partial) => setAsset((prev) => prev ? { ...prev, ...partial } : prev)}
              onRefresh={loadAsset}
              onCategoriesChanged={loadCategories}
            />
            <OperationalOverview asset={asset} now={now} onSelectBooking={setSelectedBookingId} />
          </div>
          <AccessoriesSection asset={asset} canEdit={canEdit} onRefresh={loadAsset} />
        </>
      )}

      {/* Checkouts / Reservations tabs */}
      {(activeTab === "checkouts" || activeTab === "reservations") && (
        <BookingKindTab
          kind={activeTab === "checkouts" ? "CHECKOUT" : "RESERVATION"}
          groups={historyByMonth}
          asset={asset}
          now={now}
          onSelectBooking={setSelectedBookingId}
        />
      )}

      {/* Calendar tab */}
      {activeTab === "calendar" && (
        <CalendarTab asset={asset} onSelectBooking={setSelectedBookingId} />
      )}

      {/* History tab — full activity feed from audit log */}
      {activeTab === "history" && (
        <div className="card mt-14">
          <div className="card-header"><h2>Activity Log</h2></div>
          <div className="p-16">
            <ActivityFeed assetId={asset.id} />
          </div>
        </div>
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
