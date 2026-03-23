"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

type AuditEntry = {
  id: string;
  actor: string;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
};

type AuditData = {
  data: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
};

function AuditMobileCard({ entry }: { entry: AuditEntry }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 border-b last:border-b-0">
      <div className="flex items-center justify-between">
        <Badge variant="gray">{entry.action}</Badge>
        <span className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
      </div>
      <div className="text-sm">
        <span>{entry.actor}</span>
        <span className="text-muted-foreground"> &middot; </span>
        <span className="font-mono text-xs">{entry.entityType}:{entry.entityId.slice(0, 8)}</span>
      </div>
    </div>
  );
}

function downloadCsv(entries: AuditEntry[]) {
  const header = "Timestamp,Actor,Action,Entity Type,Entity ID\n";
  const rows = entries.map((e) =>
    `"${e.createdAt}","${e.actor}","${e.action}","${e.entityType}","${e.entityId}"`
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditReportPage() {
  const [data, setData] = useState<AuditData | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [periodDays, setPeriodDays] = useState(0); // 0 = all time
  const limit = 25;

  function loadData(p = page) {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({
      type: "audit",
      limit: String(limit),
      offset: String(p * limit),
    });
    if (periodDays > 0) {
      params.set("startDate", new Date(Date.now() - periodDays * 86_400_000).toISOString());
    }
    fetch(`/api/reports?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => setData(json ?? null))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(page); }, [page, periodDays]);

  if (loading) {
    return (
      <Card className="p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex gap-4 py-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4" style={{ width: `${50 + (i % 3) * 12}%` }} />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
        ))}
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to load audit report</AlertTitle>
        <AlertDescription className="flex items-center gap-3">
          <span>Check your connection and try again.</span>
          <Button variant="outline" size="sm" onClick={() => { setPage(0); loadData(0); }}>Retry</Button>
        </AlertDescription>
      </Alert>
    );
  }

  const totalPages = Math.ceil(data.total / limit);
  const entries = data.data ?? [];

  return (
    <>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-1 flex-wrap">
        <span className="text-sm text-muted-foreground">Period:</span>
        {[{ d: 0, label: "All" }, { d: 7, label: "7d" }, { d: 30, label: "30d" }, { d: 90, label: "90d" }].map(({ d, label }) => (
          <Button
            key={d}
            variant={periodDays === d ? "default" : "outline"} size="sm"
            onClick={() => { setPeriodDays(d); setPage(0); }}
          >
            {label}
          </Button>
        ))}
        {entries.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => downloadCsv(entries)} className="ml-auto">
            Export CSV
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit trail</CardTitle>
          <span className="text-sm text-muted-foreground">{data.total} entries</span>
        </CardHeader>

        {entries.length === 0 ? (
          <EmptyState icon="clipboard" title="No audit log entries" />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm">{formatDateTime(entry.createdAt)}</TableCell>
                      <TableCell>{entry.actor}</TableCell>
                      <TableCell><Badge variant="gray">{entry.action}</Badge></TableCell>
                      <TableCell className="text-sm font-mono">{entry.entityType}:{entry.entityId.slice(0, 8)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden">
              {entries.map((entry) => (
                <AuditMobileCard key={entry.id} entry={entry} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
