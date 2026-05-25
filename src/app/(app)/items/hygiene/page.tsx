"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import { OperationalMetricCard, OperationalPartialResultsAlert } from "@/components/OperationalFeedback";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { handleAuthRedirect, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
import { cn } from "@/lib/utils";

type HygieneIssueKey =
  | "missing-category"
  | "missing-department"
  | "missing-primary-scan"
  | "missing-image"
  | "duplicate-scan-identity"
  | "retired-in-kits"
  | "camera-missing-attachments"
  | "low-bulk-stock";

type HygieneSample = {
  id: string;
  label: string;
  detail: string;
  href: string;
};

type HygieneIssue = {
  key: HygieneIssueKey | string;
  title: string;
  description: string;
  count: number;
  samples: HygieneSample[];
};

type HygieneData = {
  generatedAt: string;
  totals: {
    openIssues: number;
    activeChecks: number;
    checksNeedingWork: number;
  };
  issues: HygieneIssue[];
  partialFailures?: string[];
};

type ViewMode = "needs-work" | "all" | "clean";
type IssueTone = "red" | "orange" | "blue" | "green" | "gray";

type IssueMeta = {
  area: string;
  priority: number;
  tone: IssueTone;
  repairHref: string;
  repairLabel: string;
  cleanLabel: string;
};

const ISSUE_META: Record<HygieneIssueKey, IssueMeta> = {
  "duplicate-scan-identity": {
    area: "Scan identity",
    priority: 1,
    tone: "red",
    repairHref: "/items",
    repairLabel: "Review matching items",
    cleanLabel: "Scan values are unique across item identities.",
  },
  "retired-in-kits": {
    area: "Kit integrity",
    priority: 2,
    tone: "red",
    repairHref: "/kits",
    repairLabel: "Review kits",
    cleanLabel: "Active kits do not contain retired items.",
  },
  "missing-primary-scan": {
    area: "Scan readiness",
    priority: 3,
    tone: "orange",
    repairHref: "/items",
    repairLabel: "Open items",
    cleanLabel: "Tracked items have canonical scan values.",
  },
  "low-bulk-stock": {
    area: "Item families",
    priority: 4,
    tone: "orange",
    repairHref: "/bulk-inventory",
    repairLabel: "Open item-family operations",
    cleanLabel: "Active item families are at or above their thresholds.",
  },
  "camera-missing-attachments": {
    area: "Camera systems",
    priority: 5,
    tone: "orange",
    repairHref: "/items",
    repairLabel: "Review attachments",
    cleanLabel: "Camera bodies have expected child attachments recorded.",
  },
  "missing-category": {
    area: "Catalog metadata",
    priority: 6,
    tone: "blue",
    repairHref: "/items",
    repairLabel: "Open items",
    cleanLabel: "Serialized items have category metadata.",
  },
  "missing-department": {
    area: "Catalog metadata",
    priority: 7,
    tone: "blue",
    repairHref: "/items",
    repairLabel: "Open items",
    cleanLabel: "Serialized items have department ownership.",
  },
  "missing-image": {
    area: "Picker confidence",
    priority: 8,
    tone: "blue",
    repairHref: "/items",
    repairLabel: "Open items",
    cleanLabel: "Tracked items have confirmation photos.",
  },
};

const DEFAULT_META: IssueMeta = {
  area: "Inventory",
  priority: 99,
  tone: "gray",
  repairHref: "/items",
  repairLabel: "Open items",
  cleanLabel: "This check is clean.",
};

