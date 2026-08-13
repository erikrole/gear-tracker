import { sportLabel } from "@/lib/sports";
import { normalizeTeamAbbreviations } from "@/lib/title-normalization";
import type { EventSummary } from "../dashboard-types";

type DashboardEventTitleInput = Pick<EventSummary, "title" | "sportCode" | "opponent" | "isHome">;

export function dashboardEventTitle(event: DashboardEventTitleInput) {
  if (event.opponent) {
    return `${event.sportCode ? `${sportLabel(event.sportCode)} ` : ""}${event.isHome === false ? "at" : "vs"} ${normalizeTeamAbbreviations(event.opponent)}`;
  }

  const title = event.title.trim();
  return normalizeTeamAbbreviations(title) || (event.sportCode ? sportLabel(event.sportCode) : "Event");
}
