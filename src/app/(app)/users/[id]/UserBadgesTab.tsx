"use client";

import type { ComponentType } from "react";
import {
  AlarmClockCheck,
  BadgeCheck,
  Boxes,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Clock3,
  Flame,
  Handshake,
  PackageCheck,
  PackageOpen,
  QrCode,
  Repeat2,
  ScanLine,
  ScanSearch,
  ShieldCheck,
  Trophy,
  UserCheck,
  Warehouse,
} from "lucide-react";
import { AlertCircle } from "lucide-react";
import { BadgeMedallion } from "@/components/badges/BadgeMedallion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StaggerItem, StaggerList } from "@/components/ui/motion";
import { useFetch } from "@/hooks/use-fetch";
import { badgeRarityVariant, getBadgeRarity, isHiddenUntilEarnedBadge } from "@/lib/badges/display";
import { formatDateFull } from "@/lib/format";
import { cn } from "@/lib/utils";

type UserBadge = {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  kind: string;
  trigger: string;
  threshold: number | null;
  ruleKey: string | null;
  active: boolean;
  sortOrder: number;
  earned: boolean;
  awardedAt: string | null;
  source: "AUTO" | "MANUAL" | null;
  note: string | null;
  progressCurrent: number | null;
  progressTarget: number | null;
};

type UserBadgesResponse = {
  userId: string;
  peerVisible: boolean;
  earnedCount: number;
  totalCount: number;
  badges: UserBadge[];
  disabled?: boolean;
};

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  AlarmClockCheck,
  BadgeCheck,
  Boxes,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Clock3,
  Flame,
  Handshake,
  PackageCheck,
  PackageOpen,
  QrCode,
  Repeat2,
  ScanLine,
  ScanSearch,
  ShieldCheck,
  Trophy,
  UserCheck,
  Warehouse,
};

function BadgeGridSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Card key={index} elevation="flat">
            <CardContent className="flex items-center gap-3 p-4">
              <Skeleton className="size-10 rounded-lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Card key={index} elevation="flat">
            <CardHeader className="flex-row items-start gap-3">
              <Skeleton className="size-10 rounded-lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card elevation="flat">
      <CardContent className="p-4">
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function isRecentlyEarned(awardedAt: string | null) {
  if (!awardedAt) return false;
  const awardedAtMs = new Date(awardedAt).getTime();
  if (Number.isNaN(awardedAtMs)) return false;
  return Date.now() - awardedAtMs <= 7 * 86_400_000;
}

