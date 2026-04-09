"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

import { toLocalDateTimeValue } from "./helpers";

/** Convert datetime-local string back to Date (treats string as local time) */
function parseLocalDateTime(s: string): Date | undefined {
  if (!s) return undefined;
  const [datePart, timePart] = s.split("T");
  if (!datePart || !timePart) return undefined;
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);
  const date = new Date(y, mo - 1, d, h, mi);
  return isNaN(date.getTime()) ? undefined : date;
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
    <div className="px-5 py-4">
      <div className="mb-3 flex flex-col gap-1">
        <Label>Title</Label>
        <Input
          value={editTitle}
          onChange={(e) => onEditTitle(e.target.value)}
        />
      </div>

      <div className="flex gap-3">
        {booking.kind === "RESERVATION" && (
          <div className="mb-3 flex flex-col gap-1 flex-1">
            <Label>Start</Label>
            <DateTimePicker
              value={parseLocalDateTime(editStartsAt)}
              onChange={(d) => onEditStartsAt(toLocalDateTimeValue(d))}
            />
          </div>
        )}
        <div className="mb-3 flex flex-col gap-1 flex-1">
          <Label>{booking.kind === "RESERVATION" ? "End" : "Due date"}</Label>
          <DateTimePicker
            value={parseLocalDateTime(editEndsAt)}
            onChange={(d) => onEditEndsAt(toLocalDateTimeValue(d))}
          />
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-1">
        <Label>Notes</Label>
        <Textarea
          rows={3}
          value={editNotes}
          onChange={(e) => onEditNotes(e.target.value)}
        />
      </div>

      <div className="flex gap-2 mt-4">
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
