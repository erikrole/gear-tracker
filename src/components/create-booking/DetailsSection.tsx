"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, FileTextIcon, BoxesIcon } from "lucide-react";
import { SPORT_CODES } from "@/lib/sports";
import {
  toLocalDateTimeValue,
  type BookingListConfig,
  type FormUser,
  type Location,
} from "../booking-list/types";
import type { FormAction, FormState, Section } from "./types";

export type DetailsSectionProps = {
  form: FormState;
  dispatch: Dispatch<FormAction>;
  users: FormUser[];
  locations: Location[];
  kits: { id: string; name: string }[];
  kitId: string;
  setKitId: Dispatch<SetStateAction<string>>;
  config: BookingListConfig;
  openSection: Section;
  detailsSummary: React.ReactNode;
  toggleSection: (section: Section) => void;
};

export function DetailsSection({
  form,
  dispatch,
  users,
  locations,
  kits,
  kitId,
  setKitId,
  config,
  openSection,
  detailsSummary,
  toggleSection,
}: DetailsSectionProps) {
  return (
    <Collapsible open={openSection === "details"} onOpenChange={() => toggleSection("details")}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 border-b px-6 py-3 text-left hover:bg-muted/50 transition-colors"
        >
          <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
          <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
            <span className="font-medium text-sm">Details</span>
            {openSection !== "details" && detailsSummary}
          </div>
          {openSection === "details" ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 border-b px-6 py-4">
          {/* Title */}
          <div className="space-y-1">
            <Label>
              Booking name{form.tieToEvent && form.selectedEvent ? " (auto-filled from event)" : ""}
            </Label>
            <Input
              value={form.title}
              onChange={(e) => dispatch({ type: "SET_TITLE", value: e.target.value })}
              placeholder={form.tieToEvent ? "Select an event above..." : "e.g. Game day equipment"}
              required
            />
          </div>

          {/* Sport (when not tied to event) */}
          {!form.tieToEvent && (
            <div className="space-y-1">
              <Label>Sport (optional)</Label>
              <Select
                value={form.sport || "__none__"}
                onValueChange={(v) => dispatch({ type: "SET_SPORT", value: v === "__none__" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {SPORT_CODES.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.code} - {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Requester */}
          <div className="space-y-1">
            <Label>{config.requesterLabel}</Label>
            <Select value={form.requester} onValueChange={(v) => dispatch({ type: "SET_REQUESTER", value: v })} required>
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="space-y-1">
            <Label>Location</Label>
            <Select
              value={form.locationId}
              onValueChange={(v) => dispatch({ type: "SET_LOCATION_ID", value: v })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Kit (optional) */}
          {kits.length > 0 && (
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5">
                <BoxesIcon className="size-3.5" />
                Kit (optional)
              </Label>
              <Select
                value={kitId || "__none__"}
                onValueChange={(v) => setKitId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {kits.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>{config.startLabel}</Label>
              <DateTimePicker
                value={form.startsAt ? new Date(form.startsAt) : undefined}
                onChange={(d) => dispatch({ type: "SET_STARTS_AT", value: toLocalDateTimeValue(d) })}
                placeholder="Start date & time"
              />
            </div>
            <div className="space-y-1">
              <Label>{config.endLabel}</Label>
              <DateTimePicker
                value={form.endsAt ? new Date(form.endsAt) : undefined}
                onChange={(d) => dispatch({ type: "SET_ENDS_AT", value: toLocalDateTimeValue(d) })}
                placeholder="End date & time"
              />
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
