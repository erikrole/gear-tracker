export type ResourceFilterKey =
  | "all"
  | "recent"
  | "my-area"
  | "area-video"
  | "area-photo"
  | "area-graphics"
  | "area-comms"
  | "contacts"
  | "building-numbers"
  | "media-drive"
  | "server-paths";

export type ResourceSortKey = "personalized" | "recent" | "title";

const FILTER_PARAM_MAP: Record<string, ResourceFilterKey> = {
  recent: "recent",
  "my-area": "my-area",
  "area-video": "area-video",
  "area-photo": "area-photo",
  "area-graphics": "area-graphics",
  "area-comms": "area-comms",
  contacts: "contacts",
  "building-numbers": "building-numbers",
  "media-drive": "media-drive",
  "server-paths": "server-paths",
};

const LEGACY_AREA_PARAM_MAP: Record<string, ResourceFilterKey> = {
  video: "area-video",
  photo: "area-photo",
  graphics: "area-graphics",
  comms: "area-comms",
};

const SORT_PARAM_VALUES = new Set<ResourceSortKey>(["personalized", "recent", "title"]);

function normalizeParam(value: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function parseResourceFilter(params: { get(name: string): string | null }): ResourceFilterKey {
  const currentFilter = normalizeParam(params.get("filter"));
  if (FILTER_PARAM_MAP[currentFilter]) return FILTER_PARAM_MAP[currentFilter];

  const legacyView = normalizeParam(params.get("view"));
  if (FILTER_PARAM_MAP[legacyView]) return FILTER_PARAM_MAP[legacyView];

  const legacyArea = normalizeParam(params.get("area"));
  if (LEGACY_AREA_PARAM_MAP[legacyArea]) return LEGACY_AREA_PARAM_MAP[legacyArea];

  return "all";
}

export function parseResourceSort(value: string | null): ResourceSortKey {
  const normalized = normalizeParam(value);
  return SORT_PARAM_VALUES.has(normalized as ResourceSortKey)
    ? (normalized as ResourceSortKey)
    : "personalized";
}
