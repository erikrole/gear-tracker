export type VenueTone = "home" | "away" | "neutral";
export type VenueFilter = "all" | VenueTone;

type VenueToneStyle = {
  label: string;
  badgeVariant: "green" | "orange" | "gray";
  railClass: string;
  solidClass: string;
  surfaceClass: string;
  activeTabClass: string;
};

export const VENUE_FILTER_OPTIONS: Array<{ value: VenueFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "home", label: "Home" },
  { value: "away", label: "Away" },
  { value: "neutral", label: "Neutral" },
];

export const VENUE_TONES: Record<VenueTone, VenueToneStyle> = {
  home: {
    label: "Home",
    badgeVariant: "green",
    railClass: "border-l-[var(--green)]",
    solidClass: "bg-[var(--green)]",
    surfaceClass: "bg-[var(--green)]/10 hover:bg-[var(--green)]/18",
    activeTabClass: "bg-[var(--green)]/15 text-[var(--green-text)]",
  },
  away: {
    label: "Away",
    badgeVariant: "orange",
    railClass: "border-l-[var(--orange)]",
    solidClass: "bg-[var(--orange)]",
    surfaceClass: "bg-[var(--orange)]/10 hover:bg-[var(--orange)]/18",
    activeTabClass: "bg-[var(--orange)]/15 text-[var(--orange-text)]",
  },
  neutral: {
    label: "Neutral",
    badgeVariant: "gray",
    railClass: "border-l-muted-foreground/35",
    solidClass: "bg-muted-foreground/55",
    surfaceClass: "bg-muted/50 hover:bg-muted",
    activeTabClass: "bg-muted text-foreground",
  },
};

export function venueToneFromIsHome(isHome: boolean | null | undefined): VenueTone {
  if (isHome === true) return "home";
  if (isHome === false) return "away";
  return "neutral";
}

export function venueToneFromEvent(event: {
  isHome?: boolean | null;
  summary?: string | null;
  rawSummary?: string | null;
}): VenueTone {
  const title = event.rawSummary ?? event.summary ?? "";
  const prefix = title.match(/^\s*\[([HAN])\]/i)?.[1]?.toUpperCase();
  if (prefix === "H") return "home";
  if (prefix === "A") return "away";
  if (prefix === "N") return "neutral";
  return venueToneFromIsHome(event.isHome);
}

export function venueBadgeVariant(isHome: boolean | null | undefined): VenueToneStyle["badgeVariant"] {
  return VENUE_TONES[venueToneFromIsHome(isHome)].badgeVariant;
}

export function venueFilterActiveClass(value: VenueFilter): string {
  if (value === "all") return "bg-background text-foreground";
  return VENUE_TONES[value].activeTabClass;
}
