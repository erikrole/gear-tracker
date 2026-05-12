"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { useUrlState, useDebounce } from "@/hooks/use-url-state";
import { toast } from "sonner";
import {
  ArchiveIcon,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BoxIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
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
import { FadeUp } from "@/components/ui/motion";
import { useFetch } from "@/hooks/use-fetch";
import { type KitRow, useKitsQuery } from "./hooks/use-kits-query";
import { NewKitSheet } from "./new-kit-sheet";

type Location = { id: string; name: string };
type KitSortColumn = "name" | "memberCount" | "updatedAt";

const kitSortColumns: KitSortColumn[] = ["name", "memberCount", "updatedAt"];
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function parseStringParam(value: string | null) {
  return value ?? "";
}

function serializeOptionalString(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseArchivedParam(value: string | null) {
  return value === "true";
}

function serializeArchivedParam(value: boolean) {
  return value ? "true" : null;
}

function parseSortColumn(value: string | null): KitSortColumn {
  return kitSortColumns.includes(value as KitSortColumn)
    ? (value as KitSortColumn)
    : "name";
}

function serializeSortColumn(value: KitSortColumn) {
  return value === "name" ? null : value;
}

function parseSortOrder(value: string | null): "asc" | "desc" {
  return value === "desc" ? "desc" : "asc";
}

function serializeSortOrder(value: "asc" | "desc") {
  return value === "desc" ? "desc" : null;
}

function getKitCounts(kit: KitRow) {
  const serialized = kit._count.members;
  const bulk = kit._count.bulkMembers;
  return { serialized, bulk, total: serialized + bulk };
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatContentDetail(kit: KitRow) {
  const { serialized, bulk, total } = getKitCounts(kit);

  if (total === 0) return "No contents yet";
  if (serialized > 0 && bulk > 0) {
    return `${pluralize(serialized, "asset")} + ${pluralize(bulk, "bulk SKU")}`;
  }
  if (serialized > 0) return pluralize(serialized, "asset");
  return pluralize(bulk, "bulk SKU");
}

function getKitStatus(kit: KitRow) {
  const counts = getKitCounts(kit);
  if (!kit.active) return { label: "Archived", variant: "outline" as const };
  if (counts.total === 0) return { label: "Empty", variant: "outline" as const };
  return { label: "Ready", variant: "default" as const };
}

function KitStatusBadge({ kit }: { kit: KitRow }) {
  const status = getKitStatus(kit);
  return (
    <Badge
      variant={status.variant}
      className={status.label === "Empty" ? "text-muted-foreground" : undefined}
    >
      {status.label}
    </Badge>
  );
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <Card elevation="flat" className="bg-muted/30 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
    </Card>
  );
}

function KitsLoadingState() {
  return (
    <>
      <PageHeader
        title="Kits"
        description="Reusable gear groups for faster checkout and booking setup."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} elevation="flat" className="bg-muted/30 p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-16" />
            <Skeleton className="mt-2 h-4 w-32" />
          </Card>
        ))}
      </div>
      <Card className="mt-4">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(240px,1fr)_220px_auto_auto]">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-24" />
        </CardContent>
      </Card>
      <Card className="mt-4 p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 py-3">
            <Skeleton className="h-10 w-10 rounded-md" />
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </Card>
    </>
  );
}

