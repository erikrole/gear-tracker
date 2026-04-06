"use client";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { CalendarIcon, ClockIcon, UserIcon, MapPinIcon, CalendarCheckIcon, LinkIcon, StickyNoteIcon, TriangleAlert } from "lucide-react";
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

function InfoRow({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
        <div className="text-sm font-medium">{children}</div>
      </div>
    </div>
  );
}

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
    <div className="space-y-4">
      {/* Conflict error banner */}
      {conflictError?.conflicts && conflictError.conflicts.length > 0 && (
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
      )}

      {/* Partial check in progress */}
      {checkinProgress && checkinProgress.returned > 0 && (
        <div className="flex items-center gap-3 px-1">
          <Progress value={checkinProgress.percent} className="flex-1 h-2" />
          <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">
            {checkinProgress.returned}/{checkinProgress.total} returned
          </span>
        </div>
      )}

      {/* Main info card */}
      <Card elevation="flat">
        <CardContent className="py-1 divide-y divide-border/40">
          <InfoRow icon={CalendarIcon} label="Start">
            {formatDateTime(booking.startsAt)}
          </InfoRow>
          <InfoRow icon={ClockIcon} label="Due">
            {formatDateTime(booking.endsAt)}
          </InfoRow>
          <InfoRow icon={UserIcon} label="Requester">
            {booking.requester?.name ?? "Unknown"}
            {booking.requester?.email && (
              <span className="text-muted-foreground font-normal"> ({booking.requester.email})</span>
            )}
          </InfoRow>
          <InfoRow icon={MapPinIcon} label="Location">
            {booking.location?.name ?? "\u2014"}
          </InfoRow>
          {booking.event && (
            <InfoRow icon={CalendarCheckIcon} label="Event">
              {booking.event.summary}
              {booking.event.sportCode && (
                <Badge variant="outline" className="ml-1.5 text-[10px] align-middle">{booking.event.sportCode}</Badge>
              )}
            </InfoRow>
          )}
          {booking.shiftAssignment && (
            <InfoRow icon={CalendarCheckIcon} label="Shift">
              <Badge variant="outline" className="text-[10px]">{booking.shiftAssignment.shift.area}</Badge>
            </InfoRow>
          )}
          {booking.sourceReservation && (
            <InfoRow icon={LinkIcon} label="Converted from">
              <Link href={`/reservations/${booking.sourceReservation.id}`} className="text-primary hover:underline">
                {booking.sourceReservation.refNumber || booking.sourceReservation.title}
              </Link>
            </InfoRow>
          )}
          {booking.notes && (
            <InfoRow icon={StickyNoteIcon} label="Notes">
              <span className="font-normal text-muted-foreground">{booking.notes}</span>
            </InfoRow>
          )}
        </CardContent>
      </Card>

      {/* Created by */}
      {booking.creator && (
        <p className="text-xs text-muted-foreground px-1">
          Created by {booking.creator.name} on {formatDateTime(booking.createdAt)}
        </p>
      )}

      {/* Return suggestion */}
      {returnSuggestion && booking.isActive && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-muted rounded-md text-sm">
          <span className="text-lg">{"\u21b5"}</span>
          {returnSuggestion}
        </div>
      )}

      {/* Extend due date */}
      {canExtend && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Extend due date</div>
          <div className="flex gap-1.5 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => onExtend(1)} disabled={extending}>{extending ? "..." : "+1 day"}</Button>
            <Button variant="outline" size="sm" onClick={() => onExtend(3)} disabled={extending}>{extending ? "..." : "+3 days"}</Button>
            <Button variant="outline" size="sm" onClick={() => onExtend(7)} disabled={extending}>{extending ? "..." : "+1 week"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
