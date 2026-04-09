"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SaveableField, useSaveField } from "@/components/SaveableField";
import { BoxesIcon, CameraIcon, Copy, TriangleAlert } from "lucide-react";
import { formatDateTime, formatDuration } from "@/lib/format";
import { useToast } from "@/components/Toast";
import type { BookingDetail, BookingPhoto } from "@/components/booking-details/types";

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
  const { toast } = useToast();

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
    <Card className="border-border/40 divide-y divide-border/30">
      <CardHeader className="pb-0">
        <CardTitle className="text-base">
          {booking.kind === "CHECKOUT" ? "Checkout details" : "Reservation details"}
        </CardTitle>
      </CardHeader>
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

      {/* Location (read-only, click to copy) */}
      <SaveableField label="Location">
        {booking.location?.name ? (
          <button
            className="inline-flex items-center gap-1.5 text-sm group/loc hover:text-foreground transition-colors"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(booking.location.name);
                toast("Location copied", "success");
              } catch {
                toast("Failed to copy", "error");
              }
            }}
            title="Click to copy"
          >
            {booking.location.name}
            <Copy className="size-3 text-muted-foreground opacity-0 group-hover/loc:opacity-100 transition-opacity" />
          </button>
        ) : (
          <span className="text-sm">{"\u2014"}</span>
        )}
      </SaveableField>

      {/* Date range (connected From → To) */}
      <SaveableField label="When">
        <div className="text-sm space-y-0.5">
          <div>{formatDateTime(booking.startsAt)}</div>
          <div>
            {formatDateTime(booking.endsAt)}
            <span className="ml-2 text-muted-foreground text-xs">
              ({formatDuration(booking.startsAt, booking.endsAt)})
            </span>
          </div>
        </div>
      </SaveableField>

      {/* User */}
      <SaveableField label="User">
        <span className="inline-flex items-center gap-2 text-sm">
          <UserAvatar name={booking.requester?.name ?? "U"} avatarUrl={booking.requester?.avatarUrl} />
          {booking.requester?.name ?? "Unknown"}
        </span>
      </SaveableField>

      {/* Creator */}
      {booking.creator && (
        <SaveableField label="Created by">
          <span className="inline-flex items-center gap-2 text-sm">
            <UserAvatar name={booking.creator.name} avatarUrl={booking.creator.avatarUrl} />
            {booking.creator.name}
          </span>
        </SaveableField>
      )}

      {/* Kit */}
      {booking.kit && (
        <SaveableField label="Kit">
          <Link
            href={`/kits/${booking.kit.id}`}
            className="inline-flex items-center gap-1.5 text-sm hover:underline"
          >
            <BoxesIcon className="size-3.5 text-muted-foreground" />
            <Badge variant="outline" className="font-normal">
              {booking.kit.name}
            </Badge>
          </Link>
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

      {/* Condition photos */}
      {booking.photos && booking.photos.length > 0 && (
        <ConditionPhotos photos={booking.photos} />
      )}

      {/* Mixed location warning */}
      {booking.locationMode === "MIXED" && booking.itemLocations.length > 1 && (
        <Alert className="rounded-t-none border-x-0 border-b-0">
          <TriangleAlert className="size-4" />
          <AlertDescription>
            Equipment spans multiple locations:{" "}
            {booking.itemLocations.map((l) => l.name).join(", ")}
          </AlertDescription>
        </Alert>
      )}
    </Card>
  );
}

/* ── Condition Photos ── */

function ConditionPhotos({ photos }: { photos: BookingPhoto[] }) {
  const checkoutPhotos = photos.filter((p) => p.phase === "CHECKOUT");
  const checkinPhotos = photos.filter((p) => p.phase === "CHECKIN");

  return (
    <div className="px-4 pb-3 space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <CameraIcon className="size-3.5" />
        Condition Photos
      </div>
      <div className="grid grid-cols-2 gap-3">
        {checkoutPhotos.length > 0 && (
          <PhotoGroup label="Checkout" photos={checkoutPhotos} />
        )}
        {checkinPhotos.length > 0 && (
          <PhotoGroup label="Check-in" photos={checkinPhotos} />
        )}
      </div>
    </div>
  );
}

function PhotoGroup({ label, photos }: { label: string; photos: BookingPhoto[] }) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {photos.map((photo) => (
        <a
          key={photo.id}
          href={photo.imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg overflow-hidden border border-border hover:border-foreground/20 transition-colors"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.imageUrl}
            alt={`${label} condition photo`}
            className="w-full h-auto object-cover"
          />
        </a>
      ))}
      <span className="text-[11px] text-muted-foreground">
        by {photos[0].actor.name} &middot; {formatDateTime(photos[0].createdAt)}
      </span>
    </div>
  );
}