export default function KitsPage() {
  const [search, setSearch] = useUrlState<string>(
    "q",
    parseStringParam,
    serializeOptionalString,
  );
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [locationId, setLocationId] = useUrlState<string>(
    "location",
    parseStringParam,
    serializeOptionalString,
  );
  const [includeArchived, setIncludeArchived] = useUrlState<boolean>(
    "archived",
    parseArchivedParam,
    serializeArchivedParam,
  );
  const [sortBy, setSortBy] = useUrlState<KitSortColumn>(
    "sort",
    parseSortColumn,
    serializeSortColumn,
  );
  const [sortOrder, setSortOrder] = useUrlState<"asc" | "desc">(
    "order",
    parseSortOrder,
    serializeSortOrder,
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  const query = useKitsQuery({
    search: debouncedSearch,
    locationId,
    includeArchived,
    sortBy,
    sortOrder,
  });

  const { data: locations } = useFetch<Location[]>({
    url: "/api/locations",
    refetchOnFocus: false,
    transform: (json) => (Array.isArray(json) ? json : (json.data as Location[]) ?? []),
  });

  const locationOptions = locations ?? [];

  const handleCreated = useCallback(
    () => {
      toast.success("Kit created");
      query.reload();
    },
    [query.reload],
  );

  function toggleSort(column: KitSortColumn) {
    if (sortBy === column) {
      setSortOrder((order) => (order === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder(column === "name" ? "asc" : "desc");
    }
  }

  function SortButton({
    column,
    children,
    className,
  }: {
    column: KitSortColumn;
    children: ReactNode;
    className?: string;
  }) {
    const active = sortBy === column;
    const Icon = !active ? ArrowUpDown : sortOrder === "asc" ? ArrowUp : ArrowDown;

    return (
      <button
        type="button"
        onClick={() => toggleSort(column)}
        className={[
          "-ml-3 inline-flex h-10 items-center gap-1 rounded-md px-3 text-left font-medium transition-[background-color,color] hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          className,
        ].filter(Boolean).join(" ")}
      >
        {children}
        <Icon className={`size-3.5 ${active ? "" : "text-muted-foreground/60"}`} />
      </button>
    );
  }

  function clearFilters() {
    setSearch("");
    setLocationId("");
    setIncludeArchived(false);
    setSortBy("name");
    setSortOrder("asc");
  }

  const hasResultFilters = !!debouncedSearch || !!locationId || includeArchived;
  const canClearFilters = !!search.trim()
    || !!locationId
    || includeArchived
    || sortBy !== "name"
    || sortOrder !== "asc";
  const firstResult = query.total === 0 ? 0 : query.page * query.limit + 1;
  const lastResult = Math.min(query.total, (query.page + 1) * query.limit);

  if (query.loading) {
    return <KitsLoadingState />;
  }

  return (
    <FadeUp>
      <PageHeader
        title="Kits"
        description="Reusable gear groups for faster checkout and booking setup."
      >
        <Button onClick={() => setSheetOpen(true)} size="lg">
          <PlusIcon className="size-4" />
          New Kit
        </Button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Matching kits"
          value={query.summary.total}
          helper={hasResultFilters ? "Current filters" : "Visible by default"}
        />
        <MetricCard
          label="Active"
          value={query.summary.active}
          helper="Available to checkout flows"
        />
        <MetricCard
          label="Archived"
          value={query.summary.archived}
          helper={includeArchived ? "Included in this view" : "Hidden until shown"}
        />
        <MetricCard
          label="Empty"
          value={query.summary.empty}
          helper="Needs contents before use"
        />
      </div>

      <Card className="mt-4">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(260px,1fr)_220px_auto_auto] md:items-center">
          <div className="relative">
            <label htmlFor="kits-search" className="sr-only">
              Search kits
            </label>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="kits-search"
              name="kits-search"
              type="search"
              placeholder="Search kits and descriptions"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 pl-9"
            />
          </div>

          <div>
            <label htmlFor="kits-location-filter" className="sr-only">
              Filter by location
            </label>
            <Select value={locationId || "all"} onValueChange={(value) => setLocationId(value === "all" ? "" : value)}>
              <SelectTrigger id="kits-location-filter" className="h-10">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locationOptions.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-[background-color,color] hover:bg-accent hover:text-accent-foreground">
            <Checkbox
              checked={includeArchived}
              onCheckedChange={(value) => setIncludeArchived(!!value)}
              aria-label="Show archived kits"
            />
            <ArchiveIcon className="size-4" />
            Show archived
          </label>

          <div className="flex items-center justify-between gap-2 md:justify-end">
            {query.refreshing && (
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner className="size-4" />
                Updating
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={clearFilters}
              disabled={!canClearFilters}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {query.loadError && (
        <Card className="mt-4">
          <EmptyState
            icon="wifi-off"
            title="Failed to load kits"
            description="Check your connection and try again."
            actionLabel="Retry"
            onAction={query.reload}
          />
        </Card>
      )}

      {!query.loadError && query.kits.length === 0 && (
        <Card className="mt-4">
          {hasResultFilters ? (
            <EmptyState
              icon="search"
              title="No kits match your filters"
              description="Clear the filters or broaden your search to see more kit groups."
              actionLabel="Clear filters"
              onAction={clearFilters}
            />
          ) : (
            <EmptyState
              icon="box"
              title="No kits yet"
              description="Create your first kit to group gear for quick checkout."
              actionLabel="Create kit"
              onAction={() => setSheetOpen(true)}
            />
          )}
        </Card>
      )}

      {!query.loadError && query.kits.length > 0 && (
        <Card className="mt-4 overflow-hidden">
          <div className="grid gap-3 p-3 md:hidden">
            {query.kits.map((kit) => {
              const counts = getKitCounts(kit);

              return (
                <Link
                  key={kit.id}
                  href={`/kits/${kit.id}`}
                  className="group rounded-lg border bg-card p-4 shadow-xs transition-[background-color,border-color,box-shadow,scale] hover:border-primary/40 hover:bg-accent/35 hover:shadow-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <BoxIcon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-semibold">{kit.name}</span>
                      </div>
                      {kit.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {kit.description}
                        </p>
                      )}
                    </div>
                    <KitStatusBadge kit={kit} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span className="font-medium tabular-nums text-foreground">
                      {pluralize(counts.total, "content")}
                    </span>
                    <span>{formatContentDetail(kit)}</span>
                    <span>{kit.location.name}</span>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortButton column="name">Name</SortButton>
                  </TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-center">
                    <SortButton column="memberCount" className="mx-auto">
                      Contents
                    </SortButton>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <SortButton column="updatedAt">Updated</SortButton>
                  </TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.kits.map((kit) => {
                  const counts = getKitCounts(kit);

                  return (
                    <TableRow key={kit.id} className="align-top">
                      <TableCell className="min-w-[280px]">
                        <Link
                          href={`/kits/${kit.id}`}
                          className="-ml-2 inline-flex min-h-10 max-w-full items-center gap-2 rounded-md px-2 py-1.5 transition-[background-color,color] hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                          <BoxIcon className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate font-medium">{kit.name}</span>
                        </Link>
                        {kit.description && (
                          <p className="ml-8 mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {kit.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{kit.location.name}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                          <Badge variant="secondary" className="tabular-nums">
                            {counts.total}
                          </Badge>
                          <span className="mt-1 text-xs text-muted-foreground">
                            {formatContentDetail(kit)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <KitStatusBadge kit={kit} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {dateFormatter.format(new Date(kit.updatedAt))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm" className="h-10">
                          <Link href={`/kits/${kit.id}`}>Open</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <Separator />
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-muted-foreground">
              Showing <span className="tabular-nums">{firstResult}</span>-<span className="tabular-nums">{lastResult}</span> of{" "}
              <span className="tabular-nums">{query.total}</span> kits
            </span>
            {query.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10"
                  disabled={query.page === 0}
                  onClick={() => query.setPage(query.page - 1)}
                >
                  Previous
                </Button>
                <span className="min-w-24 text-center text-sm text-muted-foreground">
                  Page <span className="tabular-nums">{query.page + 1}</span> of{" "}
                  <span className="tabular-nums">{query.totalPages}</span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10"
                  disabled={query.page >= query.totalPages - 1}
                  onClick={() => query.setPage(query.page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      <NewKitSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        locations={locationOptions}
        onCreated={handleCreated}
      />
    </FadeUp>
  );
}
