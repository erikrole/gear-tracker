"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <div className="mb-3 space-y-1">
        <Label>Title</Label>
        <Input
          value={editTitle}
          onChange={(e) => onEditTitle(e.target.value)}
        />
      </div>

      <div className="flex gap-3">
        {booking.kind === "RESERVATION" && (
          <div className="mb-3 space-y-1">
            <Label>Start</Label>
            <Input
              type="datetime-local"
              step={900}
              value={editStartsAt}
              onChange={(e) => onEditStartsAt(e.target.value)}
            />
          </div>
        )}
        <div className="mb-3 space-y-1">
          <Label>{booking.kind === "RESERVATION" ? "End" : "Due date"}</Label>
          <Input
            type="datetime-local"
            step={900}
            value={editEndsAt}
            onChange={(e) => onEditEndsAt(e.target.value)}
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
