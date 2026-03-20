"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";

/* ───── Types ───── */

type ColumnMapping = Record<string, string>;

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
  action?: string;
};

type PreviewSummary = {
  totalItems: number;
  willCreate: number;
  willUpdate: number;
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
  mapping: ColumnMapping;
  summary: PreviewSummary;
};

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  kitsCreated: number;
  errors: Array<{ line: number; assetTag: string; error: string }>;
};

type Step = "upload" | "mapping" | "preview" | "importing" | "summary";

/* ───── Field definitions for column mapping ───── */

const FIELD_OPTIONS = [
  { value: "", label: "— Skip —" },
  { value: "assetTag", label: "Asset Tag / Name" },
  { value: "type", label: "Category / Type" },
  { value: "brand", label: "Brand" },
  { value: "model", label: "Model" },
  { value: "serialNumber", label: "Serial Number" },
  { value: "locationName", label: "Location" },
  { value: "department", label: "Department" },
  { value: "kitName", label: "Kit" },
  { value: "purchaseDate", label: "Purchase Date" },
  { value: "purchasePrice", label: "Purchase Price" },
  { value: "warrantyDate", label: "Warranty Date" },
  { value: "residualValue", label: "Residual Value" },
  { value: "imageUrl", label: "Image URL" },
  { value: "uwAssetTag", label: "UW Asset Tag" },
  { value: "codes", label: "Codes" },
  { value: "barcodes", label: "Barcodes" },
  { value: "sourceId", label: "Source ID" },
  { value: "retired", label: "Retired" },
  { value: "link", label: "Link / URL" },
  { value: "description", label: "Description" },
  { value: "owner", label: "Owner" },
  { value: "fiscalYear", label: "Fiscal Year" },
  { value: "kind", label: "Kind (Individual/Bulk)" },
  { value: "quantity", label: "Quantity" },
];

/* ───── Component ───── */

