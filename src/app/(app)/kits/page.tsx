"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BoxIcon,
  PlusIcon,
  SearchIcon,
  Loader2,
  ArchiveIcon,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import EmptyState from "@/components/EmptyState";
import { useKitsQuery } from "./hooks/use-kits-query";
import { NewKitSheet } from "./new-kit-sheet";

type Location = { id: string; name: string };

export default function KitsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [locationId, setLocationId] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [locations, setLocations] = useState<Location[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = useKitsQuery({
    search: debouncedSearch,
    locationId,
    includeArchived,
    sortBy,
    sortOrder,
  });

  // Load locations for filter + creation sheet
  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((data) => setLocations(Array.isArray(data) ? data : data.data ?? []))
      .catch(() => {});
  }, []);

  const handleCreated = useCallback(
    (kitId: string) => {
      toast.success("Kit created");
      router.push(`/kits/${kitId}`);
    },
    [router]
  );

  function toggleSort(column: string) {
    if (sortBy === column) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder(column === "name" ? "asc" : "desc");
    }
  }

  function SortIcon({ column }: { column: string }) {
    if (sortBy !== column) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground/50" />;
    return sortOrder === "asc"
      ? <ArrowUp className="ml-1 h-3.5 w-3.5" />
      : <ArrowDown className="ml-1 h-3.5 w-3.5" />;
  }

  const hasFilters = !!debouncedSearch || !!locationId || includeArchived;

  // Skeleton loading state
  if (query.loading) {
    return (
      <>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-8">
          <h1>Kits</h1>
        </div>
        <Card className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-8">
        <h1>Kits</h1>
        <Button onClick={() => setSheetOpen(true)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          New Kit
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search kits…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={locationId || "all"} onValueChange={(v) => setLocationId(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {locations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <Checkbox
            checked={includeArchived}
            onCheckedChange={(v) => setIncludeArchived(!!v)}
          />
          <ArchiveIcon className="h-3.5 w-3.5" />
          Show archived
        </label>
        {query.refreshing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Error state */}
      {query.loadError && (
        <Card>
          <EmptyState
            icon="wifi-off"
            title="Failed to load kits"
            description="Check your connection and try again."
            actionLabel="Retry"
            onAction={query.reload}
          />
        </Card>
      )}

      {/* Empty states */}
      {!query.loadError && query.kits.length === 0 && (
        <Card>
          {hasFilters ? (
            <EmptyState
              icon="search"
              title="No kits match your filters"
              description="Try adjusting your search or filters."
            />
          ) : (
            <EmptyState
              icon="box"
              title="No kits yet"
              description="Create your first kit to group gear items for quick checkout."
              actionLabel="Create Kit"
              onAction={() => setSheetOpen(true)}
            />
          )}
        </Card>
      )}

      {/* Table */}
      {!query.loadError && query.kits.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("name")}
                >
                  <span className="flex items-center">Name <SortIcon column="name" /></span>
                </TableHead>
                <TableHead>Location</TableHead>
                <TableHead
                  className="cursor-pointer select-none text-center"
                  onClick={() => toggleSort("memberCount")}
                >
                  <span className="flex items-center justify-center">Items <SortIcon column="memberCount" /></span>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("updatedAt")}
                >
                  <span className="flex items-center">Updated <SortIcon column="updatedAt" /></span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.kits.map((kit) => (
                <TableRow
                  key={kit.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/kits/${kit.id}`)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <BoxIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{kit.name}</span>
                      {!kit.active && (
                        <Badge variant="outline" className="text-xs">Archived</Badge>
                      )}
                    </div>
                    {kit.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 ml-6 line-clamp-1">
                        {kit.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>{kit.location.name}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{kit._count.members}</Badge>
                  </TableCell>
                  <TableCell>
                    {kit._count.members === 0 ? (
                      <Badge variant="outline" className="text-muted-foreground">Empty</Badge>
                    ) : (
                      <Badge variant="default">Ready</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(kit.updatedAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {query.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">
                {query.total} kit{query.total !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={query.page === 0}
                  onClick={() => query.setPage(query.page - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {query.page + 1} of {query.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={query.page >= query.totalPages - 1}
                  onClick={() => query.setPage(query.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <NewKitSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        locations={locations}
        onCreated={handleCreated}
      />
    </>
  );
}
