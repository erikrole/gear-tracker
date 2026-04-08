"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
const BookingDetailsSheet = dynamic(() => import("@/components/BookingDetailsSheet"), { ssr: false });
const ItemInsightsTab = dynamic(() => import("./ItemInsightsTab"), { ssr: false });
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { FadeUp } from "@/components/ui/motion";
import ChooseImageModal from "@/components/ChooseImageModal";
import ItemInfoCard from "./ItemInfoTab";
import { OperationalOverview, BookingsTab, CalendarTab, SettingsTab } from "./ItemBookingsTab";
import ActivityFeed from "./ItemHistoryTab";
import { AccessoriesSection } from "./ItemSettingsTab";

import useItemData from "./_hooks/use-item-data";
import useItemActions from "./_hooks/use-item-actions";
import { ItemHeader } from "./_components/ItemHeader";

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

/* ── Main Page ──────────────────────────────────────────── */

export default function ItemDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabKey) || "info";
  const [activeTab, setActiveTab] = useState<TabKey>(
    tabDefs.some((t) => t.key === initialTab) ? initialTab : "info"
  );
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);

  const {
    asset,
    setAsset,
    fetchError,
    refreshing,
    lastRefreshed,
    currentUserRole,
    categories,
    departments,
    locations,
    now,
    loadAsset,
    loadCategories,
    loadDepartments,
    loadLocations,
    canEdit,
  } = useItemData(id);

  const {
    handleAction,
    handleToggleFavorite,
    saveHeaderField,
  } = useItemActions({ asset, setAsset, loadAsset });

  // URL-synced tab switching
  function switchTab(tab: TabKey) {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "info") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  }

  // Keyboard shortcuts: 1-7 to switch tabs
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

  if (fetchError && !asset) {
    return (
      <div>
        {fetchError === "not-found" ? (
          <EmptyState
            icon="box"
            title="Item not found"
            description="This item may have been deleted or you don't have access."
            actionLabel="Back to items"
            actionHref="/items"
          />
        ) : fetchError === "network" ? (
          <EmptyState
            icon="wifi-off"
            title="You're offline"
            description="Check your connection and try again."
            actionLabel="Retry"
            onAction={loadAsset}
          />
        ) : (
          <EmptyState
            icon="box"
            title="Something went wrong"
            description="We couldn't load this item. This is usually temporary."
            actionLabel="Retry"
            onAction={loadAsset}
          />
        )}
      </div>
    );
  }

  if (!asset) {
    return (
      <div>
        {/* Header skeleton */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="flex gap-4 items-center">
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
        <div className="mb-1 mt-2 flex gap-2">
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

  // Tab badge counts (derived from loaded asset data)
  const bookingsCount = (asset?.history?.length ?? 0) + (asset?.activeBooking ? 1 : 0);
  const accessoriesCount = asset?.accessories?.length ?? 0;

  return (
    <FadeUp>
      <ItemHeader
        asset={asset}
        canEdit={canEdit}
        refreshing={refreshing}
        lastRefreshed={lastRefreshed}
        onRefresh={loadAsset}
        onToggleFavorite={handleToggleFavorite}
        onSaveHeaderField={saveHeaderField}
        onAction={handleAction}
        onImageModalOpen={() => setImageModalOpen(true)}
      />

      {/* Tabs — sticky on scroll, horizontally scrollable on mobile */}
      <Tabs value={activeTab} onValueChange={(v) => switchTab(v as TabKey)}>
        <TabsList className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm overflow-x-auto scrollbar-hide">
          {tabDefs.map((tab, i) => {
            const count =
              tab.key === "bookings" ? bookingsCount :
              tab.key === "accessories" ? accessoriesCount :
              0;
            return (
              <TabsTrigger key={tab.key} value={tab.key} className="shrink-0">
                {tab.label}
                {count > 0 && (
                  <span className="ml-1 text-[10px] text-muted-foreground">{count}</span>
                )}
                <kbd className="ml-1 hidden sm:inline-block text-[10px] text-muted-foreground/50 font-mono" aria-hidden="true">{i + 1}</kbd>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Info tab — dashboard layout */}
      {activeTab === "info" && (
        <>
          <div className="details-grid mt-3.5">
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
        <Card className="mt-3.5 border-border/40 max-w-3xl">
          <CardHeader><CardTitle>Activity Log</CardTitle></CardHeader>
          <CardContent className="p-4">
            <ActivityFeed assetId={asset.id} assetName={asset.name || asset.assetTag} />
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
    </FadeUp>
  );
}
