"use client";

import type { Dispatch, SetStateAction } from "react";
import { SPORT_CODES, sportLabel } from "@/lib/sports";
import EquipmentPicker from "@/components/EquipmentPicker";
import type { BulkSelection } from "@/components/EquipmentPicker";
import {
  formatDate,
  type BookingListConfig,
  type CalendarEvent,
  type FormUser,
  type Location,
  type BulkSkuOption,
} from "./types";
import { ClockIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { toLocalDateTimeValue } from "./types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CreateBookingCardProps = {
  config: BookingListConfig;
  /* Event tie */
  tieToEvent: boolean;
  onTieToEventChange: (v: boolean) => void;
  createSport: string;
  onCreateSportChange: (v: string) => void;
  events: CalendarEvent[];
  eventsLoading: boolean;
  selectedEvent: CalendarEvent | null;
  onSelectEvent: (ev: CalendarEvent) => void;
  /* Shift context */
  myShiftForEvent: {
    area: string;
    startsAt: string;
    endsAt: string;
    gearStatus: string;
  } | null;
  /* Form fields */
  createTitle: string;
  onCreateTitleChange: (v: string) => void;
  createRequester: string;
  onCreateRequesterChange: (v: string) => void;
  createLocationId: string;
  onCreateLocationIdChange: (v: string) => void;
  createStartsAt: string;
  onCreateStartsAtChange: (v: string) => void;
  createEndsAt: string;
  onCreateEndsAtChange: (v: string) => void;
  users: FormUser[];
  locations: Location[];
  /* Equipment */
  bulkSkus: BulkSkuOption[];
  showEquipPicker: boolean;
  onShowEquipPickerChange: (v: boolean) => void;
  selectedAssetIds: string[];
  onSelectedAssetIdsChange: Dispatch<SetStateAction<string[]>>;
  selectedBulkItems: BulkSelection[];
  onSelectedBulkItemsChange: Dispatch<SetStateAction<BulkSelection[]>>;
  /* Actions */
  createError: string;
  submitting: boolean;
  onCreate: () => void;
  onClose: () => void;
};

