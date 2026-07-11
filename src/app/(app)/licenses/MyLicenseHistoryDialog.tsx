"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock3, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/format";
import { handleAuthRedirect, parseErrorMessage, parseJsonSafely } from "@/lib/errors";

type HistoryEntry = {
  id: string;
  claimedAt: string;
  releasedAt: string | null;
  licenseCode: {
    id: string;
    label: string | null;
    expiresAt: string | null;
  };
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type HistoryResponse = {
  data?: HistoryEntry[];
};

export function MyLicenseHistoryDialog({ open, onOpenChange }: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadHistory = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch("/api/licenses/my/history", { signal });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not load license history"));
      const json = await parseJsonSafely<HistoryResponse>(res);
      setHistory(json?.data ?? []);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void loadHistory(controller.signal);
    return () => controller.abort();
  }, [loadHistory, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>License history</DialogTitle>
          <DialogDescription>
            Your recent Photo Mechanic claims and returns. Released codes stay hidden here.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {loading ? (
            Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="rounded-md border p-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-2 h-3 w-56" />
              </div>
            ))
          ) : loadError ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <span>License history could not load.</span>
              <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => void loadHistory()}>
                <RefreshCw data-icon="inline-start" />
                Retry
              </Button>
            </div>
          ) : history.length === 0 ? (
            <div className="flex items-center gap-2 rounded-md border p-3 text-sm text-muted-foreground">
              <Clock3 className="size-4" />
              No license claims yet.
            </div>
          ) : (
            history.map((entry) => {
              const label = entry.licenseCode.label ?? "Photo Mechanic license";
              const claimed = formatRelativeTime(entry.claimedAt, new Date());
              const released = entry.releasedAt
                ? formatRelativeTime(entry.releasedAt, new Date())
                : null;

              return (
                <div key={entry.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Claimed {claimed}
                      {released ? `, returned ${released}` : ""}
                    </p>
                  </div>
                  <Badge variant={entry.releasedAt ? "outline" : "green"} className="shrink-0">
                    {entry.releasedAt ? "Returned" : "Active"}
                  </Badge>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
