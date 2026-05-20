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
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useFetch } from "@/hooks/use-fetch";
import type { AdminFixTodayQueue, AdminFixTodaySection, AdminFixTodaySeverity } from "@/lib/admin-fix-today";
import { cn } from "@/lib/utils";

const SEVERITY_META: Record<AdminFixTodaySeverity, {
  label: string;
  badge: "red" | "orange" | "blue";
  iconTone: string;
  cardTone: string;
}> = {
  critical: {
    label: "Critical",
    badge: "red",
    iconTone: "text-red-600 bg-red-50 dark:bg-red-950/30",
    cardTone: "border-red-200/80 bg-red-50/40 dark:border-red-950 dark:bg-red-950/10",
  },
  warning: {
    label: "Needs work",
    badge: "orange",
    iconTone: "text-orange-600 bg-orange-50 dark:bg-orange-950/30",
    cardTone: "border-orange-200/80 bg-orange-50/40 dark:border-orange-950 dark:bg-orange-950/10",
  },
  info: {
    label: "Watch",
    badge: "blue",
    iconTone: "text-blue-600 bg-blue-50 dark:bg-blue-950/30",
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
      <div className="space-y-4">
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
              <RefreshCw className="size-4" />
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

  return (
    <div className="space-y-5">
      <PageHeader title="Fix Today">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {data && (
            <span className="text-xs text-muted-foreground">
              Updated {formatGeneratedAt(data.generatedAt)}
            </span>
          )}
          {lastRefreshed && (
            <span className="text-xs text-muted-foreground">
              Cached {formatGeneratedAt(lastRefreshed.toISOString())}
            </span>
          )}
          <Button variant="outline" size="sm" className="h-10" onClick={reload} disabled={refreshing}>
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </PageHeader>

      {data && (
        <>
          <section className="rounded-lg border bg-card p-4 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-balance">Admin daily queue</h2>
                  <Badge variant="outline" className="gap-1.5">
                    <ShieldCheck className="size-3" />
                    Admin only
                  </Badge>
                </div>
                <p className="max-w-3xl text-sm text-muted-foreground text-pretty">
                  One place to catch overdue custody, kiosk health, calendar sync, inventory exceptions, low batteries, pending handoffs, and license expirations.
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <OperationalMetricCard label="Open items" value={data.totals.openItems} tone={data.totals.openItems ? "orange" : "green"} />
                  <OperationalMetricCard label="Critical checks" value={data.totals.criticalChecks} tone={data.totals.criticalChecks ? "red" : "green"} />
                  <OperationalMetricCard label="Checks needing work" value={data.totals.checksNeedingWork} tone={data.totals.checksNeedingWork ? "orange" : "green"} />
                  <OperationalMetricCard label="Checks running" value={data.totals.activeChecks} tone="muted" />
                </div>
              </div>
              <div className="w-full max-w-xs rounded-md bg-muted/50 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">Clean checks</span>
                  <span className="tabular-nums text-muted-foreground">{completion}%</span>
                </div>
                <Progress value={completion} className="mt-3 h-2" />
              </div>
            </div>
          </section>

          <OperationalPartialResultsAlert failures={partialFailures} />

          {activeSections.length === 0 && (
            <Card className="border-green-200/80 bg-green-50/50 dark:border-green-950 dark:bg-green-950/10">
              <CardContent className="flex min-h-32 items-center gap-3 p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-green-100 text-green-700 dark:bg-green-950/40">
                  <CheckCircle2 className="size-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold">No admin fixes are open</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    All {pluralize(data.totals.activeChecks, "check")} came back clean.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

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
      <CardHeader className="border-b p-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-md", hasWork ? meta.iconTone : "bg-muted text-muted-foreground")}>
            {hasWork ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base leading-tight text-balance">{section.title}</CardTitle>
              <Badge variant={hasWork ? meta.badge : "outline"} size="sm">
                {hasWork ? meta.label : "Clean"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">{section.description}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums">{section.count}</div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">open</div>
          </div>
        </div>
      </CardHeader>

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
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-60 transition-[color,opacity,translate] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex min-h-20 items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
            {hasWork ? <Clock3 className="size-4" /> : <CheckCircle2 className="size-4 text-green-600" />}
            {hasWork ? "No samples returned for this check." : "Nothing needs attention right now."}
          </div>
        )}
        <div className="border-t bg-muted/30 px-4 py-3">
          <Button asChild variant="outline" size="sm" className="min-h-10">
            <Link href={section.href}>
              {section.ctaLabel}
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FixTodaySkeleton() {
  return (
    <div className="space-y-5">
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
