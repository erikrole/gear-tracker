"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { ColumnMapping } from "../_types";
import { FIELD_OPTIONS } from "../_types";

interface ImportMappingStepProps {
  csvHeaders: string[];
  csvSample: string[][];
  mapping: ColumnMapping;
  loading: boolean;
  onUpdateMapping: (header: string, field: string) => void;
  onPreview: () => void;
  onBack: () => void;
}

export function ImportMappingStep({
  csvHeaders,
  csvSample,
  mapping,
  loading,
  onUpdateMapping,
  onPreview,
  onBack,
}: ImportMappingStepProps) {
  return (
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
                      onValueChange={(v) => onUpdateMapping(header, v)}
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
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button
          disabled={!mapping["Name"] && !Object.values(mapping).includes("assetTag")}
          onClick={onPreview}
        >
          {loading ? "Processing..." : "Preview import"}
        </Button>
      </div>
    </>
  );
}
