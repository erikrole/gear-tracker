"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import EmptyState from "@/components/EmptyState";
import { FadeUp } from "@/components/ui/motion";
import { BulkSkuHeader } from "./_components/BulkSkuHeader";
import { BulkSkuInfoTab } from "./BulkSkuInfoTab";
import { BulkSkuOverviewCard } from "./BulkSkuOverviewCard";
import useBulkSkuData from "./_hooks/use-bulk-sku-data";
import ActivityFeed from "../../items/[id]/ItemHistoryTab";

const BulkSkuUnitsTab = dynamic(() => import("./BulkSkuUnitsTab"), { ssr: false });
const BulkSkuQrTab = dynamic(() => import("./BulkSkuQrTab"), { ssr: false });
const BulkSkuSettingsTab = dynamic(() => import("./BulkSkuSettingsTab"), { ssr: false });

type TabKey = "info" | "units" | "qr" | "history" | "settings";

export default function BulkSkuDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabKey) || "info";
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  const { sku, setSku, fetchError, refreshing, canEdit, currentUserRole, loadSku } = useBulkSkuData(id);

  function switchTab(tab: TabKey) {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "info") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  }

  if (fetchError && !sku) {
    return (
      <EmptyState
        icon="box"
        title={fetchError === "not-found" ? "SKU not found" : "Something went wrong"}
        description={fetchError === "not-found" ? "This bulk SKU may have been deleted." : "We couldn't load this item."}
        actionLabel="Back to Items"
        actionHref="/items"
      />
    );
  }

  if (!sku) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9 w-96 mt-4" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 mt-4">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  const tabDefs: Array<{ key: TabKey; label: string; hidden?: boolean }> = [
    { key: "info", label: "Info" },
    { key: "units", label: "Units", hidden: !sku.trackByNumber },
    { key: "qr", label: "QR Codes", hidden: currentUserRole !== "ADMIN" },
    { key: "history", label: "History" },
    { key: "settings", label: "Settings", hidden: !canEdit },
  ];

  return (
    <FadeUp>
      <BulkSkuHeader
        sku={sku}
        refreshing={refreshing}
        canEdit={canEdit}
        onRefresh={loadSku}
        onImageChanged={(url) => setSku((prev) => prev ? { ...prev, imageUrl: url } : prev)}
      />

      <Tabs value={activeTab} onValueChange={(v) => switchTab(v as TabKey)}>
        <TabsList className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm overflow-x-auto scrollbar-hide">
          {tabDefs.filter((t) => !t.hidden).map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="shrink-0">
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}>{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {activeTab === "info" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 mt-3.5">
          <BulkSkuInfoTab
            sku={sku}
            canEdit={canEdit}
            onFieldSaved={(partial) => setSku((prev) => prev ? { ...prev, ...partial } : prev)}
          />
          <BulkSkuOverviewCard sku={sku} />
        </div>
      )}

      {activeTab === "units" && sku.trackByNumber && (
        <BulkSkuUnitsTab
          sku={sku}
          canEdit={canEdit}
          onRefresh={loadSku}
          onUnitsAdded={(count) =>
            setSku((prev) =>
              prev ? { ...prev, onHand: prev.onHand + count, availableQuantity: prev.availableQuantity + count } : prev
            )
          }
        />
      )}

      {activeTab === "qr" && (
        <BulkSkuQrTab
          sku={sku}
          canEdit={canEdit}
          onFieldSaved={(partial) => setSku((prev) => prev ? { ...prev, ...partial } : prev)}
        />
      )}

      {activeTab === "history" && (
        <Card className="mt-3.5 border-border/40 max-w-3xl">
          <CardHeader><CardTitle>Activity Log</CardTitle></CardHeader>
          <CardContent className="p-4">
            <ActivityFeed
              assetId={sku.id}
              assetName={sku.name}
              endpoint={`/api/bulk-skus/${sku.id}/activity`}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === "settings" && canEdit && (
        <BulkSkuSettingsTab sku={sku} onRefresh={loadSku} />
      )}
    </FadeUp>
  );
}
