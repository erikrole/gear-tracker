"use client";

import { Button } from "@/components/ui/button";
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
      <div className="sheet-field">
        <label>Title</label>
        <input
          value={editTitle}
          onChange={(e) => onEditTitle(e.target.value)}
        />
      </div>

      <div className="sheet-field-row">
        {booking.kind === "RESERVATION" && (
          <div className="sheet-field">
            <label>Start</label>
            <input
              type="datetime-local"
              step={900}
              value={editStartsAt}
              onChange={(e) => onEditStartsAt(e.target.value)}
            />
          </div>
        )}
        <div className="sheet-field">
          <label>{booking.kind === "RESERVATION" ? "End" : "Due date"}</label>
          <input
            type="datetime-local"
            step={900}
            value={editEndsAt}
            onChange={(e) => onEditEndsAt(e.target.value)}
          />
        </div>
      </div>

      <div className="sheet-field">
        <label>Notes</label>
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
