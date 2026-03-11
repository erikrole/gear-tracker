"use client";

import { useCallback, useEffect, useState } from "react";
import BookingDetailsSheet from "@/components/BookingDetailsSheet";

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

type MyPossessionItem = {
  assetId: string;
  assetTag: string;
  brand: string;
  model: string;
  type: string;
  bookingId: string;
  bookingTitle: string;
  endsAt: string;
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
  location: string | null;
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
  checkouts: { total: number; overdue: number; items: BookingSummary[] };
  reservations: { total: number; items: BookingSummary[] };
  upcomingEvents: EventSummary[];
  myPossession: MyPossessionItem[];
  myReservations: MyReservation[];
  overdueCount: number;
  overdueItems: OverdueItem[];
};

/* ───── Countdown helpers ───── */

type UrgencyLevel = "overdue" | "critical" | "warning" | "normal";

function getUrgency(endsAt: string, now: Date): UrgencyLevel {
  const diff = new Date(endsAt).getTime() - now.getTime();
  if (diff <= 0) return "overdue";
  if (diff <= 24 * 60 * 60 * 1000) return "critical";
  if (diff <= 7 * 24 * 60 * 60 * 1000) return "warning";
  return "normal";
}

function formatCountdown(endsAt: string, now: Date): string {
  const diff = new Date(endsAt).getTime() - now.getTime();
  const absDiff = Math.abs(diff);

  const days = Math.floor(absDiff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((absDiff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((absDiff % (60 * 60 * 1000)) / (60 * 1000));

  let timeStr: string;
  if (days > 0) {
    timeStr = `${days}d ${hours}h`;
  } else if (hours > 0) {
    timeStr = `${hours}h ${minutes}m`;
  } else {
    timeStr = `${minutes}m`;
  }

  if (diff <= 0) return `OVERDUE BY ${timeStr}`;
  return `DUE BACK IN ${timeStr}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDateRange(startsAt: string, endsAt: string) {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (s.toDateString() === e.toDateString()) {
    return s.toLocaleDateString("en-US", opts);
  }
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}`;
}

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
    return <div className="empty-state">Failed to load dashboard data. Please refresh the page.</div>;
  }

  if (!data) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      {/* ══════ Overdue Banner ══════ */}
      {data.overdueCount > 0 && (
        <div className="overdue-banner">
          <div className="overdue-banner-content">
            <strong>{data.overdueCount} overdue checkout{data.overdueCount !== 1 ? "s" : ""}</strong>
            <span className="overdue-banner-items">
              {data.overdueItems.map((item, i) => (
                <button
                  key={item.bookingId}
                  className="overdue-banner-link"
                  onClick={() => setSelectedBookingId(item.bookingId)}
                >
                  {item.bookingTitle}{i < data.overdueItems.length - 1 ? "," : ""}
                </button>
              ))}
            </span>
          </div>
        </div>
      )}

      {/* ══════ Two-Column Split ══════ */}
      <div className="dashboard-split">

        {/* ────── Left Column: Global Ops ────── */}
        <div className="dashboard-col dashboard-col-left">

          {/* Reserved */}
          <div className="card">
            <div className="card-header">
              <h2>Reserved</h2>
              <span className="section-count">{data.reservations.total}</span>
            </div>
            {data.reservations.items.length === 0 ? (
              <div className="empty-state">No active reservations</div>
            ) : (
              <div className="card-body card-body-compact">
                {data.reservations.items.map((r) => (
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
              </div>
            )}
          </div>

          {/* Checked Out */}
          <div className="card">
            <div className="card-header">
              <h2>Checked out</h2>
              <span className="section-count">{data.checkouts.total}</span>
            </div>
            {data.checkouts.items.length === 0 ? (
              <div className="empty-state">No open check-outs</div>
            ) : (
              <div className="card-body card-body-compact">
                {data.checkouts.items.map((c) => (
                  <button
                    key={c.id}
                    className={`ops-row ${c.isOverdue ? "ops-row-overdue" : ""}`}
                    onClick={() => setSelectedBookingId(c.id)}
                  >
                    <div className="ops-row-main">
                      <span className="ops-row-title">{c.title}</span>
                      <span className="ops-row-meta">
                        {c.requesterName} &middot; Due {formatDate(c.endsAt)}
                      </span>
                    </div>
                    <span className="ops-row-count">{c.itemCount} item{c.itemCount !== 1 ? "s" : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Events */}
          <div className="card">
            <div className="card-header">
              <h2>Upcoming events</h2>
            </div>
            {data.upcomingEvents.length === 0 ? (
              <div className="empty-state">No upcoming events</div>
            ) : (
              <div className="card-body card-body-compact">
                {data.upcomingEvents.map((e) => (
                  <div key={e.id} className="ops-row ops-row-static">
                    <div className="ops-row-main">
                      <span className="ops-row-title">
                        {e.sportCode && <span className="event-sport">{e.sportCode}</span>}
                        {e.opponent ? `vs ${e.opponent}` : e.title}
                      </span>
                      <span className="ops-row-meta">
                        {formatDate(e.startsAt)}
                        {e.location && ` \u00B7 ${e.location}`}
                      </span>
                    </div>
                    {e.isHome !== null && (
                      <span className={`badge ${e.isHome ? "badge-green" : "badge-gray"}`}>
                        {e.isHome ? "Home" : "Away"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ────── Right Column: Personal ────── */}
        <div className="dashboard-col dashboard-col-right">

          {/* In My Possession */}
          <div className="card">
            <div className="card-header">
              <h2>In my possession</h2>
              <span className="section-count">{data.myPossession.length}</span>
            </div>
            {data.myPossession.length === 0 ? (
              <div className="empty-state">Nothing checked out to you</div>
            ) : (
              <div className="card-body card-body-compact">
                {data.myPossession.map((item) => {
                  const urgency = getUrgency(item.endsAt, now);
                  return (
                    <button
                      key={`${item.bookingId}-${item.assetId}`}
                      className="possession-card"
                      onClick={() => setSelectedBookingId(item.bookingId)}
                    >
                      <div className={`countdown-bar countdown-${urgency}`}>
                        {urgency !== "normal"
                          ? formatCountdown(item.endsAt, now)
                          : `Due ${formatDate(item.endsAt)}`}
                      </div>
                      <div className="possession-card-body">
                        <span className="possession-asset-tag">{item.assetTag}</span>
                        <span className="possession-asset-name">
                          {item.brand} {item.model}
                        </span>
                        <span className="ops-row-meta">{item.bookingTitle}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* My Reservations */}
          <div className="card">
            <div className="card-header">
              <h2>My reservations</h2>
              <span className="section-count">{data.myReservations.length}</span>
            </div>
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
