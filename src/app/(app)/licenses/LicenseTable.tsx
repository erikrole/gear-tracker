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

function ExpiryBadge({ expiresAt }: { expiresAt: string }) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  if (days < 0) return <Badge variant="destructive" className="text-xs">Expired</Badge>;
  if (days <= 30) return <Badge variant="outline" className="text-xs border-yellow-400 text-yellow-700 dark:text-yellow-400">{days}d left</Badge>;
  return null;
}

function HolderCell({
  claims,
  currentUserId,
  isAdmin,
  myClaimId,
}: {
  claims: ActiveClaim[];
  currentUserId: string | null;
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
              <span className="text-xs text-muted-foreground italic">unknown</span>
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
            <TableHead>Status</TableHead>
            <TableHead>Holders ({MAX_SLOTS} max)</TableHead>
            {showExpiry && <TableHead>Expires</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {codes.map((code) => {
            const myActiveClaim = code.claims.find(
              (c) => c.userId === currentUserId
            );
            const isOwn = !!myActiveClaim;
            const canClick =
              code.status !== "RETIRED" &&
              (code.status === "AVAILABLE" ||
                code.status === "PARTIAL" ||
                isOwn ||
                isAdmin);

            const rowClass = cn(
              "transition-colors",
              code.status === "AVAILABLE" && "bg-green-50 hover:bg-green-100 dark:bg-green-950/20 dark:hover:bg-green-950/30 cursor-pointer",
              code.status === "PARTIAL" && "bg-amber-50 dark:bg-amber-950/20",
              code.status === "PARTIAL" && (isAdmin || isOwn) && "hover:bg-amber-100 dark:hover:bg-amber-950/30 cursor-pointer",
              code.status === "PARTIAL" && !isOwn && !isAdmin && "cursor-pointer hover:bg-green-50 dark:hover:bg-green-950/20",
              code.status === "CLAIMED" && "bg-red-50 dark:bg-red-950/20",
              code.status === "CLAIMED" && (isOwn || isAdmin) && "hover:bg-red-100 dark:hover:bg-red-950/30 cursor-pointer",
              isOwn && "ring-1 ring-inset ring-green-300 dark:ring-green-700",
              code.status === "RETIRED" && "opacity-50"
            );

            function handleClick() {
              if (!canClick) return;
              if (code.status === "AVAILABLE") return onClickAvailable(code);
              if (code.status === "PARTIAL" && !isOwn && !isAdmin) return onClickAvailable(code);
              onClickClaimed(code);
            }

            const displayCode =
              isAdmin || isOwn ? code.code : maskCode(code.code);

            return (
              <TableRow key={code.id} className={rowClass} onClick={handleClick}>
                <TableCell>
                  <code className="font-mono text-sm">{displayCode}</code>
                  {code.label && (
                    <span className="ml-2 text-xs text-muted-foreground">{code.label}</span>
                  )}
                  {code.accountEmail && isAdmin && (
                    <span className="ml-2 text-xs text-muted-foreground">· {code.accountEmail}</span>
                  )}
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
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    myClaimId={myActiveClaim?.id ?? null}
                  />
                </TableCell>
                {showExpiry && (
                  <TableCell>
                    {code.expiresAt ? (
                      <div className="flex flex-col gap-0.5">
                        <ExpiryBadge expiresAt={code.expiresAt} />
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(code.expiresAt, new Date())}
                        </span>
                      </div>
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
