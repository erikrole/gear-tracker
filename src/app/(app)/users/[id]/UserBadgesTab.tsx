"use client";

import { useMemo, useState, type ComponentType } from "react";
import {
  AlarmClockCheck,
  AlertCircle,
  ArrowLeft,
  Award,
  BadgeCheck,
  Boxes,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChevronRight,
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
  Star,
  Trash2,
  Trophy,
  UserCheck,
  Warehouse,
} from "lucide-react";
import { BadgeMedallion, type BadgeMedallionShape } from "@/components/badges/BadgeMedallion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  awardedByName: string | null;
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
type AwardCollectionKey = "gear_flow" | "reliability" | "scans" | "teamwork" | "staff_picks";

type AwardCollectionDefinition = {
  key: AwardCollectionKey;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  shape: BadgeMedallionShape;
};

type AwardCollection = AwardCollectionDefinition & {
  badges: UserBadge[];
  earnedCount: number;
  hiddenCount: number;
  featuredBadge: UserBadge | null;
  previewBadges: UserBadge[];
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
  Sparkles,
  Trophy,
  UserCheck,
  Warehouse,
};

const categoryLabel: Record<string, string> = {
  CHECKOUT: "Checkout",
  ON_TIME: "On-time returns",
  SCAN: "Scans",
  TRADE: "Trades",
  SHIFT: "Shifts",
  STREAK: "Streaks",
  MILESTONE: "Milestones",
};

const filterLabels: Record<BadgeFilter, string> = {
  all: "All",
  earned: "Earned",
  locked: "Locked",
  manual: "Manual",
  rare: "Rare",
};

const awardCollectionDefinitions: AwardCollectionDefinition[] = [
  {
    key: "gear_flow",
    title: "Gear Flow",
    description: "Checkout, pickup, full-kit, and clean handoff awards.",
    icon: PackageCheck,
    shape: "stack",
  },
  {
    key: "reliability",
    title: "Reliability",
    description: "On-time returns, clean streaks, and no-drama follow-through.",
    icon: AlarmClockCheck,
    shape: "coin",
  },
  {
    key: "scans",
    title: "Scans",
    description: "QR scan wins, clean scan streaks, and lookup accuracy.",
    icon: ScanLine,
    shape: "hex",
  },
  {
    key: "teamwork",
    title: "Teamwork",
    description: "Trades, coverage, event help, and above-and-beyond moments.",
    icon: Handshake,
    shape: "shield",
  },
  {
    key: "staff_picks",
    title: "Staff Picks",
    description: "Manual awards, inside jokes, and custom recognition.",
    icon: Sparkles,
    shape: "hex",
  },
];

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

function rarityStageClass(rarity: BadgeRarity) {
  if (rarity === "Legendary") {
    return "bg-[radial-gradient(circle_at_22%_14%,var(--purple-bg),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.30),transparent_28%),linear-gradient(135deg,var(--background),var(--purple-bg))]";
  }
  if (rarity === "Rare") {
    return "bg-[radial-gradient(circle_at_22%_14%,var(--orange-bg),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.28),transparent_28%),linear-gradient(135deg,var(--background),var(--orange-bg))]";
  }
  if (rarity === "Uncommon") {
    return "bg-[radial-gradient(circle_at_22%_14%,var(--blue-bg),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.26),transparent_28%),linear-gradient(135deg,var(--background),var(--blue-bg))]";
  }
  return "bg-[radial-gradient(circle_at_22%_14%,rgba(255,255,255,0.24),transparent_32%),linear-gradient(135deg,var(--background),var(--muted))]";
}

function rarityAccentClass(rarity: BadgeRarity) {
  if (rarity === "Legendary") return "bg-[var(--purple-text)] text-[var(--purple-bg)]";
  if (rarity === "Rare") return "bg-[var(--orange-text)] text-[var(--orange-bg)]";
  if (rarity === "Uncommon") return "bg-[var(--blue-text)] text-[var(--blue-bg)]";
  return "bg-primary text-primary-foreground";
}

function badgeStatusCopy(badge: UserBadge, rarity: BadgeRarity) {
  if (!badge.earned) return "Locked in the catalog";
  if (badge.source === "MANUAL") return `${rarity} manual recognition`;
  return `${rarity} achievement unlocked`;
}

