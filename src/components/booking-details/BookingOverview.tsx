"use client";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import DataList from "@/components/DataList";
import { formatDateTime } from "@/lib/format";
import { TriangleAlert } from "lucide-react";
import type { BookingDetail, CheckinProgress, ConflictData } from "./types";

type Props = {
  booking: BookingDetail;
  conflictError: ConflictData | null;
  returnSuggestion: string | null;
  checkinProgress: CheckinProgress | null;
  canExtend: boolean;
  extending: boolean;
  onExtend: (days: number) => void;
};

export default function BookingOverview({
  booking,
  conflictError,
  returnSuggestion,
  checkinProgress,
  canExtend,
  extending,
  onExtend,
}: Props) {
  return (
    <>
      {/* Conflict error banner */}
      {conflictError?.conflicts && conflictError.conflicts.length > 0 && (
        <div className="px-5 pt-4">
          <Alert variant="destructive">
            <TriangleAlert className="size-4" />
            <AlertDescription>
              <strong className="block mb-1">Scheduling conflict</strong>
              {conflictError.conflicts.map((c, i) => (
                <div key={i} className="text-xs">
                  {c.conflictingBookingTitle ? `"${c.conflictingBookingTitle}"` : "Another booking"}{" "}
                  ({formatDateTime(c.startsAt)} {"\u2013"} {formatDateTime(c.endsAt)})
                </div>
              ))}
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="px-5 py-4">
        <DataList
          items={[
            { label: "Start", value: formatDateTime(booking.startsAt) },
            { label: "Due", value: formatDateTime(booking.endsAt) },
            { label: "Requester", value: `${booking.requester?.name ?? "Unknown"} (${booking.requester?.email ?? ""})` },
            { label: "Location", value: booking.location?.name ?? "\u2014" },
            ...(booking.notes ? [{ label: "Notes", value: booking.notes }] : []),
          ]}
        />
      </div>

      {/* Return suggestion */}
      {returnSuggestion && booking.isActive && (
        <div className="px-5">
          <div className="flex items-center gap-2 px-3.5 py-2.5 bg-muted rounded-md text-sm">
            <span className="text-lg">{"\u21b5"}</span>
            {returnSuggestion}
          </div>
        </div>
      )}

      {/* Partial check in progress */}
      {checkinProgress && checkinProgress.returned > 0 && (
        <div className="px-5 py-4 border-t border-border/30">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Check in progress</div>
          <div className="flex items-center gap-2.5">
            <Progress
              value={checkinProgress.percent}
              className="flex-1 h-2"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {checkinProgress.returned}/{checkinProgress.total} returned
            </span>
          </div>
        </div>
      )}

      {/* Quick actions */}
      {canExtend && (
        <div className="px-5 py-4 border-t border-border/30">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Extend due date</div>
          <div className="flex gap-1.5 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => onExtend(1)} disabled={extending}>{extending ? "..." : "+1 day"}</Button>
            <Button variant="outline" size="sm" onClick={() => onExtend(3)} disabled={extending}>{extending ? "..." : "+3 days"}</Button>
            <Button variant="outline" size="sm" onClick={() => onExtend(7)} disabled={extending}>{extending ? "..." : "+1 week"}</Button>
          </div>
        </div>
      )}
    </>
  );
}
