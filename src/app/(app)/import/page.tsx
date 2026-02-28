"use client";

import { useCallback, useRef, useState } from "react";

type PreviewRow = {
  line: number;
  assetTag: string;
  assetTagDeduped: boolean;
  name: string;
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  locationName: string;
  departmentName: string;
  kitName: string;
  uwAssetTag: string;
  consumable: boolean;
  retired: boolean;
  warnings: string[];
  errors: string[];
};

type PreviewSummary = {
  totalItems: number;
  withErrors: number;
  withWarnings: number;
  duplicateNames: number;
  consumableItems: number;
  retiredItems: number;
  locations: string[];
  newLocations: string[];
  departments: string[];
  newDepartments: string[];
  kits: string[];
};

type PreviewData = {
  headers: string[];
  totalRows: number;
  rows: PreviewRow[];
  summary: PreviewSummary;
};

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  kitsCreated: number;
  errors: Array<{ line: number; assetTag: string; error: string }>;
};

type Step = "upload" | "preview" | "importing" | "summary";

export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError("");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && (dropped.name.endsWith(".csv") || dropped.name.endsWith(".CSV"))) {
      setFile(dropped);
      setError("");
    } else {
      setError("Please drop a CSV file");
    }
  }, []);

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/assets/import?mode=preview", {
        method: "POST",
        body: formData
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Failed to parse CSV");
        setLoading(false);
        return;
      }

      setPreview(json.data);
      setStep("preview");
    } catch {
      setError("Failed to upload file");
    }
    setLoading(false);
  }

  async function handleImport() {
    if (!file) return;
    setStep("importing");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/assets/import?mode=import", {
        method: "POST",
        body: formData
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Import failed");
        setStep("preview");
        return;
      }

      setResult(json.data);
      setStep("summary");
    } catch {
      setError("Import failed unexpectedly");
      setStep("preview");
    }
  }

  function handleDownloadErrors() {
    if (!result?.errors.length) return;
    const csv = ["Line,Asset Tag,Error"]
      .concat(
        result.errors.map(
          (e) => `${e.line},"${e.assetTag.replace(/"/g, '""')}","${e.error.replace(/"/g, '""')}"`
        )
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetWizard() {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <>
      <div className="page-header">
        <h1>Import from Cheqroom</h1>
        {step !== "upload" && step !== "importing" && (
          <button className="btn" onClick={resetWizard}>Start over</button>
        )}
      </div>

      {/* Step indicator */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {(["upload", "preview", "importing", "summary"] as Step[]).map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {i > 0 && <div style={{ width: 24, height: 1, background: "var(--border)" }} />}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                borderRadius: 16,
                fontSize: 13,
                fontWeight: step === s ? 600 : 400,
                background: step === s ? "var(--blue)" : "var(--bg-secondary)",
                color: step === s ? "white" : "var(--text-secondary)"
              }}
            >
              <span>{i + 1}</span>
              <span style={{ textTransform: "capitalize" }}>
                {s === "importing" ? "Import" : s}
              </span>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ padding: "10px 16px", marginBottom: 16, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── Upload step ── */}
      {step === "upload" && (
        <div className="card">
          <div className="card-header"><h2>Upload CSV file</h2></div>
          <div style={{ padding: 24 }}>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              style={{
                border: "2px dashed var(--border)",
                borderRadius: 12,
                padding: "48px 24px",
                textAlign: "center",
                cursor: "pointer",
                background: file ? "#f0fdf4" : "var(--bg-secondary)",
                transition: "background 150ms"
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.CSV"
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />
              {file ? (
                <>
                  <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{file.name}</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                    {(file.size / 1024).toFixed(1)} KB — Click or drop to replace
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--text-secondary)" }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Drop your Cheqroom CSV here</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                    or click to browse — supports semicolon and comma delimited CSV
                  </div>
                </>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button
                className="btn btn-primary"
                disabled={!file || loading}
                onClick={handlePreview}
              >
                {loading ? "Parsing..." : "Preview import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview step ── */}
      {step === "preview" && preview && (
        <>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
            <SummaryCard label="Total items" value={preview.summary.totalItems} />
            <SummaryCard label="With errors" value={preview.summary.withErrors} warn={preview.summary.withErrors > 0} />
            <SummaryCard label="With warnings" value={preview.summary.withWarnings} warn={preview.summary.withWarnings > 0} />
            <SummaryCard label="Duplicate names" value={preview.summary.duplicateNames} />
            <SummaryCard label="Consumable" value={preview.summary.consumableItems} />
            <SummaryCard label="Retired" value={preview.summary.retiredItems} />
          </div>

          {/* New entities to create */}
          {(preview.summary.newLocations.length > 0 || preview.summary.newDepartments.length > 0 || preview.summary.kits.length > 0) && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header"><h2>Will be auto-created</h2></div>
              <div style={{ padding: 16, display: "flex", flexWrap: "wrap", gap: 16 }}>
                {preview.summary.newLocations.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>New Locations</div>
                    {preview.summary.newLocations.map((l) => (
                      <span key={l} className="badge badge-blue" style={{ marginRight: 4, marginBottom: 4 }}>{l}</span>
                    ))}
                  </div>
                )}
                {preview.summary.newDepartments.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>New Departments</div>
                    {preview.summary.newDepartments.map((d) => (
                      <span key={d} className="badge badge-purple" style={{ marginRight: 4, marginBottom: 4 }}>{d}</span>
                    ))}
                  </div>
                )}
                {preview.summary.kits.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Kits</div>
                    {preview.summary.kits.map((k) => (
                      <span key={k} className="badge badge-orange" style={{ marginRight: 4, marginBottom: 4 }}>{k}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preview table */}
          <div className="card">
            <div className="card-header">
              <h2>Preview ({preview.rows.length}{preview.totalRows > 200 ? ` of ${preview.totalRows}` : ""} rows)</h2>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Asset Tag</th>
                    <th>Brand</th>
                    <th>Model</th>
                    <th>Type</th>
                    <th>Serial</th>
                    <th>Location</th>
                    <th>Department</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.line} style={row.errors.length > 0 ? { background: "#fef2f2" } : row.warnings.length > 0 ? { background: "#fffbeb" } : {}}>
                      <td style={{ fontSize: 11, color: "var(--text-secondary)" }}>{row.line}</td>
                      <td style={{ fontWeight: 600 }}>
                        {row.assetTag}
                        {row.assetTagDeduped && <span className="badge badge-orange" style={{ marginLeft: 4, fontSize: 10 }}>renamed</span>}
                      </td>
                      <td>{row.brand}</td>
                      <td>{row.model}</td>
                      <td>{row.type}</td>
                      <td style={{ fontFamily: "monospace", fontSize: 11 }}>{row.serialNumber}</td>
                      <td>{row.locationName}</td>
                      <td>{row.departmentName}</td>
                      <td>
                        {row.errors.length > 0 ? (
                          <span className="badge badge-red" title={row.errors.join(", ")}>error</span>
                        ) : row.retired ? (
                          <span className="badge badge-gray">retired</span>
                        ) : (
                          <span className="badge badge-green">ok</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button className="btn" onClick={resetWizard}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={preview.summary.withErrors === preview.summary.totalItems}
              onClick={handleImport}
            >
              Import {preview.summary.totalItems - preview.summary.withErrors} items
            </button>
          </div>
        </>
      )}

      {/* ── Importing step ── */}
      {step === "importing" && (
        <div className="card">
          <div style={{ padding: 48, textAlign: "center" }}>
            <div className="loading-spinner" style={{ position: "static" }}>
              <div className="spinner" />
            </div>
            <div style={{ marginTop: 16, fontWeight: 600 }}>Importing items...</div>
            <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              Creating locations, departments, kits, and assets
            </div>
          </div>
        </div>
      )}

      {/* ── Summary step ── */}
      {step === "summary" && result && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
            <SummaryCard label="Created" value={result.created} color="#22c55e" />
            <SummaryCard label="Updated" value={result.updated} color="#3b82f6" />
            <SummaryCard label="Skipped" value={result.skipped} warn={result.skipped > 0} />
            <SummaryCard label="Kits created" value={result.kitsCreated} color="#8b5cf6" />
          </div>

          {result.errors.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <h2>Errors ({result.errors.length})</h2>
                <button className="btn btn-sm" onClick={handleDownloadErrors}>
                  Download error CSV
                </button>
              </div>
              <div style={{ overflowX: "auto", maxHeight: 300 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Line</th>
                      <th>Asset Tag</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.slice(0, 50).map((e, i) => (
                      <tr key={i}>
                        <td>{e.line}</td>
                        <td style={{ fontWeight: 600 }}>{e.assetTag}</td>
                        <td style={{ fontSize: 12, color: "#991b1b" }}>{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card">
            <div style={{ padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>
                {result.created + result.updated > 0 ? "Import complete" : "No items imported"}
              </div>
              <div style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
                {result.created} created, {result.updated} updated, {result.skipped} skipped
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button className="btn" onClick={resetWizard}>Import another file</button>
                <a href="/items" className="btn btn-primary" style={{ textDecoration: "none" }}>View items</a>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function SummaryCard({
  label,
  value,
  warn,
  color
}: {
  label: string;
  value: number;
  warn?: boolean;
  color?: string;
}) {
  return (
    <div className="card" style={{ padding: 16, textAlign: "center" }}>
      <div style={{
        fontSize: 28,
        fontWeight: 700,
        color: warn ? "var(--red)" : color || "var(--text-primary)"
      }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
    </div>
  );
}