function isManualBadge(badge: UserBadge) {
  return badge.source === "MANUAL" || (badge.kind === "RULE" && badge.trigger === "manual");
}

function badgeCollectionKeys(badge: UserBadge): AwardCollectionKey[] {
  const keys = new Set<AwardCollectionKey>();
  if (badge.category === "CHECKOUT") keys.add("gear_flow");
  if (badge.category === "ON_TIME") keys.add("reliability");
  if (badge.category === "SCAN") keys.add("scans");
  if (badge.category === "TRADE" || badge.category === "SHIFT") keys.add("teamwork");
  if (isManualBadge(badge) || badge.category === "MILESTONE") keys.add("staff_picks");
  if (badge.key.includes("streak") || badge.key.includes("reliable") || badge.key.includes("zero_errors")) keys.add("reliability");
  if (badge.key.includes("handoff") || badge.key.includes("kit") || badge.key.includes("rookie")) keys.add("gear_flow");
  if (badge.key.includes("clutch") || badge.key.includes("hero") || badge.key.includes("above")) keys.add("teamwork");
  if (keys.size === 0) keys.add("gear_flow");
  return Array.from(keys);
}

function badgeShape(badge: UserBadge): BadgeMedallionShape {
  if (badge.category === "SCAN") return "hex";
  if (badge.category === "TRADE" || badge.category === "SHIFT") return "shield";
  if (badge.category === "CHECKOUT" || badge.category === "ON_TIME") return "stack";
  if (isManualBadge(badge)) return "hex";
  return "coin";
}

function sortedForDisplay(badges: UserBadge[]) {
  return [...badges].sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    const aDate = a.awardedAt ? new Date(a.awardedAt).getTime() : 0;
    const bDate = b.awardedAt ? new Date(b.awardedAt).getTime() : 0;
    if (aDate !== bDate) return bDate - aDate;
    return a.sortOrder - b.sortOrder;
  });
}

