"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ClipboardCheckIcon, CalendarCheckIcon, ClockIcon, ArrowRightCircleIcon } from "lucide-react";
import { formatDueLabel, formatRelativeTime, isDueToday } from "@/lib/format";
import { UserAvatar, GearAvatarStack } from "./dashboard-avatars";
import type { DashboardData, BookingSummary } from "../dashboard-types";
import type { FilteredDashboardData } from "@/hooks/use-dashboard-filters";

type Props = {
  data: DashboardData;
  filtered: FilteredDashboardData | null;
  activeSport: string | null;
  now: Date;
  deletingDraftId: string | null;
  inlineActionId: string | null;
  ownedAccent?: boolean;
  onSelectBooking: (id: string) => void;
  onDeleteDraft: (draftId: string) => void;
  onExtend: (booking: BookingSummary, e: React.MouseEvent) => void;
  onConvert: (bookingId: string, e: React.MouseEvent) => void;
};

export function MyGearColumn({
  data,
  filtered,
  activeSport,
  now,
  deletingDraftId,
  inlineActionId,
  ownedAccent,
  onSelectBooking,
  onDeleteDraft,
  onExtend,
  onConvert,
}: Props) {
  const accentClass = ownedAccent ? " border-l-2 border-l-primary" : "";
  return (
    <div className="dashboard-col dashboard-col-left">
      <span className="dashboard-col-label">My Gear</span>

      {/* My Checkouts */}
      <Card>
        <a href="/checkouts?mine=true" className="card-header-link">
          <h2>My checkouts</h2>
          <Badge variant="gray" size="sm">{data.myCheckouts.total}</Badge>
        </a>
        {(filtered?.myCheckouts ?? data.myCheckouts.items).length === 0 ? (
          <div className="empty-section"><ClipboardCheckIcon className="empty-section-icon" />{activeSport ? `No ${activeSport} checkouts` : "You have no gear checked out"}</div>
        ) : (
          <CardContent className="p-0 py-1">
            {(filtered?.myCheckouts ?? data.myCheckouts.items).map((c) => {
              const dueLabel = formatDueLabel(c.endsAt, now);
              return (
                <button
                  key={c.id}
                  className={`ops-row ops-row-status ${c.isOverdue ? "ops-row-overdue" : isDueToday(c.endsAt, now) ? "ops-row-due-today" : "ops-row-checked-out"}${accentClass}`}
                  onClick={() => onSelectBooking(c.id)}
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
                    {(c.isOverdue || isDueToday(c.endsAt, now)) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="inline-action-btn"
                            disabled={inlineActionId === c.id}
                            onClick={(e) => onExtend(c, e)}
                          >
                            <ClockIcon className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Extend 1 day</TooltipContent>
                      </Tooltip>
                    )}
                    <Badge variant={c.isOverdue ? "red" : isDueToday(c.endsAt, now) ? "orange" : "gray"} size="sm">{dueLabel}</Badge>
                    <GearAvatarStack items={c.items} totalCount={c.itemCount} />
                  </div>
                </button>
              );
            })}
            {!activeSport && data.myCheckouts.total > data.myCheckouts.items.length && (
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
        {(filtered?.myReservations ?? data.myReservations).length === 0 ? (
          <div className="empty-section"><CalendarCheckIcon className="empty-section-icon" />{activeSport ? `No ${activeSport} reservations` : "No reservations coming up"}</div>
        ) : (
          <CardContent className="p-0 py-1">
            {(filtered?.myReservations ?? data.myReservations).map((r) => (
              <button
                key={r.id}
                className={`ops-row ops-row-status ops-row-reserved${accentClass}`}
                onClick={() => onSelectBooking(r.id)}
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
                <div className="ops-row-right">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="inline-action-btn"
                        disabled={inlineActionId === r.id}
                        onClick={(e) => onConvert(r.id, e)}
                      >
                        <ArrowRightCircleIcon className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Convert to checkout</TooltipContent>
                  </Tooltip>
                  <GearAvatarStack items={r.items} totalCount={r.itemCount} />
                </div>
              </button>
            ))}
            {!activeSport && data.myReservations.length >= 5 && (
              <a href="/reservations?mine=true" className="view-all-link">View all &rarr;</a>
            )}
          </CardContent>
        )}
      </Card>

      {/* My Shifts */}
      {(filtered?.myShifts ?? data.myShifts).length > 0 && (
        <Card>
          <a href="/schedule" className="card-header-link">
            <h2>My shifts</h2>
            <Badge variant="gray" size="sm">{data.myShifts.length}</Badge>
          </a>
          <CardContent className="p-0 py-1">
            {(filtered?.myShifts ?? data.myShifts).map((s) => {
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

      {/* Drafts */}
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
                    disabled={deletingDraftId !== null}
                    onClick={() => onDeleteDraft(d.id)}
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
  );
}
