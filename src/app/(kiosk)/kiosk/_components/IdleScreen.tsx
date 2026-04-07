"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Clock, Package, RefreshCw, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AvatarGrid } from "./AvatarGrid";

type KioskUser = { id: string; name: string; avatarUrl: string | null };

type DashboardData = {
  stats: { itemsOut: number; checkouts: number; overdue: number };
  events: Array<{
    id: string;
    title: string;
    sportCode: string;
    startsAt: string;
    shiftCount: number;
  }>;
  checkouts: Array<{
    id: string;
    requesterName: string;
    requesterInitials: string;
    items: Array<{ name: string }>;
    endsAt: string;
    isOverdue: boolean;
  }>;
};

type Props = {
  kioskInfo: { kioskId: string; locationId: string; locationName: string };
  onSelectUser: (user: KioskUser) => void;
};

const REFRESH_INTERVAL_MS = 30_000;

export function IdleScreen({ kioskInfo, onSelectUser }: Props) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [users, setUsers] = useState<KioskUser[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchDashboard = useCallback(async (showLoading = false) => {
    if (showLoading) setDashboardLoading(true);
    setDashboardError(null);
    try {
      const res = await fetch("/api/kiosk/dashboard");
      if (!res.ok) throw new Error(`Dashboard fetch failed (${res.status})`);
      const data: DashboardData = await res.json();
      setDashboard(data);
    } catch (err) {
      setDashboardError(
        err instanceof Error ? err.message : "Failed to load dashboard"
      );
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await fetch("/api/kiosk/users");
      if (!res.ok) throw new Error(`Users fetch failed (${res.status})`);
      const json: { data: KioskUser[] } = await res.json();
      setUsers(json.data);
    } catch (err) {
      setUsersError(
        err instanceof Error ? err.message : "Failed to load users"
      );
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchDashboard(true);
    fetchUsers();
  }, [fetchDashboard, fetchUsers]);

  // Auto-refresh dashboard every 30s
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchDashboard(false);
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchDashboard]);

  function formatTime(isoString: string): string {
    return new Date(isoString).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function summarizeItems(items: Array<{ name: string }>): string {
    if (items.length === 0) return "No items";
    if (items.length === 1) return items[0].name;
    return `${items[0].name} +${items.length - 1} more`;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Left column */}
      <div className="flex w-[55%] flex-col gap-4 overflow-y-auto border-r p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gear Tracker</h1>
          <p className="text-sm text-muted-foreground">
            {kioskInfo.locationName}
          </p>
        </div>

        {/* Dashboard error state */}
        {dashboardError && (
          <Card elevation="flat" className="border-destructive/50">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertCircle className="size-5 shrink-0 text-destructive" />
              <span className="flex-1 text-sm text-destructive">
                {dashboardError}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchDashboard(true)}
              >
                <RefreshCw className="mr-1.5 size-3.5" />
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Dashboard loading */}
        {dashboardLoading && !dashboard && (
          <div className="flex flex-1 items-center justify-center">
            <Spinner className="size-8" />
          </div>
        )}

        {/* Dashboard content */}
        {dashboard && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <Card elevation="flat">
                <CardContent className="flex flex-col items-center p-4">
                  <Package className="mb-1 size-5 text-muted-foreground" />
                  <span className="text-3xl font-bold">
                    {dashboard.stats.itemsOut}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Items Out
                  </span>
                </CardContent>
              </Card>
              <Card elevation="flat">
                <CardContent className="flex flex-col items-center p-4">
                  <Users className="mb-1 size-5 text-muted-foreground" />
                  <span className="text-3xl font-bold">
                    {dashboard.stats.checkouts}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Active Checkouts
                  </span>
                </CardContent>
              </Card>
              <Card elevation="flat">
                <CardContent className="flex flex-col items-center p-4">
                  <AlertCircle className="mb-1 size-5 text-destructive" />
                  <span className="text-3xl font-bold text-destructive">
                    {dashboard.stats.overdue}
                  </span>
                  <span className="text-xs text-muted-foreground">Overdue</span>
                </CardContent>
              </Card>
            </div>

            {/* Today's Schedule */}
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Today&apos;s Schedule
              </h2>
              {dashboard.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No events scheduled today
                </p>
              ) : (
                <div className="space-y-1.5">
                  {dashboard.events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="sport" size="sm">
                          {event.sportCode}
                        </Badge>
                        <span className="text-sm font-medium">
                          {event.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {formatTime(event.startsAt)}
                        </span>
                        <span>
                          {event.shiftCount} shift
                          {event.shiftCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Checkouts */}
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Active Checkouts
              </h2>
              {dashboard.checkouts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active checkouts
                </p>
              ) : (
                <div className="space-y-1.5">
                  {dashboard.checkouts.map((checkout) => (
                    <div
                      key={checkout.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                          {checkout.requesterInitials}
                        </span>
                        <div>
                          <span className="text-sm font-medium">
                            {checkout.requesterName}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {summarizeItems(checkout.items)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          Due {formatTime(checkout.endsAt)}
                        </span>
                        {checkout.isOverdue && (
                          <Badge variant="red" size="sm">
                            Overdue
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right column */}
      <div className="flex w-[45%] flex-col">
        {/* Header */}
        <div className="shrink-0 p-6 pb-3 text-center">
          <h2 className="text-lg font-semibold">Tap your name to get started</h2>
        </div>

        {/* Users error state */}
        {usersError && (
          <div className="flex flex-col items-center gap-3 p-6">
            <p className="text-sm text-destructive">{usersError}</p>
            <Button variant="outline" size="sm" onClick={fetchUsers}>
              <RefreshCw className="mr-1.5 size-3.5" />
              Retry
            </Button>
          </div>
        )}

        {/* Avatar grid */}
        {!usersError && (
          <div className="min-h-0 flex-1">
            <AvatarGrid
              users={users}
              onSelect={onSelectUser}
              loading={usersLoading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
