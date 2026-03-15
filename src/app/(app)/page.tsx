"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
const BookingDetailsSheet = dynamic(() => import("@/components/BookingDetailsSheet"), { ssr: false });
import EmptyState from "@/components/EmptyState";
import { SkeletonCard } from "@/components/Skeleton";
import {
  formatDateShort,
  formatDateRange,
  formatEventDateTime,
  formatOverdueElapsed,
  isDueToday,
} from "@/lib/format";

/* ───── Types ───── */

type BookingSummary = {
  id: string;
  title: string;
  requesterName: string;
  startsAt: string;
  endsAt: string;
  itemCount: number;
  status: string;
  isOverdue: boolean;
};

type MyReservation = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  itemCount: number;
  locationName: string | null;
};

type EventSummary = {
  id: string;
  title: string;
  sportCode: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string | null;
  locationId: string | null;
  opponent: string | null;
  isHome: boolean | null;
};

type OverdueItem = {
  bookingId: string;
  bookingTitle: string;
  requesterName: string;
  assetTags: string[];
  endsAt: string;
};

type DashboardData = {
  stats: {
    checkedOut: number;
    overdue: number;
    reserved: number;
    dueToday: number;
  };
  myCheckouts: { total: number; items: BookingSummary[] };
  teamCheckouts: { total: number; overdue: number; items: BookingSummary[] };
  teamReservations: { total: number; items: BookingSummary[] };
  upcomingEvents: EventSummary[];
  myReservations: MyReservation[];
  overdueCount: number;
  overdueItems: OverdueItem[];
};

