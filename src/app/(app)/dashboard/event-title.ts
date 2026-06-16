import { sportLabel } from "@/lib/sports";
import type { EventSummary } from "../dashboard-types";

type DashboardEventTitleInput = Pick<EventSummary, "title" | "sportCode" | "opponent" | "isHome">;

export function dashboardEventTitle(event: DashboardEventTitleInput) {
  if (event.opponent) {
    return `${event.sportCode ? `${sportLabel(event.sportCode)} ` : ""}${event.isHome === false ? "at" : "vs"} ${event.opponent}`;
  }

  const title = event.title.trim();
  return title || (event.sportCode ? sportLabel(event.sportCode) : "Event");
}
