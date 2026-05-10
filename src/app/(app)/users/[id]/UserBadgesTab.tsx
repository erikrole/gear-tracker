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
  LockKeyhole,
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
import { Skeleton } from "@/components/ui/skeleton";
import { useFetch } from "@/hooks/use-fetch";
import { formatDateFull } from "@/lib/format";
import { cn } from "@/lib/utils";

type StudentBadge = {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  kind: string;
  threshold: number | null;
  ruleKey: string | null;
  active: boolean;
  sortOrder: number;
  earned: boolean;
  awardedAt: string | null;
  source: "AUTO" | "MANUAL" | null;
  note: string | null;
};

type UserBadgesResponse = {
  userId: string;
  peerVisible: boolean;
  earnedCount: number;
  totalCount: number;
  badges: StudentBadge[];
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

function BadgeCard({ badge }: { badge: StudentBadge }) {
  const Icon = iconMap[badge.icon] ?? Trophy;
  const earned = badge.earned;

  return (
    <Card
      elevation={earned ? "raised" : "flat"}
      className={cn(
        "min-h-[156px]",
        !earned && "bg-muted/30 text-muted-foreground",
      )}
    >
      <CardHeader className="flex-row items-start gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground",
            earned && "bg-primary/10 text-primary",
          )}
        >
          {earned ? <Icon className="size-5" /> : <LockKeyhole className="size-5" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm leading-5">{badge.name}</CardTitle>
            {earned ? (
              <Badge variant="secondary" size="sm">Earned</Badge>
            ) : (
              <Badge variant="outline" size="sm">Locked</Badge>
            )}
          </div>
          <CardDescription className="text-xs leading-5">
            {badge.description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" size="sm">{badge.category.toLowerCase()}</Badge>
          {earned && badge.awardedAt ? (
            <span>Earned {formatDateFull(badge.awardedAt)}</span>
          ) : (
            <span>{badge.threshold ? `${badge.threshold} required` : "Rule badge"}</span>
          )}
          {!badge.active && earned && (
            <Badge variant="gray" size="sm">Retired</Badge>
          )}
        </div>
      </CardContent>
    </Card>
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
  const lockedBadges = data.badges.filter((badge) => !badge.earned && badge.active);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Earned badges" value={data.earnedCount} />
        <SummaryCard label="Available badges" value={data.totalCount} />
        <SummaryCard
          label="Completion"
          value={data.totalCount > 0 ? `${Math.round((data.earnedCount / data.totalCount) * 100)}%` : "0%"}
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
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {earnedBadges.map((badge) => (
                  <BadgeCard key={badge.id} badge={badge} />
                ))}
              </div>
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
                  Remaining badges in the active catalog.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {lockedBadges.map((badge) => (
                  <BadgeCard key={badge.id} badge={badge} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
