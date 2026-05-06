"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, Wrench } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

type HygieneSample = {
  id: string;
  label: string;
  detail: string;
  href: string;
};

type HygieneIssue = {
  key: string;
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
};

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function InventoryHygienePage() {
  const [data, setData] = useState<HygieneData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load({ refresh = false } = {}) {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/inventory-hygiene");
      if (handleAuthRedirect(res, "/items/hygiene")) return;
      if (!res.ok) {
        const message = await parseErrorMessage(res, "Failed to load inventory hygiene");
        setError(message);
        return;
      }
      const json = await res.json();
      setData(json.data);
      setError(null);
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const sortedIssues = useMemo(() => {
    return [...(data?.issues ?? [])].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  }, [data]);

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-72" />
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-lg" />)}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-64 rounded-lg" />)}
        </div>
      </div>
    );
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
        <div className="flex items-center gap-2">
          {data && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Updated {formatGeneratedAt(data.generatedAt)}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => void load({ refresh: true })} disabled={refreshing}>
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </PageHeader>

      {data && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard label="Open records" value={data.totals.openIssues} tone={data.totals.openIssues ? "orange" : "green"} />
            <MetricCard label="Checks needing work" value={data.totals.checksNeedingWork} tone={data.totals.checksNeedingWork ? "orange" : "green"} />
            <MetricCard label="Checks running" value={data.totals.activeChecks} tone="muted" />
          </div>

          {data.totals.openIssues === 0 ? (
            <EmptyState
              icon="check"
              title="Inventory hygiene is clean"
              description="No tracked metadata, scan identity, kit, attachment, or bulk threshold issues are open."
              actionLabel="Back to Items"
              actionHref="/items"
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {sortedIssues.map((issue) => <IssueCard key={issue.key} issue={issue} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: "green" | "orange" | "muted" }) {
  const toneClass = {
    green: "text-[var(--green-text)]",
    orange: "text-[var(--orange-text)]",
    muted: "text-foreground",
  }[tone];

  return (
    <Card className="border-border/40 shadow-none">
      <CardContent className="p-4">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={cn("mt-1 text-2xl font-black tabular-nums", toneClass)} style={{ fontFamily: "var(--font-heading)" }}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function IssueCard({ issue }: { issue: HygieneIssue }) {
  const clean = issue.count === 0;

  return (
    <Card className={cn("border-border/40 shadow-none", clean && "bg-muted/20")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              {clean ? (
                <CheckCircle2 className="size-4 text-[var(--green-text)]" />
              ) : (
                <AlertTriangle className="size-4 text-[var(--orange-text)]" />
              )}
              {issue.title}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{issue.description}</p>
          </div>
          <Badge variant={clean ? "green" : "orange"} className="shrink-0 tabular-nums">
            {issue.count}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {clean ? (
          <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">No action needed.</p>
        ) : (
          <div className="space-y-2">
            {issue.samples.map((sample) => (
              <Link
                key={`${issue.key}-${sample.id}`}
                href={sample.href}
                className="group flex items-start justify-between gap-3 rounded-md border border-border/50 px-3 py-2 transition-[background-color,scale] hover:bg-muted/40 active:scale-[0.99]"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{sample.label}</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{sample.detail}</div>
                </div>
                <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
              </Link>
            ))}
            {issue.count > issue.samples.length && (
              <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <Wrench className="size-3.5" />
                {issue.count - issue.samples.length} more item{issue.count - issue.samples.length === 1 ? "" : "s"} need cleanup.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
