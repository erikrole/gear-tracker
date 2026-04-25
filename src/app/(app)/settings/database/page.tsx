"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FadeUp } from "@/components/ui/motion";
import { handleAuthRedirect, classifyError, isAbortError } from "@/lib/errors";

type MigrationRow = { name: string; appliedAt: string | null };
type DriftItem = { table: string; column: string; status: string };

type DiagnosticsResult = {
  ok: boolean;
  checks: {
    migrationTable: { exists: boolean; migrations: MigrationRow[] };
    tables: { present: string[]; missing: string[]; extra: string[] };
    enums: { present: string[]; missing: string[] };
    extensions: { present: string[]; missing: string[] };
    columns: { drift: DriftItem[] };
  };
  remediation: string[];
};

export default function DatabasePage() {
  const [result, setResult] = useState<DiagnosticsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runCheck() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/db-diagnostics");
      if (handleAuthRedirect(res, "/settings/database")) return;
      if (!res.ok) {
        // Don't surface raw server error text — could leak schema internals.
        await res.json().catch(() => null);
        setError(
          res.status === 403
            ? "Admin access required to run diagnostics."
            : "Could not run diagnostics. Please try again."
        );
        setResult(null);
        return;
      }
      setResult(await res.json());
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      setError(kind === "network" ? "Could not reach the server. Check your connection." : "Something went wrong");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <FadeUp>
    <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-md:grid-cols-1 max-md:gap-4">
      <div className="sticky top-20 max-md:static">
        <h2 className="text-2xl font-bold mb-2">Database Health</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Check that your database schema matches the expected Prisma migrations. Surfaces missing tables, enums, columns, and migration drift.
        </p>
      </div>

      <div className="min-w-0">
        <div className="flex justify-end mb-3">
          <Button onClick={runCheck} disabled={loading}>
            {loading ? "Checking\u2026" : "Run diagnostics"}
          </Button>
        </div>

        {error && (
          <Card className="mb-1">
            <CardContent className="text-red">
              {error}
            </CardContent>
          </Card>
        )}

        {result && (
          <>
            {/* Overall status */}
            <Card className="mb-1">
              <CardContent className="flex items-center gap-3">
                <span
                  className={`shrink-0 inline-block size-3 rounded-full ${result.ok ? "bg-[var(--green)]" : "bg-destructive"}`}
                />
                <span className="font-semibold text-[length:var(--text-md)]">
                  {result.ok ? "Schema is healthy" : "Issues detected"}
                </span>
              </CardContent>
            </Card>

            {/* Remediation steps */}
            {result.remediation.length > 0 && (
              <Card className="mb-1">
                <CardHeader>
                  <span className="font-semibold text-sm">Remediation</span>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {result.remediation.map((step, i) => (
                    <div
                      key={i}
                      className="text-sm font-mono px-3 py-2 bg-destructive/5 rounded-md leading-relaxed"
                    >
                      {step}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Migration table */}
            <Card className="mb-1">
              <CardHeader>
                <span className="font-semibold text-sm">Migrations</span>
                <StatusBadge ok={result.checks.migrationTable.exists} label={result.checks.migrationTable.exists ? "Table exists" : "Table missing"} />
              </CardHeader>
              {result.checks.migrationTable.migrations.length > 0 && (
                <CardContent className="px-0 py-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Migration</TableHead>
                        <TableHead>Applied</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.checks.migrationTable.migrations.map((m) => (
                        <TableRow key={m.name}>
                          <TableCell>{m.name}</TableCell>
                          <TableCell>
                            {m.appliedAt ? new Date(m.appliedAt).toLocaleDateString() : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>

            {/* Tables */}
            <Card className="mb-1">
              <CardHeader>
                <span className="font-semibold text-sm">Tables</span>
                <StatusBadge
                  ok={result.checks.tables.missing.length === 0}
                  label={result.checks.tables.missing.length === 0
                    ? `${result.checks.tables.present.length} present`
                    : `${result.checks.tables.missing.length} missing`}
                />
              </CardHeader>
              {result.checks.tables.missing.length > 0 && (
                <CardContent>
                  <TagList items={result.checks.tables.missing} variant="danger" />
                </CardContent>
              )}
            </Card>

            {/* Enums */}
            <Card className="mb-1">
              <CardHeader>
                <span className="font-semibold text-sm">Enums</span>
                <StatusBadge
                  ok={result.checks.enums.missing.length === 0}
                  label={result.checks.enums.missing.length === 0
                    ? `${result.checks.enums.present.length} present`
                    : `${result.checks.enums.missing.length} missing`}
                />
              </CardHeader>
              {result.checks.enums.missing.length > 0 && (
                <CardContent>
                  <TagList items={result.checks.enums.missing} variant="danger" />
                </CardContent>
              )}
            </Card>

            {/* Extensions */}
            <Card className="mb-1">
              <CardHeader>
                <span className="font-semibold text-sm">Extensions</span>
                <StatusBadge
                  ok={result.checks.extensions.missing.length === 0}
                  label={result.checks.extensions.missing.length === 0
                    ? `${result.checks.extensions.present.length} installed`
                    : `${result.checks.extensions.missing.length} missing`}
                />
              </CardHeader>
              {result.checks.extensions.missing.length > 0 && (
                <CardContent>
                  <TagList items={result.checks.extensions.missing} variant="danger" />
                </CardContent>
              )}
            </Card>

            {/* Column drift */}
            {result.checks.columns.drift.length > 0 && (
              <Card className="mb-1">
                <CardHeader>
                  <span className="font-semibold text-sm">Column Drift</span>
                  <StatusBadge ok={false} label={`${result.checks.columns.drift.length} missing`} />
                </CardHeader>
                <CardContent className="px-0 py-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Table</TableHead>
                        <TableHead>Column</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.checks.columns.drift.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell><code>{d.table}</code></TableCell>
                          <TableCell><code>{d.column}</code></TableCell>
                          <TableCell>
                            <Badge variant="red" size="sm">{d.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {!result && !error && !loading && (
          <Card>
            <div className="py-10 px-5 text-center text-muted-foreground">
              Click &ldquo;Run diagnostics&rdquo; to check schema health
            </div>
          </Card>
        )}
      </div>
    </div>
    </FadeUp>
  );
}

/* ── Helpers ──────────────────────────────────────────── */

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge variant={ok ? "green" : "red"} size="sm">
      {label}
    </Badge>
  );
}

function TagList({ items, variant }: { items: string[]; variant: "danger" | "info" }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge key={item} variant={variant === "danger" ? "red" : "blue"} size="sm">
          {item}
        </Badge>
      ))}
    </div>
  );
}