function buildAwardCollections(badges: UserBadge[]) {
  const grouped = new Map<AwardCollectionKey, UserBadge[]>(
    awardCollectionDefinitions.map((definition) => [definition.key, []]),
  );

  for (const badge of badges) {
    for (const key of badgeCollectionKeys(badge)) {
      grouped.get(key)?.push(badge);
    }
  }

  return awardCollectionDefinitions
    .map((definition): AwardCollection => {
      const collectionBadges = sortedForDisplay(grouped.get(definition.key) ?? []);
      const earnedBadges = collectionBadges.filter((badge) => badge.earned);
      const featuredBadge = earnedBadges[0] ?? collectionBadges[0] ?? null;
      return {
        ...definition,
        badges: collectionBadges,
        earnedCount: earnedBadges.length,
        hiddenCount: collectionBadges.filter((badge) => !badge.earned && isHiddenUntilEarnedBadge(badge.key)).length,
        featuredBadge,
        previewBadges: sortedForDisplay(collectionBadges).slice(0, 4),
      };
    })
    .filter((collection) => collection.badges.length > 0);
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
          shape={badgeShape(badge)}
          className={cn(recentlyEarned && "scale-[1.03]")}
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

function AwardCollectionCard({
  collection,
  onOpen,
}: {
  collection: AwardCollection;
  onOpen: (collectionKey: AwardCollectionKey) => void;
}) {
  const FeaturedIcon = collection.featuredBadge ? iconMap[collection.featuredBadge.icon] ?? collection.icon : collection.icon;
  const featuredRarity = collection.featuredBadge ? getBadgeRarity(collection.featuredBadge) : "Common";
  const moreCount = Math.max(0, collection.badges.length - collection.previewBadges.length);
  const latestEarnedDate = collection.badges.find((badge) => badge.earned && badge.awardedAt)?.awardedAt;

  return (
    <button
      type="button"
      onClick={() => onOpen(collection.key)}
      className="group relative flex min-h-[320px] w-full flex-col overflow-hidden rounded-2xl bg-card p-5 text-left shadow-[0_0_0_1px_hsl(var(--border)),0_16px_44px_rgba(0,0,0,0.06)] outline-none transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(0,0,0,0.10),0_0_0_1px_hsl(var(--border))] focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.96]"
      aria-label={`${collection.title}, ${collection.earnedCount} of ${collection.badges.length} awards earned. Open collection.`}
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.70),transparent_32%),radial-gradient(circle_at_75%_12%,var(--blue-bg),transparent_34%)] opacity-60 transition-opacity duration-200 group-hover:opacity-90" />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background/70 to-transparent" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <h3 className="text-balance text-2xl font-semibold leading-tight tracking-tight">{collection.title}</h3>
          <p className="mt-2 line-clamp-2 max-w-[28ch] text-sm leading-6 text-muted-foreground">{collection.description}</p>
        </div>
        <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden="true" />
      </div>

      <div className="relative my-6 flex flex-1 items-center justify-center">
        <BadgeMedallion
          icon={FeaturedIcon}
          earned={collection.featuredBadge?.earned ?? false}
          rarity={featuredRarity}
          shape={collection.featuredBadge ? badgeShape(collection.featuredBadge) : collection.shape}
          className="size-32 shadow-[0_24px_44px_rgba(0,0,0,0.18)]"
          iconClassName="size-12"
        />
      </div>

      <div className="relative mt-auto flex items-end justify-between gap-3">
        <div className="flex min-w-0 items-center">
          {collection.previewBadges.slice(0, 4).map((badge, index) => {
            const Icon = iconMap[badge.icon] ?? Trophy;
            return (
              <BadgeMedallion
                key={badge.id}
                icon={Icon}
                earned={badge.earned}
                rarity={getBadgeRarity(badge)}
                shape={badgeShape(badge)}
                className={cn("size-10 shadow-[0_10px_20px_rgba(0,0,0,0.16)]", index > 0 && "-ml-3")}
              />
            );
          })}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums">
            {collection.earnedCount}/{collection.badges.length}
          </p>
          <p className="text-xs text-muted-foreground">
            {moreCount > 0 ? `+${moreCount} more` : latestEarnedDate ? formatDateFull(latestEarnedDate) : "All visible"}
          </p>
          <p className="text-xs font-semibold text-primary">Show all</p>
        </div>
      </div>
    </button>
  );
}

function AwardCollections({
  collections,
  hiddenSurpriseCount,
  onOpen,
}: {
  collections: AwardCollection[];
  hiddenSurpriseCount: number;
  onOpen: (collectionKey: AwardCollectionKey) => void;
}) {
  return (
    <StaggerList className="grid gap-4 md:grid-cols-2">
      {collections.map((collection) => (
        <StaggerItem key={collection.key}>
          <AwardCollectionCard collection={collection} onOpen={onOpen} />
        </StaggerItem>
      ))}
      {hiddenSurpriseCount > 0 ? (
        <StaggerItem>
          <div className="flex min-h-[320px] flex-col overflow-hidden rounded-2xl bg-muted/30 p-5 text-muted-foreground shadow-[0_0_0_1px_hsl(var(--border))]">
            <div>
              <h3 className="text-balance text-2xl font-semibold leading-tight text-foreground">Surprise Awards</h3>
              <p className="mt-2 text-sm leading-6">
                {hiddenSurpriseCount} hidden {hiddenSurpriseCount === 1 ? "award is" : "awards are"} waiting for the right workflow.
              </p>
            </div>
            <div className="my-8 flex flex-1 items-center justify-center">
              <BadgeMedallion icon={Sparkles} earned={false} rarity="Rare" shape="hex" className="size-28 opacity-80" iconClassName="size-10" />
            </div>
            <Badge variant="outline" className="w-fit">Hidden until earned</Badge>
          </div>
        </StaggerItem>
      ) : null}
    </StaggerList>
  );
}

