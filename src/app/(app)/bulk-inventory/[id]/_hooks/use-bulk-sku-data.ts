"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { handleAuthRedirect, isAbortError, classifyError, type FetchErrorKind } from "@/lib/errors";
import { useBreadcrumbLabel } from "@/components/BreadcrumbContext";
import type { BulkSkuDetail } from "../types";

export type UseBulkSkuDataReturn = {
  sku: BulkSkuDetail | null;
  setSku: React.Dispatch<React.SetStateAction<BulkSkuDetail | null>>;
  fetchError: FetchErrorKind | "not-found" | false;
  refreshing: boolean;
  currentUserRole: string;
  canEdit: boolean;
  loadSku: () => void;
};

export default function useBulkSkuData(id: string): UseBulkSkuDataReturn {
  const [sku, setSku] = useState<BulkSkuDetail | null>(null);
  const [fetchError, setFetchError] = useState<FetchErrorKind | "not-found" | false>(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const hasLoadedOnce = useRef(false);
  const { setBreadcrumbLabel } = useBreadcrumbLabel();

  const loadSku = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const isRefresh = hasLoadedOnce.current;
    if (isRefresh) setRefreshing(true);

    fetch(`/api/bulk-skus/${id}`, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return null;
        if (handleAuthRedirect(res, `/bulk-inventory/${id}`)) return null;
        if (res.status === 404) {
          if (!isRefresh) setFetchError("not-found");
          return null;
        }
        if (!res.ok) throw new Error("server");
        return res.json();
      })
      .then((json) => {
        if (!json || controller.signal.aborted) return;
        if (json?.data) {
          setSku(json.data);
          setBreadcrumbLabel(json.data.name);
          setFetchError(false);
          hasLoadedOnce.current = true;
        }
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        if (isRefresh) {
          toast.error("Failed to refresh — data may be stale.");
        } else {
          setFetchError(classifyError(err));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setRefreshing(false);
      });
  }, [id]);

  useEffect(() => {
    loadSku();
    fetch("/api/me")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json?.user?.role) setCurrentUserRole(json.user.role); })
      .catch(() => {});
    return () => { abortRef.current?.abort(); };
  }, [loadSku]);

  const canEdit = currentUserRole === "ADMIN" || currentUserRole === "STAFF";

  return { sku, setSku, fetchError, refreshing, currentUserRole, canEdit, loadSku };
}
