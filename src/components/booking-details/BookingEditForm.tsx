"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import type { BookingDetail } from "./types";

type Props = {
  booking: BookingDetail;
  editTitle: string;
  editStartsAt: string;
  editEndsAt: string;
  editNotes: string;
  saving: boolean;
  onEditTitle: (v: string) => void;
  onEditStartsAt: (v: string) => void;
  onEditEndsAt: (v: string) => void;
  onEditNotes: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

/** Convert datetime-local string back to Date */
function parseLocalDateTime(s: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

/** Convert Date to datetime-local string (for the parent's string-based state) */
function toLocalDateTimeValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  const local = new Date(date.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
}

export default function BookingEditForm({
  booking,
  editTitle,
  editStartsAt,
  editEndsAt,
  editNotes,
  saving,
  onEditTitle,
  onEditStartsAt,
  onEditEndsAt,
  onEditNotes,
  onSave,
  onCancel,
}: Props) {
  return (
    <div className="sheet-section">
      <div className="mb-3 space-y-1">
        <Label>Title</Label>
        <Input
          value={editTitle}
          onChange={(e) => onEditTitle(e.target.value)}
        />
      </div>

      <div className="flex gap-3">
        {booking.kind === "RESERVATION" && (
          <div className="mb-3 space-y-1 flex-1">
            <Label>Start</Label>
            <DateTimePicker
              value={parseLocalDateTime(editStartsAt)}
              onChange={(d) => onEditStartsAt(toLocalDateTimeValue(d))}
            />
          </div>
        )}
        <div className="mb-3 space-y-1 flex-1">
          <Label>{booking.kind === "RESERVATION" ? "End" : "Due date"}</Label>
          <DateTimePicker
            value={parseLocalDateTime(editEndsAt)}
            onChange={(d) => onEditEndsAt(toLocalDateTimeValue(d))}
          />
        </div>
      </div>

      <div className="mb-3 space-y-1">
        <Label>Notes</Label>
        <textarea
          rows={3}
          value={editNotes}
          onChange={(e) => onEditNotes(e.target.value)}
        />
      </div>

      <div className="action-row-mt">
        <Button
          disabled={saving}
          onClick={onSave}
        >
          {saving ? "Saving..." : "Save changes"}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
