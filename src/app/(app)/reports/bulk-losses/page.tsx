"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MetricCard from "../MetricCard";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";

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
  lostUnits: unknown;
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
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(false);

    try {
      const res = await fetch("/api/reports?type=bulk-losses", {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    return () => { abortRef.current?.abort(); };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Failed to load report</AlertTitle>
        <AlertDescription>
          <Button variant="outline" size="sm" onClick={fetchData} className="mt-2">
            <RefreshCw className="size-3.5 mr-1.5" /> Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Total Units Lost" value={data.totalLost} />
        <MetricCard label="SKUs Affected" value={data.bySku.length} />
        <MetricCard label="Users Involved" value={data.byUser.length} />
      </div>

      {/* Loss by SKU */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lost Units by Item</CardTitle>
        </CardHeader>
        <CardContent>
          {data.bySku.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No lost units recorded.</p>
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
                      <Badge variant="red" size="sm">{sku.count}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Loss by user leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Loss by Requester</CardTitle>
        </CardHeader>
        <CardContent>
          {data.byUser.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No user-attributed losses found.</p>
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
                      <Badge variant={i === 0 && data.byUser.length > 1 ? "red" : "secondary"} size="sm">
                        {user.count}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent auto-loss events */}
      {data.recentLosses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Loss Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recentLosses.map((event) => (
                <div key={event.id} className="flex items-center justify-between py-2 border-b last:border-b-0 text-sm">
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
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
