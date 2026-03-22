"use client";

import { useMemo, useState } from "react";
import {
  getUrgency,
  formatCountdown,
  formatDateShort,
  formatDuration,
  formatDateWithDayTime,
  isStartingToday,
  formatStartsIn,
} from "@/lib/format";
import type { AssetDetail, ActiveBookingDetail, UpcomingReservation } from "./types";
import { QRCodeCanvas, QRModal } from "./ItemInfoTab";
import { useSaveField } from "@/components/SaveableField";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ── Shared: Urgency Badge ────────────────────────────── */

export function UrgencyBadge({ startsAt, endsAt, now }: { startsAt: string; endsAt: string; now: Date }) {
  const urgency = getUrgency(startsAt, endsAt, now);
  const variant = urgency === "critical" || urgency === "overdue" ? "red" : urgency === "warning" ? "orange" : "blue";
  return <Badge variant={variant} className="mt-1">{formatCountdown(endsAt, now)}</Badge>;
}

/* ── Shared: Upcoming Reservations List ──────────────── */

export function UpcomingReservationsList({
  reservations, now, onSelectBooking,
}: {
  reservations: UpcomingReservation[];
  now: Date;
  onSelectBooking: (id: string) => void;
}) {
  return (
    <>
      {reservations.map((r) => {
        const pastStart = new Date(r.startsAt) < now;
        const startsToday = !pastStart && isStartingToday(r.startsAt, now);
        return (
          <button
            key={r.bookingId}
            className={`ops-row ${pastStart ? "ops-row-overdue" : startsToday ? "ops-row-due-today" : ""}`}
            onClick={() => onSelectBooking(r.bookingId)}
          >
            <div className="ops-row-main">
              <span className="ops-row-title">{r.title}</span>
              <span className="ops-row-meta">
                {r.requesterName} {"\u00b7"}{" "}
                {pastStart ? (
                  <>{formatDateShort(r.startsAt)} <Badge variant="red" size="sm">{formatStartsIn(r.startsAt, now)}</Badge></>
                ) : startsToday ? (
                  <Badge variant="orange" size="sm">{formatStartsIn(r.startsAt, now)}</Badge>
                ) : (
                  <>{formatDateShort(r.startsAt)} {"\u2013"} {formatDateShort(r.endsAt)}</>
                )}
              </span>
            </div>
            <Badge variant={r.status === "BOOKED" ? "blue" : r.status === "DRAFT" ? "gray" : "green"} size="sm">
              {r.status === "BOOKED" ? "Booked" : r.status === "DRAFT" ? "Draft" : "Open"}
            </Badge>
          </button>
        );
      })}
    </>
  );
}

/* ── Shared: Active Booking Card ─────────────────────── */

export function ActiveBookingCard({
  booking, kind, now, onSelectBooking,
}: {
  booking: ActiveBookingDetail;
  kind: string;
  now: Date;
  onSelectBooking: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>Active {kind === "CHECKOUT" ? "Checkout" : "Reservation"}</CardTitle></CardHeader>
      <CardContent className="p-0 py-1">
        <button className="possession-card" onClick={() => onSelectBooking(booking.id)}>
          <div className="possession-card-body">
            <span className="possession-asset-tag">{booking.title}</span>
            <span className="possession-asset-name">
              {kind === "CHECKOUT" ? "Checked out" : "Reserved"} by {booking.requesterName}
            </span>
            <UrgencyBadge startsAt={booking.startsAt} endsAt={booking.endsAt} now={now} />
          </div>
        </button>
      </CardContent>
    </Card>
  );
}

/* ── Tracking Codes Card (sidebar) ─────────────────────── */

