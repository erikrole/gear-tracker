"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarDays, MapPin, Trophy } from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import { handleAuthRedirect, parseJsonSafely } from "@/lib/errors";
import { formatDateShort } from "@/lib/format";
import { AREA_LABELS } from "@/types/areas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ScoreboardBucket, ScoreboardEvent, UserScoreboard } from "@/lib/services/scoreboard";

type ResultFilter = "all" | "WIN" | "LOSS";
type ExtraEvents = { requestUrl: string; events: ScoreboardEvent[]; nextCursor: string | null };

const INITIAL_LIMIT = 25;

function recordLabel(bucket: Pick<ScoreboardBucket, "wins" | "losses">): string {
  return `${bucket.wins}–${bucket.losses}`;
}

function rateLabel(rate: number | null): string {
  return rate == null ? "—" : `${rate}%`;
}

function siteLabel(site: ScoreboardEvent["site"]): string {
  if (site === "HOME") return "Home";
  if (site === "AWAY") return "Away";
  if (site === "NEUTRAL") return "Neutral";
  return "Site unknown";
}

function matchupLabel(event: ScoreboardEvent): string {
  const sport = event.sportLabel ?? "Worked event";
  if (!event.opponent) return sport;
  return `${sport} ${event.site === "AWAY" ? "at" : "vs"} ${event.opponent}`;
}

function areaLabel(area: string): string {
  return AREA_LABELS[area as keyof typeof AREA_LABELS] ?? area;
}

function resultVariant(result: ScoreboardEvent["result"]): "green" | "red" {
  return result === "WIN" ? "green" : "red";
}

function highlightRows(scoreboard: UserScoreboard): Array<{ label: string; value: string; detail: string }> {
  if (scoreboard.summary.games === 0) return [];

  const mostWorkedSport = scoreboard.bySport[0];
  const mostWorkedOpponent = scoreboard.byOpponent.find((bucket) => bucket.key !== null);
  const bestVenue = [...scoreboard.byVenue]
    .filter((bucket) => bucket.key !== null)
    .sort((a, b) => (b.winRate ?? -1) - (a.winRate ?? -1) || b.games - a.games)[0];

  return [
    mostWorkedSport
      ? { label: "Most worked", value: mostWorkedSport.label, detail: `${mostWorkedSport.games} games` }
      : null,
    mostWorkedOpponent
      ? { label: "Top matchup", value: mostWorkedOpponent.label, detail: recordLabel(mostWorkedOpponent) }
      : null,
    bestVenue
      ? { label: "Best venue record", value: bestVenue.label, detail: `${recordLabel(bestVenue)} · ${rateLabel(bestVenue.winRate)}` }
      : null,
  ].filter((highlight): highlight is { label: string; value: string; detail: string } => Boolean(highlight));
}

