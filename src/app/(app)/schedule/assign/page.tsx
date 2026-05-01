"use client";

import { useEffect, useState } from "react";
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
import { AssignmentGrid } from "./_components/AssignmentGrid";
import type { PickerUser } from "@/components/shift-detail/UserAvatarPicker";
import { SPORT_CODES } from "@/lib/sports";
import { AREAS, AREA_LABELS } from "@/types/areas";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // Gate: redirect non-staff
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((j) => {
        const role: string = j?.user?.role ?? "STUDENT";
        setCurrentUserRole(role);
        if (role !== "STAFF" && role !== "ADMIN") {
          router.replace("/schedule");
        }
      })
      .catch(() => router.replace("/schedule"));
  }, [router]);

  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ["users-picker"],
    queryFn: fetchUsers,
    staleTime: 5 * 60_000,
  });

  const isStaff = currentUserRole === "STAFF" || currentUserRole === "ADMIN";

  const monthLabel = grid.month.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function prevMonth() {
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
  if (currentUserRole === null) return null;

  return (
    <FadeUp>
      <PageHeader title="Assign Shifts">
        <Button variant="ghost" size="sm" onClick={() => router.push("/schedule")}>
          ← Schedule
        </Button>
      </PageHeader>

      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Month nav */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={prevMonth} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" className="min-w-[9rem] font-medium" onClick={thisMonth}>
            {monthLabel}
          </Button>
          <Button variant="outline" size="icon-sm" onClick={nextMonth} aria-label="Next month">
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Sport filter */}
        <Select value={grid.sportFilter || "_all"} onValueChange={(v) => grid.setSportFilter(v === "_all" ? "" : v)}>
          <SelectTrigger className="h-8 w-44 text-sm">
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
          <SelectTrigger className="h-8 w-36 text-sm">
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

        {/* Loading / count badge */}
        {grid.loading ? (
          <Badge variant="outline" className="text-muted-foreground">Loading…</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            {grid.events.length} event{grid.events.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Error state */}
      {grid.error && (
        <div className="text-sm text-destructive mb-4">
          {grid.error === "network"
            ? "You're offline — schedule data unavailable."
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
      />
    </FadeUp>
  );
}
