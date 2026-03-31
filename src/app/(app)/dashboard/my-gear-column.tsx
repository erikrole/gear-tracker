"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ClipboardCheckIcon, CalendarCheckIcon, ClockIcon, ArrowRightCircleIcon } from "lucide-react";
import { ScaleIn } from "@/components/ui/motion";
import { formatDueLabel, formatRelativeTime, isDueToday } from "@/lib/format";
import { UserAvatar, GearAvatarStack } from "./dashboard-avatars";
import type { DashboardData, BookingSummary, CreateBookingContext } from "../dashboard-types";
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
  onCreateBooking?: (ctx: CreateBookingContext) => void;
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
  onCreateBooking,
}: Props) {
  const accentClass = ownedAccent ? " border-l-2 border-l-primary" : "";
  return (
    <div className="flex flex-col gap-5">
      <span className="text-xs font-semibold text-muted-foreground pl-0.5">My Gear</span>

      {/* My Checkouts */}
      <ScaleIn delay={0}>
      <Card elevation="elevated">
        <a href="/checkouts?mine=true" className="flex items-center justify-between px-4 py-3 border-b border-border/50 no-underline text-inherit cursor-pointer transition-colors rounded-t-[var(--radius)] hover:bg-[var(--panel-hover)] hover:no-underline">
          <h2 className="text-[var(--text-sm)] font-semibold text-foreground m-0">My checkouts</h2>
          <Badge variant="gray" size="sm">{data.myCheckouts.total}</Badge>
        </a>
        {(filtered?.myCheckouts ?? data.myCheckouts.items).length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center text-[var(--text-muted)] text-[var(--text-sm)]"><ClipboardCheckIcon className="size-6 opacity-40" />{activeSport ? `No ${activeSport} checkouts` : "You have no gear checked out"}</div>
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
                      <UserAvatar name={c.requesterName} avatarUrl={c.requesterAvatarUrl} />
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
              <a href="/checkouts?mine=true" className="block text-center text-xs text-muted-foreground py-2 px-4 border-t border-border/50 no-underline transition-colors hover:text-foreground">View all {data.myCheckouts.total} &rarr;</a>
            )}
          </CardContent>
        )}
      </Card>
      </ScaleIn>

      {/* My Reservations */}
      <ScaleIn delay={0.05}>
      <Card>
        <a href="/reservations?mine=true" className="flex items-center justify-between px-4 py-3 border-b border-border/50 no-underline text-inherit cursor-pointer transition-colors rounded-t-[var(--radius)] hover:bg-[var(--panel-hover)] hover:no-underline">
          <h2 className="text-[var(--text-sm)] font-semibold text-foreground m-0">My reservations</h2>
          <Badge variant="gray" size="sm">{data.myReservations.length}</Badge>
        </a>
        {(filtered?.myReservations ?? data.myReservations).length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center text-[var(--text-muted)] text-[var(--text-sm)]"><CalendarCheckIcon className="size-6 opacity-40" />{activeSport ? `No ${activeSport} reservations` : "No reservations coming up"}</div>
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
                    <UserAvatar name={r.requesterName} avatarUrl={r.requesterAvatarUrl} />
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
              <a href="/reservations?mine=true" className="block text-center text-xs text-muted-foreground py-2 px-4 border-t border-border/50 no-underline transition-colors hover:text-foreground">View all &rarr;</a>
            )}
          </CardContent>
        )}
      </Card>
      </ScaleIn>

      {/* My Shifts */}
      {(filtered?.myShifts ?? data.myShifts).length > 0 && (
        <ScaleIn delay={0.1}>
        <Card>
          <a href="/schedule" className="flex items-center justify-between px-4 py-3 border-b border-border/50 no-underline text-inherit cursor-pointer transition-colors rounded-t-[var(--radius)] hover:bg-[var(--panel-hover)] hover:no-underline">
            <h2 className="text-[var(--text-sm)] font-semibold text-foreground m-0">My shifts</h2>
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
                      <span className="font-semibold text-xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--panel-hover)] text-muted-foreground shrink-0">{s.area}</span>
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onCreateBooking?.({
                          kind: "CHECKOUT",
                          title: eventTitle,
                          startsAt: s.event.startsAt,
                          endsAt: s.event.endsAt,
                          locationId: s.event.locationId || undefined,
                          eventId: s.event.id,
                          sportCode: s.event.sportCode || undefined,
                        })}
                      >
                        Prep gear
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
        </ScaleIn>
      )}

      {/* Drafts */}
      {data.drafts.length > 0 && (
        <ScaleIn delay={0.15}>
        <Card elevation="elevated">
          <CardHeader className="border-b border-border/50">
            <CardTitle>Drafts</CardTitle>
            <Badge variant="gray" size="sm">{data.drafts.length}</Badge>
          </CardHeader>
          <CardContent className="p-0 py-1">
            {data.drafts.map((d) => (
              <div key={d.id} className="ops-row flex items-center gap-3">
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
                <div className="flex gap-1.5 shrink-0">
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
        </ScaleIn>
      )}
    </div>
  );
}
