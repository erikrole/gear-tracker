"use client";

import { useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SaveableField, useSaveField } from "@/components/SaveableField";
import { formatDateTime } from "@/lib/format";
import type { BookingDetail } from "@/components/booking-details/types";

export default function BookingInfoTab({
  booking,
  canEdit,
  onSave,
  onPatch,
}: {
  booking: BookingDetail;
  canEdit: boolean;
  onSave: (field: string, value: unknown) => Promise<void>;
  onPatch: (patch: Partial<BookingDetail>) => void;
}) {
  const titleSave = useSaveField(
    useCallback(async (v: string) => {
      await onSave("title", v);
      onPatch({ title: v });
    }, [onSave, onPatch]),
  );

  const notesSave = useSaveField(
    useCallback(async (v: string) => {
      await onSave("notes", v || null);
      onPatch({ notes: v || null });
    }, [onSave, onPatch]),
  );

  return (
    <Card className="border-border/40 shadow-none divide-y divide-border/30">
      {/* Title */}
      <SaveableField label="Title" status={titleSave.status}>
        {canEdit ? (
          <Input
            defaultValue={booking.title}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== booking.title) titleSave.save(v);
            }}
            className="h-8 text-sm border-transparent bg-transparent shadow-none hover:bg-muted/60 hover:border-border/50 focus-visible:bg-background focus-visible:border-ring focus-visible:shadow-xs"
          />
        ) : (
          <span className="text-sm">{booking.title}</span>
        )}
      </SaveableField>

      {/* Location (read-only) */}
      <SaveableField label="Location">
        <span className="text-sm">{booking.location?.name ?? "\u2014"}</span>
      </SaveableField>

      {/* From */}
      <SaveableField label="From">
        <span className="text-sm">{formatDateTime(booking.startsAt)}</span>
      </SaveableField>

      {/* To */}
      <SaveableField label="To">
        <span className="text-sm">{formatDateTime(booking.endsAt)}</span>
      </SaveableField>

      {/* Requester */}
      <SaveableField label="Requester">
        <span className="text-sm">
          {booking.requester?.name ?? "Unknown"}{" "}
          <span className="text-muted-foreground">({booking.requester?.email ?? ""})</span>
        </span>
      </SaveableField>

      {/* Creator */}
      {booking.creator && (
        <SaveableField label="Created by">
          <span className="text-sm">{booking.creator.name}</span>
        </SaveableField>
      )}

      {/* Notes */}
      <SaveableField label="Notes" status={notesSave.status}>
        {canEdit ? (
          <Textarea
            defaultValue={booking.notes ?? ""}
            placeholder="Add notes..."
            rows={2}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (booking.notes ?? "")) notesSave.save(v);
            }}
            className="min-h-[36px] text-sm border-transparent bg-transparent shadow-none hover:bg-muted/60 hover:border-border/50 focus-visible:bg-background focus-visible:border-ring focus-visible:shadow-xs resize-none"
          />
        ) : (
          <span className="text-sm text-muted-foreground">
            {booking.notes || "No notes"}
          </span>
        )}
      </SaveableField>

      {/* Created */}
      <SaveableField label="Created">
        <span className="text-sm">{formatDateTime(booking.createdAt)}</span>
      </SaveableField>

      {/* Mixed location warning */}
      {booking.locationMode === "MIXED" && booking.itemLocations.length > 1 && (
        <div className="px-3 py-2.5 text-sm text-muted-foreground bg-muted/50 rounded-b-lg">
          Equipment spans multiple locations:{" "}
          {booking.itemLocations.map((l) => l.name).join(", ")}
        </div>
      )}
    </Card>
  );
}