function BadgeCard({ badge }: { badge: UserBadge }) {
  const Icon = iconMap[badge.icon] ?? Trophy;
  const earned = badge.earned;
  const rarity = getBadgeRarity(badge);
  const recentlyEarned = earned && isRecentlyEarned(badge.awardedAt);
  const hasProgress = !earned && badge.progressCurrent !== null && badge.progressTarget !== null && badge.progressTarget > 0;
  const progressValue = hasProgress
    ? Math.min(100, Math.round((badge.progressCurrent! / badge.progressTarget!) * 100))
    : 0;

  return (
    <Card
      elevation={earned ? "raised" : "flat"}
      className={cn(
        "min-h-[178px] transition-[box-shadow,scale] duration-200 hover:shadow-sm active:scale-[0.99]",
        recentlyEarned && "ring-1 ring-primary/20",
        !earned && "bg-muted/30 text-muted-foreground",
      )}
    >
      <CardHeader className="flex-row items-start gap-3">
        <BadgeMedallion icon={Icon} earned={earned} rarity={rarity} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm leading-5">{badge.name}</CardTitle>
            <div className="flex shrink-0 items-center gap-1.5">
              {recentlyEarned ? <Badge variant="green" size="sm">New</Badge> : null}
              {earned ? (
                <Badge variant="secondary" size="sm">Earned</Badge>
              ) : (
                <Badge variant="outline" size="sm">Locked</Badge>
              )}
            </div>
          </div>
          <CardDescription className="text-xs leading-5">
            {badge.description}
          </CardDescription>
          {earned && badge.source === "MANUAL" && badge.note ? (
            <p className="mt-1 text-xs leading-5 text-foreground/80">
              {badge.note}
            </p>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" size="sm">{badge.category.toLowerCase()}</Badge>
          <Badge variant={badgeRarityVariant(rarity)} size="sm">{rarity}</Badge>
          {earned && badge.awardedAt ? (
            <span>Earned {formatDateFull(badge.awardedAt)}</span>
          ) : hasProgress ? (
            <span className="tabular-nums">{badge.progressCurrent}/{badge.progressTarget}</span>
          ) : (
            <span>{badge.threshold ? `${badge.threshold} required` : "Rule badge"}</span>
          )}
          {!badge.active && earned && (
            <Badge variant="gray" size="sm">Retired</Badge>
          )}
        </div>
        {hasProgress ? (
          <Progress
            value={progressValue}
            className="mt-3 h-1.5 bg-muted [&_[data-slot=progress-indicator]]:bg-primary/70"
            aria-label={`${badge.name} progress`}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function BadgeCardsGrid({ badges }: { badges: UserBadge[] }) {
  return (
    <StaggerList className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {badges.map((badge) => (
        <StaggerItem key={badge.id}>
          <BadgeCard badge={badge} />
        </StaggerItem>
      ))}
    </StaggerList>
  );
}

export default function UserBadgesTab({ userId }: { userId: string }) {
  const { data, loading, error } = useFetch<UserBadgesResponse>({
    url: `/api/badges/user/${userId}`,
    returnTo: `/users/${userId}?tab=badges`,
    refetchOnFocus: false,
  });

  if (loading) {
    return <BadgeGridSkeleton />;
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Badges unavailable</AlertTitle>
        <AlertDescription>
          This badge profile could not be loaded.
        </AlertDescription>
      </Alert>
    );
  }

  const earnedBadges = data.badges.filter((badge) => badge.earned);
  const lockedBadges = data.badges.filter(
    (badge) => !badge.earned && badge.active && !isHiddenUntilEarnedBadge(badge.key),
  );
  const hiddenSurpriseCount = data.badges.filter(
    (badge) => !badge.earned && badge.active && isHiddenUntilEarnedBadge(badge.key),
  ).length;
  const visibleTotalCount = earnedBadges.length + lockedBadges.length;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Earned badges" value={data.earnedCount} />
        <SummaryCard label="Visible badges" value={visibleTotalCount} />
        <SummaryCard
          label="Completion"
          value={visibleTotalCount > 0 ? `${Math.round((data.earnedCount / visibleTotalCount) * 100)}%` : "0%"}
        />
      </div>

      {data.disabled ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Trophy />
            </EmptyMedia>
            <EmptyTitle>Badges unavailable</EmptyTitle>
            <EmptyDescription>
              Badge profiles will appear here after achievements are enabled.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : data.badges.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Trophy />
            </EmptyMedia>
            <EmptyTitle>No badges yet</EmptyTitle>
            <EmptyDescription>
              Earned badges will appear here after badge definitions are seeded.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="text-base font-semibold">Earned</h2>
              <p className="text-sm text-muted-foreground">
                Recognition earned from completed kiosk and operations work.
              </p>
            </div>
            {earnedBadges.length > 0 ? (
              <BadgeCardsGrid badges={earnedBadges} />
            ) : (
              <Empty className="min-h-[180px]">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Trophy />
                  </EmptyMedia>
                  <EmptyTitle>No earned badges</EmptyTitle>
                  <EmptyDescription>
                    First awards will show here after qualifying badge events.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </section>

          {lockedBadges.length > 0 && (
            <section className="flex flex-col gap-3">
              <div>
                <h2 className="text-base font-semibold">Available</h2>
                <p className="text-sm text-muted-foreground">
                  Remaining visible badges in the active catalog.
                  {hiddenSurpriseCount > 0 ? ` ${hiddenSurpriseCount} surprise ${hiddenSurpriseCount === 1 ? "badge is" : "badges are"} hidden until earned.` : ""}
                </p>
              </div>
              <BadgeCardsGrid badges={lockedBadges} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
