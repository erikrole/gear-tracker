"use client";

import { useState } from "react";
import { CalendarClock, KeyRound, Plus, RefreshCw, List, Download } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { FadeUp } from "@/components/ui/motion";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { OperationalMetricCard } from "@/components/OperationalFeedback";
import { useFetch } from "@/hooks/use-fetch";
import { formatRelativeTime } from "@/lib/format";
import { LicenseTable } from "./LicenseTable";
import { MyLicensePanel } from "./MyLicensePanel";
import { ConfirmClaimDialog } from "./ConfirmClaimDialog";
import { AdminClaimSheet } from "./AdminClaimSheet";
import { AddLicenseDialog } from "./AddLicenseDialog";
import { BulkAddSheet } from "./BulkAddSheet";
import { BulkRenewDialog } from "./BulkRenewDialog";
import type { LicenseCode, MyLicense } from "./types";

const MAX_SLOTS = 2;

function LicenseSummary({
  activeCodes,
  usedSlots,
  expiringCount,
  retiredCount,
  myLicense,
}: {
  activeCodes: number;
  usedSlots: number;
  expiringCount: number;
  retiredCount: number;
  myLicense: boolean;
}) {
  const totalSlots = activeCodes * MAX_SLOTS;
  const openSlots = Math.max(totalSlots - usedSlots, 0);

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <OperationalMetricCard
        label="Active codes"
        value={activeCodes}
        helper="Usable license codes"
        className="bg-muted/30"
      />
      <OperationalMetricCard
        label="Slots in use"
        value={`${usedSlots}/${totalSlots}`}
        helper="Two slots per code"
        tone={usedSlots > 0 ? "blue" : "muted"}
        className="bg-muted/30"
      />
      <OperationalMetricCard
        label="Open slots"
        value={openSlots}
        helper="Claimable capacity"
        tone={openSlots > 0 ? "green" : "muted"}
        className="bg-muted/30"
      />
      <OperationalMetricCard
        label="Expiring soon"
        value={expiringCount}
        helper="Within 30 days"
        tone={expiringCount > 0 ? "orange" : "muted"}
        className="bg-muted/30"
      />
      <OperationalMetricCard
        label="Retired"
        value={retiredCount}
        helper="Hidden by default"
        className="bg-muted/30"
      />
      {myLicense && (
        <div className="px-1 text-xs text-muted-foreground sm:col-span-3 lg:col-span-5">
          You hold one slot.
        </div>
      )}
    </div>
  );
}