function TrackingCodesCard({ asset, canEdit, onRefresh }: { asset: AssetDetail; canEdit: boolean; onRefresh: () => void }) {
  const [showModal, setShowModal] = useState(false);
  const rawParts = asset.assetTag.split(/[\s]+/).filter(Boolean);
  const isFootball = rawParts.length === 3 && rawParts[0] === "FB";
  const tagLines = rawParts.length >= 3
    ? rawParts.slice(0, 3)
    : [...Array(3 - rawParts.length).fill(""), ...rawParts];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Tracking Codes</CardTitle>
        </CardHeader>
        <CardContent className="p-16 pt-0">
          <div className="flex gap-12 items-center">
            <button
              className="asset-tag-label"
              onClick={() => setShowModal(true)}
              title="Click to enlarge QR code"
            >
              <div className={`asset-tag-label-text ${isFootball ? "" : "asset-tag-label-text-left"}`}>
                {tagLines.map((line, i) => (
                  <div key={i} className="asset-tag-label-line">{line || "\u00A0"}</div>
                ))}
              </div>
              <div className="asset-tag-label-qr">
                <QRCodeCanvas value={asset.qrCodeValue} size={96} margin={0} />
              </div>
            </button>
            <div className="flex flex-col gap-2">
              <Badge variant="outline" className="gap-1.5 font-mono text-xs">
                <span className="text-muted-foreground uppercase text-[0.6rem] font-semibold tracking-wider">QR</span>
                {asset.qrCodeValue}
              </Badge>
              {asset.serialNumber && (
                <Badge variant="outline" className="gap-1.5 font-mono text-xs">
                  <span className="text-muted-foreground uppercase text-[0.6rem] font-semibold tracking-wider">Serial</span>
                  {asset.serialNumber}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <QRModal
        asset={asset}
        canEdit={canEdit}
        onRefresh={onRefresh}
        open={showModal}
        onOpenChange={setShowModal}
      />
    </>
  );
}

/* ── Saveable Toggle Row ───────────────────────────────── */

function SaveableToggle({
  label,
  help,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  help: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => Promise<void>;
}) {
  const saveField = useSaveField(async () => {
    await onToggle();
  });

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors",
        checked && "border-primary/30 bg-primary/5",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">{label}</Label>
          {saveField.status === "saving" && <Spinner className="size-3" />}
          {saveField.status === "saved" && <Check className="size-3 text-green-600 dark:text-green-400" />}
          {saveField.status === "error" && <X className="size-3 text-destructive" />}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 m-0">{help}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={() => saveField.save("")}
        disabled={saveField.status === "saving" || disabled}
        className="shrink-0"
      />
    </div>
  );
}

/* ── Settings Card (sidebar) ───────────────────────────── */

