import { scheduleEventTitleParts } from "@/app/(app)/schedule/_components/types";
import type { EventSummary } from "../dashboard-types";

type DashboardEventTitleInput = Pick<EventSummary, "title" | "sportCode" | "opponent" | "isHome">;

export function dashboardEventTitle(event: DashboardEventTitleInput) {
  return scheduleEventTitleParts({
    summary: event.title,
    sportCode: event.sportCode,
    opponent: event.opponent,
    isHome: event.isHome,
  }).title;
}
