"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
const BookingDetailsSheet = dynamic(() => import("@/components/BookingDetailsSheet"), { ssr: false });
import EmptyState from "@/components/EmptyState";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SkeletonCard } from "@/components/Skeleton";
import {
  formatDateShort,
  formatDateRange,
  formatEventDateTime,
  formatOverdueElapsed,
  formatRelativeTime,
  isDueToday,
} from "@/lib/format";
import { ClipboardCheckIcon, CalendarCheckIcon, PackageIcon, CalendarIcon, InboxIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

/* ───── Types ───── */

type ItemThumb = {
  id: string;
  name: string | null;
  imageUrl: string | null;
};

type BookingSummary = {
  id: string;
  title: string;
  refNumber: string | null;
  requesterName: string;
  requesterInitials: string;
  locationName: string | null;
  startsAt: string;
  endsAt: string;
  itemCount: number;
  status: string;
  isOverdue: boolean;
  items: ItemThumb[];
};

type MyReservation = {
  id: string;
  title: string;
  refNumber: string | null;
  startsAt: string;
  endsAt: string;
  itemCount: number;
  locationName: string | null;
  items: ItemThumb[];
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
  totalShiftSlots: number;
  assignedUsers: Array<{ id: string; name: string; initials: string }>;
};

type OverdueItem = {
  bookingId: string;
  bookingTitle: string;
  requesterName: string;
  assetTags: string[];
  endsAt: string;
};

type DraftSummary = {
  id: string;
  kind: string;
  title: string;
  itemCount: number;
  updatedAt: string;
};

type MyShift = {
  id: string;
  area: string;
  workerType: string;
  startsAt: string;
  endsAt: string;
  event: {
    id: string;
    summary: string;
    startsAt: string;
    endsAt: string;
    sportCode: string | null;
    opponent: string | null;
    isHome: boolean | null;
    locationId: string | null;
    locationName: string | null;
  };
  gearStatus: string;
  gearItems: ItemThumb[];
  gearItemCount: number;
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
  drafts: DraftSummary[];
  myShifts: MyShift[];
};

/* ───── Shared sub-components ───── */

function GearAvatarStack({ items, totalCount }: { items: ItemThumb[]; totalCount: number }) {
  if (totalCount === 0) return null;
  const overflow = totalCount - items.length;
  return (
    <div className="gear-avatar-stack">
      {items.map((item) => (
        <div key={item.id} className="gear-avatar" title={item.name || undefined}>
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.name || "Item"} />
          ) : (
            <span>{(item.name || "?")[0].toUpperCase()}</span>
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div className="gear-avatar gear-avatar-overflow">
          <span>+{overflow}</span>
        </div>
      )}
    </div>
  );
}

function UserInitialsAvatar({ initials }: { initials: string }) {
  return <span className="user-initials-avatar">{initials}</span>;
}

function ShiftAvatarStack({ assignedUsers, totalSlots }: { assignedUsers: EventSummary["assignedUsers"]; totalSlots: number }) {
  if (totalSlots === 0) return null;
  const emptySlots = Math.max(0, totalSlots - assignedUsers.length);
  const maxShow = 5;
  const showUsers = assignedUsers.slice(0, maxShow);
  const showEmpty = Math.min(emptySlots, maxShow - showUsers.length);
  const overflow = assignedUsers.length + emptySlots - maxShow;
  return (
    <div className="shift-avatar-stack">
      {showUsers.map((u) => (
        <div key={u.id} className="shift-avatar shift-avatar-filled" title={u.name}>
          <span>{u.initials}</span>
        </div>
      ))}
      {Array.from({ length: showEmpty }).map((_, i) => (
        <div key={`empty-${i}`} className="shift-avatar shift-avatar-empty" />
      ))}
      {overflow > 0 && (
        <div className="shift-avatar shift-avatar-overflow">
          <span>+{overflow}</span>
        </div>
      )}
    </div>
  );
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
          <Button variant="outline" asChild><a href="/checkouts?create=true">New checkout</a></Button>
          <Button variant="outline" asChild><a href="/reservations?create=true">New reservation</a></Button>
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
                <div className="overdue-banner-item-main">
                  <span className="overdue-banner-item-title">{item.bookingTitle}</span>
                  <span className="overdue-banner-item-meta">
                    <UserInitialsAvatar initials={item.requesterName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)} />
                    {item.requesterName} &middot; {item.assetTags.length > 0 && <>{item.assetTags.join(", ")} &middot; </>}
                    <span className="overdue-elapsed">{formatOverdueElapsed(item.endsAt, now)}</span>
                  </span>
                </div>
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
          <Card>
            <a href="/checkouts?mine=true" className="card-header-link flex items-center justify-between px-5 py-4 border-b border-border/50">
              <h2>My checkouts</h2>
              <span className="section-count">{data.myCheckouts.total}</span>
            </a>
            {data.myCheckouts.items.length === 0 ? (
              <div className="empty-section"><ClipboardCheckIcon className="empty-section-icon" />No open checkouts</div>
            ) : (
              <CardContent className="p-0 py-1">
                {data.myCheckouts.items.map((c) => (
                  <button
                    key={c.id}
                    className={`ops-row ops-row-owned ${c.isOverdue ? "ops-row-overdue" : isDueToday(c.endsAt, now) ? "ops-row-due-today" : ""}`}
                    onClick={() => setSelectedBookingId(c.id)}
                  >
                    <div className="ops-row-main">
                      <span className="ops-row-subtext">
                        {c.title}
                        {c.locationName && ` \u00B7 ${c.locationName}`}
                      </span>
                      <span className="ops-row-meta">
                        {c.itemCount} item{c.itemCount !== 1 ? "s" : ""} &middot;{" "}
                        {c.isOverdue ? (
                          <>Due {formatDateShort(c.endsAt)} <span className="overdue-badge-inline">{formatOverdueElapsed(c.endsAt, now)}</span></>
                        ) : isDueToday(c.endsAt, now) ? (
                          <span className="due-today-badge">Due today</span>
                        ) : (
                          <>Due {formatDateShort(c.endsAt)}</>
                        )}
                      </span>
                    </div>
                    <GearAvatarStack items={c.items} totalCount={c.itemCount} />
                  </button>
                ))}
                {data.myCheckouts.total > data.myCheckouts.items.length && (
                  <a href="/checkouts?mine=true" className="view-all-link">View all {data.myCheckouts.total} &rarr;</a>
                )}
              </CardContent>
            )}
          </Card>

          {/* My Reservations */}
          <Card>
            <a href="/reservations?mine=true" className="card-header-link flex items-center justify-between px-5 py-4 border-b border-border/50">
              <h2>My reservations</h2>
              <span className="section-count">{data.myReservations.length}</span>
            </a>
            {data.myReservations.length === 0 ? (
              <div className="empty-section"><CalendarCheckIcon className="empty-section-icon" />No upcoming reservations</div>
            ) : (
              <CardContent className="p-0 py-1">
                {data.myReservations.map((r) => (
                  <button
                    key={r.id}
                    className="ops-row ops-row-owned"
                    onClick={() => setSelectedBookingId(r.id)}
                  >
                    <div className="ops-row-main">
                      <span className="ops-row-subtext">
                        {r.title}
                        {r.locationName && ` \u00B7 ${r.locationName}`}
                      </span>
                      <span className="ops-row-meta">
                        {r.itemCount} item{r.itemCount !== 1 ? "s" : ""} &middot; {formatDateRange(r.startsAt, r.endsAt)}
                      </span>
                    </div>
                    <GearAvatarStack items={r.items} totalCount={r.itemCount} />
                  </button>
                ))}
              </CardContent>
            )}
          </Card>

          {/* Drafts */}
          {data.drafts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Drafts</CardTitle>
                <span className="section-count">{data.drafts.length}</span>
              </CardHeader>
              <CardContent className="p-0 py-1">
                {data.drafts.map((d) => (
                  <div key={d.id} className="ops-row draft-row">
                    <div className="ops-row-main">
                      <span className="ops-row-title">
                        <span className="draft-kind-badge">{d.kind === "CHECKOUT" ? "Checkout" : "Reservation"}</span>
                        {d.title || "Untitled"}
                      </span>
                      <span className="ops-row-meta">
                        {d.itemCount > 0 && <>{d.itemCount} item{d.itemCount !== 1 ? "s" : ""} &middot; </>}
                        Edited {formatRelativeTime(d.updatedAt, now)}
                      </span>
                    </div>
                    <div className="draft-actions">
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/${d.kind === "CHECKOUT" ? "checkouts" : "reservations"}?draftId=${d.id}`}>
                          Resume
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await fetch(`/api/drafts/${d.id}`, { method: "DELETE" });
                          loadData();
                        }}
                      >
                        Discard
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {/* My Shifts */}
          {data.myShifts.length > 0 && (
            <Card>
              <a href="/schedule" className="card-header-link flex items-center justify-between px-5 py-4 border-b border-border/50">
                <h2>My shifts</h2>
                <span className="section-count">{data.myShifts.length}</span>
              </a>
              <CardContent className="p-0 py-1">
                {data.myShifts.map((s) => {
                  const gearLabel = s.gearStatus === "checked_out" ? "Gear out" : s.gearStatus === "reserved" ? "Reserved" : s.gearStatus === "draft" ? "Draft" : null;
                  const eventTitle = s.event.opponent
                    ? `${s.event.isHome ? "vs" : "at"} ${s.event.opponent}`
                    : s.event.summary;
                  return (
                    <div key={s.id} className="ops-row">
                      <div className="ops-row-main">
                        <span className="ops-row-title">
                          {s.event.sportCode && <span className="event-sport">{s.event.sportCode}</span>}
                          {eventTitle}
                        </span>
                        <span className="ops-row-meta">
                          <span className="shift-widget-area">{s.area}</span>
                          {" "}
                          {new Date(s.startsAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).toLowerCase()}
                          {s.event.locationName && ` \u00B7 ${s.event.locationName}`}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                        {gearLabel ? (
                          <>
                            <GearAvatarStack items={s.gearItems} totalCount={s.gearItemCount} />
                            <span className={`badge ${s.gearStatus === "checked_out" ? "badge-green" : s.gearStatus === "reserved" ? "badge-orange" : "badge-gray"}`}>
                              {gearLabel}
                            </span>
                          </>
                        ) : (
                          <Button variant="outline" size="sm" asChild>
                            <a href={`/checkouts?create=true&title=${encodeURIComponent(eventTitle)}&startsAt=${encodeURIComponent(s.event.startsAt)}&endsAt=${encodeURIComponent(s.event.endsAt)}${s.event.locationId ? `&locationId=${s.event.locationId}` : ""}`}>
                              Reserve gear
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ────── Right Column: Team Activity ────── */}
        <div className="dashboard-col dashboard-col-right">
          <span className="dashboard-col-label">Team Activity</span>

          {/* Team Checkouts */}
          <Card>
            <a href="/checkouts" className="card-header-link flex items-center justify-between px-5 py-4 border-b border-border/50">
              <h2>Checked out</h2>
              <span className="section-count">{data.teamCheckouts.total}</span>
            </a>
            {data.teamCheckouts.items.length === 0 ? (
              <div className="empty-section"><InboxIcon className="empty-section-icon" />No open checkouts</div>
            ) : (
              <CardContent className="p-0 py-1">
                {data.teamCheckouts.items.map((c) => (
                  <button
                    key={c.id}
                    className={`ops-row ${c.isOverdue ? "ops-row-overdue" : isDueToday(c.endsAt, now) ? "ops-row-due-today" : ""}`}
                    onClick={() => setSelectedBookingId(c.id)}
                  >
                    <div className="ops-row-main">
                      <span className="ops-row-subtext">
                        {c.title}
                        {c.locationName && ` \u00B7 ${c.locationName}`}
                      </span>
                      <span className="ops-row-meta">
                        <UserInitialsAvatar initials={c.requesterInitials} />
                        {c.requesterName} &middot; {c.itemCount} item{c.itemCount !== 1 ? "s" : ""} &middot;{" "}
                        {c.isOverdue ? (
                          <>Due {formatDateShort(c.endsAt)} <span className="overdue-badge-inline">{formatOverdueElapsed(c.endsAt, now)}</span></>
                        ) : isDueToday(c.endsAt, now) ? (
                          <span className="due-today-badge">Due today</span>
                        ) : (
                          <>Due {formatDateShort(c.endsAt)}</>
                        )}
                      </span>
                    </div>
                    <GearAvatarStack items={c.items} totalCount={c.itemCount} />
                  </button>
                ))}
                {data.teamCheckouts.total > data.teamCheckouts.items.length && (
                  <a href="/checkouts" className="view-all-link">View all {data.teamCheckouts.total} &rarr;</a>
                )}
              </CardContent>
            )}
          </Card>

          {/* Team Reservations */}
          <Card>
            <a href="/reservations" className="card-header-link flex items-center justify-between px-5 py-4 border-b border-border/50">
              <h2>Reserved</h2>
              <span className="section-count">{data.teamReservations.total}</span>
            </a>
            {data.teamReservations.items.length === 0 ? (
              <div className="empty-section"><InboxIcon className="empty-section-icon" />No active reservations</div>
            ) : (
              <CardContent className="p-0 py-1">
                {data.teamReservations.items.map((r) => (
                  <button
                    key={r.id}
                    className="ops-row"
                    onClick={() => setSelectedBookingId(r.id)}
                  >
                    <div className="ops-row-main">
                      <span className="ops-row-subtext">
                        {r.title}
                        {r.locationName && ` \u00B7 ${r.locationName}`}
                      </span>
                      <span className="ops-row-meta">
                        <UserInitialsAvatar initials={r.requesterInitials} />
                        {r.requesterName} &middot; {r.itemCount} item{r.itemCount !== 1 ? "s" : ""} &middot; {formatDateRange(r.startsAt, r.endsAt)}
                      </span>
                    </div>
                    <GearAvatarStack items={r.items} totalCount={r.itemCount} />
                  </button>
                ))}
                {data.teamReservations.total > data.teamReservations.items.length && (
                  <a href="/reservations" className="view-all-link">View all {data.teamReservations.total} &rarr;</a>
                )}
              </CardContent>
            )}
          </Card>

          {/* Upcoming Events */}
          <Card>
            <a href="/events" className="card-header-link flex items-center justify-between px-5 py-4 border-b border-border/50">
              <h2>Upcoming events</h2>
            </a>
            {data.upcomingEvents.length === 0 ? (
              <div className="empty-section"><CalendarIcon className="empty-section-icon" />No upcoming events</div>
            ) : (
              <CardContent className="p-0 py-1">
                {data.upcomingEvents.map((e) => {
                  const titleParam = encodeURIComponent(e.title);
                  const startsParam = encodeURIComponent(e.startsAt);
                  const endsParam = encodeURIComponent(e.endsAt);
                  const locParam = e.locationId ? `&locationId=${e.locationId}` : "";
                  return (
                    <div key={e.id} className="ops-row event-row-clickable">
                      <a href={`/events/${e.id}`} className="ops-row-main" style={{ textDecoration: "none", color: "inherit" }}>
                        <span className="ops-row-title">
                          {e.sportCode && <span className="event-sport">{e.sportCode}</span>}
                          {e.opponent ? `vs ${e.opponent}` : e.title}
                        </span>
                        <span className="ops-row-meta">
                          {formatEventDateTime(e.startsAt, e.endsAt, e.allDay)}
                          {e.location && ` \u00B7 ${e.location}`}
                        </span>
                      </a>
                      <div className="event-row-right">
                        <ShiftAvatarStack assignedUsers={e.assignedUsers} totalSlots={e.totalShiftSlots} />
                        {e.isHome !== null && (
                          <span className={`badge ${e.isHome ? "badge-green" : "badge-gray"}`}>
                            {e.isHome ? "Home" : "Away"}
                          </span>
                        )}
                        <DropdownMenu>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="event-action-trigger">
                                  <PackageIcon className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>Gear for this event</TooltipContent>
                          </Tooltip>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <a href={`/checkouts?title=${titleParam}&startsAt=${startsParam}&endsAt=${endsParam}${locParam}`}>
                                <ClipboardCheckIcon className="mr-2 size-4" />
                                New checkout
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={`/reservations?title=${titleParam}&startsAt=${startsParam}&endsAt=${endsParam}${locParam}`}>
                                <CalendarCheckIcon className="mr-2 size-4" />
                                New reservation
                              </a>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>

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
