"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

export function ItemsPagination({
  total,
  page,
  totalPages,
  limit,
  offset,
  selectedCount,
  onPageChange,
  onLimitChange,
}: {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  offset: number;
  selectedCount: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}) {
  const rangeStart = offset + 1;
  const rangeEnd = Math.min(offset + limit, total);

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <div className="flex-1 hidden sm:block">
        {selectedCount > 0
          ? `${selectedCount} of ${total} selected`
          : `Showing ${rangeStart}\u2013${rangeEnd} of ${total} items`}
      </div>
      <div className="flex items-center justify-center gap-1.5 lg:gap-8 w-full sm:w-auto">
        <div className="hidden md:flex items-center gap-2">
          <p className="text-sm">Rows per page</p>
          <Select
            value={String(limit)}
            onValueChange={(v) => onLimitChange(Number(v))}
          >
            <SelectTrigger size="sm" className="w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm">
          Page {page + 1} of {totalPages || 1}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={page === 0}
            onClick={() => onPageChange(0)}
          >
            <ChevronsLeft className="size-4" />
            <span className="sr-only">Go to first page</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={page >= totalPages - 1}
            onClick={() => onPageChange(totalPages - 1)}
          >
            <ChevronsRight className="size-4" />
            <span className="sr-only">Go to last page</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
