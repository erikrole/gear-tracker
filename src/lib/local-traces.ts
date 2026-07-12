import { RECENT_STORAGE_KEY } from "@/lib/breadcrumbs";
import { QUERY_CACHE_STORAGE_KEY } from "@/lib/query-client";

export const RECENT_SEARCHES_STORAGE_KEY = "recent-searches";

// Keys that hold per-user history or cached entity data. Preference keys
// (theme, text scale, schedule view) are device-level and deliberately kept.
const LOCAL_TRACE_KEYS = [
  RECENT_STORAGE_KEY,
  RECENT_SEARCHES_STORAGE_KEY,
  QUERY_CACHE_STORAGE_KEY,
] as const;

/**
 * Remove locally persisted history and cached entity data at logout so the
 * next person on a shared machine can't read the previous user's breadcrumb
 * recents, searches, or dashboard/booking cache.
 */
export function clearLocalTraces() {
  for (const key of LOCAL_TRACE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // localStorage unavailable
    }
  }
}
