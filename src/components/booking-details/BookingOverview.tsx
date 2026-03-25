"use client";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import Link from "next/link";
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
            ...(booking.event ? [{
              label: "Event",
              value: (
                <span className="text-sm">
                  {booking.event.summary}
                  {booking.event.sportCode && <Badge variant="outline" className="ml-1.5 text-[10px]">{booking.event.sportCode}</Badge>}
                </span>
              ),
            }] : []),
            ...(booking.shiftAssignment ? [{
              label: "Shift",
              value: <Badge variant="outline" className="text-[10px]">{booking.shiftAssignment.shift.area}</Badge>,
            }] : []),
            ...(booking.sourceReservation ? [{
              label: "Converted from",
              value: (
                <Link href={`/reservations/${booking.sourceReservation.id}`} className="text-sm text-primary hover:underline">
                  {booking.sourceReservation.refNumber || booking.sourceReservation.title}
                </Link>
              ),
            }] : []),
            ...(booking.creator ? [{
              label: "Created",
              value: (
                <span className="text-sm text-muted-foreground">
                  by {booking.creator.name} on {formatDateTime(booking.createdAt)}
                </span>
              ),
            }] : []),
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
