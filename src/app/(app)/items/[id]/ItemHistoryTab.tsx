"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import ActivityTimeline, { type AuditEntry } from "@/components/ActivityTimeline";

/* ── Activity Feed Component ── */

export default function ActivityFeed({
  assetId,
  assetName,
}: {
  assetId: string;
  assetName?: string;
}) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const loadActivity = useCallback(() => {
    setLoading(true);
    setFetchError(false);
    fetch(`/api/assets/${assetId}/activity`)
      .then((res) => {
        if (!res.ok) {
          setFetchError(true);
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (json?.data) setEntries(json.data);
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [assetId]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <Empty className="py-8 border-0">
        <AlertTriangle className="size-8 text-muted-foreground opacity-50 mx-auto mb-2" />
        <EmptyDescription>Failed to load activity history.</EmptyDescription>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={loadActivity}
        >
          Retry
        </Button>
      </Empty>
    );
  }

  if (entries.length === 0) {
    return (
      <Empty className="py-8 border-0">
        <EmptyDescription>No activity recorded yet.</EmptyDescription>
      </Empty>
    );
  }

  return (
    <ActivityTimeline
      entries={entries}
      context="item"
      entityName={assetName}
    />
  );
}
