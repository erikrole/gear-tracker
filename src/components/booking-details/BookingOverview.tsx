"use client";

import { Button } from "@/components/ui/button";
import DataList from "@/components/DataList";
import { formatDateTime } from "@/lib/format";
import { statusBadge } from "./helpers";
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
        <div className="sheet-section sheet-section-no-pb">
          <div className="conflict-error">
            <strong>Scheduling conflict</strong>
            {conflictError.conflicts.map((c, i) => (
              <div key={i}>
                {c.conflictingBookingTitle ? `"${c.conflictingBookingTitle}"` : "Another booking"}{" "}
                ({formatDateTime(c.startsAt)} {"\u2013"} {formatDateTime(c.endsAt)})
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sheet-section">
        <DataList
          items={[
            { label: "Title", value: booking.title },
            { label: "Type", value: booking.bookingType },
            { label: "Status", value: (
              <span className={`badge ${booking.isOverdue ? "badge-red" : (statusBadge[booking.status] || "badge-gray")}`}>
                {booking.isOverdue ? "overdue" : booking.status.toLowerCase()}
              </span>
            )},
            { label: "Location", value: booking.location?.name ?? "\u2014" },
            { label: "Start", value: formatDateTime(booking.startsAt) },
            { label: "Due", value: formatDateTime(booking.endsAt) },
            { label: "Requester", value: `${booking.requester?.name ?? "Unknown"} (${booking.requester?.email ?? ""})` },
            ...(booking.notes ? [{ label: "Notes", value: booking.notes }] : []),
          ]}
        />
      </div>

      {/* Return suggestion */}
      {returnSuggestion && booking.isActive && (
        <div className="sheet-section sheet-section-no-pt">
          <div className="return-suggestion">
            <span className="return-icon">{"\u21b5"}</span>
            {returnSuggestion}
          </div>
        </div>
      )}

      {/* Partial check in progress */}
      {checkinProgress && checkinProgress.returned > 0 && (
        <div className="sheet-section">
          <div className="sheet-section-title">Check in progress</div>
          <div className="progress-row">
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${checkinProgress.percent}%`,
                  background: checkinProgress.percent === 100 ? "var(--green)" : "var(--blue)",
                }}
              />
            </div>
            <span className="progress-label">
              {checkinProgress.returned}/{checkinProgress.total} returned
            </span>
          </div>
        </div>
      )}

      {/* Quick actions */}
      {canExtend && (
        <div className="sheet-section">
          <div className="sheet-section-title">Extend due date</div>
          <div className="extend-buttons">
            <Button variant="outline" onClick={() => onExtend(1)} disabled={extending}>{extending ? "..." : "+1 day"}</Button>
            <Button variant="outline" onClick={() => onExtend(3)} disabled={extending}>{extending ? "..." : "+3 days"}</Button>
            <Button variant="outline" onClick={() => onExtend(7)} disabled={extending}>{extending ? "..." : "+1 week"}</Button>
          </div>
        </div>
      )}
    </>
  );
}