function AwardCollectionDetail({
  collection,
  filter,
  hiddenSurpriseCount,
  selectedBadge,
  onBack,
  onFilterChange,
  onSelect,
}: {
  collection: AwardCollection;
  filter: BadgeFilter;
  hiddenSurpriseCount: number;
  selectedBadge: UserBadge | null;
  onBack: () => void;
  onFilterChange: (filter: BadgeFilter) => void;
  onSelect: (badge: UserBadge) => void;
}) {
  const filteredBadges = filterBadges(collection.badges, filter);
  const showHiddenSurpriseTile = (filter === "all" || filter === "locked") && hiddenSurpriseCount > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-card p-5 shadow-[0_0_0_1px_hsl(var(--border))]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to award collections" className="shrink-0">
              <ArrowLeft data-icon="inline-start" />
            </Button>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Award collection</p>
              <h3 className="mt-1 text-balance text-3xl font-semibold leading-tight tracking-tight">{collection.title}</h3>
              <p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">{collection.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="tabular-nums">{collection.earnedCount} earned</Badge>
                <Badge variant="outline" className="tabular-nums">{collection.badges.length} visible</Badge>
                {hiddenSurpriseCount > 0 ? <Badge variant="outline" className="tabular-nums">{hiddenSurpriseCount} hidden</Badge> : null}
              </div>
            </div>
          </div>
          <ToggleGroup
            type="single"
            value={filter}
            onValueChange={(value) => {
              if (value) onFilterChange(value as BadgeFilter);
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
        </div>
      </div>

      {filteredBadges.length > 0 || showHiddenSurpriseTile ? (
        <BadgeGallery
          badges={filteredBadges}
          hiddenSurpriseCount={showHiddenSurpriseTile ? hiddenSurpriseCount : 0}
          selectedBadge={selectedBadge}
          onSelect={onSelect}
        />
      ) : (
        <Empty className="min-h-[220px]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {filter === "locked" ? <LockKeyhole /> : <Trophy />}
            </EmptyMedia>
            <EmptyTitle>No {filterLabels[filter].toLowerCase()} awards</EmptyTitle>
            <EmptyDescription>
              Try another collection filter.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}

function BadgeDetailDialog({
  badge,
  canRevoke = false,
  canAward = false,
  onOpenChange,
  onRevoke,
  onAwardRequest,
}: {
  badge: UserBadge | null;
  canRevoke?: boolean;
  canAward?: boolean;
  onOpenChange: (open: boolean) => void;
  onRevoke?: (badgeId: string) => void;
  onAwardRequest?: (badge: UserBadge) => void;
}) {
  const [revokeBusy, setRevokeBusy] = useState(false);
  const Icon = badge ? iconMap[badge.icon] ?? Trophy : Trophy;
  const rarity = badge ? getBadgeRarity(badge) : "Common";
  const progressValue = badge ? progressPercent(badge) : 0;
  const recentlyEarned = badge ? badge.earned && isRecentlyEarned(badge.awardedAt) : false;

  async function handleRevoke() {
    if (!badge || revokeBusy) return;
    setRevokeBusy(true);
    try {
      const res = await fetch(`/api/badges/award/${badge.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Revoke failed");
      onRevoke?.(badge.id);
      onOpenChange(false);
    } finally {
      setRevokeBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(badge)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] overflow-hidden border-0 p-0 shadow-[0_24px_80px_rgba(0,0,0,0.22),0_0_0_1px_var(--border)] sm:rounded-2xl">
        {badge ? (
          <>
            <DialogHeader className={cn("relative isolate block overflow-hidden border-b-0 px-6 pb-8 pt-10 shadow-[0_1px_0_0_hsl(var(--border)/0.5)] sm:px-10", rarityStageClass(rarity))}>
              <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.40)_46%,transparent_58%)] motion-safe:animate-[badge-shine_4.8s_ease-in-out_infinite] motion-reduce:animate-none" />
              <div className="pointer-events-none absolute left-1/2 top-0 size-56 -translate-x-1/2 -translate-y-1/3 rounded-full bg-background/15 blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 left-1/4 size-32 rounded-full bg-background/10 blur-2xl" />

              {/* Centered medallion stage */}
              <div className="relative mx-auto mb-6 flex size-44 items-center justify-center">
                <span className={cn("absolute inset-0 rounded-[2.75rem] opacity-35 blur-2xl", rarityAccentClass(rarity))} aria-hidden="true" />
                <span className="absolute inset-3 rounded-[2.25rem] bg-background/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.60),0_28px_56px_rgba(0,0,0,0.18)]" aria-hidden="true" />
                <BadgeMedallion
                  icon={Icon}
                  earned={badge.earned}
                  rarity={rarity}
                  shape={badgeShape(badge)}
                  className="size-32"
                  iconClassName="size-14"
                />
                {badge.earned ? (
                  <>
                    <Sparkles className="absolute -right-2 top-6 size-5 text-foreground/50 motion-safe:animate-[badge-float_2.8s_ease-in-out_infinite] motion-reduce:animate-none" aria-hidden="true" />
                    <Star className="absolute bottom-6 -left-2 size-4 text-foreground/40 motion-safe:animate-[badge-float_3.4s_ease-in-out_infinite] motion-reduce:animate-none" aria-hidden="true" />
                  </>
                ) : null}
              </div>

              {/* Centered text */}
              <div className="relative text-center">
                <div className="mb-4 flex flex-wrap justify-center gap-2">
                  <Badge variant={badge.earned ? "secondary" : "outline"}>{badge.earned ? "Earned" : "Locked"}</Badge>
                  <Badge variant={badgeRarityVariant(rarity)}>{rarity}</Badge>
                  {badge.source === "MANUAL" ? <Badge variant="purple">Manual</Badge> : null}
                  {recentlyEarned ? <Badge variant="green">Fresh</Badge> : null}
                  {!badge.active && badge.earned ? <Badge variant="gray">Retired</Badge> : null}
                </div>
                <DialogTitle className="text-balance !text-3xl font-semibold leading-tight tracking-tight sm:!text-4xl">
                  {badge.name}
                </DialogTitle>
                <DialogDescription className="mx-auto mt-3 max-w-[48ch] text-pretty text-base leading-7 text-foreground/75">
                  {badge.description}
                </DialogDescription>
              </div>
            </DialogHeader>
            <DialogBody className="bg-background px-6 pb-7 pt-5 sm:px-8">
              <div className="flex flex-wrap gap-4 rounded-2xl bg-muted/35 px-5 py-4 shadow-[inset_0_0_0_1px_hsl(var(--border))]">
                <DetailMetric icon={Trophy} label="Category" value={readableCategory(badge.category)} />
                <div className="w-px self-stretch bg-border/60" aria-hidden="true" />
                <DetailMetric icon={UserCheck} label="Source" value={badge.source === "MANUAL" ? "Manual award" : badge.earned ? "Automatic" : "Not earned"} />
                <div className="w-px self-stretch bg-border/60" aria-hidden="true" />
                <DetailMetric icon={CalendarCheck2} label="Earned date" value={badge.awardedAt ? formatDateFull(badge.awardedAt) : "Not earned yet"} />
              </div>

              {hasProgress(badge) ? (
                <div className="mt-5 rounded-2xl bg-muted/40 p-4 shadow-[inset_0_0_0_1px_hsl(var(--border))]">
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground">Progress</span>
                    <span className="text-muted-foreground tabular-nums">{badge.progressCurrent}/{badge.progressTarget}</span>
                  </div>
                  <Progress value={progressValue} className="h-2" />
                </div>
              ) : null}

              {(badge.note || badge.awardedByName) ? (
                <div className="mt-5 flex gap-4 overflow-hidden rounded-2xl bg-muted/30 shadow-[inset_0_0_0_1px_hsl(var(--border))]">
                  <div
                    className={cn(
                      "w-1 shrink-0 rounded-l-2xl",
                      rarity === "Legendary" && "bg-[var(--purple-text)]/70",
                      rarity === "Rare" && "bg-[var(--orange-text)]/70",
                      rarity === "Uncommon" && "bg-[var(--blue-text)]/70",
                      rarity === "Common" && "bg-primary/40",
                    )}
                    aria-hidden="true"
                  />
                  <div className="py-5 pr-5">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      <BadgeCheck className="size-3.5" aria-hidden="true" />
                      Award note
                    </p>
                    {badge.note ? <p className="mt-3 text-pretty text-sm leading-6 text-foreground">{badge.note}</p> : null}
                    {badge.awardedByName ? (
                      <p className="mt-2 text-xs text-muted-foreground">-- {badge.awardedByName}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {(!badge.earned && !hasProgress(badge)) || canRevoke || (canAward && !badge.earned && badge.trigger === "manual") ? (
                <>
                  <Separator className="my-5" />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {!badge.earned && !hasProgress(badge) ? (
                        <span className="inline-flex items-center gap-1">
                          <LockKeyhole className="size-3.5" aria-hidden="true" />
                          Unlocks from a qualifying workflow or staff recognition.
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {canAward && !badge.earned && badge.trigger === "manual" ? (
                        <Button size="sm" variant="outline" onClick={() => onAwardRequest?.(badge)}>
                          <Award className="size-3.5" />
                          Award this badge
                        </Button>
                      ) : null}
                      {canRevoke && badge.earned && badge.source === "MANUAL" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleRevoke}
                          disabled={revokeBusy}
                          className="text-destructive hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <Trash2 className="size-3.5" />
                          {revokeBusy ? "Revoking..." : "Revoke award"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : null}
            </DialogBody>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))]" aria-hidden="true">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-foreground text-balance">{value}</p>
      </div>
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

export default function UserBadgesTab({
  userId,
  canRevoke = false,
  canAward = false,
  onAwardRequest,
}: {
  userId: string;
  canRevoke?: boolean;
  canAward?: boolean;
  onAwardRequest?: (badge: UserBadge) => void;
}) {
  const [filter, setFilter] = useState<BadgeFilter>("all");
  const [activeCollectionKey, setActiveCollectionKey] = useState<AwardCollectionKey | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<UserBadge | null>(null);
  const [revision, setRevision] = useState(0);
  const { data, loading, error } = useFetch<UserBadgesResponse>({
    url: `/api/badges/user/${userId}?_r=${revision}`,
    returnTo: `/users/${userId}?tab=badges`,
    refetchOnFocus: false,
  });

  const galleryBadges = useMemo(() => {
    if (!data) return [];
    return data.badges.filter(
      (badge) => badge.earned || (badge.active && !isHiddenUntilEarnedBadge(badge.key)),
    );
  }, [data]);

  const awardCollections = useMemo(() => buildAwardCollections(galleryBadges), [galleryBadges]);

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
  const activeCollection = awardCollections.find((collection) => collection.key === activeCollectionKey) ?? null;
  const activeHiddenSurpriseCount = activeCollection
    ? data.badges.filter((badge) => !badge.earned && badge.active && isHiddenUntilEarnedBadge(badge.key) && badgeCollectionKeys(badge).includes(activeCollection.key)).length
    : hiddenSurpriseCount;

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
          {!activeCollection ? (
            <>
              <Card elevation="flat">
                <CardHeader>
                  <CardTitle className="text-base">Award collections</CardTitle>
                  <CardDescription>
                    Browse awards by family, open a collection, then tap any award for the full story.
                  </CardDescription>
                </CardHeader>
              </Card>
              <AwardCollections
                collections={awardCollections}
                hiddenSurpriseCount={hiddenSurpriseCount}
                onOpen={(collectionKey) => {
                  setFilter("all");
                  setActiveCollectionKey(collectionKey);
                }}
              />
            </>
          ) : (
            <AwardCollectionDetail
              collection={activeCollection}
              filter={filter}
              hiddenSurpriseCount={activeHiddenSurpriseCount}
              selectedBadge={selectedBadge}
              onBack={() => {
                setFilter("all");
                setActiveCollectionKey(null);
              }}
              onFilterChange={setFilter}
              onSelect={setSelectedBadge}
            />
          )}

          {earnedBadges.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Recently earned awards get a soft glow for one week. Surprise awards stay hidden until earned.
            </p>
          ) : null}
        </>
      )}

      <BadgeDetailDialog
        badge={selectedBadge}
        canRevoke={canRevoke}
        canAward={canAward}
        onOpenChange={(open) => {
          if (!open) setSelectedBadge(null);
        }}
        onRevoke={() => {
          setSelectedBadge(null);
          setRevision((r) => r + 1);
        }}
        onAwardRequest={onAwardRequest}
      />
    </div>
  );
}
