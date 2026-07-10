"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { OperationalMetricCard, OperationalPartialResultsAlert } from "@/components/OperationalFeedback";
import { OperationalStatusRail, type OperationalStatusRailItem } from "@/components/OperationalStatusRail";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import StatusIndicator from "@/components/ui/status-indicator";
import { useFetch } from "@/hooks/use-fetch";
import type { AdminFixTodayQueue, AdminFixTodaySection, AdminFixTodaySeverity } from "@/lib/admin-fix-today";
import type { OperationalHealthState } from "@/lib/operational-health";
import { cn } from "@/lib/utils";

const SEVERITY_META: Record<AdminFixTodaySeverity, {
  label: string;
  state: OperationalHealthState;
  iconTone: string;
  cardTone: string;
}> = {
  critical: {
    label: "Critical",
    state: "down",
    iconTone: "bg-[var(--red-bg)] text-[var(--red-text)]",
    cardTone: "border-[var(--red-text)]/25 bg-[var(--red-bg)]/20",
  },
  warning: {
    label: "Needs work",
    state: "fixing",
    iconTone: "bg-[var(--orange-bg)] text-[var(--orange-text)]",
    cardTone: "border-[var(--orange-text)]/25 bg-[var(--orange-bg)]/20",
  },
  info: {
    label: "Watch",
    state: "idle",
    iconTone: "bg-[var(--blue-bg)] text-[var(--blue-text)]",
    cardTone: "border-border bg-card",
  },
};

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

function sortSections(sections: AdminFixTodaySection[]) {
  const severityRank: Record<AdminFixTodaySeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return [...sections].sort((a, b) => {
    if (a.count > 0 && b.count === 0) return -1;
    if (a.count === 0 && b.count > 0) return 1;
    return severityRank[a.severity] - severityRank[b.severity] || b.count - a.count || a.title.localeCompare(b.title);
  });
}

