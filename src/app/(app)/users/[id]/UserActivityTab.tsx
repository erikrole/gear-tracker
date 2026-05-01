"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useFetch } from "@/hooks/use-fetch";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import ActivityTimeline, { type AuditEntry } from "@/components/ActivityTimeline";
import { handleAuthRedirect } from "@/lib/errors";

type ActivityResponse = { data: AuditEntry[]; nextCursor: string | null };

export default function UserActivityTab({ userId }: { userId: string }) {
  const [extras, setExtras] = useState<AuditEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const {
    data,
    loading,
    error,
    reload,
  } = useFetch<ActivityResponse>({
    url: `/api/users/${userId}/activity`,
    transform: (json) => ({
      data: (json as ActivityResponse).data ?? [],
      nextCursor: (json as ActivityResponse).nextCursor ?? null,
    }),
  });

  const entries: AuditEntry[] = [...(data?.data ?? []), ...extras];
  const cursor =
    extras.length > 0 ? nextCursor : data?.nextCursor ?? null;

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/users/${userId}/activity?cursor=${encodeURIComponent(cursor)}`,
      );
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        toast.error("Failed to load more activity");
        return;
      }
      const json = (await res.json()) as ActivityResponse;
      if (json.data) setExtras((prev) => [...prev, ...json.data]);
      setNextCursor(json.nextCursor ?? null);
    } catch {
      toast.error("Network error");
    } finally {
      setLoadingMore(false);
    }
  }, [userId, cursor, loadingMore]);

  if (error && !data) {
    return (
      <div className="py-10 px-5 flex justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="size-4" />
          <AlertTitle>Failed to load activity</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-3">
              Something went wrong loading the activity history.
            </p>
            <Button variant="outline" size="sm" onClick={reload}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <ActivityTimeline
        entries={entries}
        loading={loading || loadingMore}
        hasMore={!!cursor}
        onLoadMore={loadMore}
        context="user"
        emptyMessage="No activity recorded yet."
      />
    </div>
  );
}
