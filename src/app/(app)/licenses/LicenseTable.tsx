"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, KeyRound } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserAvatar } from "@/components/UserAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { LicenseCode, ActiveClaim } from "./types";

const MAX_SLOTS = 2;

const MASKED_CODE = "••••-••••-••••-••••";

function ExpiryDisplay({ expiresAt }: { expiresAt: string }) {
  const expiry = new Date(expiresAt);
  const diff = expiry.getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  const dateStr = expiry.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  if (diff < 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="destructive" className="text-xs cursor-help">Expired</Badge>
        </TooltipTrigger>
        <TooltipContent>Expired {dateStr}</TooltipContent>
      </Tooltip>
    );
  }
  if (days <= 30) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-xs border-yellow-400 text-yellow-700 dark:text-yellow-400 cursor-help">
            {days <= 0 ? "Today" : `${days}d left`}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Expires {dateStr}</TooltipContent>
      </Tooltip>
    );
  }
  return <span className="text-xs text-muted-foreground">{dateStr}</span>;
}

function HolderCell({
  claims,
  isAdmin,
  myClaimId,
}: {
  claims: ActiveClaim[];
  isAdmin: boolean;
  myClaimId: string | null;
}) {
  if (claims.length === 0) return <span className="text-muted-foreground text-sm">—</span>;

  return (
    <div className="flex flex-col gap-1">
      {claims.map((claim) => {
        const isOwn = myClaimId === claim.id;
        const showName = isAdmin || isOwn;
        const name = claim.user?.name ?? claim.occupantLabel ?? "Unknown";
        const avatarUrl = claim.user?.avatarUrl ?? null;

        return (
          <div key={claim.id} className="flex items-center gap-1.5">
            {showName ? (
              <UserAvatar name={name} avatarUrl={avatarUrl} size="xs" />
            ) : (
              <span className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
                <KeyRound className="size-3" />
              </span>
            )}
            <span className={cn("text-sm", !showName && "text-muted-foreground")}>
              {showName ? name : "Occupied"}
            </span>
            {isOwn && <span className="text-xs text-muted-foreground">(you)</span>}
            {claim.userId === null && isAdmin && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">unknown</Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}

type Props = {
  codes: LicenseCode[];
  loading: boolean;
  currentUserId: string | null;
  isAdmin: boolean;
  hasMyLicense: boolean;
  onClickAvailable: (code: LicenseCode) => void;
  onClickClaimed: (code: LicenseCode) => void;
  showExpiry?: boolean;
};

export function LicenseTable({
  codes,
  loading,
  currentUserId,
  isAdmin,
  hasMyLicense,
  onClickAvailable,
  onClickClaimed,
  showExpiry = false,
}: Props) {
  if (loading && codes.length === 0) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Holders</TableHead>
              {showExpiry && <TableHead>Expires</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }, (_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-36 font-mono" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                {showExpiry && <TableCell><Skeleton className="h-4 w-16" /></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead className="w-24">Status</TableHead>
            <TableHead>Holders</TableHead>
            {showExpiry && <TableHead className="w-32">Expires</TableHead>}
            <TableHead className="w-28 text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {codes.map((code) => {
            const myActiveClaim = code.claims.find((c) => c.userId === currentUserId);
            const isOwn = !!myActiveClaim;

            // Determine clickability
            const claimable = code.status === "AVAILABLE" || code.status === "PARTIAL";
            const studentCanClaim = claimable && !hasMyLicense;
            const adminCanInspect = isAdmin;
            const isClickable = studentCanClaim || adminCanInspect;

            const rowClass = cn(
              "transition-colors",
              code.status === "AVAILABLE" && "bg-green-50/50 dark:bg-green-950/10",
              code.status === "PARTIAL" && "bg-blue-50/50 dark:bg-blue-950/10",
              code.status === "CLAIMED" && "bg-blue-50/30 dark:bg-blue-950/10",
              code.status === "RETIRED" && "opacity-50",
              isOwn && "ring-1 ring-inset ring-blue-300 dark:ring-blue-700",
              isClickable && "cursor-pointer hover:bg-muted/60",
              !isClickable && "cursor-default"
            );

            function handleClick() {
              if (!isClickable) return;
              if (isOwn) return onClickClaimed(code);
              if (adminCanInspect) return onClickClaimed(code);
              if (claimable && studentCanClaim) return onClickAvailable(code);
            }

            const displayCode = isAdmin || isOwn ? code.code : MASKED_CODE;
            const rowActionLabel = adminCanInspect ? "Inspect" : "Claim";

            return (
              <TableRow
                key={code.id}
                className={cn(rowClass, isClickable && "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]")}
                onClick={handleClick}
                tabIndex={isClickable ? 0 : undefined}
                aria-label={isClickable ? `${rowActionLabel} license ${displayCode}` : undefined}
                onKeyDown={isClickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); } } : undefined}
              >
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="font-mono text-sm">{displayCode}</code>
                      {code.label && (
                        <span className="text-xs text-muted-foreground">{code.label}</span>
                      )}
                    </div>
                    {code.accountEmail && isAdmin && (
                      <span className="text-xs text-muted-foreground truncate">{code.accountEmail}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {code.status === "AVAILABLE" && <Badge variant="green">Open</Badge>}
                  {code.status === "PARTIAL" && <Badge variant="blue">1/{MAX_SLOTS}</Badge>}
                  {code.status === "CLAIMED" && <Badge variant="blue">{isOwn ? "Yours · 2/2" : "Full · 2/2"}</Badge>}
                  {code.status === "RETIRED" && <Badge variant="gray">Retired</Badge>}
                </TableCell>
                <TableCell>
                  <HolderCell
                    claims={code.claims}
                    isAdmin={isAdmin}
                    myClaimId={myActiveClaim?.id ?? null}
                  />
                </TableCell>
                {showExpiry && (
                  <TableCell>
                    {code.expiresAt ? (
                      <ExpiryDisplay expiresAt={code.expiresAt} />
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                )}
                <TableCell className="text-right">
                  {adminCanInspect ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-10"
                      onClick={(event) => { event.stopPropagation(); onClickClaimed(code); }}
                    >
                      <Eye data-icon="inline-start" />
                      Inspect
                    </Button>
                  ) : studentCanClaim ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10"
                      onClick={(event) => { event.stopPropagation(); onClickAvailable(code); }}
                    >
                      <KeyRound data-icon="inline-start" />
                      Claim
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">{isOwn ? "In use" : "Unavailable"}</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