export default function ImportPage() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvSample, setCsvSample] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load saved mapping from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("import-column-mapping");
      if (saved) setMapping(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

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

  /** Parse CSV headers client-side to show mapping step */
  async function handleParseHeaders() {
    if (!file) return;
    setLoading(true);
    setError("");

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        setError("CSV must include a header and at least one data row");
        setLoading(false);
        return;
      }

      const delimiter = lines[0].includes(";") ? ";" : ",";
      const headers = parseLine(lines[0], delimiter);
      setCsvHeaders(headers);

      // Parse first 3 data rows as sample
      const samples: string[][] = [];
      for (let i = 1; i < Math.min(4, lines.length); i++) {
        samples.push(parseLine(lines[i], delimiter));
      }
      setCsvSample(samples);

      // Auto-detect mapping (Cheqroom preset), but preserve any saved user overrides
      const autoMapping: ColumnMapping = {};
      const CHEQROOM_PRESET: Record<string, string> = {
        "Name": "assetTag", "Category": "type", "Brand": "brand", "Model": "model",
        "Serial number": "serialNumber", "Quantity": "quantity", "Kind": "kind",
        "Warranty Date": "warrantyDate", "Purchase Price": "purchasePrice",
        "Purchase Date": "purchaseDate", "Residual Value": "residualValue",
        "Location": "locationName", "Department": "department", "Kit": "kitName",
        "Image Url": "imageUrl", "UW Asset Tag": "uwAssetTag", "Codes": "codes",
        "Barcodes": "barcodes", "Id": "sourceId", "Retired": "retired",
        "Link": "link", "Description": "description", "Owner": "owner",
        "Fiscal Year Purchased": "fiscalYear",
      };

      for (const header of headers) {
        // Use saved mapping if available, otherwise auto-detect
        if (mapping[header]) {
          autoMapping[header] = mapping[header];
        } else if (CHEQROOM_PRESET[header]) {
          autoMapping[header] = CHEQROOM_PRESET[header];
        }
      }

      setMapping(autoMapping);
      setStep("mapping");
    } catch {
      setError("Failed to parse CSV headers");
    }
    setLoading(false);
  }

  /** Simple CSV line parser (client-side, for headers + sample only) */
  function parseLine(line: string, delimiter: string): string[] {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
        continue;
      }
      if (ch === delimiter && !inQuotes) { cells.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    cells.push(current.trim());
    return cells;
  }

  function updateMapping(header: string, field: string) {
    setMapping((prev) => {
      const next = { ...prev };
      if (field) next[header] = field;
      else delete next[header];
      return next;
    });
  }

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    setError("");

    // Save mapping for next time
    try { localStorage.setItem("import-column-mapping", JSON.stringify(mapping)); } catch { /* ignore */ }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(mapping));

      const res = await fetch("/api/assets/import?mode=preview", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Failed to parse CSV");
        toast(json.error || "Failed to parse CSV", "error");
        setLoading(false);
        return;
      }

      setPreview(json);
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
      formData.append("mapping", JSON.stringify(mapping));

      const res = await fetch("/api/assets/import?mode=import", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Import failed");
        toast(json.error || "Import failed", "error");
        setStep("preview");
        return;
      }

      setResult(json);
      setStep("summary");
      toast(`Imported ${json.created} items successfully`, "success");
    } catch {
      setError("Import failed unexpectedly");
      toast("Import failed unexpectedly", "error");
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
    setCsvHeaders([]);
    setCsvSample([]);
    setPreview(null);
    setResult(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const stepLabels: Step[] = ["upload", "mapping", "preview", "importing", "summary"];

  return (
    <>
      <div className="page-header">
        <h1>Import Items</h1>
        {step !== "upload" && step !== "importing" && (
          <Button variant="outline" onClick={resetWizard}>Start over</Button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex gap-8 mb-24">
        {stepLabels.map((s, i) => (
          <div key={s} className="flex-center gap-8">
            {i > 0 && <div style={{ width: 24, height: 1, background: "var(--border)" }} />}
            <div
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 12px", borderRadius: 16, fontSize: "var(--text-sm)",
                fontWeight: step === s ? 600 : 400,
                background: step === s ? "var(--blue)" : "var(--bg-secondary)",
                color: step === s ? "white" : "var(--text-secondary)",
              }}
            >
              <span>{i + 1}</span>
              <span style={{ textTransform: "capitalize" }}>
                {s === "importing" ? "Import" : s === "mapping" ? "Map columns" : s}
              </span>
            </div>
          </div>
        ))}
      </div>

      {error && <div className="alert-error">{error}</div>}

      {/* ── Upload step ── */}
      {step === "upload" && (
        <div className="card">
          <div className="card-header"><h2>Upload CSV file</h2></div>
          <div className="p-24">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              style={{
                border: "2px dashed var(--border)", borderRadius: 12,
                padding: "48px 24px", textAlign: "center", cursor: "pointer",
                background: file ? "var(--green-bg)" : "var(--bg-secondary)",
                transition: "background 150ms",
              }}
            >
              <input
                ref={fileRef} type="file" accept=".csv,.CSV"
                onChange={handleFileSelect} className="hidden"
              />
              {file ? (
                <>
                  <div className="text-xl font-semibold mb-4">{file.name}</div>
                  <div className="text-secondary text-sm">
                    {(file.size / 1024).toFixed(1)} KB — Click or drop to replace
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: "var(--text-4xl)", marginBottom: 8 }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-secondary">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div className="font-semibold mb-4">Drop your CSV here</div>
                  <div className="text-secondary text-sm">
                    Supports semicolon and comma delimited CSV
                  </div>
                </>
              )}
            </div>

            <div className="flex-end mt-16">
              <Button
                disabled={!file || loading}
                onClick={handleParseHeaders}
              >
                {loading ? "Reading..." : "Next: Map columns"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Column mapping step ── */}
      {step === "mapping" && csvHeaders.length > 0 && (
        <>
          <div className="card mb-16">
            <div className="card-header">
              <h2>Map CSV columns to fields</h2>
              <span className="text-secondary text-sm">
                {Object.values(mapping).filter(Boolean).length} of {csvHeaders.length} columns mapped
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>CSV Column</th>
                    <th>Sample Data</th>
                    <th>Maps To</th>
                  </tr>
                </thead>
                <tbody>
                  {csvHeaders.map((header, colIdx) => (
                    <tr key={header}>
                      <td className="font-semibold">{header}</td>
                      <td className="text-sm text-secondary font-mono" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {csvSample[0]?.[colIdx] || "—"}
                      </td>
                      <td>
                        <select
                          value={mapping[header] || ""}
                          onChange={(e) => updateMapping(header, e.target.value)}
                          className="input"
                          style={{ minWidth: 180 }}
                        >
                          {FIELD_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex-end gap-8">
            <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
            <Button
              disabled={!mapping["Name"] && !Object.values(mapping).includes("assetTag")}
              onClick={handlePreview}
            >
              {loading ? "Processing..." : "Preview import"}
            </Button>
          </div>
        </>
      )}

      {/* ── Preview step ── */}
      {step === "preview" && preview && (
        <>
          {/* Summary cards */}
          <div className="summary-grid mb-16">
            <SummaryCard label="Total items" value={preview.summary.totalItems} />
            <SummaryCard label="Will create" value={preview.summary.willCreate} color="var(--green)" />
            <SummaryCard label="Will update" value={preview.summary.willUpdate} color="var(--blue)" />
            <SummaryCard label="With errors" value={preview.summary.withErrors} warn={preview.summary.withErrors > 0} />
            <SummaryCard label="Duplicate names" value={preview.summary.duplicateNames} />
            <SummaryCard label="Retired" value={preview.summary.retiredItems} />
          </div>

          {/* New entities to create */}
          {(preview.summary.newLocations.length > 0 || preview.summary.newDepartments.length > 0 || preview.summary.kits.length > 0) && (
            <div className="card mb-16">
              <div className="card-header"><h2>Will be auto-created</h2></div>
              <div className="p-16 flex flex-wrap gap-16">
                {preview.summary.newLocations.length > 0 && (
                  <div>
                    <div className="font-semibold text-sm mb-4">New Locations</div>
                    {preview.summary.newLocations.map((l) => (
                      <span key={l} className="badge badge-blue mr-4 mb-4">{l}</span>
                    ))}
                  </div>
                )}
                {preview.summary.newDepartments.length > 0 && (
                  <div>
                    <div className="font-semibold text-sm mb-4">New Departments</div>
                    {preview.summary.newDepartments.map((d) => (
                      <span key={d} className="badge badge-purple mr-4 mb-4">{d}</span>
                    ))}
                  </div>
                )}
                {preview.summary.kits.length > 0 && (
                  <div>
                    <div className="font-semibold text-sm mb-4">Kits</div>
                    {preview.summary.kits.map((k) => (
                      <span key={k} className="badge badge-orange mr-4 mb-4">{k}</span>
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
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Action</th>
                    <th>Asset Tag</th>
                    <th>Brand</th>
                    <th>Model</th>
                    <th>Type</th>
                    <th>Serial</th>
                    <th>Location</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr
                      key={row.line}
                      style={
                        row.errors.length > 0
                          ? { background: "var(--red-bg)" }
                          : row.warnings.length > 0
                          ? { background: "#fffbeb" }
                          : {}
                      }
                    >
                      <td className="text-xs text-secondary">{row.line}</td>
                      <td>
                        {row.action === "create" ? (
                          <span className="badge badge-green">new</span>
                        ) : row.action === "update" ? (
                          <span className="badge badge-blue">update</span>
                        ) : (
                          <span className="badge badge-red">skip</span>
                        )}
                      </td>
                      <td className="font-semibold">
                        {row.assetTag}
                        {row.assetTagDeduped && <span className="badge badge-orange ml-4" style={{ fontSize: "var(--text-2xs)" }}>renamed</span>}
                      </td>
                      <td>{row.brand}</td>
                      <td>{row.model}</td>
                      <td>{row.type}</td>
                      <td className="font-mono text-xs">{row.serialNumber}</td>
                      <td>{row.locationName}</td>
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

          <div className="flex-end gap-8 mt-16">
            <Button variant="outline" onClick={() => setStep("mapping")}>Back to mapping</Button>
            <Button variant="outline" onClick={resetWizard}>Cancel</Button>
            <Button
              disabled={preview.summary.withErrors === preview.summary.totalItems}
              onClick={handleImport}
            >
              Import {preview.summary.totalItems - preview.summary.withErrors} items
            </Button>
          </div>
        </>
      )}

      {/* ── Importing step ── */}
      {step === "importing" && (
        <div className="card">
          <div className="p-48 text-center">
            <div className="flex items-center justify-center py-10">
              <Spinner className="size-8" />
            </div>
            <div className="mt-16 font-semibold">Importing items...</div>
            <div className="text-secondary text-sm">
              Creating locations, departments, kits, and assets
            </div>
          </div>
        </div>
      )}

      {/* ── Summary step ── */}
      {step === "summary" && result && (
        <>
          <div className="summary-grid mb-16">
            <SummaryCard label="Created" value={result.created} color="var(--green)" />
            <SummaryCard label="Updated" value={result.updated} color="var(--blue)" />
            <SummaryCard label="Skipped" value={result.skipped} warn={result.skipped > 0} />
            <SummaryCard label="Kits created" value={result.kitsCreated} color="var(--purple)" />
          </div>

          {result.errors.length > 0 && (
            <div className="card mb-16">
              <div className="card-header">
                <h2>Errors ({result.errors.length})</h2>
                <Button variant="outline" size="sm" onClick={handleDownloadErrors}>
                  Download error CSV
                </Button>
              </div>
              <div className="overflow-x-auto" style={{ maxHeight: 300 }}>
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
                        <td className="font-semibold">{e.assetTag}</td>
                        <td className="text-sm text-red">{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card">
            <div className="p-24 text-center">
              <div style={{ fontSize: "var(--text-4xl)", marginBottom: 8 }}>
                {result.created + result.updated > 0 ? "Import complete" : "No items imported"}
              </div>
              <div className="text-secondary mb-16">
                {result.created} created, {result.updated} updated, {result.skipped} skipped
              </div>
              <div className="flex gap-8" style={{ justifyContent: "center" }}>
                <Button variant="outline" onClick={resetWizard}>Import another file</Button>
                <Button asChild><a href="/items" className="no-underline">View items</a></Button>
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
  color,
}: {
  label: string;
  value: number;
  warn?: boolean;
  color?: string;
}) {
  return (
    <div className="card p-16 text-center">
      <div className="metric-value" style={{ color: warn ? "var(--red)" : color || "var(--text-primary)" }}>
        {value}
      </div>
      <div className="metric-label">{label}</div>
    </div>
  );
}
