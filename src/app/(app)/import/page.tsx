"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UploadIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  { value: "__skip__", label: "\u2014 Skip \u2014" },
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

const STEP_LABELS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "mapping", label: "Map columns" },
  { key: "preview", label: "Preview" },
  { key: "importing", label: "Import" },
  { key: "summary", label: "Summary" },
];

/* ───── Component ───── */

export default function ImportPage() {
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
      if (field && field !== "__skip__") next[header] = field;
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
        toast.error(json.error || "Failed to parse CSV");
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
        toast.error(json.error || "Import failed");
        setStep("preview");
        return;
      }

      setResult(json);
      setStep("summary");
      toast.success(`Imported ${json.created} items successfully`);
    } catch {
      setError("Import failed unexpectedly");
      toast.error("Import failed unexpectedly");
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

  return (
    <>
      <div className="flex items-center justify-between mb-4 gap-3">
        <h1 className="text-2xl tracking-tight">Import Items</h1>
        {step !== "upload" && step !== "importing" && (
          <Button variant="outline" onClick={resetWizard}>Start over</Button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {STEP_LABELS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            {i > 0 && <div className="w-6 h-px bg-border" />}
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm ${
                step === s.key
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <span>{i + 1}</span>
              <span>{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 text-destructive px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* ── Upload step ── */}
      {step === "upload" && (
        <Card>
          <CardHeader><CardTitle>Upload CSV file</CardTitle></CardHeader>
          <CardContent>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl py-12 px-6 text-center cursor-pointer transition-colors ${
                file
                  ? "border-green-500/50 bg-green-50 dark:bg-green-950/20"
                  : "border-border bg-muted/50 hover:bg-muted"
              }`}
            >
              <input
                ref={fileRef} type="file" accept=".csv,.CSV"
                onChange={handleFileSelect} className="hidden"
              />
              {file ? (
                <>
                  <div className="text-xl font-semibold mb-1">{file.name}</div>
                  <div className="text-muted-foreground text-sm">
                    {(file.size / 1024).toFixed(1)} KB — Click or drop to replace
                  </div>
                </>
              ) : (
                <>
                  <UploadIcon className="size-12 text-muted-foreground mx-auto mb-2" />
                  <div className="font-semibold mb-1">Drop your CSV here</div>
                  <div className="text-muted-foreground text-sm">
                    Supports semicolon and comma delimited CSV
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end mt-4">
              <Button
                disabled={!file || loading}
                onClick={handleParseHeaders}
              >
                {loading ? "Reading..." : "Next: Map columns"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Column mapping step ── */}
      {step === "mapping" && csvHeaders.length > 0 && (
        <>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Map CSV columns to fields</CardTitle>
              <span className="text-muted-foreground text-sm">
                {Object.values(mapping).filter(Boolean).length} of {csvHeaders.length} columns mapped
              </span>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CSV Column</TableHead>
                    <TableHead>Sample Data</TableHead>
                    <TableHead>Maps To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvHeaders.map((header, colIdx) => (
                    <TableRow key={header}>
                      <TableCell className="font-semibold">{header}</TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono max-w-[200px] truncate">
                        {csvSample[0]?.[colIdx] || "—"}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={mapping[header] || "__skip__"}
                          onValueChange={(v) => updateMapping(header, v)}
                        >
                          <SelectTrigger className="min-w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <div className="flex justify-end gap-2">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <SummaryCard label="Total items" value={preview.summary.totalItems} />
            <SummaryCard label="Will create" value={preview.summary.willCreate} variant="green" />
            <SummaryCard label="Will update" value={preview.summary.willUpdate} variant="blue" />
            <SummaryCard label="With errors" value={preview.summary.withErrors} variant={preview.summary.withErrors > 0 ? "red" : undefined} />
            <SummaryCard label="Duplicate names" value={preview.summary.duplicateNames} />
            <SummaryCard label="Retired" value={preview.summary.retiredItems} />
          </div>

          {/* New entities to create */}
          {(preview.summary.newLocations.length > 0 || preview.summary.newDepartments.length > 0 || preview.summary.kits.length > 0) && (
            <Card className="mb-4">
              <CardHeader><CardTitle>Will be auto-created</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-4">
                {preview.summary.newLocations.length > 0 && (
                  <div>
                    <div className="font-semibold text-sm mb-1">New Locations</div>
                    {preview.summary.newLocations.map((l) => (
                      <Badge key={l} variant="blue" className="mr-1 mb-1">{l}</Badge>
                    ))}
                  </div>
                )}
                {preview.summary.newDepartments.length > 0 && (
                  <div>
                    <div className="font-semibold text-sm mb-1">New Departments</div>
                    {preview.summary.newDepartments.map((d) => (
                      <Badge key={d} variant="purple" className="mr-1 mb-1">{d}</Badge>
                    ))}
                  </div>
                )}
                {preview.summary.kits.length > 0 && (
                  <div>
                    <div className="font-semibold text-sm mb-1">Kits</div>
                    {preview.summary.kits.map((k) => (
                      <Badge key={k} variant="orange" className="mr-1 mb-1">{k}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Preview table */}
          <Card>
            <CardHeader>
              <CardTitle>Preview ({preview.rows.length}{preview.totalRows > 200 ? ` of ${preview.totalRows}` : ""} rows)</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Asset Tag</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row) => (
                    <TableRow
                      key={row.line}
                      className={
                        row.errors.length > 0
                          ? "bg-destructive/10 dark:bg-destructive/20"
                          : row.warnings.length > 0
                          ? "bg-amber-50 dark:bg-amber-950/20"
                          : ""
                      }
                    >
                      <TableCell className="text-xs text-muted-foreground">{row.line}</TableCell>
                      <TableCell>
                        {row.action === "create" ? (
                          <Badge variant="green">new</Badge>
                        ) : row.action === "update" ? (
                          <Badge variant="blue">update</Badge>
                        ) : (
                          <Badge variant="red">skip</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {row.assetTag}
                        {row.assetTagDeduped && <Badge variant="orange" size="sm" className="ml-1">renamed</Badge>}
                      </TableCell>
                      <TableCell>{row.brand}</TableCell>
                      <TableCell>{row.model}</TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell className="font-mono text-xs">{row.serialNumber}</TableCell>
                      <TableCell>{row.locationName}</TableCell>
                      <TableCell>
                        {row.errors.length > 0 ? (
                          <Badge variant="red" title={row.errors.join(", ")}>error</Badge>
                        ) : row.retired ? (
                          <Badge variant="gray">retired</Badge>
                        ) : (
                          <Badge variant="green">ok</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <div className="flex justify-end gap-2 mt-4">
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
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex items-center justify-center py-10">
              <Spinner className="size-8" />
            </div>
            <div className="mt-4 font-semibold">Importing items...</div>
            <div className="text-muted-foreground text-sm">
              Creating locations, departments, kits, and assets
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Summary step ── */}
      {step === "summary" && result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <SummaryCard label="Created" value={result.created} variant="green" />
            <SummaryCard label="Updated" value={result.updated} variant="blue" />
            <SummaryCard label="Skipped" value={result.skipped} variant={result.skipped > 0 ? "red" : undefined} />
            <SummaryCard label="Kits created" value={result.kitsCreated} variant="purple" />
          </div>

          {result.errors.length > 0 && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Errors ({result.errors.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={handleDownloadErrors}>
                  Download error CSV
                </Button>
              </CardHeader>
              <div className="overflow-x-auto max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Line</TableHead>
                      <TableHead>Asset Tag</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.errors.slice(0, 50).map((e, i) => (
                      <TableRow key={i}>
                        <TableCell>{e.line}</TableCell>
                        <TableCell className="font-semibold">{e.assetTag}</TableCell>
                        <TableCell className="text-sm text-destructive">{e.error}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          <Card>
            <CardContent className="py-8 text-center">
              <div className="text-2xl font-bold mb-2">
                {result.created + result.updated > 0 ? "Import complete" : "No items imported"}
              </div>
              <div className="text-muted-foreground mb-4">
                {result.created} created, {result.updated} updated, {result.skipped} skipped
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={resetWizard}>Import another file</Button>
                <Button asChild><Link href="/items">View items</Link></Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

const VARIANT_COLORS: Record<string, string> = {
  green: "text-green-600 dark:text-green-400",
  blue: "text-blue-600 dark:text-blue-400",
  red: "text-destructive",
  purple: "text-purple-600 dark:text-purple-400",
};

function SummaryCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant?: string;
}) {
  return (
    <Card className="p-4 text-center">
      <div className={`text-3xl font-bold ${variant ? VARIANT_COLORS[variant] || "" : "text-foreground"}`}>
        {value}
      </div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </Card>
  );
}
