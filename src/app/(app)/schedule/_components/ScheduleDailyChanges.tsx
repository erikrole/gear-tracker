"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangleIcon,
  CalendarMinus2Icon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  PencilLineIcon,
  PlusIcon,
} from "lucide-react";
import type { UseFetchResult } from "@/hooks/use-fetch";
import type {
  CalendarSyncChangeKind,
  CalendarSyncChangedField,
  ScheduleSyncChangesDigest,
} from "@/lib/schedule-sync-changes-types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const INITIAL_CHANGE_COUNT = 8;

const CHANGE_META = {
  added: {
    label: "Added",
    icon: PlusIcon,
    badge: "green" as const,
    iconClassName: "text-[var(--green-text)]",
  },
  modified: {
    label: "Modified",
    icon: PencilLineIcon,
    badge: "blue" as const,
    iconClassName: "text-[var(--blue-text)]",
  },
  removed: {
    label: "Removed from feed",
    icon: CalendarMinus2Icon,
    badge: "orange" as const,
    iconClassName: "text-[var(--orange-text)]",
  },
} satisfies Record<CalendarSyncChangeKind, {
  label: string;
  icon: typeof PlusIcon;
  badge: "green" | "blue" | "orange";
  iconClassName: string;
}>;

const FIELD_LABELS: Record<CalendarSyncChangedField, string> = {
  title: "title",
  description: "description",
  date_time: "date or time",
  status: "status",
  result: "result",
  venue: "venue",
  event_details: "event details",
};

function formatRunAt(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatEventDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function changedFieldCopy(fields: CalendarSyncChangedField[]) {
  if (fields.length === 0) return null;
  return fields.map((field) => FIELD_LABELS[field]).join(", ");
}

function DigestSkeleton() {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

type ScheduleDailyChangesProps = {
  digest: ScheduleSyncChangesDigest | null;
  loading: boolean;
  error: UseFetchResult<ScheduleSyncChangesDigest | null>["error"];
  reload: () => void;
  className?: string;
};

export function ScheduleDailyChanges({
  digest: data,
  loading,
  error,
  reload,
  className,
}: ScheduleDailyChangesProps) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <section className={className} aria-label="Daily calendar changes">
        <DigestSkeleton />
      </section>
    );
  }

  if (error) {
    return (
      <section className={className} aria-label="Daily calendar changes">
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>Daily calendar changes unavailable</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>The Schedule is still available, but its latest fetch summary could not be loaded.</span>
            <Button variant="outline" size="sm" className="h-10" onClick={reload}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  if (!data) {
    return (
      <section className={className} aria-label="Daily calendar changes">
        <h2 className="text-sm font-semibold">Daily calendar changes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          No daily calendar fetch has been recorded yet.
        </p>
      </section>
    );
  }

  const displayedChanges = expanded
    ? data.changes
    : data.changes.slice(0, INITIAL_CHANGE_COUNT);
  const hiddenChangeCount = data.changes.length - displayedChanges.length;
  const hasChanges = data.totals.added + data.totals.modified + data.totals.removed > 0;

  return (
    <section className={cn("space-y-3", className)} aria-label="Daily calendar changes">
      <div className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Daily calendar changes</h2>
            <p className="text-sm text-muted-foreground">
              Calendar sources checked {formatRunAt(data.runAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Daily calendar change totals">
            <Badge variant="green">{data.totals.added} added</Badge>
            <Badge variant="blue">{data.totals.modified} modified</Badge>
            <Badge variant="orange">{data.totals.removed} removed</Badge>
          </div>
        </div>
      </div>

      {data.sourceErrors.length > 0 && (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>
            {data.sourceErrors.length} calendar source{data.sourceErrors.length === 1 ? "" : "s"} failed
          </AlertTitle>
          <AlertDescription>
            {data.sourceErrors.map((source) => source.sourceName).join(", ")} did not contribute a complete change list.
          </AlertDescription>
        </Alert>
      )}

      {!hasChanges ? (
        <div className="flex items-center gap-2 rounded-md border border-border/60 px-4 py-3 text-sm text-muted-foreground">
          <CheckCircle2Icon className="size-4 text-[var(--green-text)]" />
          No calendar events changed in this fetch.
        </div>
      ) : (
        <ItemGroup className="rounded-md border border-border/60">
          {displayedChanges.map((change, index) => {
            const meta = CHANGE_META[change.kind];
            const Icon = meta.icon;
            const fieldCopy = changedFieldCopy(change.changedFields);
            return (
              <div key={`${change.sourceId}:${change.kind}:${change.eventId}`}>
                {index > 0 && <ItemSeparator />}
                <Item size="sm" asChild>
                  <Link href={`/events/${change.eventId}`}>
                    <ItemMedia>
                      <Icon className={`size-4 ${meta.iconClassName}`} />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>
                        <span>{change.summary}</span>
                        <Badge variant={meta.badge} size="sm">{meta.label}</Badge>
                      </ItemTitle>
                      <ItemDescription>
                        {change.sourceName} · {formatEventDate(change.startsAt)}
                        {fieldCopy ? ` · Changed ${fieldCopy}` : ""}
                      </ItemDescription>
                    </ItemContent>
                  </Link>
                </Item>
              </div>
            );
          })}
        </ItemGroup>
      )}

      {data.changes.length > INITIAL_CHANGE_COUNT && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronUpIcon data-icon="inline-start" /> : <ChevronDownIcon data-icon="inline-start" />}
          {expanded ? "Show fewer changes" : `Show ${hiddenChangeCount} more`}
        </Button>
      )}

      {data.truncated && (
        <p className="text-xs text-muted-foreground">
          This fetch exceeded the 200-item display limit. Totals include every detected change.
        </p>
      )}
    </section>
  );
}
