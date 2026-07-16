import { memo } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AREA_LABELS, type UserRow as UserRowType } from "./types";
import RoleBadge from "./RoleBadge";
import { formatRelativeTime } from "@/lib/format";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TableRow, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const ACTIVE_NOW_MS = 1000 * 60 * 5;

function titleLabel(user: UserRowType): string | null {
  if (user.role === "STUDENT") {
    const area = areaLabel(user.primaryArea);
    return area ? `${area} Student` : "Student";
  }
  if (user.title) return user.title;
  return null;
}

function lastActiveLabel(lastActiveAt: string | null): string {
  if (!lastActiveAt) return "Never";
  if (isActiveNow(lastActiveAt)) return "Now";
  return formatRelativeTime(lastActiveAt, new Date());
}

function isActiveNow(lastActiveAt: string | null): boolean {
  return Boolean(lastActiveAt && Date.now() - new Date(lastActiveAt).getTime() < ACTIVE_NOW_MS);
}

function lastActiveTitle(lastActiveAt: string | null): string | undefined {
  if (!lastActiveAt) return undefined;
  return new Date(lastActiveAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function areaLabel(area: string | null): string | null {
  if (!area) return null;
  if (AREA_LABELS[area]) return AREA_LABELS[area];
  const lower = area.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function mobileMetaParts(user: UserRowType): string[] {
  return [
    titleLabel(user),
    user.role === "STUDENT" ? null : areaLabel(user.primaryArea),
    user.location,
    user.lastActiveAt ? `Active ${lastActiveLabel(user.lastActiveAt)}` : "Never active",
  ].filter((part): part is string => Boolean(part));
}

function LastActiveValue({ lastActiveAt }: { lastActiveAt: string | null }) {
  if (isActiveNow(lastActiveAt)) {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-[var(--green-text)]">
        <span className="size-1.5 rounded-full bg-[var(--green-text)]" aria-hidden="true" />
        Now
      </span>
    );
  }

  return <span className={lastActiveAt ? "tabular-nums" : "text-muted-foreground"}>{lastActiveLabel(lastActiveAt)}</span>;
}

function PresenceAvatar({
  user,
  size,
  className,
  dotClassName,
}: {
  user: UserRowType;
  size: "md" | "lg";
  className?: string;
  dotClassName?: string;
}) {
  const activeNow = isActiveNow(user.lastActiveAt);

  return (
    <span className={cn("relative shrink-0", className)} title={activeNow ? "Active now" : undefined}>
      <UserAvatar
        name={user.name}
        avatarUrl={user.avatarUrl}
        size={size}
        className="ring-1 ring-border"
      />
      {activeNow && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2 border-background bg-[var(--green-text)]",
            size === "lg" ? "size-3" : "size-2.5",
            dotClassName,
          )}
          aria-hidden="true"
        />
      )}
    </span>
  );
}

function UserNameLine({
  user,
  className,
  style,
  showInactiveBadge = true,
}: {
  user: UserRowType;
  className?: string;
  style?: CSSProperties;
  showInactiveBadge?: boolean;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)} style={style}>
      <span className="truncate">
        {user.name}
      </span>
      {showInactiveBadge && user.active === false && (
        <Badge variant="outline" className="shrink-0 px-1 py-0 text-[10px] text-muted-foreground">
          Inactive
        </Badge>
      )}
    </span>
  );
}

/* ── Desktop Table Row ────────────────────────────────── */

export const UserTableRow = memo(function UserTableRow({ user }: { user: UserRowType }) {
  const router = useRouter();

  return (
    <TableRow
      className="cursor-pointer transition-colors hover:bg-muted/35 focus-visible:bg-muted/35 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]"
      tabIndex={0}
      role="link"
      aria-label={`View ${user.name}`}
      onClick={() => router.push(`/users/${user.id}`)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/users/${user.id}`); } }}
    >
      <TableCell className="w-[26rem]">
        <div className="flex items-center gap-3 min-w-0">
          <PresenceAvatar
            user={user}
            size="md"
          />
          <div className="flex flex-col gap-0.5 min-w-0">
            <UserNameLine
              user={user}
              className="text-[13px] leading-tight"
              style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
            />
            <span
              className="text-[11px] text-muted-foreground leading-tight truncate"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {user.email}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className="w-28">
        <RoleBadge role={user.role} />
      </TableCell>
      <TableCell className="hidden min-w-[16rem] lg:table-cell text-muted-foreground text-sm">
        {titleLabel(user) ?? "\u2014"}
      </TableCell>
      <TableCell className="hidden w-32 md:table-cell text-muted-foreground text-sm">
        {areaLabel(user.primaryArea) || "\u2014"}
      </TableCell>
      <TableCell className="hidden w-40 md:table-cell text-muted-foreground text-sm">
        {user.location || "\u2014"}
      </TableCell>
      <TableCell className="hidden w-36 xl:table-cell text-muted-foreground text-sm" title={lastActiveTitle(user.lastActiveAt)}>
        <div className="flex items-center">
          <LastActiveValue lastActiveAt={user.lastActiveAt} />
        </div>
      </TableCell>
    </TableRow>
  );
});

/* ── Mobile Card ──────────────────────────────────────── */

export const UserMobileCard = memo(function UserMobileCard({ user }: { user: UserRowType }) {
  const metaParts = mobileMetaParts(user);

  return (
    <Link href={`/users/${user.id}`} className="block no-underline">
      <Card className="hover:shadow-sm transition-shadow duration-150">
        <CardContent className="p-3.5">
          <div className="flex items-center gap-3.5">
            <PresenceAvatar
              user={user}
              size="lg"
            />
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <UserNameLine
                user={user}
                className="text-[13.5px] leading-tight"
                showInactiveBadge={false}
                style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
              />
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
          {metaParts.length > 0 && (
            <div
              className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground"
              style={{ paddingLeft: "56px" }}
            >
              {metaParts.map((part, index) => (
                <span key={`${part}-${index}`} className="contents">
                  {index > 0 && <span>&middot;</span>}
                  <span className="truncate">{part}</span>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
});
