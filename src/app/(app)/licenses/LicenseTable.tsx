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
import type { LicenseCode } from "./types";

function maskCode(code: string): string {
  const parts = code.split("-");
  if (parts.length < 2) return code;
  return [parts[0], ...parts.slice(1, -1).map(() => "••••"), parts[parts.length - 1]].join("-");
}

type Props = {
  codes: LicenseCode[];
  loading: boolean;
  currentUserId: string | null;
  isAdmin: boolean;
  myLicenseId: string | null;
  onClickAvailable: (code: LicenseCode) => void;
  onClickClaimed: (code: LicenseCode) => void;
};

export function LicenseTable({
  codes,
  loading,
  currentUserId,
  isAdmin,
  myLicenseId,
  onClickAvailable,
  onClickClaimed,
}: Props) {
  if (loading && codes.length === 0) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Holder</TableHead>
              <TableHead>Claimed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }, (_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-36 font-mono" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
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
            <TableHead>Holder</TableHead>
            <TableHead>Claimed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {codes.map((code) => {
            const isOwn = code.claimedById === currentUserId;
            const rowClass = cn(
              "transition-colors",
              code.status === "AVAILABLE" && "bg-green-50 hover:bg-green-100 dark:bg-green-950/20 dark:hover:bg-green-950/30 cursor-pointer",
              code.status === "CLAIMED" && "bg-red-50 dark:bg-red-950/20",
              isOwn && "ring-1 ring-inset ring-green-300 dark:ring-green-700",
              code.status === "CLAIMED" && (isOwn || isAdmin) && "hover:bg-red-100 dark:hover:bg-red-950/30 cursor-pointer",
              code.status === "RETIRED" && "opacity-50"
            );

            function handleClick() {
              if (code.status === "AVAILABLE") onClickAvailable(code);
              else if (code.status === "CLAIMED" && (isOwn || isAdmin)) onClickClaimed(code);
            }

            const displayCode = isAdmin || isOwn ? code.code : maskCode(code.code);

            return (
              <TableRow key={code.id} className={rowClass} onClick={handleClick}>
                <TableCell>
                  <code className="font-mono text-sm">{displayCode}</code>
                  {code.label && (
                    <span className="ml-2 text-xs text-muted-foreground">{code.label}</span>
                  )}
                </TableCell>
                <TableCell>
                  {code.status === "AVAILABLE" && (
                    <Badge variant="outline" className="border-green-400 text-green-700 dark:text-green-400">
                      Available
                    </Badge>
                  )}
                  {code.status === "CLAIMED" && (
                    <Badge variant="outline" className="border-red-400 text-red-700 dark:text-red-400">
                      {isOwn ? "Yours" : "Taken"}
                    </Badge>
                  )}
                  {code.status === "RETIRED" && (
                    <Badge variant="secondary">Retired</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {code.claimedBy ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="size-6">
                        {code.claimedBy.avatarUrl && (
                          <AvatarImage src={code.claimedBy.avatarUrl} alt={code.claimedBy.name} />
                        )}
                        <AvatarFallback className="text-xs">
                          {getInitials(code.claimedBy.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{isAdmin || isOwn ? code.claimedBy.name : "—"}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {code.claimedAt
                    ? formatRelativeTime(code.claimedAt, new Date())
                    : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