export default function FixTodayClient() {
  const { data, loading, refreshing, error, lastRefreshed, reload } = useFetch<AdminFixTodayQueue>({
    url: "/api/admin/fix-today",
    returnTo: "/admin/fix-today",
    refetchOnFocus: false,
  });

  if (loading && !data) {
    return <FixTodaySkeleton />;
  }

  if (error && !data) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Fix Today" />
        <Card>
          <CardContent className="flex min-h-44 flex-col items-center justify-center gap-3 text-center">
            <AlertTriangle className="size-8 text-muted-foreground" />
            <div>
              <h2 className="font-semibold">Admin queue unavailable</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {error === "server" ? "Could not load the admin queue." : "Could not reach the server."}
              </p>
            </div>
            <Button onClick={reload}>
              <RefreshCw data-icon="inline-start" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sections = sortSections(data?.sections ?? []);
  const activeSections = sections.filter((section) => section.count > 0);
  const cleanChecks = data ? Math.max(0, data.totals.activeChecks - data.totals.checksNeedingWork) : 0;
  const completion = data?.totals.activeChecks ? Math.round((cleanChecks / data.totals.activeChecks) * 100) : 100;
  const partialFailures = data?.partialFailures ?? [];
  const railItems: OperationalStatusRailItem[] = data ? [
    ...(data.totals.criticalChecks > 0 ? [{
      id: "critical-checks",
      label: "Critical checks",
      value: data.totals.criticalChecks,
      detail: "Checks that need immediate operator attention.",
      icon: AlertTriangle,
      tone: "critical" as const,
    }] : []),
    ...(data.totals.checksNeedingWork > 0 ? [{
      id: "checks-needing-work",
      label: "Needs work",
      value: data.totals.checksNeedingWork,
      detail: "Checks with one or more open repair items.",
      icon: Clock3,
      tone: "warning" as const,
    }] : []),
    ...(data.totals.openItems > 0 ? [{
      id: "open-items",
      label: "Open items",
      value: data.totals.openItems,
      detail: "Individual records waiting for review or repair.",
      icon: ArrowUpRight,
      tone: "warning" as const,
    }] : []),
    ...(partialFailures.length > 0 ? [{
      id: "partial-data",
      label: "Partial data",
      value: partialFailures.length,
      detail: "Some checks did not finish. Refresh before treating this queue as complete.",
      icon: AlertTriangle,
      tone: "warning" as const,
    }] : []),
  ] : [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Fix Today">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {lastRefreshed && (
            <span className="text-xs text-muted-foreground">
              Cached {formatGeneratedAt(lastRefreshed.toISOString())}
            </span>
          )}
          <Button variant="outline" size="sm" className="h-10" onClick={reload} disabled={refreshing}>
            <RefreshCw data-icon="inline-start" className={cn(refreshing && "animate-spin")} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </PageHeader>

      {data && (
        <>
          <OperationalStatusRail
            orientation={{
              label: "Queue updated",
              value: formatGeneratedAt(data.generatedAt),
              icon: ShieldCheck,
            }}
            items={railItems}
            allClearLabel={activeSections.length === 0 && partialFailures.length === 0 ? "No admin fixes are open" : undefined}
            details={(
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-sm font-semibold">Admin daily queue</span>
                    <Badge variant="outline">
                      <ShieldCheck aria-hidden="true" />
                      Admin only
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {pluralize(data.totals.activeChecks, "check")} running
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <OperationalMetricCard label="Open items" value={data.totals.openItems} tone={data.totals.openItems ? "orange" : "muted"} />
                  <OperationalMetricCard label="Critical checks" value={data.totals.criticalChecks} tone={data.totals.criticalChecks ? "red" : "muted"} />
                  <OperationalMetricCard label="Checks needing work" value={data.totals.checksNeedingWork} tone={data.totals.checksNeedingWork ? "orange" : "muted"} />
                  <OperationalMetricCard label="Checks running" value={data.totals.activeChecks} tone="muted" />
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">Clean checks</span>
                    <span className="tabular-nums text-muted-foreground">{completion}%</span>
                  </div>
                  <Progress value={completion} className="mt-3 h-2" />
                </div>
              </div>
            )}
          />

          <OperationalPartialResultsAlert failures={partialFailures} />

          <div className="grid gap-4 xl:grid-cols-2">
            {sections.map((section) => (
              <QueueSectionCard key={section.key} section={section} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function QueueSectionCard({ section }: { section: AdminFixTodaySection }) {
  const meta = SEVERITY_META[section.severity];
  const hasWork = section.count > 0;

  return (
    <Card className={cn("min-w-0 overflow-hidden", hasWork ? meta.cardTone : "border-border bg-card")}>
      <CardHeader className="p-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-md", hasWork ? meta.iconTone : "bg-muted text-muted-foreground")}>
            {hasWork ? <AlertTriangle /> : <CheckCircle2 />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base leading-tight text-balance">{section.title}</CardTitle>
              <StatusIndicator
                state={hasWork ? meta.state : "active"}
                label={hasWork ? meta.label : "Clean"}
                size="sm"
                title={hasWork ? section.description : "This check is clean."}
              />
            </div>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">{section.description}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums">{section.count}</div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">open</div>
          </div>
        </div>
      </CardHeader>
      <Separator />

      <CardContent className="p-0">
        {section.samples.length > 0 ? (
          <div className="divide-y">
            {section.samples.map((sample) => (
              <Link
                key={sample.id}
                href={sample.href}
                className="group flex min-h-16 items-center gap-3 px-4 py-3 no-underline transition-[background-color,scale] hover:bg-background/70 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">{sample.label}</div>
                  <div className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{sample.detail}</div>
                </div>
                <ArrowUpRight className="shrink-0 text-muted-foreground opacity-60 transition-[color,opacity,translate] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex min-h-20 items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
            {hasWork ? <Clock3 className="size-4" /> : <CheckCircle2 className="size-4 text-muted-foreground" />}
            {hasWork ? "No samples returned for this check." : "Nothing needs attention right now."}
          </div>
        )}
      </CardContent>
      <Separator />
      <CardFooter className="bg-muted/30 px-4 py-3">
        <Button asChild variant="outline" size="sm" className="min-h-10">
          <Link href={section.href}>
            {section.ctaLabel}
            <ArrowUpRight data-icon="inline-end" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function FixTodaySkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Fix Today" />
      <Skeleton className="h-44 w-full rounded-lg" />
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-64 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
