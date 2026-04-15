"use client";

import { useEffect, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SPORT_CODES } from "@/lib/sports";
import { parseErrorMessage } from "@/lib/errors";

type Location = { id: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

function DateTimeField({
  label,
  date,
  time,
  allDay,
  onDateChange,
  onTimeChange,
}: {
  label: string;
  date: Date | undefined;
  time: string;
  allDay: boolean;
  onDateChange: (d: Date | undefined) => void;
  onTimeChange: (t: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="flex-1 justify-start font-normal gap-2">
              <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
              {date ? format(date, "MMM d, yyyy") : <span className="text-muted-foreground">Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={date} onSelect={onDateChange} initialFocus />
          </PopoverContent>
        </Popover>
        {!allDay && (
          <Input
            type="time"
            value={time}
            onChange={(e) => onTimeChange(e.target.value)}
            className="w-[120px] shrink-0"
          />
        )}
      </div>
    </div>
  );
}

function buildDateTime(date: Date | undefined, time: string, allDay: boolean): string | null {
  if (!date) return null;
  if (allDay) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const [h = "0", m = "0"] = time.split(":");
  const d = new Date(date);
  d.setHours(parseInt(h), parseInt(m), 0, 0);
  return d.toISOString();
}

export function NewEventSheet({ open, onOpenChange, onCreated }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);

  // Form state
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [endTime, setEndTime] = useState("17:00");
  const [allDay, setAllDay] = useState(false);
  const [locationId, setLocationId] = useState("");
  const [sportCode, setSportCode] = useState("");
  const [isHome, setIsHome] = useState<"home" | "away" | "neutral">("home");
  const [opponent, setOpponent] = useState("");
  const [error, setError] = useState("");

  // Fetch locations when sheet opens
  useEffect(() => {
    if (!open) return;
    fetch("/api/locations")
      .then((r) => r.json())
      .then((j) => setLocations(j.data ?? []))
      .catch(() => {/* ignore — location field stays empty */});
  }, [open]);

  function reset() {
    setTitle("");
    setStartDate(undefined);
    setStartTime("09:00");
    setEndDate(undefined);
    setEndTime("17:00");
    setAllDay(false);
    setLocationId("");
    setSportCode("");
    setIsHome("home");
    setOpponent("");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const startsAt = buildDateTime(startDate, startTime, allDay);
    const endsAt = buildDateTime(endDate, endTime, allDay);

    if (!title.trim()) { setError("Title is required"); return; }
    if (!startsAt) { setError("Start date is required"); return; }
    if (!endsAt) { setError("End date is required"); return; }
    if (new Date(endsAt) <= new Date(startsAt)) { setError("End must be after start"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/calendar-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: title.trim(),
          startsAt,
          endsAt,
          allDay,
          locationId: locationId || null,
          sportCode: sportCode || null,
          isHome: sportCode ? (isHome === "home" ? true : isHome === "away" ? false : null) : null,
          opponent: (sportCode && opponent.trim()) ? opponent.trim() : null,
        }),
      });

      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Failed to create event");
        setError(msg);
        return;
      }

      toast.success(`"${title.trim()}" added to schedule`);
      onCreated();
      onOpenChange(false);
      reset();
    } catch {
      setError("Network error — check your connection");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>New event</SheetTitle>
          <SheetDescription>Add an event directly to the schedule.</SheetDescription>
        </SheetHeader>

        <SheetBody className="px-6 py-6">
          <form id="new-event-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-title">Title</Label>
              <Input
                id="event-title"
                placeholder="e.g. Men's Basketball vs Duke"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            {/* All-day toggle */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="all-day"
                checked={allDay}
                onCheckedChange={(v) => setAllDay(!!v)}
              />
              <Label htmlFor="all-day" className="cursor-pointer">All-day event</Label>
            </div>

            {/* Start / End */}
            <DateTimeField
              label="Start"
              date={startDate}
              time={startTime}
              allDay={allDay}
              onDateChange={(d) => {
                setStartDate(d);
                // Auto-set end date if not yet set
                if (d && !endDate) setEndDate(d);
              }}
              onTimeChange={setStartTime}
            />
            <DateTimeField
              label="End"
              date={endDate}
              time={endTime}
              allDay={allDay}
              onDateChange={setEndDate}
              onTimeChange={setEndTime}
            />

            {/* Location */}
            <div className="flex flex-col gap-1.5">
              <Label>Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sport (optional) */}
            <div className="flex flex-col gap-1.5">
              <Label>Sport <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Select value={sportCode} onValueChange={(v) => setSportCode(v === "__none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {SPORT_CODES.map((s) => (
                    <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Home / Away + Opponent — only shown when sport is selected */}
            {sportCode && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label>Location type</Label>
                  <Select value={isHome} onValueChange={(v) => setIsHome(v as "home" | "away" | "neutral")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="home">Home</SelectItem>
                      <SelectItem value="away">Away</SelectItem>
                      <SelectItem value="neutral">Neutral site</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="opponent">Opponent <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    id="opponent"
                    placeholder="e.g. Duke"
                    value={opponent}
                    onChange={(e) => setOpponent(e.target.value)}
                  />
                </div>
              </>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </form>
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="new-event-form" disabled={submitting}>
            {submitting ? "Adding..." : "Add event"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
