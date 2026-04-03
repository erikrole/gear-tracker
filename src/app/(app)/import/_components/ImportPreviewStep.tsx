"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { PreviewData } from "../_types";
import { VARIANT_COLORS } from "../_types";

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

interface ImportPreviewStepProps {
  preview: PreviewData;
  importMode: "upsert" | "create_only";
  isImporting: boolean;
  onImportModeChange: (mode: "upsert" | "create_only") => void;
  onConfirmImport: () => void;
  onBackToMapping: () => void;
  onCancel: () => void;
}

export function ImportPreviewStep({
  preview,
  importMode,
  isImporting,
  onImportModeChange,
  onConfirmImport,
  onBackToMapping,
  onCancel,
}: ImportPreviewStepProps) {
  if (isImporting) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="flex items-center justify-center py-10">
            <Spinner className="size-8" />
          </div>
          <div className="mt-4 font-semibold">Importing items...</div>
          <div className="text-muted-foreground text-sm">
            <span>
              Processing {importMode === "create_only" ? preview.summary.willCreate : preview.summary.totalItems - preview.summary.withErrors} items
              {importMode === "create_only" ? " (create only)" : ` (${preview.summary.willCreate} new, ${preview.summary.willUpdate} updates)`}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
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

      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Mode:</span>
          <Select value={importMode} onValueChange={(v) => onImportModeChange(v as "upsert" | "create_only")}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="upsert">Create &amp; update</SelectItem>
              <SelectItem value="create_only">Create only (skip existing)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
        <Button variant="outline" onClick={onBackToMapping}>Back to mapping</Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          disabled={preview.summary.withErrors === preview.summary.totalItems}
          onClick={onConfirmImport}
        >
          Import {importMode === "create_only" ? preview.summary.willCreate : preview.summary.totalItems - preview.summary.withErrors} items
        </Button>
        </div>
      </div>
    </>
  );
}
