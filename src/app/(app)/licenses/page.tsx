"use client";

import { useState } from "react";
import { KeyRound, Plus, RefreshCw, List, Download } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { FadeUp } from "@/components/ui/motion";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFetch } from "@/hooks/use-fetch";
import { formatRelativeTime } from "@/lib/format";
import { LicenseTable } from "./LicenseTable";
import { MyLicensePanel } from "./MyLicensePanel";
import { ConfirmClaimDialog } from "./ConfirmClaimDialog";
import { AdminClaimSheet } from "./AdminClaimSheet";
import { AddLicenseDialog } from "./AddLicenseDialog";
import { BulkAddSheet } from "./BulkAddSheet";
import type { LicenseCode, MyLicense } from "./types";

const MAX_SLOTS = 2;

export default function LicensesPage() {
  const [claimTarget, setClaimTarget] = useState<LicenseCode | null>(null);
  const [adminTarget, setAdminTarget] = useState<LicenseCode | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
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
  const totalSlots = activeCodes.length * MAX_SLOTS;
  const usedSlots = activeCodes.reduce((sum, c) => sum + c.claims.length, 0);
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
              className="size-7"
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
                    className="size-7"
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
                  className="size-7"
                  onClick={handleExport}
                  aria-label="Export CSV"
                >
                  <Download className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export CSV</TooltipContent>
            </Tooltip>
            <Button variant="outline" size="sm" onClick={() => setShowBulk(true)}>
              Bulk add
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="size-3.5 mr-1" />
              Add code
            </Button>
          </>
        )}
      </PageHeader>

      {/* Student: my active license banner */}
      {myLicense && (
        <MyLicensePanel license={myLicense} onReleased={reloadAll} />
      )}

      {/* Slot utilization summary */}
      {!codesLoading && allCodes.length > 0 && (
        <p className="text-sm text-muted-foreground mb-4">
          {usedSlots} of {totalSlots} slots in use
          {myLicense && " · You hold one slot"}
        </p>
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
      ) : (
        <LicenseTable
          codes={visibleCodes}
          loading={codesLoading}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          hasMyLicense={!!myLicense}
          myClaimId={myLicense?.claimId ?? null}
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
