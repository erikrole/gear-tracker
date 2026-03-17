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

export type RosterMember = {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    primaryArea: string | null;
  };
};

export const AREAS = ["VIDEO", "PHOTO", "GRAPHICS", "COMMS"] as const;

export const AREA_LABELS: Record<string, string> = {
  VIDEO: "Video",
  PHOTO: "Photo",
  GRAPHICS: "Graphics",
  COMMS: "Comms",
};

export function defaultShiftConfigs(): ShiftConfig[] {
  return AREAS.map((area) => ({ area, homeCount: 1, awayCount: 1 }));
}
