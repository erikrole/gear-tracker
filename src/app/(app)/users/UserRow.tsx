import { memo } from "react";
import Link from "next/link";
import type { UserRow as UserRowType } from "./types";
import RoleBadge from "./RoleBadge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { TableRow, TableCell } from "@/components/ui/table";

/* ── Desktop Table Row ─────────────────────────────────── */

export const UserTableRow = memo(function UserTableRow({ user }: { user: UserRowType }) {
  return (
    <TableRow>
      <TableCell>
        <Link href={`/users/${user.id}`} className="flex items-center gap-3 no-underline">
          <Avatar className="size-8 shrink-0">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
            <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">{user.name}</span>
        </Link>
      </TableCell>
      <TableCell className="hidden md:table-cell text-muted-foreground">{user.email}</TableCell>
      <TableCell>
        <RoleBadge role={user.role} />
      </TableCell>
      <TableCell className="hidden md:table-cell">{user.location || "\u2014"}</TableCell>
      <TableCell className="hidden md:table-cell">{user.primaryArea || "\u2014"}</TableCell>
    </TableRow>
  );
});

/* ── Mobile Card ───────────────────────────────────────── */

export const UserMobileCard = memo(function UserMobileCard({ user }: { user: UserRowType }) {
  return (
    <Link href={`/users/${user.id}`} className="user-mobile-card no-underline">
      <div className="user-mobile-top">
        <Avatar className="size-9" aria-hidden="true">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
          <AvatarFallback className="bg-secondary text-secondary-foreground text-sm font-semibold">
            {user.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="user-mobile-name">
          <span className="row-link">{user.name}</span>
          <span className="text-secondary text-xs">{user.email}</span>
        </div>
        <RoleBadge role={user.role} />
      </div>
      {(user.location || user.primaryArea) && (
        <div className="user-mobile-meta">
          {user.location && <span>{user.location}</span>}
          {user.location && user.primaryArea && <span className="text-muted">&middot;</span>}
          {user.primaryArea && <span>{user.primaryArea}</span>}
        </div>
      )}
    </Link>
  );
});
