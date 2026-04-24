"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatRelativeTime } from "@/lib/format";
import { getInitials } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import type { LicenseCode, ActiveClaim } from "./types";

const MAX_SLOTS = 2;

function maskCode(code: string): string {
  const parts = code.split("-");
  if (parts.length < 2) return code;
  return [parts[0], ...parts.slice(1, -1).map(() => "••••"), parts[parts.length - 1]].join("-");
}

function ExpiryDisplay({ expiresAt }: { expiresAt: string }) {
  const expiry = new Date(expiresAt);
  const diff = expiry.getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  const dateStr = expiry.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  if (days < 0) {
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
            {days}d left
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
            <Avatar className="size-5">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
              <AvatarFallback className="text-[10px]">{getInitials(name)}</AvatarFallback>
            </Avatar>
            <span className={cn("text-sm", !showName && "text-muted-foreground")}>
              {showName ? name : "—"}
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
  myClaimId: string | null;
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
  myClaimId,
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
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead className="w-24">Status</TableHead>
            <TableHead>Holders</TableHead>
            {showExpiry && <TableHead className="w-32">Expires</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {codes.map((code) => {
            const myActiveClaim = code.claims.find((c) => c.userId === currentUserId);
            const isOwn = !!myActiveClaim;

            // Determine clickability
            const claimable = code.status === "AVAILABLE" || code.status === "PARTIAL";
            const studentCanClaim = claimable && !hasMyLicense;
            const adminCanInspect = isAdmin && code.status !== "RETIRED";
            const studentCanRelease = isOwn;
            const isClickable = studentCanClaim || studentCanRelease || adminCanInspect;

            const rowClass = cn(
              "transition-colors",
              code.status === "AVAILABLE" && "bg-green-50/50 dark:bg-green-950/10",
              code.status === "PARTIAL" && "bg-amber-50/50 dark:bg-amber-950/10",
              code.status === "CLAIMED" && "bg-red-50/30 dark:bg-red-950/10",
              code.status === "RETIRED" && "opacity-50",
              isOwn && "ring-1 ring-inset ring-green-300 dark:ring-green-700",
              isClickable && "cursor-pointer hover:bg-muted/60",
              !isClickable && "cursor-default"
            );

            function handleClick() {
              if (!isClickable) return;
              if (isOwn) return onClickClaimed(code);
              if (claimable && studentCanClaim) return onClickAvailable(code);
              if (adminCanInspect) return onClickClaimed(code);
            }

            const displayCode = isAdmin || isOwn ? code.code : maskCode(code.code);

            return (
              <TableRow key={code.id} className={rowClass} onClick={handleClick}>
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
                  {code.status === "AVAILABLE" && (
                    <Badge variant="outline" className="border-green-400 text-green-700 dark:text-green-400">
                      Open
                    </Badge>
                  )}
                  {code.status === "PARTIAL" && (
                    <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400">
                      1/{MAX_SLOTS}
                    </Badge>
                  )}
                  {code.status === "CLAIMED" && (
                    <Badge variant="outline" className="border-red-400 text-red-700 dark:text-red-400">
                      {isOwn ? "Yours" : "Full"}
                    </Badge>
                  )}
                  {code.status === "RETIRED" && (
                    <Badge variant="secondary">Retired</Badge>
                  )}
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
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
