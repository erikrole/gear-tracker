"use client";

import { useState } from "react";

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
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error ?? `HTTP ${res.status}`);
        setResult(null);
        return;
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="settings-split">
      <div className="settings-sidebar">
        <h2 className="settings-title">Database Health</h2>
        <p className="settings-desc">
          Check that your database schema matches the expected Prisma migrations. Surfaces missing tables, enums, columns, and migration drift.
        </p>
      </div>

      <div className="settings-main">
        <div className="settings-action-row">
          <button className="btn btn-primary" onClick={runCheck} disabled={loading}>
            {loading ? "Checking\u2026" : "Run diagnostics"}
          </button>
        </div>

        {error && (
          <div className="card mb-16">
            <div className="card-body text-red">
              {error}
            </div>
          </div>
        )}

        {result && (
          <>
            {/* Overall status */}
            <div className="card mb-16">
              <div className="card-body flex-center gap-12">
                <span
                  className="shrink-0"
                  style={{
                    display: "inline-block",
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: result.ok ? "#22c55e" : "#ef4444",
                  }}
                />
                <span className="font-semibold" style={{ fontSize: "var(--text-md)" }}>
                  {result.ok ? "Schema is healthy" : "Issues detected"}
                </span>
              </div>
            </div>

            {/* Remediation steps */}
            {result.remediation.length > 0 && (
              <div className="card mb-16">
                <div className="card-header">
                  <span className="font-semibold text-sm">Remediation</span>
                </div>
                <div className="card-body flex-col gap-8">
                  {result.remediation.map((step, i) => (
                    <div
                      key={i}
                      className="text-sm font-mono"
                      style={{
                        padding: "8px 12px",
                        background: "rgba(239, 68, 68, 0.06)",
                        borderRadius: 8,
                        lineHeight: 1.5,
                      }}
                    >
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Migration table */}
            <div className="card mb-16">
              <div className="card-header">
                <span className="font-semibold text-sm">Migrations</span>
                <StatusBadge ok={result.checks.migrationTable.exists} label={result.checks.migrationTable.exists ? "Table exists" : "Table missing"} />
              </div>
              {result.checks.migrationTable.migrations.length > 0 && (
                <div className="card-body" style={{ padding: 0 }}>
                  <table className="diag-table">
                    <thead>
                      <tr>
                        <th>Migration</th>
                        <th>Applied</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.checks.migrationTable.migrations.map((m) => (
                        <tr key={m.name}>
                          <td>{m.name}</td>
                          <td>
                            {m.appliedAt ? new Date(m.appliedAt).toLocaleDateString() : "\u2014"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Tables */}
            <div className="card mb-16">
              <div className="card-header">
                <span className="font-semibold text-sm">Tables</span>
                <StatusBadge
                  ok={result.checks.tables.missing.length === 0}
                  label={result.checks.tables.missing.length === 0
                    ? `${result.checks.tables.present.length} present`
                    : `${result.checks.tables.missing.length} missing`}
                />
              </div>
              {result.checks.tables.missing.length > 0 && (
                <div className="card-body">
                  <TagList items={result.checks.tables.missing} variant="danger" />
                </div>
              )}
            </div>

            {/* Enums */}
            <div className="card mb-16">
              <div className="card-header">
                <span className="font-semibold text-sm">Enums</span>
                <StatusBadge
                  ok={result.checks.enums.missing.length === 0}
                  label={result.checks.enums.missing.length === 0
                    ? `${result.checks.enums.present.length} present`
                    : `${result.checks.enums.missing.length} missing`}
                />
              </div>
              {result.checks.enums.missing.length > 0 && (
                <div className="card-body">
                  <TagList items={result.checks.enums.missing} variant="danger" />
                </div>
              )}
            </div>

            {/* Extensions */}
            <div className="card mb-16">
              <div className="card-header">
                <span className="font-semibold text-sm">Extensions</span>
                <StatusBadge
                  ok={result.checks.extensions.missing.length === 0}
                  label={result.checks.extensions.missing.length === 0
                    ? `${result.checks.extensions.present.length} installed`
                    : `${result.checks.extensions.missing.length} missing`}
                />
              </div>
              {result.checks.extensions.missing.length > 0 && (
                <div className="card-body">
                  <TagList items={result.checks.extensions.missing} variant="danger" />
                </div>
              )}
            </div>

            {/* Column drift */}
            {result.checks.columns.drift.length > 0 && (
              <div className="card mb-16">
                <div className="card-header">
                  <span className="font-semibold text-sm">Column Drift</span>
                  <StatusBadge ok={false} label={`${result.checks.columns.drift.length} missing`} />
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  <table className="diag-table">
                    <thead>
                      <tr>
                        <th>Table</th>
                        <th>Column</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.checks.columns.drift.map((d, i) => (
                        <tr key={i}>
                          <td><code>{d.table}</code></td>
                          <td><code>{d.column}</code></td>
                          <td>
                            <span className="badge badge-red" style={{ fontSize: "var(--text-3xs)" }}>{d.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {!result && !error && !loading && (
          <div className="card">
            <div className="empty-state">
              Click &ldquo;Run diagnostics&rdquo; to check schema health
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────── */

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`badge badge-sm ${ok ? "badge-green" : "badge-red"}`}
    >
      {label}
    </span>
  );
}

function TagList({ items, variant }: { items: string[]; variant: "danger" | "info" }) {
  const cls = variant === "danger" ? "badge-red" : "badge-blue";
  return (
    <div className="flex flex-wrap gap-6">
      {items.map((item) => (
        <span key={item} className={`badge badge-sm ${cls}`}>
          {item}
        </span>
      ))}
    </div>
  );
}
