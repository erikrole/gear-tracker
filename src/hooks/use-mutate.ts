"use client";

import { useState, useCallback, useRef } from "react";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";

type MutateOptions = {
  /** Called on success with the parsed JSON response. */
  onSuccess?: (data: unknown) => void;
  /** Called on error with the error message. */
  onError?: (message: string) => void;
};

type MutateState = {
  loading: boolean;
  error: string | null;
};

type MutateFn = (
  url: string,
  options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  },
) => Promise<{ ok: boolean; data?: unknown; error?: string }>;

/**
 * Lightweight mutation helper for POST/PATCH/DELETE requests.
 *
 * Handles:
 * - Loading state tracking (prevents duplicate submissions)
 * - 401 → redirect to /login
 * - JSON error parsing with fallback message
 * - Network error handling
 *
 * Usage:
 *   const { mutate, loading, error } = useMutate();
 *   const result = await mutate("/api/foo", { method: "POST", body: { bar: 1 } });
 *   if (result.ok) toast("Done!", "success");
 */
export function useMutate(defaults?: MutateOptions): MutateState & { mutate: MutateFn } {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflightRef = useRef(false);

  const mutate: MutateFn = useCallback(async (url, options) => {
    if (inflightRef.current) return { ok: false, error: "Request in progress" };
    inflightRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(url, {
        method: options?.method ?? "POST",
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
        body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
      });

      if (handleAuthRedirect(res)) {
        return { ok: false, error: "Session expired" };
      }

      if (!res.ok) {
        const msg = await parseErrorMessage(res);
        setError(msg);
        defaults?.onError?.(msg);
        return { ok: false, error: msg };
      }

      const data = await res.json().catch(() => ({}));
      defaults?.onSuccess?.(data);
      return { ok: true, data };
    } catch {
      const msg = "Network error — try again";
      setError(msg);
      defaults?.onError?.(msg);
      return { ok: false, error: msg };
    } finally {
      setLoading(false);
      inflightRef.current = false;
    }
  }, [defaults]);

  return { mutate, loading, error };
}