/* ───── Component ───── */

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const loadData = useCallback(() => {
    fetch("/api/dashboard")
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((json) => { if (json?.data) setData(json.data); else setFetchError(true); })
      .catch(() => setFetchError(true));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Live countdown tick every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (fetchError) {
    return (
      <EmptyState
        icon="box"
        title="Failed to load dashboard"
        description="Something went wrong. Please refresh the page."
        actionLabel="Retry"
        onAction={loadData}
      />
    );
  }

  if (!data) {
    return (
      <>
        <div className="page-header"><h1>Dashboard</h1></div>
        <div className="dashboard-split">
          <div className="dashboard-col dashboard-col-left">
            <SkeletonCard rows={3} />
            <SkeletonCard rows={3} />
          </div>
          <div className="dashboard-col dashboard-col-right">
            <SkeletonCard rows={4} />
            <SkeletonCard rows={3} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* ══════ Page Header + Quick Actions ══════ */}
      <div className="page-header">
        <h1>Dashboard</h1>
        <div className="quick-actions">
          <a href="/checkouts?create=true" className="btn">New checkout</a>
          <a href="/reservations?create=true" className="btn">New reservation</a>
        </div>
      </div>

      {/* ══════ Stat Strip ══════ */}
      <div className="stat-strip">
        <a href="/checkouts?filter=overdue" className={`stat-strip-item stat-strip-clickable ${data.stats.overdue > 0 ? "stat-strip-danger" : ""}`}>
          <span className="stat-strip-value">{data.stats.overdue}</span>
          <span className="stat-strip-label">Overdue</span>
        </a>
        <a href="/checkouts?filter=due-today" className={`stat-strip-item stat-strip-clickable ${data.stats.dueToday > 0 ? "stat-strip-warning" : ""}`}>
          <span className="stat-strip-value">{data.stats.dueToday}</span>
          <span className="stat-strip-label">Due today</span>
        </a>
        <a href="/checkouts" className="stat-strip-item stat-strip-clickable">
          <span className="stat-strip-value">{data.stats.checkedOut}</span>
          <span className="stat-strip-label">Checked out</span>
        </a>
        <a href="/reservations" className="stat-strip-item stat-strip-clickable">
          <span className="stat-strip-value">{data.stats.reserved}</span>
          <span className="stat-strip-label">Reserved</span>
        </a>
      </div>

      {/* ══════ Welcome Banner (first-run) ══════ */}
      {data.stats.checkedOut === 0 && data.stats.overdue === 0 && data.stats.reserved === 0 && data.stats.dueToday === 0
        && data.myCheckouts.total === 0 && data.teamCheckouts.total === 0 && data.upcomingEvents.length === 0 && (
        <div className="welcome-banner">
          <h2>Welcome to Gear Tracker</h2>
          <p>Get started by setting up your equipment inventory.</p>
          <div className="welcome-steps">
            <Link href="/items" className="welcome-step">
              <span className="welcome-step-num">1</span>
              <span>Add your first item</span>
            </Link>
            <Link href="/import" className="welcome-step">
              <span className="welcome-step-num">2</span>
              <span>Import from spreadsheet</span>
            </Link>
            <Link href="/events" className="welcome-step">
              <span className="welcome-step-num">3</span>
              <span>Set up calendar sync</span>
            </Link>
          </div>
        </div>
      )}

      {/* ══════ Overdue Banner ══════ */}
      {data.overdueCount > 0 && (
        <div className="overdue-banner">
          <div className="overdue-banner-header">
            <div className="overdue-banner-title">
              <svg className="overdue-banner-icon" viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <span className="pulse-dot" />
              <strong>{data.overdueCount} overdue checkout{data.overdueCount !== 1 ? "s" : ""}</strong>
            </div>
            <a href="/checkouts?filter=overdue" className="overdue-banner-viewall">View all overdue &rarr;</a>
          </div>
          <div className="overdue-banner-list">
            {data.overdueItems.map((item) => (
              <button
                key={item.bookingId}
                className="overdue-banner-item"
                onClick={() => setSelectedBookingId(item.bookingId)}
              >
                <span className="overdue-banner-item-title">{item.bookingTitle}</span>
                <span className="overdue-elapsed">{formatOverdueElapsed(item.endsAt, now)}</span>
                <span className="overdue-banner-item-who">{item.requesterName}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══════ Two-Column Split ══════ */}
      <div className="dashboard-split">

        {/* ────── Left Column: My Gear ────── */}
        <div className="dashboard-col dashboard-col-left">
          <span className="dashboard-col-label">My Gear</span>

          {/* My Checkouts */}
          <div className="card">
            <a href="/checkouts?mine=true" className="card-header card-header-link">
              <h2>My checkouts</h2>
              <span className="section-count">{data.myCheckouts.total}</span>
            </a>
            {data.myCheckouts.items.length === 0 ? (
              <div className="empty-state">No open checkouts</div>
            ) : (
              <div className="card-body card-body-compact">
                {data.myCheckouts.items.map((c) => (
                  <button
                    key={c.id}
                    className={`ops-row ${c.isOverdue ? "ops-row-overdue" : isDueToday(c.endsAt, now) ? "ops-row-due-today" : ""}`}
                    onClick={() => setSelectedBookingId(c.id)}
                  >
                    <div className="ops-row-main">
                      <span className="ops-row-title">{c.title}</span>
                      <span className="ops-row-meta">
                        {c.isOverdue ? (
                          <>Due {formatDateShort(c.endsAt)} <span className="overdue-badge-inline">{formatOverdueElapsed(c.endsAt, now)}</span></>
                        ) : isDueToday(c.endsAt, now) ? (
                          <span className="due-today-badge">Due today</span>
                        ) : (
                          <>Due {formatDateShort(c.endsAt)}</>
                        )}
                      </span>
                    </div>
                    <span className="ops-row-count">{c.itemCount} item{c.itemCount !== 1 ? "s" : ""}</span>
                  </button>
                ))}
                {data.myCheckouts.total > data.myCheckouts.items.length && (
                  <a href="/checkouts?mine=true" className="view-all-link">View all {data.myCheckouts.total} &rarr;</a>
                )}
              </div>
            )}
          </div>

          {/* My Reservations */}
          <div className="card">
            <a href="/reservations?mine=true" className="card-header card-header-link">
              <h2>My reservations</h2>
              <span className="section-count">{data.myReservations.length}</span>
            </a>
            {data.myReservations.length === 0 ? (
              <div className="empty-state">No upcoming reservations</div>
            ) : (
              <div className="card-body card-body-compact">
                {data.myReservations.map((r) => (
                  <button
                    key={r.id}
                    className="ops-row"
                    onClick={() => setSelectedBookingId(r.id)}
                  >
                    <div className="ops-row-main">
                      <span className="ops-row-title">{r.title}</span>
                      <span className="ops-row-meta">
                        {formatDateRange(r.startsAt, r.endsAt)}
                        {r.locationName && ` \u00B7 ${r.locationName}`}
                      </span>
                    </div>
                    <span className="ops-row-count">{r.itemCount} item{r.itemCount !== 1 ? "s" : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ────── Right Column: Team Activity ────── */}
        <div className="dashboard-col dashboard-col-right">
          <span className="dashboard-col-label">Team Activity</span>

          {/* Team Checkouts */}
          <div className="card">
            <a href="/checkouts" className="card-header card-header-link">
              <h2>Checked out</h2>
              <span className="section-count">{data.teamCheckouts.total}</span>
            </a>
            {data.teamCheckouts.items.length === 0 ? (
              <div className="empty-state">No open checkouts</div>
            ) : (
              <div className="card-body card-body-compact">
                {data.teamCheckouts.items.map((c) => (
                  <button
                    key={c.id}
                    className={`ops-row ${c.isOverdue ? "ops-row-overdue" : isDueToday(c.endsAt, now) ? "ops-row-due-today" : ""}`}
                    onClick={() => setSelectedBookingId(c.id)}
                  >
                    <div className="ops-row-main">
                      <span className="ops-row-title">{c.title}</span>
                      <span className="ops-row-meta">
                        {c.requesterName} &middot;{" "}
                        {c.isOverdue ? (
                          <>Due {formatDateShort(c.endsAt)} <span className="overdue-badge-inline">{formatOverdueElapsed(c.endsAt, now)}</span></>
                        ) : isDueToday(c.endsAt, now) ? (
                          <span className="due-today-badge">Due today</span>
                        ) : (
                          <>Due {formatDateShort(c.endsAt)}</>
                        )}
                      </span>
                    </div>
                    <span className="ops-row-count">{c.itemCount} item{c.itemCount !== 1 ? "s" : ""}</span>
                  </button>
                ))}
                {data.teamCheckouts.total > data.teamCheckouts.items.length && (
                  <a href="/checkouts" className="view-all-link">View all {data.teamCheckouts.total} &rarr;</a>
                )}
              </div>
            )}
          </div>

          {/* Team Reservations */}
          <div className="card">
            <a href="/reservations" className="card-header card-header-link">
              <h2>Reserved</h2>
              <span className="section-count">{data.teamReservations.total}</span>
            </a>
            {data.teamReservations.items.length === 0 ? (
              <div className="empty-state">No active reservations</div>
            ) : (
              <div className="card-body card-body-compact">
                {data.teamReservations.items.map((r) => (
                  <button
                    key={r.id}
                    className="ops-row"
                    onClick={() => setSelectedBookingId(r.id)}
                  >
                    <div className="ops-row-main">
                      <span className="ops-row-title">{r.title}</span>
                      <span className="ops-row-meta">
                        {r.requesterName} &middot; {formatDateRange(r.startsAt, r.endsAt)}
                      </span>
                    </div>
                    <span className="ops-row-count">{r.itemCount} item{r.itemCount !== 1 ? "s" : ""}</span>
                  </button>
                ))}
                {data.teamReservations.total > data.teamReservations.items.length && (
                  <a href="/reservations" className="view-all-link">View all {data.teamReservations.total} &rarr;</a>
                )}
              </div>
            )}
          </div>

          {/* Upcoming Events */}
          <div className="card">
            <a href="/events" className="card-header card-header-link">
              <h2>Upcoming events</h2>
            </a>
            {data.upcomingEvents.length === 0 ? (
              <div className="empty-state">No upcoming events</div>
            ) : (
              <div className="card-body card-body-compact">
                {data.upcomingEvents.map((e) => {
                  const titleParam = encodeURIComponent(e.title);
                  const startsParam = encodeURIComponent(e.startsAt);
                  const endsParam = encodeURIComponent(e.endsAt);
                  const locParam = e.locationId ? `&locationId=${e.locationId}` : "";
                  return (
                    <div key={e.id} className="event-row-wrapper">
                      <a href={`/events/${e.id}`} className="ops-row event-row-clickable">
                        <div className="ops-row-main">
                          <span className="ops-row-title">
                            {e.sportCode && <span className="event-sport">{e.sportCode}</span>}
                            {e.opponent ? `vs ${e.opponent}` : e.title}
                          </span>
                          <span className="ops-row-meta">
                            {formatEventDateTime(e.startsAt, e.endsAt, e.allDay)}
                            {e.location && ` \u00B7 ${e.location}`}
                          </span>
                        </div>
                        {e.isHome !== null && (
                          <span className={`badge ${e.isHome ? "badge-green" : "badge-gray"}`}>
                            {e.isHome ? "Home" : "Away"}
                          </span>
                        )}
                      </a>
                      <div className="event-row-actions">
                        <a
                          href={`/checkouts?title=${titleParam}&startsAt=${startsParam}&endsAt=${endsParam}${locParam}`}
                          className="event-action-btn"
                          title="Checkout for this event"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                          Checkout
                        </a>
                        <a
                          href={`/reservations?title=${titleParam}&startsAt=${startsParam}&endsAt=${endsParam}${locParam}`}
                          className="event-action-btn"
                          title="Reserve for this event"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
                          Reserve
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ══════ Booking Detail Sheet ══════ */}
      <BookingDetailsSheet
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        onUpdated={loadData}
      />
    </>
  );
}
