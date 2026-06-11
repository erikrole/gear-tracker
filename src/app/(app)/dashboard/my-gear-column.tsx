"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemGroup,
} from "@/components/ui/item";
import { ClipboardCheckIcon, CalendarCheckIcon, ClockIcon, ArrowRightCircleIcon } from "lucide-react";
import { ScaleIn } from "@/components/ui/motion";
import { formatDayLabel, formatRelativeTime, isDueToday } from "@/lib/format";
import { sportLabel } from "@/lib/sports";
import { formatCallWindow } from "@/lib/shift-call-windows";
import { GearAvatarStack } from "./dashboard-avatars";
import { DashboardBookingRow, dashboardBookingAccent } from "./booking-row";
import { DashboardSectionHeader } from "./section-header";
import type { DashboardData, BookingSummary, CreateBookingContext } from "../dashboard-types";
import type { FilteredDashboardData } from "@/hooks/use-dashboard-filters";

type Props = {
  data: DashboardData;
  filtered: FilteredDashboardData | null;
  activeSport: string | null;
  hasActiveFilter: boolean;
  now: Date;
  acting: boolean;
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
  hasActiveFilter,
  now,
  acting,
  ownedAccent,
  onSelectBooking,
  onDeleteDraft,
  onExtend,
  onConvert,
  onCreateBooking,
}: Props) {
  const visibleMyCheckouts = filtered?.myCheckouts ?? data.myCheckouts.items;
  const visibleMyReservations = filtered?.myReservations ?? data.myReservations;
  const visibleMyShifts = filtered?.myShifts ?? data.myShifts;
  const myCheckoutsCount = filtered ? visibleMyCheckouts.length : data.myCheckouts.total;
  const myReservationsCount = filtered ? visibleMyReservations.length : data.myReservations.length;
  const myShiftsCount = filtered ? visibleMyShifts.length : data.myShifts.length;
  const personalGearEmpty = visibleMyCheckouts.length === 0 && visibleMyReservations.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60 pl-0.5" style={{ fontFamily: "var(--font-mono)" }}>My Gear</span>

      {personalGearEmpty ? (
        <ScaleIn delay={0}>
          <Card elevation="elevated">
            <CardContent className="flex min-h-[88px] items-center justify-between gap-4 p-4 max-sm:flex-col max-sm:items-start">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <ClipboardCheckIcon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {activeSport ? `No ${activeSport} gear assigned` : "No personal gear assigned"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Checkouts and upcoming reservations are clear.
                  </p>
                </div>
              </div>
              {onCreateBooking && (
                <div className="flex shrink-0 gap-2 max-sm:w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    className="max-sm:flex-1"
                    onClick={() => onCreateBooking({ kind: "RESERVATION" })}
                  >
                    Reserve
                  </Button>
                  <Button
                    size="sm"
                    className="max-sm:flex-1"
                    onClick={() => onCreateBooking({ kind: "CHECKOUT" })}
                  >
                    Check out
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </ScaleIn>
      ) : (
        <>
          {/* My Checkouts */}
          <ScaleIn delay={0}>
          <Card elevation="elevated">
            <DashboardSectionHeader title="My checkouts" href="/checkouts?mine=true" count={myCheckoutsCount} />
            {visibleMyCheckouts.length === 0 ? (
              <div className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 px-4 py-5 text-center text-sm text-muted-foreground"><ClipboardCheckIcon className="size-5 opacity-45" />{activeSport ? `No ${activeSport} checkouts` : "You have no gear checked out"}</div>
            ) : (
              <CardContent className="p-0 py-1">
                {visibleMyCheckouts.map((c) => {
                  return (
                    <DashboardBookingRow
                      key={c.id}
                      booking={c}
                      now={now}
                      accent={dashboardBookingAccent(c, now, "checkout")}
                      showDueBadge
                      onSelectBooking={onSelectBooking}
                      actions={
                        (c.isOverdue || isDueToday(c.endsAt, now)) ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="opacity-100 transition-opacity duration-150 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                disabled={acting}
                                onClick={(e) => onExtend(c, e)}
                                aria-label={`Extend checkout "${c.title}" by 1 day`}
                              >
                                <ClockIcon className="size-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Extend 1 day</TooltipContent>
                          </Tooltip>
                        ) : null
                      }
                    />
                  );
                })}
                {!hasActiveFilter && data.myCheckouts.total > data.myCheckouts.items.length && (
                  <Link href="/checkouts?mine=true" className="block text-center text-xs text-muted-foreground py-2 px-4 border-t border-border/50 no-underline transition-colors hover:text-foreground">View all {data.myCheckouts.total} &rarr;</Link>
                )}
              </CardContent>
            )}
          </Card>
          </ScaleIn>

          {/* My Reservations */}
          <ScaleIn delay={0.05}>
          <Card>
            <DashboardSectionHeader title="My reservations" href="/reservations?mine=true" count={myReservationsCount} />
            {visibleMyReservations.length === 0 ? (
              <div className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 px-4 py-5 text-center text-sm text-muted-foreground"><CalendarCheckIcon className="size-5 opacity-45" />{activeSport ? `No ${activeSport} reservations` : "No reservations coming up"}</div>
            ) : (
              <CardContent className="p-0 py-1">
                {visibleMyReservations.map((r) => (
                  <DashboardBookingRow
                    key={r.id}
                    booking={r}
                    now={now}
                    accent="reservation"
                    onSelectBooking={onSelectBooking}
                    actions={
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="opacity-100 transition-opacity duration-150 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                            disabled={acting}
                            onClick={(e) => onConvert(r.id, e)}
                            aria-label={`Convert reservation "${r.title}" to checkout`}
                          >
                            <ArrowRightCircleIcon className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Convert to checkout</TooltipContent>
                      </Tooltip>
                    }
                  />
                ))}
                {!hasActiveFilter && data.myReservations.length >= 5 && (
                  <Link href="/reservations?mine=true" className="block text-center text-xs text-muted-foreground py-2 px-4 border-t border-border/50 no-underline transition-colors hover:text-foreground">View all &rarr;</Link>
                )}
              </CardContent>
            )}
          </Card>
          </ScaleIn>
        </>
      )}

      {/* My Shifts */}
      {visibleMyShifts.length > 0 && (
        <ScaleIn delay={0.1}>
        <Card>
          <DashboardSectionHeader title="My shifts" href="/schedule" count={myShiftsCount} />
          <CardContent className="p-0 py-1">
            <ItemGroup>
              {visibleMyShifts.map((s) => {
                const gearLabel = s.gearStatus === "checked_out" ? "Gear out" : s.gearStatus === "reserved" ? "Reserved" : s.gearStatus === "draft" ? "Draft" : null;
                const eventTitle = s.event.opponent
                  ? `${s.event.isHome === false ? "at" : "vs"} ${s.event.opponent}`
                  : s.event.summary;
                return (
                  <Item
                    key={s.id}
                    size="sm"
                    className="group rounded-none py-2 hover:bg-muted/50 [&+[data-slot=item]]:border-t [&+[data-slot=item]]:border-border/40"
                  >
                    <ItemContent>
                      <ItemTitle className="font-bold text-foreground truncate">
                        {s.event.sportCode && <span className="text-xs font-bold mr-1">{sportLabel(s.event.sportCode)}</span>}
                        <span className="font-normal text-muted-foreground">{eventTitle}</span>
                      </ItemTitle>
                      <ItemDescription className="text-xs leading-snug line-clamp-none">
                        {formatDayLabel(s.callStartsAt, now)}, Call {formatCallWindow({ startsAt: s.callStartsAt, endsAt: s.callEndsAt })}
                        {s.event.locationName && ` \u00B7 ${s.event.locationName}`}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      {gearLabel ? (
                        <>
                          <GearAvatarStack items={s.gearItems} totalCount={s.gearItemCount} />
                          <Badge variant={s.gearStatus === "checked_out" ? "blue" : s.gearStatus === "reserved" ? "purple" : "gray"}>
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
                    </ItemActions>
                  </Item>
                );
              })}
            </ItemGroup>
          </CardContent>
        </Card>
        </ScaleIn>
      )}

      {/* Drafts */}
      {data.drafts.length > 0 && (
        <ScaleIn delay={0.15}>
        <Card elevation="elevated">
          <DashboardSectionHeader title="Drafts" count={data.drafts.length} />
          <CardContent className="p-0 py-1">
            <ItemGroup>
              {data.drafts.map((d) => (
                <Item
                  key={d.id}
                  size="sm"
                  className="group rounded-none py-2 hover:bg-muted/50 [&+[data-slot=item]]:border-t [&+[data-slot=item]]:border-border/40"
                >
                  <ItemContent>
                    <ItemTitle className="font-medium text-foreground truncate">
                      <Badge variant="outline" size="sm" className="mr-1.5">{d.kind === "CHECKOUT" ? "Checkout" : "Reservation"}</Badge>
                      {d.title || "Untitled"}
                    </ItemTitle>
                    <ItemDescription className="text-xs leading-snug line-clamp-none">
                      {d.itemCount > 0 && <>{d.itemCount} item{d.itemCount !== 1 ? "s" : ""} &middot; </>}
                      Edited {formatRelativeTime(d.updatedAt, now)}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/${d.kind === "CHECKOUT" ? "checkouts" : "reservations"}?draftId=${d.id}`}>
                        Continue
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={acting}
                      onClick={() => onDeleteDraft(d.id)}
                    >
                      Delete
                    </Button>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          </CardContent>
        </Card>
        </ScaleIn>
      )}
    </div>
  );
}
