import { memo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserRow as UserRowType } from "./types";
import RoleBadge from "./RoleBadge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { TableRow, TableCell } from "@/components/ui/table";

/* Desktop Table Row */

export const UserTableRow = memo(function UserTableRow({ user }: { user: UserRowType }) {
  const router = useRouter();

  return (
    <TableRow
      className="cursor-pointer"
      onClick={() => router.push(`/users/${user.id}`)}
    >
      <TableCell>
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="size-8 shrink-0">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
            <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-medium leading-tight truncate">{user.name}</span>
            <span className="text-xs text-muted-foreground leading-tight truncate">{user.email}</span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <RoleBadge role={user.role} />
      </TableCell>
      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{user.location || "\u2014"}</TableCell>
      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{user.primaryArea || "\u2014"}</TableCell>
    </TableRow>
  );
});

/* Mobile Card */

export const UserMobileCard = memo(function UserMobileCard({ user }: { user: UserRowType }) {
  return (
    <Link href={`/users/${user.id}`} className="block no-underline">
      <Card className="hover:bg-muted/50 transition-colors">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <Avatar className="size-9 shrink-0" aria-hidden="true">
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
              <AvatarFallback className="bg-secondary text-secondary-foreground text-sm font-semibold">
                {user.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="font-medium text-sm truncate">{user.name}</span>
              <span className="text-muted-foreground text-xs truncate">{user.email}</span>
            </div>
            <RoleBadge role={user.role} />
          </div>
          {(user.location || user.primaryArea) && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground pl-12">
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
