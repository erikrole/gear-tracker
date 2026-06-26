"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
const BookingDetailsSheet = dynamic(() => import("@/components/BookingDetailsSheet"), { ssr: false });
const ItemInsightsTab = dynamic(() => import("./ItemInsightsTab"), { ssr: false });
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { FadeUp } from "@/components/ui/motion";
import ChooseImageModal from "@/components/ChooseImageModal";
import ItemInfoCard from "./ItemInfoTab";
import { OperationalOverview, CalendarTab, SettingsTab } from "./ItemBookingsTab";
import ActivityFeed from "./ItemHistoryTab";
import { AccessoriesSection } from "./ItemSettingsTab";

import useItemData from "./_hooks/use-item-data";
import useItemActions from "./_hooks/use-item-actions";
import { useItemChangeSync } from "@/hooks/use-item-change-sync";
import { useUrlState } from "@/hooks/use-url-state";
import { ItemHeader } from "./_components/ItemHeader";
import { BulkSkuDetailExperience } from "../../bulk-inventory/[id]/BulkSkuDetailExperience";
import { BULK_ID_PREFIX } from "../lib/item-href";
import type { AssetDetail } from "./types";

/* ── Tab Definitions ──────────────────────────────────────── */

type TabKey = "info" | "calendar" | "insights" | "history" | "accessories" | "settings";

const tabDefs: Array<{ key: TabKey; label: string }> = [
  { key: "info", label: "Info" },
  { key: "calendar", label: "Schedule" },
  { key: "insights", label: "Insights" },
  { key: "history", label: "History" },
  { key: "accessories", label: "Attachments" },
  { key: "settings", label: "Settings" },
];

function parseItemDetailTab(raw: string | null): TabKey {
  return tabDefs.some((tab) => tab.key === raw) ? (raw as TabKey) : "info";
}

function serializeDetailTab(tab: TabKey): string | null {
  return tab === "info" ? null : tab;
}

function buildImageSearchSeed(asset: AssetDetail) {
  const productName = asset.name?.trim() ?? "";
  const brand = asset.brand?.trim() ?? "";
  const model = asset.model?.trim() ?? "";
  const productLower = productName.toLowerCase();
  const metadata = [brand, model].filter((part) => part && !productLower.includes(part.toLowerCase()));
  return [productName, ...metadata].filter(Boolean).join(" ")
    || [brand, model].filter(Boolean).join(" ")
    || asset.assetTag;
}

/* ── Main Page ──────────────────────────────────────────── */

export default function ItemDetailsPage() {
  const { id } = useParams<{ id: string }>();

  if (id.startsWith(BULK_ID_PREFIX)) {
    const bulkSkuId = id.slice(BULK_ID_PREFIX.length);
    return (
      <BulkSkuDetailExperience
        id={bulkSkuId}
        operationsHref={`/bulk-inventory/${bulkSkuId}`}
      />
    );
  }

  return <SerializedItemDetailsPage id={id} />;
}

function SerializedItemDetailsPage({ id }: { id: string }) {
  const [activeTab, setActiveTab] = useUrlState<TabKey>("tab", parseItemDetailTab, serializeDetailTab);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  useItemChangeSync();

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
    canEdit,
  } = useItemData(id);

  const {
    actionBusy,
    handleAction,
    handleToggleFavorite,
    saveHeaderField,
  } = useItemActions({ asset, setAsset, loadAsset });

  // Keyboard shortcuts: 1-6 to switch tabs
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= tabDefs.length) {
        e.preventDefault();
        setActiveTab(tabDefs[num - 1]!.key);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setActiveTab]);

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
      <div className="mx-auto w-full max-w-7xl">
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
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 mt-0">
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
  const attachmentsCount = asset?.accessories?.length ?? 0;

  return (
    <FadeUp>
      <div className="mx-auto w-full max-w-7xl">
      <ItemHeader
        asset={asset}
        canEdit={canEdit}
        refreshing={refreshing}
        actionBusy={actionBusy}
        lastRefreshed={lastRefreshed}
        onRefresh={loadAsset}
        onToggleFavorite={handleToggleFavorite}
        onSaveHeaderField={saveHeaderField}
        onAction={handleAction}
        onImageModalOpen={() => setImageModalOpen(true)}
      />

      {/* Tabs — sticky on scroll, horizontally scrollable on mobile */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm overflow-x-auto scrollbar-hide">
          {tabDefs.map((tab) => {
            const count =
              tab.key === "accessories" ? attachmentsCount :
              0;
            return (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="relative shrink-0 gap-1.5 border-b-transparent data-[state=active]:border-b-transparent after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--wi-red)] after:opacity-0 after:transition-opacity data-[state=active]:after:opacity-100"
              >
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}>{tab.label}</span>
                {count > 0 && (
                  <span
                    className="text-[10px] tabular-nums text-muted-foreground/70"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Info tab — dashboard layout */}
      {activeTab === "info" && (
        <>
          <div className="mt-3.5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
            <OperationalOverview
              asset={asset}
              now={now}
              onSelectBooking={setSelectedBookingId}
            />
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
            />
          </div>
        </>
      )}

      {/* Schedule tab */}
      {activeTab === "calendar" && (
        <CalendarTab asset={asset} onSelectBooking={setSelectedBookingId} />
      )}

      {/* Insights tab — utilization dashboard */}
      {activeTab === "insights" && (
        <ItemInsightsTab assetId={asset.id} />
      )}

      {/* History tab — full activity feed from audit log */}
      {activeTab === "history" && (
        <Card className="mt-3.5 border-border/40 max-w-4xl shadow-none">
          <CardHeader>
            <CardTitle>Item History</CardTitle>
            <CardDescription>
              Every audited touch on this item, including item updates and booking activity that involved it.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <ActivityFeed assetId={asset.id} assetName={asset.name || asset.assetTag} />
          </CardContent>
        </Card>
      )}

      {/* Attachments tab */}
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
      />

      <ChooseImageModal
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        assetId={asset.id}
        currentImageUrl={asset.imageUrl}
        searchQuery={buildImageSearchSeed(asset)}
        onImageChanged={(newUrl) => setAsset((prev) => prev ? { ...prev, imageUrl: newUrl } : prev)}
      />
      </div>
    </FadeUp>
  );
}
