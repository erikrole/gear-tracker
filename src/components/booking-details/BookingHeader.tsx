"use client";

import type { ComponentProps } from "react";
import { InlineTitle } from "@/components/InlineTitle";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import StatusIndicator from "@/components/ui/status-indicator";
import { UserAvatar } from "@/components/UserAvatar";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, Clock, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { statusBadgeVariant, statusLabel, urgencyBadgeClassName } from "./helpers";
import type { BookingChangeSyncStatus } from "@/hooks/use-booking-change-sync";
import type { BookingDetail } from "./types";

type Props = {
  booking: BookingDetail;
  kind: "CHECKOUT" | "RESERVATION";
  canEdit: boolean;
  canExtend: boolean;
  canCancel: boolean;
  canDuplicate: boolean;
  canNudge: boolean;
  canForceComplete: boolean;
  countdown: string | null;
  urgency: string;
  kioskHandoffLabel: string | null;
  reloading: boolean;
  syncStatus?: BookingChangeSyncStatus;
  actionLoading: string | null;
  onSaveTitle: (value: string) => Promise<void>;
  onReload: () => void;
  onEdit: () => void;
  onToggleExtend: () => void;
  onCancel: () => void;
  onDuplicate: () => void;
  onNudge: () => void;
  onForceComplete: () => void;
};

function PendingDropdownMenuItem({
  active,
  children,
  ...props
}: ComponentProps<typeof DropdownMenuItem> & {
  active: boolean;
}) {
  return (
    <DropdownMenuItem aria-busy={active || undefined} {...props}>
      {active ? <Spinner aria-hidden="true" /> : null}
      {children}
    </DropdownMenuItem>
  );
}

export function BookingHeader({
  booking,
  kind,
  canEdit,
  canExtend,
  canCancel,
  canDuplicate,
  canNudge,
  canForceComplete,
  countdown,
  urgency,
  kioskHandoffLabel,
  reloading,
  syncStatus,
  actionLoading,
  onSaveTitle,
  onReload,
  onEdit,
  onToggleExtend,
  onCancel,
  onDuplicate,
  onNudge,
  onForceComplete,
}: Props) {
  const hasSecondaryActions = canDuplicate || canCancel || canNudge || canForceComplete;
  const hasPrimaryActions = canEdit || canExtend;

  const eventLabel =
    booking.events && booking.events.length > 1
      ? `${booking.events.length} events`
      : booking.event?.summary ?? null;

  const metaParts = [
    booking.location?.name,
    eventLabel,
    booking.shiftAssignment?.shift.area,
    booking.kit?.name,
  ].filter(Boolean) as string[];

  const updatedLabel = booking.updatedAt
    ? `Updated ${new Date(booking.updatedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}`
    : null;

  async function copyRef() {
    if (!booking.refNumber) return;
    try {
      await navigator.clipboard.writeText(booking.refNumber);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  }

  return (
    <header className="rounded-lg border border-border/50 bg-card px-4 py-4 shadow-xs sm:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        {/* ── Left: avatar + identity ── */}
        <div className="flex min-w-0 gap-4">
          <div className="shrink-0 self-start">
            <UserAvatar
              name={booking.requester?.name ?? "Unknown"}
              avatarUrl={booking.requester?.avatarUrl}
              size="xl"
              className="shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Status row */}
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <Badge
                variant={
                  (booking.isOverdue
                    ? "red"
                    : statusBadgeVariant(booking.status, kind)) as BadgeProps["variant"]
                }
              >
                {booking.isOverdue ? "Overdue" : statusLabel(booking.status, kind)}
              </Badge>
              {countdown && (
                <Badge
                  variant="outline"
                  className={`gap-1 font-medium tabular-nums ${urgencyBadgeClassName(urgency)}`}
                >
                  <Clock className="size-3" />
                  {countdown}
                </Badge>
              )}
              {kioskHandoffLabel && (
                <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
                  {kioskHandoffLabel}
                </Badge>
              )}
            </div>

            {/* Title */}
            <div style={{ fontFamily: "var(--font-heading)" }}>
              <InlineTitle
                value={booking.title}
                canEdit={canEdit}
                onSave={onSaveTitle}
                className="text-balance text-[26px] font-black leading-none tracking-tight sm:text-[30px]"
                placeholder="Untitled booking"
              />
            </div>

            {/* Subtitle: ref + type */}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground/70">
              {booking.refNumber && (
                <button
                  type="button"
                  onClick={copyRef}
                  title="Click to copy"
                  className="group/ref inline-flex items-center gap-1 rounded-sm font-mono text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {booking.refNumber}
                  <Copy className="size-3 opacity-50 transition-opacity group-hover/ref:opacity-100" />
                </button>
              )}
              {booking.refNumber && booking.bookingType && (
                <span aria-hidden="true" className="text-muted-foreground/30">/</span>
              )}
              {booking.bookingType && <span>{booking.bookingType}</span>}
            </div>

            {/* Meta line */}
            {metaParts.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground/70">
                {metaParts.map((part, index) => (
                  <span key={`${part}-${index}`} className="inline-flex items-center gap-2">
                    {index > 0 && (
                      <span aria-hidden="true" className="text-muted-foreground/30">/</span>
                    )}
                    <span>{part}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: actions ── */}
        <div className="flex flex-col gap-2 lg:min-w-[260px] lg:items-end">
          {(hasPrimaryActions || hasSecondaryActions) && (
            <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
              {hasSecondaryActions && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      Actions
                      <ChevronDown className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuGroup>
                      {canNudge && (
                        <PendingDropdownMenuItem
                          active={actionLoading === "nudge"}
                          onSelect={onNudge}
                          disabled={!!actionLoading}
                        >
                          Nudge borrower
                        </PendingDropdownMenuItem>
                      )}
                      {canForceComplete && (
                        <PendingDropdownMenuItem
                          active={actionLoading === "force-complete"}
                          onSelect={onForceComplete}
                          disabled={!!actionLoading}
                        >
                          Close without scan
                        </PendingDropdownMenuItem>
                      )}
                      {canDuplicate && (
                        <PendingDropdownMenuItem
                          active={actionLoading === "duplicate"}
                          onSelect={onDuplicate}
                          disabled={!!actionLoading}
                        >
                          Duplicate
                        </PendingDropdownMenuItem>
                      )}
                      {canCancel && (
                        <PendingDropdownMenuItem
                          active={actionLoading === "cancel"}
                          variant="destructive"
                          onSelect={onCancel}
                          disabled={!!actionLoading}
                        >
                          Cancel
                        </PendingDropdownMenuItem>
                      )}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {canEdit && (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  Edit
                </Button>
              )}
              {canExtend && (
                <Button variant="outline" size="sm" onClick={onToggleExtend}>
                  Extend
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-[10px] leading-none text-muted-foreground/40 lg:justify-end">
            {syncStatus && (
              <StatusIndicator
                state={syncStatus.state}
                label={syncStatus.label}
                size="sm"
                title={syncStatus.description}
              />
            )}
            {reloading ? (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Spinner className="size-3" />
                Refreshing…
              </span>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onReload}
                    className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    <RefreshCw className="size-3" />
                    {updatedLabel ?? "Refresh"}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Click to refresh</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
