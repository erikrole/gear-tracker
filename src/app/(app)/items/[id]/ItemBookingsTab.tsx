"use client";

import { useMemo, useState } from "react";
import {
  getUrgency,
  formatCountdown,
  formatDateShort,
  formatDateFull,
  isStartingToday,
  formatStartsIn,
} from "@/lib/format";
import type { AssetDetail } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ── Operational Overview (Info tab dashboard cards) ─────── */

export function OperationalOverview({ asset, now, onSelectBooking }: { asset: AssetDetail; now: Date; onSelectBooking: (id: string) => void }) {
  const b = asset.activeBooking;
  const reservations = asset.upcomingReservations;

  return (
    <div className="flex-col gap-16">
      {/* Active Checkout / Reservation Card (always visible) */}
      <Card>
        <CardHeader>
          <CardTitle>{b?.kind === "RESERVATION" ? "Active Reservation" : "Active Checkout"}</CardTitle>
        </CardHeader>
        {b ? (
          <CardContent className="p-0 py-1">
            <button
              className="possession-card"
              onClick={() => onSelectBooking(b.id)}
            >
              <div className="possession-card-body">
                <span className="possession-asset-tag">{b.title}</span>
                <span className="possession-asset-name">
                  {b.kind === "CHECKOUT" ? "Checked out" : "Reserved"} by {b.requesterName}
                </span>
                <Badge variant={getUrgency(b.startsAt, b.endsAt, now) === "critical" ? "red" : getUrgency(b.startsAt, b.endsAt, now) === "warning" ? "orange" : "blue"} className="mt-1">
                  {formatCountdown(b.endsAt, now)}
                </Badge>
              </div>
            </button>
          </CardContent>
        ) : (
          <Empty className="py-8 border-0">
            <EmptyDescription>Not currently checked out</EmptyDescription>
          </Empty>
        )}
      </Card>

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
          </CardContent>
        ) : (
          <Empty className="py-8 border-0">
            <EmptyDescription>No upcoming reservations</EmptyDescription>
          </Empty>
        )}
      </Card>
    </div>
  );
}

/* ── Booking Kind Tab ───────────────────────────────────── */

export function BookingKindTab({
  kind, groups, asset, now, onSelectBooking,
}: {
  kind: "CHECKOUT" | "RESERVATION";
  groups: Array<{ month: string; items: AssetDetail["history"] }>;
  asset: AssetDetail;
  now: Date;
  onSelectBooking: (id: string) => void;
}) {
  const label = kind === "CHECKOUT" ? "checkouts" : "reservations";
  const filtered = groups
    .map((g) => ({ month: g.month, items: g.items.filter((e) => e.booking.kind === kind) }))
    .filter((g) => g.items.length > 0);

  const activeBooking = asset.activeBooking;
  const showActiveCard = activeBooking && activeBooking.kind === kind;
  const showUpcoming = kind === "RESERVATION" && asset.upcomingReservations.length > 0;

  return (
    <div className="flex-col gap-16 mt-14">
      {/* Active booking card at top of matching tab */}
      {showActiveCard && activeBooking && (
        <Card>
          <CardHeader><CardTitle>Active {kind === "CHECKOUT" ? "Checkout" : "Reservation"}</CardTitle></CardHeader>
          <CardContent className="p-0 py-1">
            <button
              className="possession-card"
              onClick={() => onSelectBooking(activeBooking.id)}
            >
              <div className="possession-card-body">
                <span className="possession-asset-tag">{activeBooking.title}</span>
                <span className="possession-asset-name">
                  {kind === "CHECKOUT" ? "Checked out" : "Reserved"} by {activeBooking.requesterName}
                </span>
                <Badge variant={getUrgency(activeBooking.startsAt, activeBooking.endsAt, now) === "critical" ? "red" : getUrgency(activeBooking.startsAt, activeBooking.endsAt, now) === "warning" ? "orange" : "blue"} className="mt-1">
                  {formatCountdown(activeBooking.endsAt, now)}
                </Badge>
              </div>
            </button>
          </CardContent>
        </Card>
      )}

      {/* Upcoming reservations at top of Reservations tab */}
      {showUpcoming && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Reservations</CardTitle>
            <Badge variant="gray" size="sm">{asset.upcomingReservations.length}</Badge>
          </CardHeader>
          <CardContent className="p-0 py-1">
            {asset.upcomingReservations.map((r) => {
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
                        <>{formatDateFull(r.startsAt)} {"\u2013"} {formatDateFull(r.endsAt)}</>
                      )}
                    </span>
                  </div>
                  <Badge variant={r.status === "BOOKED" ? "blue" : r.status === "DRAFT" ? "gray" : "green"} size="sm">
                    {r.status === "BOOKED" ? "Booked" : r.status === "DRAFT" ? "Draft" : "Open"}
                  </Badge>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Past history */}
      <Card className="history-card">
        <CardHeader>
          <CardTitle>Past {kind === "CHECKOUT" ? "Checkouts" : "Reservations"}</CardTitle>
          {filtered.length > 0 && (
            <span className="text-xs text-muted-foreground">Completed &amp; cancelled</span>
          )}
        </CardHeader>
        <CardContent className="p-16">
          {filtered.length === 0 ? (
            <Empty className="py-8 border-0">
              <EmptyDescription>No past {label} for this item.</EmptyDescription>
            </Empty>
          ) : (
            filtered.map((group) => (
              <div key={group.month} className="mb-6">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 m-0">{group.month}</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booking</TableHead>
                      <TableHead>Requester</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead>Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.items.map((entry) => (
                      <TableRow key={entry.id} className="cursor-pointer" onClick={() => onSelectBooking(entry.booking.id)}>
                        <TableCell className="font-medium text-primary">{entry.booking.title}</TableCell>
                        <TableCell>{entry.booking.requester.name}</TableCell>
                        <TableCell>{formatDateFull(entry.booking.startsAt)}</TableCell>
                        <TableCell>{entry.booking.location.name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))
          )}
        </CardContent>
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