function SettingsCard({ asset, canEdit, onRefresh }: { asset: AssetDetail; canEdit: boolean; onRefresh: () => void }) {
  const toggles = [
    { field: "availableForReservation", label: "Available for reservation", value: asset.availableForReservation, help: "Item is available to be used in reservations" },
    { field: "availableForCheckout", label: "Available for check out", value: asset.availableForCheckout, help: "Item is available to be used in check-outs" },
    { field: "availableForCustody", label: "Available for custody", value: asset.availableForCustody, help: "Item can be taken into custody by a user" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-2">
        {toggles.map((t) => (
          <SaveableToggle
            key={t.field}
            label={t.label}
            help={t.help}
            checked={t.value}
            disabled={!canEdit}
            onToggle={async () => {
              const res = await fetch(`/api/assets/${asset.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [t.field]: !t.value }),
              });
              if (!res.ok) throw new Error();
              onRefresh();
            }}
          />
        ))}
      </CardContent>
    </Card>
  );
}

/* ── Operational Overview (Info tab dashboard cards) ─────── */

export function OperationalOverview({ asset, now, canEdit, onSelectBooking, onRefresh }: { asset: AssetDetail; now: Date; canEdit: boolean; onSelectBooking: (id: string) => void; onRefresh: () => void }) {
  const b = asset.activeBooking;
  const reservations = asset.upcomingReservations;

  return (
    <div className="flex-col gap-16">
      {/* Active Checkout / Reservation Card (always visible) */}
      {b ? (
        <ActiveBookingCard booking={b} kind={b.kind} now={now} onSelectBooking={onSelectBooking} />
      ) : (
        <Card>
          <CardHeader><CardTitle>Active Checkout</CardTitle></CardHeader>
          <Empty className="py-8 border-0">
            <EmptyDescription>Not currently checked out</EmptyDescription>
          </Empty>
        </Card>
      )}

      {/* Upcoming Reservations Card (always visible) */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Reservations</CardTitle>
          {reservations.length > 0 && (
            <Badge variant="gray" size="sm">{reservations.length}</Badge>
          )}
        </CardHeader>
        {reservations.length > 0 ? (
          <CardContent className="p-0 py-1">
            <UpcomingReservationsList reservations={reservations} now={now} onSelectBooking={onSelectBooking} />
          </CardContent>
        ) : (
          <Empty className="py-8 border-0">
            <EmptyDescription>No upcoming reservations</EmptyDescription>
          </Empty>
        )}
      </Card>

      {/* Tracking Codes */}
      <TrackingCodesCard asset={asset} canEdit={canEdit} onRefresh={onRefresh} />

    </div>
  );
}

/* ── Booking Status Label ──────────────────────────────── */

function bookingStatusLabel(status: string): { label: string; variant: "blue" | "green" | "gray" | "red" | "orange" } {
  switch (status) {
    case "BOOKED": return { label: "Booked", variant: "blue" };
    case "CHECKED_OUT": return { label: "Checked out", variant: "blue" };
    case "COMPLETED": return { label: "Completed", variant: "green" };
    case "RETURNED": return { label: "Returned", variant: "green" };
    case "CANCELLED": return { label: "Cancelled", variant: "gray" };
    case "DRAFT": return { label: "Draft", variant: "gray" };
    case "CONVERTED": return { label: "Converted", variant: "green" };
    case "CLOSED": return { label: "Closed", variant: "gray" };
    default: return { label: status, variant: "gray" };
  }
}

/* ── Booking Kind Tab ───────────────────────────────────── */

export function BookingKindTab({
  kind, history, asset, now, onSelectBooking,
}: {
  kind: "CHECKOUT" | "RESERVATION";
  history: AssetDetail["history"];
  asset: AssetDetail;
  now: Date;
  onSelectBooking: (id: string) => void;
}) {
  const label = kind === "CHECKOUT" ? "checkouts" : "reservations";

  // Deduplicate and filter bookings of this kind, sorted newest first
  const allEntries = useMemo(() => {
    const seen = new Set<string>();
    const entries: AssetDetail["history"] = [];
    for (const e of history) {
      if (e.booking.kind === kind && !seen.has(e.booking.id)) {
        seen.add(e.booking.id);
        entries.push(e);
      }
    }
    entries.sort((a, b) => new Date(b.booking.startsAt).getTime() - new Date(a.booking.startsAt).getTime());
    return entries;
  }, [history, kind]);

  const activeBooking = asset.activeBooking;
  const showActiveCard = activeBooking && activeBooking.kind === kind;
  const showUpcoming = kind === "RESERVATION" && asset.upcomingReservations.length > 0;

  return (
    <div className="flex-col gap-16 mt-14">
      {/* Active booking card at top of matching tab */}
      {showActiveCard && activeBooking && (
        <ActiveBookingCard booking={activeBooking} kind={kind} now={now} onSelectBooking={onSelectBooking} />
      )}

      {/* Upcoming reservations at top of Reservations tab */}
      {showUpcoming && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Reservations</CardTitle>
            <Badge variant="gray" size="sm">{asset.upcomingReservations.length}</Badge>
          </CardHeader>
          <CardContent className="p-0 py-1">
            <UpcomingReservationsList reservations={asset.upcomingReservations} now={now} onSelectBooking={onSelectBooking} />
          </CardContent>
        </Card>
      )}

      {/* All bookings — flat table */}
      <Card>
        <CardHeader>
          <CardTitle>{kind === "CHECKOUT" ? "Checkouts" : "Reservations"}</CardTitle>
          {allEntries.length > 0 && (
            <Badge variant="gray" size="sm">{allEntries.length}</Badge>
          )}
        </CardHeader>
        {allEntries.length === 0 ? (
          <Empty className="py-8 border-0">
            <EmptyDescription>No {label} for this item.</EmptyDescription>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allEntries.map((entry) => {
                const b = entry.booking;
                const from = formatDateWithDayTime(b.startsAt);
                const to = formatDateWithDayTime(b.endsAt);
                const dur = formatDuration(b.startsAt, b.endsAt);
                const st = bookingStatusLabel(b.status);
                return (
                  <TableRow key={entry.id} className="cursor-pointer" onClick={() => onSelectBooking(b.id)}>
                    <TableCell>
                      <div className="font-medium text-primary">{b.title}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`inline-block size-2 rounded-full ${st.variant === "green" ? "bg-green-500" : st.variant === "blue" ? "bg-blue-500" : st.variant === "red" ? "bg-red-500" : "bg-gray-400"}`} />
                        <span className="text-xs text-muted-foreground">{st.label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{from.date}</div>
                      <div className="text-xs text-muted-foreground">{from.dayTime}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{to.date}</div>
                      <div className="text-xs text-muted-foreground">{to.dayTime}</div>
                    </TableCell>
                    <TableCell className="text-sm">{dur}</TableCell>
                    <TableCell className="text-sm">{b.requester.name}</TableCell>
                    <TableCell className="text-sm">{b.location.name}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/* ── Calendar Tab ───────────────────────────────────────── */

export function CalendarTab({ asset, onSelectBooking }: { asset: AssetDetail; onSelectBooking: (id: string) => void }) {
  const [viewDate, setViewDate] = useState(() => new Date());

  const allBookings = useMemo(
    () => asset.history.map((e) => e.booking),
    [asset.history]
  );

  // Deduplicate bookings by id (same booking can appear multiple times from history)
  const uniqueBookings = useMemo(() => {
    const seen = new Set<string>();
    return allBookings.filter((b) => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });
  }, [allBookings]);

  // Build calendar grid for current month
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();

  const monthLabel = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Map bookings to days: which bookings overlap each day?
  const dayBookings = useMemo(() => {
    const map = new Map<number, Array<typeof uniqueBookings[0]>>();
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStart = new Date(year, month, d).getTime();
      const dayEnd = new Date(year, month, d + 1).getTime();
      const overlapping = uniqueBookings.filter((b) => {
        const bs = new Date(b.startsAt).getTime();
        const be = new Date(b.endsAt).getTime();
        return bs < dayEnd && be > dayStart;
      });
      if (overlapping.length > 0) map.set(d, overlapping);
    }
    return map;
  }, [uniqueBookings, year, month, daysInMonth]);

  const today = new Date();
  const isToday = (d: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)); }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)); }
  function goToday() { setViewDate(new Date()); }

  // Build grid cells: padding + days
  const cells: Array<{ day: number | null }> = [];
  for (let i = 0; i < startPad; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });

  return (
    <div className="mt-14">
      <Card>
        <CardHeader>
          <div className="flex-center gap-8">
            <Button variant="outline" size="sm" onClick={prevMonth}>&lsaquo;</Button>
            <CardTitle className="cal-month-label">{monthLabel}</CardTitle>
            <Button variant="outline" size="sm" onClick={nextMonth}>{"\u203a"}</Button>
          </div>
          <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
        </CardHeader>
        <CardContent className="p-16">
          {/* Day headers */}
          <div className="cal-grid">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="cal-header">{d}</div>
            ))}
            {cells.map((cell, i) => (
              <div key={i} className={`cal-cell ${cell.day === null ? "cal-cell-empty" : ""} ${cell.day && isToday(cell.day) ? "cal-cell-today" : ""}`}>
                {cell.day && (
                  <>
                    <span className="cal-day-num">{cell.day}</span>
                    {dayBookings.get(cell.day)?.slice(0, 3).map((b) => (
                      <button
                        key={b.id}
                        className={`cal-booking ${b.kind === "CHECKOUT" ? "cal-booking-co" : "cal-booking-res"}`}
                        onClick={() => onSelectBooking(b.id)}
                        title={`${b.kind === "CHECKOUT" ? "CO" : "RES"}: ${b.title} (${b.requester.name})`}
                      >
                        {b.title}
                      </button>
                    ))}
                    {(dayBookings.get(cell.day)?.length ?? 0) > 3 && (
                      <span className="cal-more">+{(dayBookings.get(cell.day)?.length ?? 0) - 3} more</span>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 justify-center">
        <div className="flex items-center gap-1.5 text-sm">
          <Badge variant="blue" size="sm">Checkout</Badge>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <Badge variant="purple" size="sm">Reservation</Badge>
        </div>
      </div>
    </div>
  );
}

/* ── Merged Bookings Tab ──────────────────────────────────── */

type BookingFilter = "all" | "checkouts" | "reservations";

export function BookingsTab({
  history, asset, now, onSelectBooking,
}: {
  history: AssetDetail["history"];
  asset: AssetDetail;
  now: Date;
  onSelectBooking: (id: string) => void;
}) {
  const [filter, setFilter] = useState<BookingFilter>("all");

  const allEntries = useMemo(() => {
    const seen = new Set<string>();
    const entries: AssetDetail["history"] = [];
    for (const e of history) {
      if (!seen.has(e.booking.id)) {
        seen.add(e.booking.id);
        if (filter === "all" || (filter === "checkouts" && e.booking.kind === "CHECKOUT") || (filter === "reservations" && e.booking.kind === "RESERVATION")) {
          entries.push(e);
        }
      }
    }
    entries.sort((a, b) => new Date(b.booking.startsAt).getTime() - new Date(a.booking.startsAt).getTime());
    return entries;
  }, [history, filter]);

  const activeBooking = asset.activeBooking;
  const showUpcoming = asset.upcomingReservations.length > 0;

  return (
    <div className="flex-col gap-16 mt-14">
      {/* Active booking card */}
      {activeBooking && (
        <ActiveBookingCard booking={activeBooking} kind={activeBooking.kind} now={now} onSelectBooking={onSelectBooking} />
      )}

      {/* Upcoming reservations */}
      {showUpcoming && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Reservations</CardTitle>
            <Badge variant="gray" size="sm">{asset.upcomingReservations.length}</Badge>
          </CardHeader>
          <CardContent className="p-0 py-1">
            <UpcomingReservationsList reservations={asset.upcomingReservations} now={now} onSelectBooking={onSelectBooking} />
          </CardContent>
        </Card>
      )}

      {/* All bookings with filter toggle */}
      <Card>
        <CardHeader>
          <CardTitle>Booking History</CardTitle>
          <div className="flex items-center gap-1">
            {(["all", "checkouts", "reservations"] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "ghost"}
                size="sm"
                onClick={() => setFilter(f)}
                className="text-xs capitalize"
              >
                {f === "all" ? "All" : f === "checkouts" ? "Checkouts" : "Reservations"}
              </Button>
            ))}
          </div>
        </CardHeader>
        {allEntries.length === 0 ? (
          <Empty className="py-8 border-0">
            <EmptyDescription>No bookings for this item.</EmptyDescription>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allEntries.map((entry) => {
                const b = entry.booking;
                const from = formatDateWithDayTime(b.startsAt);
                const to = formatDateWithDayTime(b.endsAt);
                const dur = formatDuration(b.startsAt, b.endsAt);
                const st = bookingStatusLabel(b.status);
                return (
                  <TableRow key={entry.id} className="cursor-pointer" onClick={() => onSelectBooking(b.id)}>
                    <TableCell>
                      <div className="font-medium text-primary">{b.title}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`inline-block size-2 rounded-full ${st.variant === "green" ? "bg-green-500" : st.variant === "blue" ? "bg-blue-500" : st.variant === "red" ? "bg-red-500" : "bg-gray-400"}`} />
                        <span className="text-xs text-muted-foreground">{st.label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={b.kind === "CHECKOUT" ? "blue" : "purple"} size="sm">
                        {b.kind === "CHECKOUT" ? "CO" : "Res"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{from.date}</div>
                      <div className="text-xs text-muted-foreground">{from.dayTime}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{to.date}</div>
                      <div className="text-xs text-muted-foreground">{to.dayTime}</div>
                    </TableCell>
                    <TableCell className="text-sm">{dur}</TableCell>
                    <TableCell className="text-sm">{b.requester.name}</TableCell>
                    <TableCell className="text-sm">{b.location.name}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/* ── Settings Tab ──────────────────────────────────────────── */

export function SettingsTab({ asset, canEdit, onRefresh }: { asset: AssetDetail; canEdit: boolean; onRefresh: () => void }) {
  return (
    <div className="mt-14 max-w-lg">
      <SettingsCard asset={asset} canEdit={canEdit} onRefresh={onRefresh} />
    </div>
  );
}
