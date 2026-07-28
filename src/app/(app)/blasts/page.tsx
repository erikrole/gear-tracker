"use client";

import { useState } from "react";
import Link from "next/link";
import { MegaphoneIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFetch } from "@/hooks/use-fetch";
import { ComposeBlastDialog } from "./_components/ComposeBlastDialog";
import { SEVERITY_VARIANT, SEVERITY_LABEL, type BlastSeverity } from "./_severity";

type BlastRow = {
  id: string;
  title: string;
  body: string;
  severity: BlastSeverity;
  status: "SENDING" | "SENT" | "CANCELLED";
  targetSummary: string;
  recipientCount: number;
  acknowledgedCount: number;
  sentAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
};

function relativeTime(iso: string): string {
  const date = new Date(iso);
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  return date.toLocaleDateString();
}

export default function BlastsPage() {
  const [composeOpen, setComposeOpen] = useState(false);
  const { data, loading, reload } = useFetch<BlastRow[]>({
    url: "/api/blasts?limit=50",
    returnTo: "/blasts",
    transform: (json) => (json.data as BlastRow[]) ?? [],
  });

  const blasts = data ?? [];

  return (
    <>
      <PageHeader
        title="Blasts"
        description="Broadcast to the people working an event, and see who has acknowledged."
      >
        <Button onClick={() => setComposeOpen(true)}>
          <MegaphoneIcon aria-hidden="true" />
          New blast
        </Button>
      </PageHeader>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : blasts.length === 0 ? (
        <EmptyState
          icon="bell"
          title="No blasts yet"
          description="Send one when a call time moves, a gate changes, or the crew needs to know something now."
          actionLabel="New blast"
          onAction={() => setComposeOpen(true)}
        />
      ) : (
        <div className="space-y-2">
          {blasts.map((blast) => {
            const pending = blast.recipientCount - blast.acknowledgedCount;
            return (
              <Card key={blast.id} className="transition-colors hover:bg-accent/40">
                <CardContent className="p-4">
                  <Link href={`/blasts/${blast.id}`} className="block">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={SEVERITY_VARIANT[blast.severity]}>{SEVERITY_LABEL[blast.severity]}</Badge>
                      <span className="font-semibold">{blast.title}</span>
                      {blast.cancelledAt && <Badge variant="gray">Cancelled</Badge>}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {relativeTime(blast.sentAt ?? blast.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{blast.body}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="truncate">{blast.targetSummary}</span>
                      <span className="tabular-nums">
                        {blast.acknowledgedCount}/{blast.recipientCount} acknowledged
                      </span>
                      {pending > 0 && !blast.cancelledAt && (
                        <span className="tabular-nums text-[var(--orange-text)]">{pending} still waiting</span>
                      )}
                      {blast.createdBy && <span>· {blast.createdBy.name}</span>}
                    </div>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ComposeBlastDialog open={composeOpen} onOpenChange={setComposeOpen} onSent={reload} />
    </>
  );
}