function getIssueMeta(issue: HygieneIssue) {
  return ISSUE_META[issue.key as HygieneIssueKey] ?? DEFAULT_META;
}

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function InventoryHygienePage() {
  const [data, setData] = useState<HygieneData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("needs-work");

  async function load({ refresh = false } = {}) {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/inventory-hygiene");
      if (handleAuthRedirect(res, "/items/hygiene")) return;
      if (!res.ok) {
        const message = await parseErrorMessage(res, "Failed to load inventory hygiene");
        if (refresh && data) toast.error(message);
        else setError(message);
        return;
      }
      const json = await parseJsonSafely<{ data?: HygieneData }>(res);
      if (!json?.data) {
        const message = "Inventory hygiene returned an unreadable response";
        if (refresh && data) toast.error(message);
        else setError(message);
        return;
      }
      setData(json.data);
      setError(null);
      if (refresh) toast.success("Inventory hygiene refreshed");
    } catch {
      const message = "Network error. Try again.";
      if (refresh && data) toast.error(message);
      else setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const sortedIssues = useMemo(() => {
    return [...(data?.issues ?? [])].sort((a, b) => {
      const priorityDelta = getIssueMeta(a).priority - getIssueMeta(b).priority;
      return priorityDelta || b.count - a.count || a.title.localeCompare(b.title);
    });
  }, [data]);

  const needsWorkIssues = useMemo(() => sortedIssues.filter((issue) => issue.count > 0), [sortedIssues]);
  const cleanIssues = useMemo(() => sortedIssues.filter((issue) => issue.count === 0), [sortedIssues]);
  const visibleIssues = viewMode === "needs-work" ? needsWorkIssues : viewMode === "clean" ? cleanIssues : sortedIssues;
  const cleanChecks = data ? Math.max(0, data.totals.activeChecks - data.totals.checksNeedingWork) : 0;
  const completion = data?.totals.activeChecks ? Math.round((cleanChecks / data.totals.activeChecks) * 100) : 100;
  const partialFailures = data?.partialFailures ?? [];

  if (loading && !data) {
    return <InventoryHygieneSkeleton />;
  }

  if (error && !data) {
    return (
      <EmptyState
        icon="wifi-off"
        title="Inventory hygiene unavailable"
        description={error}
        actionLabel="Retry"
        onAction={() => void load()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Inventory Hygiene">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {data && (
            <span className="text-xs text-muted-foreground">
              Updated {formatGeneratedAt(data.generatedAt)}
            </span>
          )}
          <Button variant="outline" size="sm" className="h-10" onClick={() => void load({ refresh: true })} disabled={refreshing}>
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </PageHeader>

      {data && (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <OperationalMetricCard label="Open records" value={data.totals.openIssues} tone={data.totals.openIssues ? "orange" : "green"} />
            <OperationalMetricCard label="Checks needing work" value={data.totals.checksNeedingWork} tone={data.totals.checksNeedingWork ? "orange" : "green"} />
            <OperationalMetricCard label="Clean checks" value={cleanChecks} tone="green" />
            <OperationalMetricCard label="Checks running" value={data.totals.activeChecks} tone="muted" />
          </div>

          <OperationalPartialResultsAlert failures={partialFailures} title="Some checks used fallback data" />

          <QueueSummary
            completion={completion}
            cleanChecks={cleanChecks}
            data={data}
            topIssue={needsWorkIssues[0] ?? null}
          />

          {data.totals.openIssues === 0 ? (
            <EmptyState
              icon="check"
              title="Inventory hygiene is clean"
              description="No tracked metadata, scan identity, kit, attachment, or bulk threshold issues are open."
              actionLabel="Back to Items"
              actionHref="/items"
            />
          ) : (
            <>
              <IssueFilterBar
                cleanCount={cleanIssues.length}
                needsWorkCount={needsWorkIssues.length}
                totalCount={sortedIssues.length}
                value={viewMode}
                onValueChange={setViewMode}
              />

              {visibleIssues.length === 0 ? (
                <Card className="border-border/40 shadow-none">
                  <CardContent className="p-8">
                    <EmptyState
                      icon="check"
                      title="No checks in this view"
                      description="Switch views to see the active cleanup queue or the completed checks."
                    />
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {visibleIssues.map((issue) => <IssueCard key={issue.key} issue={issue} />)}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function InventoryHygieneSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-lg" />)}
      </div>
      <Skeleton className="h-48 rounded-lg" />
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-64 rounded-lg" />)}
      </div>
    </div>
  );
}

function QueueSummary({
  completion,
  cleanChecks,
  data,
  topIssue,
}: {
  completion: number;
  cleanChecks: number;
  data: HygieneData;
  topIssue: HygieneIssue | null;
}) {
  const topMeta = topIssue ? getIssueMeta(topIssue) : null;
  const topSample = topIssue?.samples[0] ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
      <Card className="overflow-hidden border-border/40 shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <ListChecks className="size-3.5" />
                Cleanup queue
              </div>
              <CardTitle className="mt-2 text-xl text-balance">
                {topIssue ? topIssue.title : "All tracked checks are clean"}
              </CardTitle>
            </div>
            <Badge variant={topIssue ? topMeta?.tone ?? "orange" : "green"} className="tabular-nums">
              {topIssue ? pluralize(topIssue.count, "record") : "Clean"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {topIssue && topMeta ? (
            <>
              <p className="max-w-3xl text-sm text-muted-foreground text-pretty">{topIssue.description}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                {topSample && (
                  <Button asChild size="sm" className="h-10 sm:w-fit">
                    <Link href={topSample.href}>
                      <ArrowUpRight className="size-4" />
                      Open first record
                    </Link>
                  </Button>
                )}
                <Button asChild variant="outline" size="sm" className="h-10 sm:w-fit">
                  <Link href={topMeta.repairHref}>
                    <Wrench className="size-4" />
                    {topMeta.repairLabel}
                  </Link>
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground text-pretty">
                The checklist found no open metadata, scan, kit, attachment, or bulk threshold cleanup.
              </p>
              <Button asChild variant="outline" size="sm" className="h-10 sm:w-fit">
                <Link href="/items">
                  <ArrowUpRight className="size-4" />
                  Back to Items
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/40 shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-[var(--green-text)]" />
              Checklist health
            </CardTitle>
            <Badge variant="outline" className="tabular-nums">
              {completion}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={completion} />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">Clean</div>
              <div className="mt-1 font-semibold tabular-nums">{cleanChecks}</div>
            </div>
            <div className="rounded-md bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">Needs work</div>
              <div className="mt-1 font-semibold tabular-nums">{data.totals.checksNeedingWork}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function IssueFilterBar({
  cleanCount,
  needsWorkCount,
  onValueChange,
  totalCount,
  value,
}: {
  cleanCount: number;
  needsWorkCount: number;
  onValueChange: (value: ViewMode) => void;
  totalCount: number;
  value: ViewMode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/40 bg-card p-3 shadow-none sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CircleAlert className="size-4 text-muted-foreground" />
          Issue cards
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {pluralize(needsWorkCount, "check")} need work, {pluralize(cleanCount, "check")} are clean.
        </p>
      </div>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue) onValueChange(nextValue as ViewMode);
        }}
        aria-label="Inventory hygiene view"
        className="w-full justify-start overflow-x-auto sm:w-auto"
      >
        <ToggleGroupItem value="needs-work" className="min-h-10 whitespace-nowrap">
          Needs work <span className="tabular-nums">{needsWorkCount}</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="all" className="min-h-10 whitespace-nowrap">
          All <span className="tabular-nums">{totalCount}</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="clean" className="min-h-10 whitespace-nowrap">
          Clean <span className="tabular-nums">{cleanCount}</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

function IssueCard({ issue }: { issue: HygieneIssue }) {
  const clean = issue.count === 0;
  const meta = getIssueMeta(issue);
  const remaining = issue.count - issue.samples.length;
  const toneClass = {
    red: "text-[var(--red-text)]",
    orange: "text-[var(--orange-text)]",
    blue: "text-[var(--blue-text)]",
    green: "text-[var(--green-text)]",
    gray: "text-muted-foreground",
  }[clean ? "green" : meta.tone];
  const badgeTone = clean ? "green" : meta.tone;

  return (
    <Card className={cn("overflow-hidden border-border/40 shadow-none", clean && "bg-muted/20")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" size="sm">
                {meta.area}
              </Badge>
              {clean && (
                <Badge variant="green" size="sm">
                  Clean
                </Badge>
              )}
            </div>
            <CardTitle className="mt-2 flex items-center gap-2 text-base text-balance">
              {clean ? <CheckCircle2 className="size-4 text-[var(--green-text)]" /> : <AlertTriangle className={cn("size-4", toneClass)} />}
              {issue.title}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">{issue.description}</p>
          </div>
          <Badge variant={badgeTone} className="shrink-0 tabular-nums">
            {issue.count}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {clean ? (
          <div className="rounded-md bg-muted/50 px-3 py-3 text-sm text-muted-foreground">
            {meta.cleanLabel}
          </div>
        ) : (
          <div className="space-y-2">
            {issue.samples.map((sample) => (
              <Link
                key={`${issue.key}-${sample.id}`}
                href={sample.href}
                aria-label={`Open ${sample.label}`}
                className="group flex min-h-14 items-center justify-between gap-3 rounded-md border border-border/50 px-3 py-2 transition-[background-color,border-color,box-shadow,scale] hover:border-border hover:bg-muted/40 hover:shadow-xs active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{sample.label}</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{sample.detail}</div>
                </div>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-[background-color,color,scale] group-hover:bg-background group-hover:text-foreground group-active:scale-[0.96]">
                  <ChevronRight className="size-4" />
                </span>
              </Link>
            ))}
            <div className="flex flex-col gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="size-3.5" />
                {remaining > 0
                  ? `${pluralize(remaining, "more record")} ${remaining === 1 ? "needs" : "need"} cleanup.`
                  : "Open a record above to repair it."}
              </div>
              <Button asChild variant="ghost" size="xs" className="h-10 self-start px-3 sm:self-auto">
                <Link href={meta.repairHref}>
                  {meta.repairLabel}
                  <ArrowUpRight className="size-3" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
