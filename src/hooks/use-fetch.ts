"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  classifyError,
  isAbortError,
  handleAuthRedirect,
  type FetchErrorKind,
} from "@/lib/errors";

export type UseFetchOptions<T> = {
  /** The URL to fetch. When it changes, a new request is made. */
  url: string;
  /**
   * Optional path within `window.location.pathname` used for the `returnTo`
   * query param on 401 redirects. Defaults to current pathname.
   */
  returnTo?: string;
  /**
   * Transform the raw JSON response before storing in state.
   * Defaults to `json => json.data ?? json`.
   */
  transform?: (json: Record<string, unknown>) => T;
  /** If true, refetch when the browser tab becomes visible again. Default: true. */
  refetchOnFocus?: boolean;
};

export type UseFetchResult<T> = {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: FetchErrorKind | false;
  lastRefreshed: Date | null;
  /** Trigger a manual reload. Preserves existing data on failure. */
  reload: () => void;
};

/**
 * Shared data-fetching hook with:
 * - AbortController (cancels in-flight on re-fetch or unmount)
 * - Initial load vs refresh distinction (refresh keeps data visible)
 * - 401 → redirect to /login
 * - Classified error state (network / server)
 * - Visibility-based auto-refresh (refetch when tab regains focus)
 * - Last refreshed timestamp
 */
export function useFetch<T = unknown>(options: UseFetchOptions<T>): UseFetchResult<T> {
  const { url, returnTo, refetchOnFocus = true } = options;
  const transformRef = useRef(options.transform);
  transformRef.current = options.transform;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<FetchErrorKind | false>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const hasLoadedOnce = useRef(false);

  const reload = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const isRefresh = hasLoadedOnce.current;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(false);

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return null;
        if (handleAuthRedirect(res, returnTo)) return null;
        if (!res.ok) throw new Error("server");
        return res.json();
      })
      .then((json) => {
        if (!json || controller.signal.aborted) {
          if (!hasLoadedOnce.current && !controller.signal.aborted) {
            setError("server");
          }
          return;
        }
        const transform = transformRef.current;
        const result = transform ? transform(json) : ((json.data ?? json) as T);
        setData(result);
        setError(false);
        setLastRefreshed(new Date());
        hasLoadedOnce.current = true;
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        if (isRefresh) {
          toast.error("Failed to refresh. Your data may be stale.");
        } else {
          setError(classifyError(err));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      });
  }, [url, returnTo]);

  // Fetch on mount and when URL changes
  useEffect(() => {
    reload();
    return () => {
      abortRef.current?.abort();
    };
  }, [reload]);

  // Refetch when tab becomes visible
  useEffect(() => {
    if (!refetchOnFocus) return;

    function onVisibilityChange() {
      if (document.visibilityState === "visible" && hasLoadedOnce.current) {
        reload();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refetchOnFocus, reload]);

  return { data, loading, refreshing, error, lastRefreshed, reload };
}