function ScoreboardSummary({ scoreboard }: { scoreboard: UserScoreboard }) {
  const highlights = highlightRows(scoreboard);

  return (
    <>
      <div className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{scoreboard.scope.label}</p>
            <div className="mt-2 flex items-baseline gap-3">
              <p className="text-4xl font-bold tracking-tight tabular-nums">
                {scoreboard.summary.wins}–{scoreboard.summary.losses}
              </p>
              <span className="text-sm text-muted-foreground">record</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-5 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Events worked</p>
              <p className="mt-1 font-semibold tabular-nums">{scoreboard.summary.eventsWorked}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Record games</p>
              <p className="mt-1 font-semibold tabular-nums">{scoreboard.summary.games}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Win rate</p>
              <p className="mt-1 font-semibold tabular-nums">{rateLabel(scoreboard.summary.winRate)}</p>
            </div>
          </div>
        </div>
      </div>

      {highlights.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {highlights.map((highlight) => (
            <div key={highlight.label} className="rounded-xl border bg-muted/25 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{highlight.label}</p>
              <p className="mt-2 truncate text-sm font-semibold" title={highlight.value}>{highlight.value}</p>
              <p className="mt-1 text-xs tabular-nums text-muted-foreground">{highlight.detail}</p>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: ScoreboardBucket[] }) {
  return (
    <Card elevation="flat" className="overflow-hidden">
      <CardHeader className="border-b border-border/50 px-4 py-3 sm:px-5">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length > 0 ? (
          <div className="divide-y divide-border/40">
            {rows.map((row) => (
              <div key={`${row.key ?? "unknown"}-${row.label}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-5">
                <p className="min-w-0 truncate text-sm" title={row.label}>{row.label}</p>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{recordLabel(row)}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">{row.games} games · {rateLabel(row.winRate)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-4 py-5 text-sm text-muted-foreground sm:px-5">No resolved games in this view.</p>
        )}
      </CardContent>
    </Card>
  );
}

function EventRow({ event }: { event: ScoreboardEvent }) {
  const metadata = [
    siteLabel(event.site),
    event.venue ?? "Venue not recorded",
  ].filter(Boolean).join(" · ");
  const areas = event.shiftAreas.map(areaLabel).join(", ");

  return (
    <Link
      href={`/events/${event.id}`}
      className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
    >
      <div className="flex w-12 shrink-0 flex-col items-center gap-1 text-center">
        <Badge variant={resultVariant(event.result)} size="sm">{event.result === "WIN" ? "W" : "L"}</Badge>
        <span className="text-[11px] text-muted-foreground">{formatDateShort(event.startsAt, event.allDay)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{matchupLabel(event)}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground" title={metadata}>{metadata}</p>
      </div>
      {areas ? <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{areas}</span> : null}
    </Link>
  );
}

function ScoreboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border p-5 sm:p-6">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-10 w-24" />
        <Skeleton className="mt-3 h-3 w-64 max-w-full" />
        <Skeleton className="mt-5 h-px w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((card) => (
          <div key={card} className="rounded-xl border p-5">
            <Skeleton className="h-4 w-28" />
            <div className="mt-4 flex flex-col gap-4">
              {[0, 1, 2].map((row) => <Skeleton key={row} className="h-8 w-full" />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UserScoreboardTab({ userId }: { userId: string }) {
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [sportFilter, setSportFilter] = useState("all");
  const [loadingMore, setLoadingMore] = useState(false);
  const [extraEvents, setExtraEvents] = useState<ExtraEvents>({ requestUrl: "", events: [], nextCursor: null });

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({ season: "2026-27", limit: String(INITIAL_LIMIT) });
    if (resultFilter !== "all") params.set("result", resultFilter);
    if (sportFilter !== "all") params.set("sportCode", sportFilter);
    return `/api/users/${userId}/scoreboard?${params.toString()}`;
  }, [resultFilter, sportFilter, userId]);

  const { data, loading, refreshing, error, reload } = useFetch<UserScoreboard>({
    url: requestUrl,
    returnTo: `/users/${userId}?tab=scoreboard`,
    keepPreviousData: true,
    refetchOnFocus: false,
    transform: (json) => (json.data as UserScoreboard),
  });

  useEffect(() => {
    setExtraEvents({ requestUrl, events: [], nextCursor: null });
  }, [requestUrl]);

  const isCurrentPage = extraEvents.requestUrl === requestUrl;
  const events = [...(data?.events ?? []), ...(isCurrentPage ? extraEvents.events : [])];
  const nextCursor = isCurrentPage ? extraEvents.nextCursor || data?.nextCursor : data?.nextCursor;

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`${requestUrl}&offset=${encodeURIComponent(nextCursor)}`);
      if (handleAuthRedirect(res, `/users/${userId}?tab=scoreboard`)) return;
      if (!res.ok) throw new Error("server");
      const json = await parseJsonSafely<{ data?: UserScoreboard }>(res);
      const page = json?.data;
      if (!page) throw new Error("server");
      setExtraEvents((current) => ({
        requestUrl,
        events: current.requestUrl === requestUrl ? [...current.events, ...page.events] : page.events,
        nextCursor: page.nextCursor,
      }));
    } catch {
      // The page remains usable; the shared error surface is reserved for the initial load.
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, requestUrl, userId]);

  if (loading && !data) return <ScoreboardSkeleton />;

  if (error && !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Scoreboard unavailable</AlertTitle>
        <AlertDescription className="mt-2 flex flex-col gap-3">
          <p>We couldn’t load this profile’s worked-game record.</p>
          <Button variant="outline" size="sm" onClick={reload} className="w-fit">Retry</Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  const sportOptions = data.bySport.filter((bucket) => bucket.key !== null);
  const hasFilters = resultFilter !== "all" || sportFilter !== "all";

  return (
    <div className="flex flex-col gap-5">
      <ScoreboardSummary scoreboard={data} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border/40 py-2.5">
        <ToggleGroup
          type="single"
          value={resultFilter}
          onValueChange={(value) => value && setResultFilter(value as ResultFilter)}
          aria-label="Filter scoreboard results"
          className="h-8"
        >
          <ToggleGroupItem value="all" className="h-7 text-xs">All</ToggleGroupItem>
          <ToggleGroupItem value="WIN" className="h-7 text-xs">Wins</ToggleGroupItem>
          <ToggleGroupItem value="LOSS" className="h-7 text-xs">Losses</ToggleGroupItem>
        </ToggleGroup>
        <Select value={sportFilter} onValueChange={setSportFilter}>
          <SelectTrigger className="h-8 w-[190px] text-xs" aria-label="Filter scoreboard sport">
            <SelectValue placeholder="All sports" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sports</SelectItem>
            {sportOptions.map((sport) => (
              <SelectItem key={sport.key} value={sport.key!}>{sport.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard title="By sport" rows={data.bySport} />
        <BreakdownCard title="By opponent" rows={data.byOpponent} />
        <BreakdownCard title="By site" rows={data.bySite} />
        <BreakdownCard title="By venue" rows={data.byVenue} />
      </div>

      <Card elevation="flat" className="overflow-hidden">
        <CardHeader className="border-b border-border/50 px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
              Resolved games
            </CardTitle>
            {refreshing ? <span className="text-xs text-muted-foreground">Refreshing…</span> : null}
          </div>
        </CardHeader>
        {events.length > 0 ? (
          <CardContent className="p-0">
            <div className="divide-y divide-border/40">
              {events.map((event) => <EventRow key={event.id} event={event} />)}
            </div>
            {nextCursor ? (
              <div className="border-t border-border/40 p-3 text-center">
                <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? "Loading…" : "Show more events"}
                </Button>
              </div>
            ) : null}
          </CardContent>
        ) : (
          <CardContent className="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              {hasFilters ? <MapPin className="size-5" aria-hidden="true" /> : <Trophy className="size-5" aria-hidden="true" />}
            </div>
            <p className="text-sm font-medium">{hasFilters ? "No games match these filters" : "No resolved games on record"}</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {hasFilters
                ? "Try another result or sport filter."
                : "Completed events with a recorded result will appear here when this person has worked them."}
            </p>
            {hasFilters ? (
              <Button variant="ghost" size="sm" onClick={() => { setResultFilter("all"); setSportFilter("all"); }}>
                Clear filters
              </Button>
            ) : null}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
