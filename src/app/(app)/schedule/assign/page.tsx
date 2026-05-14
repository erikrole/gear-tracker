"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { FadeUp } from "@/components/ui/motion";
import { useAssignmentGrid } from "@/hooks/use-assignment-grid";
import { useCurrentUser } from "@/hooks/use-current-user";
import { AssignmentGrid } from "./_components/AssignmentGrid";
import type { PickerUser } from "@/components/shift-detail/UserAvatarPicker";
import { SPORT_CODES } from "@/lib/sports";
import { AREAS, AREA_LABELS } from "@/types/areas";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, FilterIcon } from "lucide-react";

async function fetchUsers(): Promise<PickerUser[]> {
  const res = await fetch("/api/users?limit=200&active=true");
  if (!res.ok) return [];
  const j = await res.json();
  return (j.data ?? []).map((u: { id: string; name: string; role: string; primaryArea: string | null; avatarUrl?: string | null }) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    primaryArea: u.primaryArea,
    avatarUrl: u.avatarUrl,
  }));
}

export default function AssignPage() {
  const router = useRouter();
  const grid = useAssignmentGrid();
  const { data: currentUser, isLoading: currentUserLoading } = useCurrentUser();
  const currentUserRole = currentUser?.role ?? null;

  useEffect(() => {
    if (!currentUserLoading && currentUserRole !== "STAFF" && currentUserRole !== "ADMIN") {
      router.replace("/schedule");
    }
  }, [currentUserLoading, currentUserRole, router]);

  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ["users-picker"],
    queryFn: fetchUsers,
    staleTime: 5 * 60_000,
  });

  const isStaff = currentUserRole === "STAFF" || currentUserRole === "ADMIN";

  const monthLabel = grid.month.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);
  const previousMonthDisabled = grid.month <= currentMonthStart;

  function prevMonth() {
    if (previousMonthDisabled) return;
    const d = grid.month;
    grid.setMonth(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    const d = grid.month;
    grid.setMonth(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }
  function thisMonth() {
    const d = new Date();
    grid.setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  // Loading state while verifying role
  if (currentUserLoading || currentUserRole === null) return null;

  return (
    <FadeUp>
      <PageHeader title="Assign shifts">
        <Button variant="outline" size="sm" onClick={() => router.push("/schedule")}>
          <ChevronLeft className="size-4" />
          Schedule
        </Button>
      </PageHeader>

      {/* Controls bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/80 p-2 shadow-sm">
        {/* Month nav */}
        <div className="flex min-h-10 items-center overflow-hidden rounded-md border border-border bg-muted/30">
          <Button
            variant="outline"
            size="icon"
            className="size-10"
            onClick={prevMonth}
            disabled={previousMonthDisabled}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            className="h-10 min-w-[9rem] rounded-none border-x border-border bg-background/70 font-medium hover:bg-background"
            onClick={thisMonth}
          >
            {monthLabel}
          </Button>
          <Button variant="outline" size="icon" className="size-10" onClick={nextMonth} aria-label="Next month">
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="mx-0.5 h-6 w-px bg-border/80 max-sm:hidden" />

        {/* Sport filter */}
        <Select value={grid.sportFilter || "_all"} onValueChange={(v) => grid.setSportFilter(v === "_all" ? "" : v)}>
          <SelectTrigger size="sm" className="h-10 w-44 bg-muted/30">
            <SelectValue placeholder="All sports" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All sports</SelectItem>
            {SPORT_CODES.map((s) => (
              <SelectItem key={s.code} value={s.code}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Area filter */}
        <Select value={grid.areaFilter || "_all"} onValueChange={(v) => grid.setAreaFilter(v === "_all" ? "" : v)}>
          <SelectTrigger size="sm" className="h-10 w-36 bg-muted/30">
            <SelectValue placeholder="All areas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All areas</SelectItem>
            {AREAS.map((a) => (
              <SelectItem key={a} value={a}>
                {AREA_LABELS[a]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {grid.sportFilter || grid.areaFilter ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-10 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              grid.setSportFilter("");
              grid.setAreaFilter("");
            }}
          >
            <FilterIcon className="size-3.5" />
            Clear
          </Button>
        ) : null}

        {/* Loading / count badge */}
        {grid.loading ? (
          <Badge variant="outline" className="ml-auto text-muted-foreground">Loading...</Badge>
        ) : (
          <Badge
            variant="outline"
            className={cn(
              "ml-auto text-muted-foreground",
              grid.events.length > 0 && "tabular-nums",
            )}
          >
            {grid.events.length} event{grid.events.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Error state */}
      {grid.error && (
        <div className="text-sm text-destructive mb-4">
          {grid.error === "network"
            ? "You're offline - schedule data unavailable."
            : "Failed to load schedule. Try refreshing."}
        </div>
      )}

      {/* Grid */}
      <AssignmentGrid
        events={grid.events}
        columns={grid.columns}
        allUsers={allUsers}
        usersLoading={usersLoading}
        isStaff={isStaff}
        onRefetch={grid.refetch}
        hasFilters={Boolean(grid.sportFilter || grid.areaFilter)}
        onClearFilters={() => {
          grid.setSportFilter("");
          grid.setAreaFilter("");
        }}
      />
    </FadeUp>
  );
}