export function CreateBookingCard({
  config,
  tieToEvent,
  onTieToEventChange,
  createSport,
  onCreateSportChange,
  events,
  eventsLoading,
  selectedEvent,
  onSelectEvent,
  myShiftForEvent,
  createTitle,
  onCreateTitleChange,
  createRequester,
  onCreateRequesterChange,
  createLocationId,
  onCreateLocationIdChange,
  createStartsAt,
  onCreateStartsAtChange,
  createEndsAt,
  onCreateEndsAtChange,
  users,
  locations,
  bulkSkus,
  showEquipPicker,
  onShowEquipPickerChange,
  selectedAssetIds,
  onSelectedAssetIdsChange,
  selectedBulkItems,
  onSelectedBulkItemsChange,
  createError,
  submitting,
  onCreate,
  onClose,
}: CreateBookingCardProps) {
  return (
    <div className="create-card">
      <div className="create-card-header">
        <h2>New {config.label}</h2>
      </div>

      <div className="create-card-body">
        {/* Tie to event toggle */}
        <div className="toggle-row">
          <button
            type="button"
            className={`toggle ${tieToEvent ? "on" : ""}`}
            onClick={() => onTieToEventChange(!tieToEvent)}
            aria-label="Tie to event"
          />
          <span className="toggle-label">Link to event</span>
        </div>

        {/* Event selection flow */}
        {tieToEvent && (
          <>
            <div className="mb-3 space-y-1">
              <Label>Sport</Label>
              <Select value={createSport} onValueChange={onCreateSportChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sport..." />
                </SelectTrigger>
                <SelectContent>
                  {SPORT_CODES.map((s) => (
                    <SelectItem key={s.code} value={s.code}>{s.code} - {s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {createSport && (
              <div className="event-section">
                <label className="event-section-label">
                  Upcoming events (next 30 days)
                </label>
                {eventsLoading ? (
                  <div className="empty-message">
                    Loading events...
                  </div>
                ) : events.length === 0 ? (
                  <div className="empty-message-bordered">
                    No upcoming events for {sportLabel(createSport)}. Toggle off {"\u201c"}Tie to event{"\u201d"} to create without an event, or add events via the Events page.
                  </div>
                ) : (
                  <div className="event-scroll">
                    {events.map((ev) => (
                      <div
                        key={ev.id}
                        className={`event-row ${selectedEvent?.id === ev.id ? "selected" : ""}`}
                        onClick={() => onSelectEvent(ev)}
                      >
                        <div className="event-row-main">
                          <div className="event-row-title">
                            {ev.opponent
                              ? `${ev.isHome ? "vs" : "at"} ${ev.opponent}`
                              : ev.summary}
                          </div>
                          <div className="event-row-meta">
                            {formatDate(ev.startsAt)}
                            {ev.rawLocationText ? ` \u00b7 ${ev.rawLocationText}` : ""}
                            {ev.location ? ` \u00b7 ${ev.location.name}` : ""}
                          </div>
                        </div>
                        {ev.isHome !== null && (
                          <Badge variant="gray" size="sm">
                            {ev.isHome ? "HOME" : "AWAY"}
                          </Badge>
                        )}
                        {ev.sportCode && (
                          <Badge variant="sport" size="sm">{ev.sportCode}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Shift context banner */}
        {myShiftForEvent && selectedEvent && (
          <div className="shift-context-banner">
            <ClockIcon className="size-4 shrink-0" />
            <div className="shift-context-text">
              <span className="shift-context-label">Your shift</span>
              <span className="shift-context-detail">
                {myShiftForEvent.area} &middot;{" "}
                {new Date(myShiftForEvent.startsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase()}
                {" \u2013 "}
                {new Date(myShiftForEvent.endsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase()}
              </span>
            </div>
            {myShiftForEvent.gearStatus !== "none" && (
              <Badge variant={myShiftForEvent.gearStatus === "checked_out" ? "green" : myShiftForEvent.gearStatus === "reserved" ? "orange" : "gray"}>
                {myShiftForEvent.gearStatus === "checked_out" ? "Gear out" : myShiftForEvent.gearStatus === "reserved" ? "Gear reserved" : "Draft"}
              </Badge>
            )}
          </div>
        )}

        {/* Title */}
        <div className="mb-3 space-y-1">
          <Label>Booking name {tieToEvent && selectedEvent ? "(auto-filled from event)" : ""}</Label>
          <Input
            value={createTitle}
            onChange={(e) => onCreateTitleChange(e.target.value)}
            placeholder={tieToEvent ? "Select an event above..." : "e.g. Game day equipment"}
            required
          />
        </div>

        {/* Sport (when not tied to event) */}
        {!tieToEvent && (
          <div className="mb-3 space-y-1">
            <Label>Sport (optional)</Label>
            <Select value={createSport || "__none__"} onValueChange={(v) => onCreateSportChange(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {SPORT_CODES.map((s) => (
                  <SelectItem key={s.code} value={s.code}>{s.code} - {s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Requester + Location */}
        <div className="field-row">
          <div className="mb-3 space-y-1">
            <Label>{config.requesterLabel}</Label>
            <Select value={createRequester} onValueChange={onCreateRequesterChange} required>
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="mb-3 space-y-1">
            <Label>Location</Label>
            <Select value={createLocationId} onValueChange={onCreateLocationIdChange} required>
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Dates */}
        <div className="field-row">
          <div className="mb-3 space-y-1">
            <Label>{config.startLabel}</Label>
            <DateTimePicker
              value={createStartsAt ? new Date(createStartsAt) : undefined}
              onChange={(d) => onCreateStartsAtChange(toLocalDateTimeValue(d))}
              placeholder="Start date & time"
            />
          </div>
          <div className="mb-3 space-y-1">
            <Label>{config.endLabel}</Label>
            <DateTimePicker
              value={createEndsAt ? new Date(createEndsAt) : undefined}
              onChange={(d) => onCreateEndsAtChange(toLocalDateTimeValue(d))}
              placeholder="End date & time"
            />
          </div>
        </div>

        {/* Equipment picker */}
        <EquipmentPicker
          bulkSkus={bulkSkus}
          selectedAssetIds={selectedAssetIds}
          setSelectedAssetIds={onSelectedAssetIdsChange}
          selectedBulkItems={selectedBulkItems}
          setSelectedBulkItems={onSelectedBulkItemsChange}
          visible={showEquipPicker}
          onDone={() => onShowEquipPickerChange(false)}
          onReopen={() => onShowEquipPickerChange(true)}
          startsAt={createStartsAt}
          endsAt={createEndsAt}
          locationId={createLocationId}
        />

        {createError && (
          <div className="alert-error">{createError}</div>
        )}
      </div>

      <div className="create-card-footer">
        <Button variant="outline" onClick={onClose}>Discard</Button>
        <Button
          disabled={submitting}
          onClick={onCreate}
        >
          {submitting ? config.actionLabelProgress : config.actionLabel}
        </Button>
      </div>
    </div>
  );
}
