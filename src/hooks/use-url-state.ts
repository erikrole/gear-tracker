"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Sync a single value to a URL search parameter via `history.replaceState`.
 *
 * Reads the initial value from the URL on mount. When the value changes,
 * the URL is updated without a navigation or re-render from Next.js router.
 *
 * @param key   - The URL search parameter name (e.g., "sport", "days", "tab")
 * @param parse - Convert the raw string (or null) from the URL to your state type.
 *                Receives null when the param is absent.
 * @param serialize - Convert the state value back to a string for the URL.
 *                    Return null/undefined to remove the parameter.
 *
 * @example
 * ```ts
 * // Simple string filter
 * const [sport, setSport] = useUrlState("sport", v => v, v => v);
 *
 * // Numeric with default
 * const [days, setDays] = useUrlState("days", v => v ? Number(v) : 30, v => v === 30 ? null : String(v));
 *
 * // Tab selection
 * const [tab, setTab] = useUrlState("tab", v => v ?? "info", v => v === "info" ? null : v);
 * ```
 */
export function useUrlState<T>(
  key: string,
  parse: (raw: string | null) => T,
  serialize: (value: T) => string | null | undefined,
): [T, (value: T | ((prev: T) => T)) => void] {
  const searchParams = useSearchParams();

  const [value, setValue] = useState<T>(() => parse(searchParams.get(key)));

  // Sync value changes to URL
  useEffect(() => {
    const serialized = serialize(value);
    const url = new URL(window.location.href);

    if (serialized == null || serialized === "") {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, serialized);
    }

    const newUrl = url.searchParams.toString()
      ? `${url.pathname}?${url.searchParams.toString()}`
      : url.pathname;

    if (newUrl !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", newUrl);
    }
  }, [key, value, serialize]);

  return [value, setValue];
}

/**
 * Sync a Set<string> to a URL parameter (multi-value via repeated keys).
 *
 * @example
 * ```ts
 * const [statuses, setStatuses] = useUrlSetState("status");
 * // URL: ?status=OPEN&status=BOOKED
 * ```
 */
export function useUrlSetState(
  key: string,
): [Set<string>, (value: Set<string> | ((prev: Set<string>) => Set<string>)) => void] {
  const searchParams = useSearchParams();

  const [value, setValue] = useState<Set<string>>(
    () => new Set(searchParams.getAll(key).filter(Boolean))
  );

  // Sync to URL
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete(key);
    value.forEach((v) => url.searchParams.append(key, v));

    const newUrl = url.searchParams.toString()
      ? `${url.pathname}?${url.searchParams.toString()}`
      : url.pathname;

    if (newUrl !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", newUrl);
    }
  }, [key, value]);

  return [value, setValue];
}

/**
 * Debounce a value by the given delay (ms). Useful for search inputs.
 *
 * @example
 * ```ts
 * const [search, setSearch] = useState("");
 * const debouncedSearch = useDebounce(search, 300);
 * ```
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
