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

/* ── Operational Overview (Info tab dashboard cards) ─────── */

export function OperationalOverview({ asset, now, onSelectBooking }: { asset: AssetDetail; now: Date; onSelectBooking: (id: string) => void }) {
  const b = asset.activeBooking;
  const reservations = asset.upcomingReservations;

  return (
    <div className="flex-col gap-16">
      {/* Active Checkout / Reservation Card (always visible) */}
      <div className="card">
        <div className="card-header">
          <h2>{b?.kind === "RESERVATION" ? "Active Reservation" : "Active Checkout"}</h2>
        </div>
        {b ? (
          <div className="card-body card-body-compact">
            <button
              className="possession-card"
              onClick={() => onSelectBooking(b.id)}
            >
              <div className="possession-card-body">
                <span className="possession-asset-tag">{b.title}</span>
                <span className="possession-asset-name">
                  {b.kind === "CHECKOUT" ? "Checked out" : "Reserved"} by {b.requesterName}
                </span>
                <span className={`possession-countdown countdown-text-${getUrgency(b.startsAt, b.endsAt, now)}`}>
                  {formatCountdown(b.endsAt, now)}
                </span>
              </div>
            </button>
          </div>
        ) : (
          <div className="py-16 px-5 text-center text-muted-foreground">Not currently checked out</div>
        )}
      </div>

      {/* Upcoming Reservations Card (always visible) */}
      <div className="card">
        <div className="card-header">
          <h2>Upcoming Reservations</h2>
          {reservations.length > 0 && (
            <span className="section-count">{reservations.length}</span>
          )}
        </div>
        {reservations.length > 0 ? (
          <div className="card-body card-body-compact">
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
                        <>{formatDateShort(r.startsAt)} <span className="overdue-badge-inline">{formatStartsIn(r.startsAt, now)}</span></>
                      ) : startsToday ? (
                        <span className="due-today-badge">{formatStartsIn(r.startsAt, now)}</span>
                      ) : (
                        <>{formatDateShort(r.startsAt)} {"\u2013"} {formatDateShort(r.endsAt)}</>
                      )}
                    </span>
                  </div>
                  <span className={`badge ${r.status === "BOOKED" ? "badge-blue" : r.status === "DRAFT" ? "badge-gray" : "badge-green"}`}>
                    {r.status === "BOOKED" ? "Booked" : r.status === "DRAFT" ? "Draft" : "Open"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="py-16 px-5 text-center text-muted-foreground">No upcoming reservations</div>
        )}
      </div>
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
        <div className="card">
          <div className="card-header"><h2>Active {kind === "CHECKOUT" ? "Checkout" : "Reservation"}</h2></div>
          <div className="card-body card-body-compact">
            <button
              className="possession-card"
              onClick={() => onSelectBooking(activeBooking.id)}
            >
              <div className="possession-card-body">
                <span className="possession-asset-tag">{activeBooking.title}</span>
                <span className="possession-asset-name">
                  {kind === "CHECKOUT" ? "Checked out" : "Reserved"} by {activeBooking.requesterName}
                </span>
                <span className={`possession-countdown countdown-text-${getUrgency(activeBooking.startsAt, activeBooking.endsAt, now)}`}>
                  {formatCountdown(activeBooking.endsAt, now)}
                </span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Upcoming reservations at top of Reservations tab */}
      {showUpcoming && (
        <div className="card">
          <div className="card-header">
            <h2>Upcoming Reservations</h2>
            <span className="section-count">{asset.upcomingReservations.length}</span>
          </div>
          <div className="card-body card-body-compact">
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
                        <>{formatDateShort(r.startsAt)} <span className="overdue-badge-inline">{formatStartsIn(r.startsAt, now)}</span></>
                      ) : startsToday ? (
                        <span className="due-today-badge">{formatStartsIn(r.startsAt, now)}</span>
                      ) : (
                        <>{formatDateFull(r.startsAt)} {"\u2013"} {formatDateFull(r.endsAt)}</>
                      )}
                    </span>
                  </div>
                  <span className={`badge ${r.status === "BOOKED" ? "badge-blue" : r.status === "DRAFT" ? "badge-gray" : "badge-green"}`}>
                    {r.status === "BOOKED" ? "Booked" : r.status === "DRAFT" ? "Draft" : "Open"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Past history */}
      <div className="card history-card">
        <div className="card-header">
          <h2>Past {kind === "CHECKOUT" ? "Checkouts" : "Reservations"}</h2>
          {filtered.length > 0 && (
            <span className="text-xs text-secondary">Completed &amp; cancelled</span>
          )}
        </div>
        <div className="p-16">
          {filtered.length === 0 ? (
            <div className="py-10 px-5 text-center text-muted-foreground">No past {label} for this item.</div>
          ) : (
            filtered.map((group) => (
              <div key={group.month} className="mb-16">
                <h3 className="text-xl mb-8 m-0">{group.month}</h3>
                <table className="data-table item-history-table">
                  <thead><tr><th>Booking</th><th>Requester</th><th>When</th><th>Location</th></tr></thead>
                  <tbody>
                    {group.items.map((entry) => (
                      <tr key={entry.id} className="cursor-pointer" onClick={() => onSelectBooking(entry.booking.id)}>
                        <td><span className="row-link">{entry.booking.title}</span></td>
                        <td>{entry.booking.requester.name}</td>
                        <td>{formatDateFull(entry.booking.startsAt)}</td>
                        <td>{entry.booking.location.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      </div>
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
      <div className="card">
        <div className="card-header">
          <div className="flex-center gap-8">
            <button className="btn btn-sm" onClick={prevMonth}>&lsaquo;</button>
            <h2 className="cal-month-label">{monthLabel}</h2>
            <button className="btn btn-sm" onClick={nextMonth}>{"\u203a"}</button>
          </div>
          <button className="btn btn-sm" onClick={goToday}>Today</button>
        </div>
        <div className="p-16">
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
        </div>
      </div>

      {/* Legend */}
      <div className="cal-legend">
        <span><span className="cal-legend-dot cal-legend-dot-checkout" />Checkout</span>
        <span><span className="cal-legend-dot cal-legend-dot-reservation" />Reservation</span>
      </div>
    </div>
  );
}
