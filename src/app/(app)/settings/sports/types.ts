export type ShiftConfig = {
  area: "VIDEO" | "PHOTO" | "GRAPHICS" | "COMMS";
  homeCount: number;
  awayCount: number;
};

export type SportConfig = {
  id: string;
  sportCode: string;
  active: boolean;
  shiftConfigs: ShiftConfig[];
};

export const AREAS = ["VIDEO", "PHOTO", "GRAPHICS", "COMMS"] as const;

export const AREA_LABELS: Record<string, string> = {
  VIDEO: "Video",
  PHOTO: "Photo",
  GRAPHICS: "Graphics",
  COMMS: "Comms",
};

/** Get the display count for a shift config (uses homeCount as the single source) */
export function getCount(config: ShiftConfig): number {
  return config.homeCount;
}

export function defaultShiftConfigs(): ShiftConfig[] {
  return AREAS.map((area) => ({ area, homeCount: 1, awayCount: 1 }));
}
