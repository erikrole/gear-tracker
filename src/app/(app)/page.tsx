"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
const BookingDetailsSheet = dynamic(() => import("@/components/BookingDetailsSheet"), { ssr: false });
import EmptyState from "@/components/EmptyState";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarGroup } from "@/components/ui/avatar-group";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDueLabel,
  formatEventDateTime,
  formatOverdueElapsed,
  formatRelativeTime,
  isDueToday,
} from "@/lib/format";
import { ClipboardCheckIcon, CalendarCheckIcon, PackageIcon, CalendarIcon, InboxIcon, AlertTriangleIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

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
  requesterAvatarUrl: string | null;
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
  requesterName: string;
  requesterInitials: string;
  requesterAvatarUrl: string | null;
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
  assignedUsers: Array<{ id: string; name: string; initials: string; avatarUrl: string | null }>;
};

type OverdueItem = {
  bookingId: string;
  bookingTitle: string;
  requesterName: string;
  requesterInitials: string;
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

function UserAvatar({ initials, avatarUrl, size = "sm" }: { initials: string; avatarUrl?: string | null; size?: "sm" | "default" }) {
  return (
    <Avatar size={size}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}

function GearAvatarStack({ items, totalCount }: { items: ItemThumb[]; totalCount: number }) {
  if (totalCount === 0) return null;
  const overflow = totalCount - items.length;
  return (
    <AvatarGroup max={99}>
      {items.map((item) => (
        <Avatar key={item.id} size="sm" className="ring-2 ring-background">
          {item.imageUrl ? (
            <AvatarImage src={item.imageUrl} alt={item.name || "Item"} />
          ) : (
            <AvatarFallback className="text-[10px]">{(item.name || "?")[0].toUpperCase()}</AvatarFallback>
          )}
        </Avatar>
      ))}
      {overflow > 0 && (
        <Avatar size="sm" className="ring-2 ring-background">
          <AvatarFallback className="text-[10px] bg-muted">+{overflow}</AvatarFallback>
        </Avatar>
      )}
    </AvatarGroup>
  );
}

function ShiftAvatarStack({ assignedUsers, totalSlots }: { assignedUsers: EventSummary["assignedUsers"]; totalSlots: number }) {
  if (totalSlots === 0) return null;
  const emptySlots = Math.max(0, totalSlots - assignedUsers.length);
  const maxShow = 5;
  const showUsers = assignedUsers.slice(0, maxShow);
  const showEmpty = Math.min(emptySlots, maxShow - showUsers.length);
  const overflow = assignedUsers.length + emptySlots - maxShow;
  return (
    <AvatarGroup max={99}>
      {showUsers.map((u) => (
        <Avatar key={u.id} size="sm" className="ring-2 ring-background" title={u.name}>
          {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt="" /> : <AvatarFallback>{u.initials}</AvatarFallback>}
        </Avatar>
      ))}
      {Array.from({ length: showEmpty }).map((_, i) => (
        <Avatar key={`empty-${i}`} size="sm" className="ring-2 ring-background">
          <AvatarFallback className="border border-dashed border-muted-foreground/30 bg-transparent" />
        </Avatar>
      ))}
      {overflow > 0 && (
        <Avatar size="sm" className="ring-2 ring-background">
          <AvatarFallback className="text-[10px] bg-muted">+{overflow}</AvatarFallback>
        </Avatar>
      )}
    </AvatarGroup>
  );
}

/* ───── Component ───── */

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [fetchError, setFetchError] = useState<false | "auth" | "network" | "server">(false);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const confirm = useConfirm();
  const { toast } = useToast();
  const loadData = useCallback((isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    fetch("/api/dashboard")
      .then((res) => {
        if (res.status === 401) { window.location.href = "/login?returnTo=/"; return null; }
        if (!res.ok) throw new Error("server");
        return res.json();
      })
      .then((json) => { if (json?.data) { setData(json.data); setFetchError(false); } else if (json !== null) setFetchError("server"); })
      .catch((err) => {
        if (err instanceof TypeError) setFetchError("network");
        else setFetchError("server");
      })
      .finally(() => setRefreshing(false));
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
        title="Couldn't load your dashboard"
        description={fetchError === "network" ? "You appear to be offline. Check your connection and try again." : "Something went wrong on our end. Try again in a moment."}
        actionLabel="Try again"
        onAction={() => { setFetchError(false); loadData(); }}
      />
    );
  }

  if (!data) {
    return (
      <>
        <div className="page-header"><h1>Dashboard</h1></div>
        <div className="stat-strip">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-strip-item">
              <Skeleton className="h-7 w-10 mb-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
        <div className="dashboard-split">
          <div className="dashboard-col dashboard-col-left">
            {[3, 3].map((rows, i) => (
              <Card key={i}>
                <CardHeader className="border-b border-border/50">
                  <Skeleton className="h-5 w-28" />
                </CardHeader>
                <CardContent className="p-0 py-1">
                  {Array.from({ length: rows }).map((_, j) => (
                    <div key={j} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <Skeleton className="size-6 rounded-full" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="dashboard-col dashboard-col-right">
            {[4, 3].map((rows, i) => (
              <Card key={i}>
                <CardHeader className="border-b border-border/50">
                  <Skeleton className="h-5 w-24" />
                </CardHeader>
                <CardContent className="p-0 py-1">
                  {Array.from({ length: rows }).map((_, j) => (
                    <div key={j} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <Skeleton className="size-6 rounded-full" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
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
      {refreshing && <Progress className="h-0.5 mb-1" />}
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
          <span className="stat-strip-label">Active checkouts</span>
        </a>
        <a href="/reservations" className="stat-strip-item stat-strip-clickable">
          <span className="stat-strip-value">{data.stats.reserved}</span>
          <span className="stat-strip-label">Reserved</span>
        </a>
      </div>

      {/* ══════ Welcome Banner (first-run) ══════ */}
      {data.stats.checkedOut === 0 && data.stats.overdue === 0 && data.stats.reserved === 0 && data.stats.dueToday === 0
        && data.myCheckouts.total === 0 && data.teamCheckouts.total === 0 && data.upcomingEvents.length === 0
        && data.myReservations.length === 0 && data.drafts.length === 0 && data.myShifts.length === 0 && (
        <div className="welcome-banner">
          <h2>Welcome to Gear Tracker</h2>
          <p>Get started by setting up your equipment inventory.</p>
          <div className="welcome-steps">
            <Link href="/items" className="welcome-step">
              <span className="welcome-step-num">1</span>
              <span>Add equipment</span>
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
              <AlertTriangleIcon className="overdue-banner-icon size-[18px]" />
              <span className="pulse-dot" />
              <strong>{data.overdueCount} overdue checkout{data.overdueCount !== 1 ? "s" : ""}</strong>
            </div>
            <a href="/checkouts?filter=overdue" className="overdue-banner-viewall">Resolve all overdue &rarr;</a>
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
                    <UserAvatar initials={item.requesterInitials} />
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
            <a href="/checkouts?mine=true" className="card-header-link">
              <h2>My checkouts</h2>
              <Badge variant="gray" size="sm">{data.myCheckouts.total}</Badge>
            </a>
            {data.myCheckouts.items.length === 0 ? (
              <div className="empty-section"><ClipboardCheckIcon className="empty-section-icon" />You have no gear checked out</div>
            ) : (
              <CardContent className="p-0 py-1">
                {data.myCheckouts.items.map((c) => {
                  const dueLabel = formatDueLabel(c.endsAt, now);
                  return (
                    <button
                      key={c.id}
                      className={`ops-row ops-row-status ${c.isOverdue ? "ops-row-overdue" : isDueToday(c.endsAt, now) ? "ops-row-due-today" : "ops-row-checked-out"}`}
                      onClick={() => setSelectedBookingId(c.id)}
                    >
                      <div className="ops-row-main">
                        <span className="ops-row-title-bold">
                          {c.refNumber && <Badge variant="gray" size="sm" className="mr-1.5">{c.refNumber}</Badge>}
                          {c.title}
                        </span>
                        <span className="ops-row-meta">
                          <UserAvatar initials={c.requesterInitials} avatarUrl={c.requesterAvatarUrl} />
                          {c.requesterName} &ndash; {c.itemCount} item{c.itemCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="ops-row-right">
                        <Badge variant={c.isOverdue ? "red" : isDueToday(c.endsAt, now) ? "orange" : "gray"} size="sm">{dueLabel}</Badge>
                        <GearAvatarStack items={c.items} totalCount={c.itemCount} />
                      </div>
                    </button>
                  );
                })}
                {data.myCheckouts.total > data.myCheckouts.items.length && (
                  <a href="/checkouts?mine=true" className="view-all-link">View all {data.myCheckouts.total} &rarr;</a>
                )}
              </CardContent>
            )}
          </Card>

          {/* My Reservations */}
          <Card>
            <a href="/reservations?mine=true" className="card-header-link">
              <h2>My reservations</h2>
              <Badge variant="gray" size="sm">{data.myReservations.length}</Badge>
            </a>
            {data.myReservations.length === 0 ? (
              <div className="empty-section"><CalendarCheckIcon className="empty-section-icon" />No reservations coming up</div>
            ) : (
              <CardContent className="p-0 py-1">
                {data.myReservations.map((r) => (
                  <button
                    key={r.id}
                    className="ops-row ops-row-status ops-row-reserved"
                    onClick={() => setSelectedBookingId(r.id)}
                  >
                    <div className="ops-row-main">
                      <span className="ops-row-title-bold">
                        {r.refNumber && <Badge variant="gray" size="sm" className="mr-1.5">{r.refNumber}</Badge>}
                        {r.title}
                      </span>
                      <span className="ops-row-meta">
                        <UserAvatar initials={r.requesterInitials} avatarUrl={r.requesterAvatarUrl} />
                        {r.requesterName} &ndash; {r.itemCount} item{r.itemCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <GearAvatarStack items={r.items} totalCount={r.itemCount} />
                  </button>
                ))}
                {data.myReservations.length >= 5 && (
                  <a href="/reservations?mine=true" className="view-all-link">View all &rarr;</a>
                )}
              </CardContent>
            )}
          </Card>

          {/* My Shifts (above drafts — higher temporal urgency) */}
          {data.myShifts.length > 0 && (
            <Card>
              <a href="/schedule" className="card-header-link">
                <h2>My shifts</h2>
                <Badge variant="gray" size="sm">{data.myShifts.length}</Badge>
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
                          {s.event.sportCode && <Badge variant="sport" size="sm" className="mr-1.5">{s.event.sportCode}</Badge>}
                          {eventTitle}
                        </span>
                        <span className="ops-row-meta">
                          <span className="shift-widget-area">{s.area}</span>
                          {" "}
                          {new Date(s.startsAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).toLowerCase()}
                          {s.event.locationName && ` \u00B7 ${s.event.locationName}`}
                        </span>
                      </div>
                      <div className="ops-row-actions">
                        {gearLabel ? (
                          <>
                            <GearAvatarStack items={s.gearItems} totalCount={s.gearItemCount} />
                            <Badge variant={s.gearStatus === "checked_out" ? "green" : s.gearStatus === "reserved" ? "orange" : "gray"}>
                              {gearLabel}
                            </Badge>
                          </>
                        ) : (
                          <Button variant="outline" size="sm" asChild>
                            <a href={`/checkouts?create=true&title=${encodeURIComponent(eventTitle)}&startsAt=${encodeURIComponent(s.event.startsAt)}&endsAt=${encodeURIComponent(s.event.endsAt)}${s.event.locationId ? `&locationId=${s.event.locationId}` : ""}`}>
                              Prep gear
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

          {/* Drafts (below shifts — lower urgency, recovery of abandoned work) */}
          {data.drafts.length > 0 && (
            <Card>
              <CardHeader className="border-b border-border/50">
                <CardTitle>Drafts</CardTitle>
                <Badge variant="gray" size="sm">{data.drafts.length}</Badge>
              </CardHeader>
              <CardContent className="p-0 py-1">
                {data.drafts.map((d) => (
                  <div key={d.id} className="ops-row draft-row">
                    <div className="ops-row-main">
                      <span className="ops-row-title">
                        <Badge variant="outline" size="sm" className="mr-1.5">{d.kind === "CHECKOUT" ? "Checkout" : "Reservation"}</Badge>
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
                          const ok = await confirm({
                            title: "Delete draft",
                            message: `Delete this ${d.kind === "CHECKOUT" ? "checkout" : "reservation"} draft? This can\u2019t be undone.`,
                            confirmLabel: "Delete draft",
                            variant: "danger",
                          });
                          if (!ok) return;
                          const res = await fetch(`/api/drafts/${d.id}`, { method: "DELETE" });
                          if (res.ok) {
                            toast("Draft deleted", "success");
                            loadData(true);
                          } else {
                            toast("Failed to delete draft", "error");
                          }
                        }}
                      >
                        Delete draft
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ────── Right Column: Team Activity ────── */}
        <div className="dashboard-col dashboard-col-right">
          <span className="dashboard-col-label">Team Activity</span>

          {/* Team Checkouts */}
          <Card>
            <a href="/checkouts" className="card-header-link">
              <h2>Checked out</h2>
              <Badge variant="gray" size="sm">{data.teamCheckouts.total}</Badge>
            </a>
            {data.teamCheckouts.items.length === 0 ? (
              <div className="empty-section"><InboxIcon className="empty-section-icon" />No team checkouts right now</div>
            ) : (
              <CardContent className="p-0 py-1">
                {data.teamCheckouts.items.map((c) => {
                  const dueLabel = formatDueLabel(c.endsAt, now);
                  return (
                    <button
                      key={c.id}
                      className={`ops-row ops-row-status ${c.isOverdue ? "ops-row-overdue" : isDueToday(c.endsAt, now) ? "ops-row-due-today" : "ops-row-checked-out"}`}
                      onClick={() => setSelectedBookingId(c.id)}
                    >
                      <div className="ops-row-main">
                        <span className="ops-row-title-bold">
                          {c.refNumber && <Badge variant="gray" size="sm" className="mr-1.5">{c.refNumber}</Badge>}
                          {c.title}
                        </span>
                        <span className="ops-row-meta">
                          <UserAvatar initials={c.requesterInitials} avatarUrl={c.requesterAvatarUrl} />
                          {c.requesterName} &ndash; {c.itemCount} item{c.itemCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="ops-row-right">
                        <Badge variant={c.isOverdue ? "red" : isDueToday(c.endsAt, now) ? "orange" : "gray"} size="sm">{dueLabel}</Badge>
                        <GearAvatarStack items={c.items} totalCount={c.itemCount} />
                      </div>
                    </button>
                  );
                })}
                {data.teamCheckouts.total > data.teamCheckouts.items.length && (
                  <a href="/checkouts" className="view-all-link">View all {data.teamCheckouts.total} &rarr;</a>
                )}
              </CardContent>
            )}
          </Card>

          {/* Team Reservations */}
          <Card>
            <a href="/reservations" className="card-header-link">
              <h2>Reserved</h2>
              <Badge variant="gray" size="sm">{data.teamReservations.total}</Badge>
            </a>
            {data.teamReservations.items.length === 0 ? (
              <div className="empty-section"><InboxIcon className="empty-section-icon" />No team reservations right now</div>
            ) : (
              <CardContent className="p-0 py-1">
                {data.teamReservations.items.map((r) => (
                  <button
                    key={r.id}
                    className="ops-row ops-row-status ops-row-reserved"
                    onClick={() => setSelectedBookingId(r.id)}
                  >
                    <div className="ops-row-main">
                      <span className="ops-row-title-bold">
                        {r.refNumber && <Badge variant="gray" size="sm" className="mr-1.5">{r.refNumber}</Badge>}
                        {r.title}
                      </span>
                      <span className="ops-row-meta">
                        <UserAvatar initials={r.requesterInitials} avatarUrl={r.requesterAvatarUrl} />
                        {r.requesterName} &ndash; {r.itemCount} item{r.itemCount !== 1 ? "s" : ""}
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
            <a href="/events" className="card-header-link">
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
                      <a href={`/events/${e.id}`} className="ops-row-main no-underline">
                        <span className="ops-row-title">
                          {e.sportCode && <Badge variant="sport" size="sm" className="mr-1.5">{e.sportCode}</Badge>}
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
                          <Badge variant={e.isHome ? "green" : "gray"}>
                            {e.isHome ? "Home" : "Away"}
                          </Badge>
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
                            <TooltipContent>Create booking for this event</TooltipContent>
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
        onUpdated={() => loadData(true)}
      />
    </>
  );
}