export default function LicensesPage() {
  const [claimTarget, setClaimTarget] = useState<LicenseCode | null>(null);
  const [adminTarget, setAdminTarget] = useState<LicenseCode | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [showRetired, setShowRetired] = useState(false);

  const { data: meData } = useFetch<{ id: string; role: string }>({
    url: "/api/me",
    transform: (json) => (json as Record<string, unknown>).user as { id: string; role: string },
    refetchOnFocus: false,
  });
  const currentUserId = meData?.id ?? null;
  const isAdmin = meData?.role === "ADMIN" || meData?.role === "STAFF";

  const {
    data: codesData,
    loading: codesLoading,
    error: codesError,
    lastRefreshed,
    reload: reloadCodes,
  } = useFetch<LicenseCode[]>({
    url: "/api/licenses",
    transform: (json) => (json as Record<string, unknown>).data as LicenseCode[],
  });

  const {
    data: myLicense,
    reload: reloadMy,
  } = useFetch<MyLicense | null>({
    url: "/api/licenses/my",
    transform: (json) => ((json as Record<string, unknown>).data as MyLicense) ?? null,
  });

  function reloadAll() {
    reloadCodes();
    reloadMy();
  }

  const allCodes = codesData ?? [];
  const visibleCodes = showRetired ? allCodes : allCodes.filter((c) => c.status !== "RETIRED");

  const activeCodes = allCodes.filter((c) => c.status !== "RETIRED");
  const usedSlots = activeCodes.reduce((sum, c) => sum + c.claims.length, 0);
  const retiredCount = allCodes.length - activeCodes.length;
  const expiringCount = activeCodes.filter((c) => {
    if (!c.expiresAt) return false;
    const diff = new Date(c.expiresAt).getTime() - Date.now();
    return diff <= 30 * 86_400_000;
  }).length;
  const hasRetired = allCodes.some((c) => c.status === "RETIRED");
  const hasExpiry = allCodes.some((c) => c.expiresAt);

  function handleClickAvailable(code: LicenseCode) {
    if (myLicense) return;
    setClaimTarget(code);
  }

  function handleClickClaimed(code: LicenseCode) {
    // Students without admin rights get their own view via MyLicensePanel — skip the sheet.
    if (!isAdmin) return;
    setAdminTarget(code);
  }

  function handleExport() {
    window.location.href = "/api/licenses/export";
  }

  return (
    <FadeUp>
      <PageHeader title="Photo Mechanic Licenses">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-10"
              onClick={reloadAll}
              disabled={codesLoading}
              aria-label="Refresh"
            >
              <RefreshCw className={`size-3.5 ${codesLoading ? "animate-spin" : ""}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {lastRefreshed
              ? `Updated ${formatRelativeTime(lastRefreshed.toISOString(), new Date())}`
              : "Refresh"}
          </TooltipContent>
        </Tooltip>
        {isAdmin && (
          <>
            {hasRetired && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showRetired ? "secondary" : "ghost"}
                    size="icon"
                    className="size-10"
                    onClick={() => setShowRetired((v) => !v)}
                    aria-label="Toggle retired codes"
                  >
                    <List className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{showRetired ? "Hide retired" : "Show retired"}</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10"
                  onClick={handleExport}
                  aria-label="Export CSV"
                >
                  <Download className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export CSV</TooltipContent>
            </Tooltip>
            <Button variant="outline" size="sm" className="h-10" onClick={() => setShowBulk(true)}>
              Bulk add
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10"
              onClick={() => setShowRenew(true)}
              disabled={activeCodes.length === 0}
            >
              <CalendarClock className="size-3.5 mr-1" />
              Renew
            </Button>
            <Button size="sm" className="h-10" onClick={() => setShowAdd(true)}>
              <Plus className="size-3.5 mr-1" />
              Add code
            </Button>
          </>
        )}
      </PageHeader>

      {/* My active license banner (students + staff) */}
      {myLicense && (
        <MyLicensePanel license={myLicense} isStaff={isAdmin} onReleased={reloadAll} />
      )}

      {/* Slot utilization summary */}
      {!codesLoading && allCodes.length > 0 && (
        <LicenseSummary
          activeCodes={activeCodes.length}
          usedSlots={usedSlots}
          expiringCount={expiringCount}
          retiredCount={retiredCount}
          myLicense={!!myLicense}
        />
      )}

      {/* Main table */}
      {!codesLoading && codesError && allCodes.length === 0 ? (
        <EmptyState
          icon="wifi-off"
          title="Couldn't load licenses"
          description="Check your connection and try again."
          actionLabel="Retry"
          onAction={reloadAll}
        />
      ) : !codesLoading && allCodes.length === 0 ? (
        <EmptyState
          icon="box"
          title="No licenses in pool"
          description={isAdmin ? "Add Photo Mechanic license codes to get started." : "No licenses have been added yet."}
          actionLabel={isAdmin ? "Add code" : undefined}
          onAction={isAdmin ? () => setShowAdd(true) : undefined}
        />
      ) : !codesLoading && visibleCodes.length === 0 ? (
        <EmptyState
          icon="box"
          title="Only retired licenses are hidden"
          description="Show retired codes from the header to review archived license history."
          actionLabel={isAdmin ? "Show retired" : undefined}
          onAction={isAdmin ? () => setShowRetired(true) : undefined}
        />
      ) : (
        <LicenseTable
          codes={visibleCodes}
          loading={codesLoading}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          hasMyLicense={!!myLicense}
          onClickAvailable={handleClickAvailable}
          onClickClaimed={handleClickClaimed}
          showExpiry={hasExpiry}
        />
      )}

      {/* Claim dialog (student) */}
      <ConfirmClaimDialog
        license={claimTarget}
        onOpenChange={(open) => { if (!open) setClaimTarget(null); }}
        onClaimed={reloadAll}
      />

      {/* Admin / detail sheet */}
      <AdminClaimSheet
        license={adminTarget}
        isAdmin={isAdmin}
        onOpenChange={(open) => { if (!open) setAdminTarget(null); }}
        onAction={reloadAll}
      />

      {/* Admin: add dialogs */}
      <AddLicenseDialog open={showAdd} onOpenChange={setShowAdd} onCreated={reloadAll} />
      <BulkAddSheet open={showBulk} onOpenChange={setShowBulk} onCreated={reloadAll} />
      <BulkRenewDialog
        open={showRenew}
        onOpenChange={setShowRenew}
        codes={visibleCodes}
        onRenewed={reloadAll}
      />

      {/* Footer hint */}
      {!codesLoading && allCodes.length > 0 && !myLicense && (
        <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <KeyRound className="size-3" />
          Click an available row to claim. Codes are copied to your clipboard automatically.
        </div>
      )}
    </FadeUp>
  );
}
