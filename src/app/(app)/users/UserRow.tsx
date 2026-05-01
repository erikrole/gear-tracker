import { memo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserRow as UserRowType } from "./types";
import { deriveStudentYear, STUDENT_YEAR_OPTIONS } from "./types";
import RoleBadge from "./RoleBadge";

function titleOrYear(user: UserRowType): string | null {
  if (user.role === "STUDENT") {
    const y = deriveStudentYear(user.gradYear, user.studentYearOverride);
    if (!y) return null;
    return STUDENT_YEAR_OPTIONS.find((o) => o.value === y)?.label ?? null;
  }
  return user.title ?? null;
}
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TableRow, TableCell } from "@/components/ui/table";

/* ── Desktop Table Row ────────────────────────────────── */

export const UserTableRow = memo(function UserTableRow({ user }: { user: UserRowType }) {
  const router = useRouter();

  return (
    <TableRow
      className="cursor-pointer"
      onClick={() => router.push(`/users/${user.id}`)}
    >
      <TableCell>
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="size-9 shrink-0 ring-1 ring-border">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
            <AvatarFallback
              className="bg-secondary text-secondary-foreground text-xs font-bold"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span
              className="leading-tight truncate text-[13px]"
              style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
            >
              {user.name}
              {user.active === false && (
                <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0 text-muted-foreground">
                  Inactive
                </Badge>
              )}
            </span>
            <span
              className="text-[11px] text-muted-foreground leading-tight truncate"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {user.email}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <RoleBadge role={user.role} />
      </TableCell>
      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
        {titleOrYear(user) ?? "\u2014"}
      </TableCell>
      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
        {user.location || "\u2014"}
      </TableCell>
      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
        {user.primaryArea || "\u2014"}
      </TableCell>
    </TableRow>
  );
});

/* ── Mobile Card ──────────────────────────────────────── */

export const UserMobileCard = memo(function UserMobileCard({ user }: { user: UserRowType }) {
  return (
    <Link href={`/users/${user.id}`} className="block no-underline">
      <Card className="hover:shadow-sm transition-shadow duration-150">
        <CardContent className="p-3.5">
          <div className="flex items-center gap-3.5">
            <Avatar className="size-11 shrink-0 ring-1 ring-border" aria-hidden="true">
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
              <AvatarFallback
                className="bg-secondary text-secondary-foreground text-sm font-bold"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span
                className="text-[13.5px] truncate leading-tight"
                style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
              >
                {user.name}
              </span>
              <span
                className="text-muted-foreground text-[11px] truncate leading-tight"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {user.email}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {user.active === false && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground">
                  Inactive
                </Badge>
              )}
              <RoleBadge role={user.role} />
            </div>
          </div>
          {(user.location || user.primaryArea || titleOrYear(user)) && (
            <div
              className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground"
              style={{ paddingLeft: "56px" }}
            >
              {titleOrYear(user) && <span className="truncate">{titleOrYear(user)}</span>}
              {titleOrYear(user) && (user.location || user.primaryArea) && <span>&middot;</span>}
              {user.location && <span>{user.location}</span>}
              {user.location && user.primaryArea && <span>&middot;</span>}
              {user.primaryArea && <span>{user.primaryArea}</span>}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
});
