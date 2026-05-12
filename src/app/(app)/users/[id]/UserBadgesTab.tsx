"use client";

import { useMemo, useState, type ComponentType } from "react";
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
  Sparkles,
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
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { StaggerItem, StaggerList } from "@/components/ui/motion";
import { useFetch } from "@/hooks/use-fetch";
import { badgeRarityVariant, getBadgeRarity, isHiddenUntilEarnedBadge, type BadgeRarity } from "@/lib/badges/display";
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

type BadgeFilter = "all" | "earned" | "locked" | "manual" | "rare";

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
  Sparkles,
  Trophy,
  UserCheck,
  Warehouse,
};

const categoryLabel: Record<string, string> = {
  CHECKOUT: "Checkout",
  RETURN: "Returns",
  SCAN: "Scans",
  TRADE: "Trades",
  SHIFT: "Shifts",
  MILESTONE: "Milestones",
};

const filterLabels: Record<BadgeFilter, string> = {
  all: "All",
  earned: "Earned",
  locked: "Locked",
  manual: "Manual",
  rare: "Rare",
};

function BadgeGridSkeleton() {
  return (
    <div className="flex flex-col gap-5">
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
              <Skeleton className="size-12 rounded-xl" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card elevation="flat">
      <CardContent className="p-4">
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="mt-1 text-xs font-medium text-muted-foreground">{label}</div>
        {hint ? <div className="mt-2 text-xs text-muted-foreground/80">{hint}</div> : null}
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

function readableCategory(category: string) {
  return categoryLabel[category] ?? category.toLowerCase().replaceAll("_", " ");
}

function hasProgress(badge: UserBadge) {
  return !badge.earned && badge.progressCurrent !== null && badge.progressTarget !== null && badge.progressTarget > 0;
}

function progressPercent(badge: UserBadge) {
  if (!hasProgress(badge)) return 0;
  return Math.min(100, Math.round((badge.progressCurrent! / badge.progressTarget!) * 100));
}

function badgeMetaLine(badge: UserBadge) {
  if (badge.earned && badge.awardedAt) return `Earned ${formatDateFull(badge.awardedAt)}`;
  if (hasProgress(badge)) return `${badge.progressCurrent}/${badge.progressTarget}`;
  if (badge.threshold) return `${badge.threshold} required`;
  return badge.earned ? "Earned" : "Rule badge";
}

function rarityGlowClass(rarity: BadgeRarity) {
  if (rarity === "Legendary") return "shadow-[0_0_0_1px_var(--purple-text),0_0_34px_var(--purple-bg)]";
  if (rarity === "Rare") return "shadow-[0_0_0_1px_var(--orange-text),0_0_30px_var(--orange-bg)]";
  if (rarity === "Uncommon") return "shadow-[0_0_0_1px_var(--blue-text),0_0_26px_var(--blue-bg)]";
  return "shadow-[0_0_0_1px_hsl(var(--primary)/0.25),0_0_22px_hsl(var(--primary)/0.12)]";
}

function BadgeTile({
  badge,
  selected,
  onSelect,
}: {
  badge: UserBadge;
  selected: boolean;
  onSelect: (badge: UserBadge) => void;
}) {
  const Icon = iconMap[badge.icon] ?? Trophy;
  const rarity = getBadgeRarity(badge);
  const recentlyEarned = badge.earned && isRecentlyEarned(badge.awardedAt);
  const progressValue = progressPercent(badge);

  return (
    <button
      type="button"
      onClick={() => onSelect(badge)}
      className={cn(
        "group relative flex min-h-[184px] w-full flex-col rounded-xl bg-card p-4 text-left shadow-[0_0_0_1px_hsl(var(--border))] outline-none transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_34px_hsl(var(--foreground)/0.08),0_0_0_1px_hsl(var(--border))] focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.96]",
        !badge.earned && "bg-muted/30 text-muted-foreground",
        recentlyEarned && rarityGlowClass(rarity),
        selected && "ring-[3px] ring-ring/30",
      )}
      aria-label={`${badge.name}, ${badge.earned ? "earned" : "locked"}. Open badge details.`}
    >
      {recentlyEarned ? (
        <span className="pointer-events-none absolute inset-0 rounded-xl bg-primary/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      ) : null}
      <div className="relative flex items-start gap-3">
        <BadgeMedallion
          icon={Icon}
          earned={badge.earned}
          rarity={rarity}
          className={cn("rounded-xl", recentlyEarned && "scale-[1.03]")}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold leading-5 text-foreground text-balance">{badge.name}</h3>
            {recentlyEarned ? <Badge variant="green" size="sm">New</Badge> : null}
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{badge.description}</p>
        </div>
      </div>

      <div className="relative mt-auto flex flex-col gap-3 pt-4">
        {hasProgress(badge) ? (
          <Progress
            value={progressValue}
            className="h-1.5 bg-muted [&_[data-slot=progress-indicator]]:bg-primary/70"
            aria-label={`${badge.name} progress`}
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={badge.earned ? "secondary" : "outline"} size="sm">
            {badge.earned ? "Earned" : "Locked"}
          </Badge>
          <Badge variant={badgeRarityVariant(rarity)} size="sm">{rarity}</Badge>
          {badge.source === "MANUAL" ? <Badge variant="purple" size="sm">Manual</Badge> : null}
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">{badgeMetaLine(badge)}</p>
      </div>
    </button>
  );
}

function SurpriseTile({ count }: { count: number }) {
  return (
    <div className="flex min-h-[184px] flex-col rounded-xl bg-muted/30 p-4 text-muted-foreground shadow-[0_0_0_1px_hsl(var(--border))]">
      <div className="flex items-start gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted shadow-[inset_0_0_0_1px_hsl(var(--border))]" aria-hidden="true">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Surprise badges</h3>
          <p className="mt-1 text-xs leading-5">
            {count} hidden {count === 1 ? "badge is" : "badges are"} waiting for the right moment.
          </p>
        </div>
      </div>
      <div className="mt-auto pt-4">
        <Badge variant="outline" size="sm">Hidden until earned</Badge>
      </div>
    </div>
  );
}

function BadgeGallery({
  badges,
  hiddenSurpriseCount,
  selectedBadge,
  onSelect,
}: {
  badges: UserBadge[];
  hiddenSurpriseCount: number;
  selectedBadge: UserBadge | null;
  onSelect: (badge: UserBadge) => void;
}) {
  return (
    <StaggerList className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {badges.map((badge) => (
        <StaggerItem key={badge.id}>
          <BadgeTile
            badge={badge}
            selected={selectedBadge?.id === badge.id}
            onSelect={onSelect}
          />
        </StaggerItem>
      ))}
      {hiddenSurpriseCount > 0 ? (
        <StaggerItem>
          <SurpriseTile count={hiddenSurpriseCount} />
        </StaggerItem>
      ) : null}
    </StaggerList>
  );
}

function BadgeDetailDialog({
  badge,
  onOpenChange,
}: {
  badge: UserBadge | null;
  onOpenChange: (open: boolean) => void;
}) {
  const Icon = badge ? iconMap[badge.icon] ?? Trophy : Trophy;
  const rarity = badge ? getBadgeRarity(badge) : "Common";
  const progressValue = badge ? progressPercent(badge) : 0;

  return (
    <Dialog open={Boolean(badge)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[620px] overflow-hidden">
        {badge ? (
          <>
            <DialogHeader className="items-start gap-4 pr-12 sm:flex-row">
              <BadgeMedallion icon={Icon} earned={badge.earned} rarity={rarity} className="size-16 rounded-2xl" />
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant={badge.earned ? "secondary" : "outline"}>{badge.earned ? "Earned" : "Locked"}</Badge>
                  <Badge variant={badgeRarityVariant(rarity)}>{rarity}</Badge>
                  {badge.source === "MANUAL" ? <Badge variant="purple">Manual</Badge> : null}
                  {!badge.active && badge.earned ? <Badge variant="gray">Retired</Badge> : null}
                </div>
                <DialogTitle className="text-balance text-2xl">{badge.name}</DialogTitle>
                <DialogDescription className="mt-2 text-pretty leading-6">
                  {badge.description}
                </DialogDescription>
              </div>
            </DialogHeader>
            <DialogBody className="pb-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <DetailMetric label="Category" value={readableCategory(badge.category)} />
                <DetailMetric label="Source" value={badge.source === "MANUAL" ? "Manual award" : badge.earned ? "Automatic" : "Not earned"} />
                <DetailMetric label="Earned date" value={badge.awardedAt ? formatDateFull(badge.awardedAt) : "Not earned yet"} />
              </div>

              {hasProgress(badge) ? (
                <div className="mt-5 rounded-xl bg-muted/40 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground">Progress</span>
                    <span className="text-muted-foreground tabular-nums">{badge.progressCurrent}/{badge.progressTarget}</span>
                  </div>
                  <Progress value={progressValue} className="h-2" />
                </div>
              ) : null}

              {badge.note ? (
                <div className="mt-5 rounded-xl bg-muted/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Award note</p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{badge.note}</p>
                </div>
              ) : null}

              <Separator className="my-5" />

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" size="sm">{badge.kind.toLowerCase()}</Badge>
                <Badge variant="outline" size="sm">{badge.trigger}</Badge>
                {badge.ruleKey ? <Badge variant="outline" size="sm">{badge.ruleKey}</Badge> : null}
                {!badge.earned && !hasProgress(badge) ? (
                  <span className="inline-flex items-center gap-1">
                    <LockKeyhole className="size-3.5" aria-hidden="true" />
                    Unlocks from a qualifying workflow or staff recognition.
                  </span>
                ) : null}
              </div>
            </DialogBody>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function filterBadges(badges: UserBadge[], filter: BadgeFilter) {
  if (filter === "earned") return badges.filter((badge) => badge.earned);
  if (filter === "locked") return badges.filter((badge) => !badge.earned);
  if (filter === "manual") return badges.filter((badge) => badge.source === "MANUAL" || (badge.kind === "RULE" && badge.trigger === "manual"));
  if (filter === "rare") {
    return badges.filter((badge) => {
      const rarity = getBadgeRarity(badge);
      return rarity === "Rare" || rarity === "Legendary";
    });
  }
  return badges;
}

export default function UserBadgesTab({ userId }: { userId: string }) {
  const [filter, setFilter] = useState<BadgeFilter>("all");
  const [selectedBadge, setSelectedBadge] = useState<UserBadge | null>(null);
  const { data, loading, error } = useFetch<UserBadgesResponse>({
    url: `/api/badges/user/${userId}`,
    returnTo: `/users/${userId}?tab=badges`,
    refetchOnFocus: false,
  });

  const galleryBadges = useMemo(() => {
    if (!data) return [];
    return data.badges.filter(
      (badge) => badge.earned || (badge.active && !isHiddenUntilEarnedBadge(badge.key)),
    );
  }, [data]);

  const filteredBadges = useMemo(() => filterBadges(galleryBadges, filter), [filter, galleryBadges]);

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
  const hiddenSurpriseCount = data.badges.filter(
    (badge) => !badge.earned && badge.active && isHiddenUntilEarnedBadge(badge.key),
  ).length;
  const visibleTotalCount = galleryBadges.length;
  const completion = visibleTotalCount > 0 ? Math.round((data.earnedCount / visibleTotalCount) * 100) : 0;
  const showHiddenSurpriseTile = filter === "all" || filter === "locked";

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Earned badges" value={data.earnedCount} hint="Unlocked recognition" />
        <SummaryCard label="Gallery" value={visibleTotalCount} hint="Visible badges" />
        <SummaryCard label="Completion" value={`${completion}%`} hint="Visible catalog" />
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
        <>
          <Card elevation="flat">
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Badge gallery</CardTitle>
                <CardDescription>
                  Browse every visible badge, then open one for the full story.
                </CardDescription>
              </div>
              <ToggleGroup
                type="single"
                value={filter}
                onValueChange={(value) => {
                  if (value) setFilter(value as BadgeFilter);
                }}
                className="flex-wrap justify-start sm:justify-end"
                aria-label="Filter badges"
              >
                {(Object.keys(filterLabels) as BadgeFilter[]).map((key) => (
                  <ToggleGroupItem key={key} value={key} aria-label={`Show ${filterLabels[key].toLowerCase()} badges`}>
                    {filterLabels[key]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </CardHeader>
          </Card>

          {filteredBadges.length > 0 || (showHiddenSurpriseTile && hiddenSurpriseCount > 0) ? (
            <BadgeGallery
              badges={filteredBadges}
              hiddenSurpriseCount={showHiddenSurpriseTile ? hiddenSurpriseCount : 0}
              selectedBadge={selectedBadge}
              onSelect={setSelectedBadge}
            />
          ) : (
            <Empty className="min-h-[220px]">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  {filter === "locked" ? <LockKeyhole /> : <Trophy />}
                </EmptyMedia>
                <EmptyTitle>No {filterLabels[filter].toLowerCase()} badges</EmptyTitle>
                <EmptyDescription>
                  Try another gallery filter.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {earnedBadges.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Recently earned badges get a soft glow for one week. Surprise badges stay hidden until earned.
            </p>
          ) : null}
        </>
      )}

      <BadgeDetailDialog
        badge={selectedBadge}
        onOpenChange={(open) => {
          if (!open) setSelectedBadge(null);
        }}
      />
    </div>
  );
}
