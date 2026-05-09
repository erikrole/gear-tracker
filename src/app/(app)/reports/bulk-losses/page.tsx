"use client";

import { useEffect, useState } from "react";
import MetricCard from "../MetricCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FadeUp } from "@/components/ui/motion";
import { useFetch } from "@/hooks/use-fetch";
import {
  ReportEmptyState,
  ReportErrorState,
  ReportListRow,
  ReportLoadingState,
  ReportMetricGrid,
  ReportSectionCard,
  ReportToolbar,
} from "../report-ui";

type SkuLoss = {
  skuName: string;
  bulkSkuId: string;
  count: number;
};

type UserLoss = {
  name: string;
  count: number;
};

type RecentLoss = {
  id: string;
  bookingId: string;
  lostUnits: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string } | null;
};

type ReportData = {
  totalLost: number;
  bySku: SkuLoss[];
  byUser: UserLoss[];
  recentLosses: RecentLoss[];
};

export default function BulkLossesReportPage() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { data, loading, error, lastRefreshed, reload } = useFetch<ReportData>({
    url: "/api/reports/bulk-losses",
  });

  if (loading && !data) return <ReportLoadingState metricCount={3} rows={6} />;

  if (error && !data) {
    return (
      <ReportErrorState
        error={error}
        onRetry={reload}
        title="Failed to load bulk losses report"
      />
    );
  }

  if (!data) return null;

  return (
    <FadeUp>
    <div className="flex flex-col gap-4">
      <ReportToolbar
        lastRefreshed={lastRefreshed}
        loading={loading}
        now={now}
        onRefresh={reload}
      />

      {/* Metrics row */}
      <ReportMetricGrid>
        <MetricCard label="Total units lost" value={data.totalLost} />
        <MetricCard label="SKUs affected" value={data.bySku.length} />
        <MetricCard label="Users involved" value={data.byUser.length} />
      </ReportMetricGrid>

      {/* Loss by SKU */}
      <ReportSectionCard title="Lost units by item" contentClassName="p-0">
          {data.bySku.length === 0 ? (
            <ReportEmptyState
              compact
              icon="check"
              title="No lost units recorded"
              description="Bulk loss rows appear after check-in records missing numbered units."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Lost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.bySku.map((sku) => (
                  <TableRow key={sku.bulkSkuId}>
                    <TableCell className="font-medium">{sku.skuName}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="red" size="sm" className="tabular-nums">{sku.count}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </ReportSectionCard>

      {/* Loss by user leaderboard */}
      <ReportSectionCard title="Loss by requester" contentClassName="p-0">
          {data.byUser.length === 0 ? (
            <ReportEmptyState
              compact
              icon="users"
              title="No user-attributed losses found"
              description="Requester rankings appear once loss events can be tied back to a booking."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requester</TableHead>
                  <TableHead className="text-right">Units Lost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byUser.map((user, i) => (
                  <TableRow key={user.name}>
                    <TableCell className="font-medium">
                      {i === 0 && data.byUser.length > 1 && (
                        <Badge variant="red" size="sm" className="mr-2">Highest</Badge>
                      )}
                      {user.name}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={i === 0 && data.byUser.length > 1 ? "red" : "secondary"} size="sm" className="tabular-nums">
                        {user.count}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </ReportSectionCard>

      {/* Recent auto-loss events */}
      {data.recentLosses.length > 0 && (
        <ReportSectionCard title="Recent loss events">
            <div className="flex flex-col gap-2">
              {data.recentLosses.map((event) => (
                <ReportListRow key={event.id} className="px-0 py-2">
                  <div>
                    <span className="font-medium">
                      {event.actor?.name ?? "System"}
                    </span>
                    <span className="text-muted-foreground ml-1.5">
                      completed check-in with missing units
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(event.createdAt).toLocaleDateString()}
                  </span>
                </ReportListRow>
              ))}
            </div>
        </ReportSectionCard>
      )}
    </div>
    </FadeUp>
  );
}
