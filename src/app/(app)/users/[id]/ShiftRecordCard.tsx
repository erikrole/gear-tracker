"use client";

import { useState } from "react";
import { ChevronDown, Trophy } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useFetch } from "@/hooks/use-fetch";
import type { ShiftRecordStats } from "@/lib/shift-record-types";
import { cn } from "@/lib/utils";

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function Stat({
  value,
  label,
  prominent = false,
}: {
  value: string;
  label: string;
  prominent?: boolean;
}) {
  return (
    <div>
      <p
        className={cn(
          "font-semibold tabular-nums tracking-tight",
          prominent ? "text-3xl" : "text-xl",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function ShiftRecordCard({ userId }: { userId: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data, loading, error, reload } = useFetch<ShiftRecordStats>({
    url: `/api/users/${userId}/shift-record`,
    returnTo: `/users/${userId}`,
  });

  if (loading) {
    return (
      <Card className="mb-5" aria-label="Loading shift record">
        <CardContent className="space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive" className="mb-5">
        <Trophy />
        <AlertTitle>Shift record unavailable</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          <span>The rest of this profile is still available.</span>
          <Button type="button" variant="outline" size="sm" onClick={reload}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const hasResults = data.resultEventCount > 0;
  const hasIncompleteCoverage = hasResults && data.resultEventCount < data.shiftCount;

  return (
    <Card className="mb-5 overflow-hidden">
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Trophy className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold">Shift record</h2>
            <p className="text-xs text-muted-foreground">All-time published assignments</p>
          </div>
        </div>

        {hasResults ? (
          <div className="grid grid-cols-3 gap-4">
            <Stat value={`${data.wins}-${data.losses}`} label="record" prominent />
            <Stat
              value={String(data.resultEventCount)}
              label={countLabel(data.resultEventCount, "result game").replace(/^\d+\s/, "")}
            />
            <Stat
              value={String(data.shiftCount)}
              label={countLabel(data.shiftCount, "shift").replace(/^\d+\s/, "")}
            />
          </div>
        ) : (
          <div>
            <Stat
              value={String(data.shiftCount)}
              label={countLabel(data.shiftCount, "shift").replace(/^\d+\s/, "")}
              prominent
            />
            <p className="mt-2 text-sm text-muted-foreground">No game results recorded.</p>
          </div>
        )}

        {hasIncompleteCoverage && (
          <p className="text-sm text-muted-foreground">
            {data.resultEventCount} results recorded from {countLabel(data.shiftCount, "shift")}.
          </p>
        )}

        {data.bySport.length > 0 && (
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-between border-t px-0 pt-4 hover:bg-transparent"
              >
                By sport
                <ChevronDown
                  className={cn("size-4 transition-transform", expanded && "rotate-180")}
                  aria-hidden="true"
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 divide-y">
                {data.bySport.map((sport) => (
                  <div
                    key={sport.sportCode}
                    className="flex items-center justify-between gap-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{sport.sportLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {countLabel(sport.resultEventCount, "result game")} from{" "}
                        {countLabel(sport.shiftCount, "shift")}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums">
                      {sport.resultEventCount > 0
                        ? `${sport.wins}-${sport.losses}`
                        : "No results"}
                    </span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
