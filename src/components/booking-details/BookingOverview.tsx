"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConfirm } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateTime } from "@/lib/format";
import { handleAuthRedirect, parseJsonSafely } from "@/lib/errors";
import { toLocalDateTimeValue } from "./helpers";
import { TriangleAlert } from "lucide-react";
import type { BookingDetail, CheckinProgress, ConflictData } from "./types";
import BookingInfoCard from "./BookingInfoCard";

type ExtendPreset = { label: string; minutes: number };

type Props = {
  booking: BookingDetail;
  conflictError: ConflictData | null;
  returnSuggestion: string | null;
  checkinProgress: CheckinProgress | null;
  canExtend: boolean;
  extending: boolean;
  onExtendTo: (endsAt: string) => void;
  canEdit?: boolean;
  onSave: (field: string, value: unknown) => Promise<void>;
  onPatch: (patch: Partial<BookingDetail>) => void;
};

export default function BookingOverview({
  booking,
  conflictError,
  returnSuggestion,
  checkinProgress,
  canExtend,
  extending,
  onExtendTo,
  canEdit = false,
  onSave,
  onPatch,
}: Props) {
  const confirm = useConfirm();
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const { data: presetsData } = useQuery<ExtendPreset[]>({
    queryKey: ["extend-presets"],
    queryFn: async () => {
      const r = await fetch("/api/settings/extend-presets");
      if (handleAuthRedirect(r)) throw new DOMException("Auth redirect", "AbortError");
      if (!r.ok) throw new Error("server");
      const json = await parseJsonSafely<{ data?: { presets?: ExtendPreset[] } }>(r);
      if (!Array.isArray(json?.data?.presets)) throw new Error("server");
      return json.data.presets;
    },
    staleTime: 10 * 60_000,
  });
  const presets = presetsData ?? [];

  async function handlePreset(minutes: number) {
    const current = new Date(booking.endsAt);
    const extended = new Date(current.getTime() + minutes * 60 * 1000);
    const label = extended.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const ok = await confirm({
      title: "Extend booking due date?",
      message: `Move the due date for "${booking.title}" to ${label}. Gear may stay checked out longer if no conflicts block the change.`,
      confirmLabel: "Extend booking",
    });
    if (!ok) return;
    onExtendTo(extended.toISOString());
  }

  const handleCustomExtend = useCallback(async (value?: string) => {
    const v = value ?? customValue;
    if (!v) return;
    const target = new Date(v);
    if (isNaN(target.getTime())) return;
    const label = target.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const ok = await confirm({
      title: "Extend booking due date?",
      message: `Move the due date for "${booking.title}" to ${label}. Gear may stay checked out longer if no conflicts block the change.`,
      confirmLabel: "Extend booking",
    });
    if (!ok) return;
    onExtendTo(target.toISOString());
    setCustomOpen(false);
  }, [booking.title, customValue, confirm, onExtendTo]);

  // Default custom value: current due date + 1 day
  function openCustom() {
    const current = new Date(booking.endsAt);
    const suggested = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    setCustomValue(toLocalDateTimeValue(suggested));
    setCustomOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Conflict error banner */}
      {conflictError?.conflicts && conflictError.conflicts.length > 0 && (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertDescription>
            <strong className="block mb-1">Scheduling conflict</strong>
            {conflictError.conflicts.map((c, i) => (
              <div key={i} className="text-xs">
                {c.conflictingBookingTitle ? `"${c.conflictingBookingTitle}"` : "Another booking"}{" "}
                ({formatDateTime(c.startsAt)} {"–"} {formatDateTime(c.endsAt)})
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

      {/* Booking fields */}
      <BookingInfoCard
        booking={booking}
        canEdit={canEdit}
        onSave={onSave}
        onPatch={onPatch}
        bare
      />

      {/* Return suggestion */}
      {returnSuggestion && booking.isActive && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-muted rounded-md text-sm">
          <span className="text-lg">{"↵"}</span>
          {returnSuggestion}
        </div>
      )}

      {/* Extend due date */}
      {canExtend && (
        <div>
          <div className="text-sm font-medium mb-2">Extend due date</div>
          <div className="flex gap-1.5 flex-wrap">
            {presets.map((p) => (
              <Button
                key={p.label}
                variant="outline"
                size="sm"
                onClick={() => handlePreset(p.minutes)}
                disabled={extending}
              >
                {extending ? "..." : p.label}
              </Button>
            ))}
            <Popover open={customOpen} onOpenChange={setCustomOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" onClick={openCustom} disabled={extending}>
                  Custom
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-3">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Extend to</label>
                  <Input
                    type="datetime-local"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    min={toLocalDateTimeValue(new Date(booking.endsAt))}
                    className="h-9"
                  />
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => handleCustomExtend()}
                    disabled={extending || !customValue}
                  >
                    {extending ? "Extending..." : "Extend"}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}
    </div>
  );
}
