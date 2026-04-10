"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
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
    requesterAvatarUrl: string | null;
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
const HDG: React.CSSProperties = { fontFamily: "var(--font-heading)" };

function LiveClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    function tick() {
      setTime(
        new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.06em",
        fontSize: "1.125rem",
      }}
      className="text-white/60 tabular-nums"
    >
      {time}
    </span>
  );
}

function StatCard({
  label,
  value,
  loading,
  danger,
}: {
  label: string;
  value: number;
  loading?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 rounded-xl p-4"
      style={{
        background: "#131316",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {loading ? (
        <>
          <Skeleton className="h-12 w-16 rounded-md" />
          <Skeleton className="mt-1 h-3 w-20 rounded" />
        </>
      ) : (
        <>
          <span
            style={{ ...HDG, fontWeight: 900, fontSize: "3rem", lineHeight: 1 }}
            className={`tabular-nums ${danger && value > 0 ? "text-[#c5050c]" : "text-white"}`}
          >
            {value}
          </span>
          <span
            className="text-center text-[10px] uppercase tracking-[0.14em] text-white/40"
          >
            {label}
          </span>
        </>
      )}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <div className="h-3 w-0.5 rounded-full" style={{ background: "#c5050c" }} />
      <span
        className="text-[10px] uppercase tracking-[0.15em] text-white/35"
        style={HDG}
      >
        {children}
      </span>
    </div>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function summarizeItems(items: Array<{ name: string }>) {
  if (items.length === 0) return "No items";
  if (items.length === 1) return items[0].name;
  return `${items[0].name} +${items.length - 1} more`;
}

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
        err instanceof Error ? err.message : "Failed to load dashboard",
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
        err instanceof Error ? err.message : "Failed to load users",
      );
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(true);
    fetchUsers();
  }, [fetchDashboard, fetchUsers]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchDashboard(false);
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchDashboard]);

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ background: "#0b0b0d" }}
    >
      {/* ── Header ── */}
      <div
        className="flex h-[52px] shrink-0 items-center gap-4 px-5"
        style={{ borderBottom: "2px solid #c5050c" }}
      >
        <span
          style={{ ...HDG, fontWeight: 900, letterSpacing: "0.14em", fontSize: "1rem" }}
          className="uppercase text-white"
        >
          Gear Tracker
        </span>
        <span
          className="rounded px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] text-white/35"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {kioskInfo.locationName}
        </span>
        <div className="ml-auto flex items-center gap-3">
          {dashboardError ? null : (
            <button
              onClick={() => fetchDashboard(true)}
              className="rounded p-1 text-white/25 transition-colors hover:text-white/60"
            >
              <RefreshCw className="size-3.5" />
            </button>
          )}
          <LiveClock />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex min-h-0 flex-1">
        {/* Left column — status dashboard */}
        <div
          className="flex w-[55%] flex-col gap-5 overflow-y-auto p-5"
          style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* Error */}
          {dashboardError && (
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{
                background: "rgba(197,5,12,0.12)",
                border: "1px solid rgba(197,5,12,0.30)",
              }}
            >
              <AlertCircle className="size-4 shrink-0 text-[#c5050c]" />
              <span className="flex-1 text-sm text-red-300">{dashboardError}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchDashboard(true)}
                className="text-white/50 hover:text-white"
              >
                <RefreshCw className="size-3.5" />
                Retry
              </Button>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="Items Out"
              value={dashboard?.stats.itemsOut ?? 0}
              loading={dashboardLoading && !dashboard}
            />
            <StatCard
              label="Active Checkouts"
              value={dashboard?.stats.checkouts ?? 0}
              loading={dashboardLoading && !dashboard}
            />
            <StatCard
              label="Overdue"
              value={dashboard?.stats.overdue ?? 0}
              loading={dashboardLoading && !dashboard}
              danger
            />
          </div>

          {/* Today's Schedule */}
          <div>
            <SectionHeader>Today&apos;s Schedule</SectionHeader>
            {dashboardLoading && !dashboard ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : dashboard?.events.length === 0 ? (
              <p className="text-sm text-white/25">No events scheduled today</p>
            ) : (
              <div className="space-y-1.5">
                {dashboard?.events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 rounded-lg py-2.5 pl-3 pr-4"
                    style={{
                      background: "#131316",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderLeft: "2px solid #c5050c",
                    }}
                  >
                    <span
                      style={{
                        ...HDG,
                        fontWeight: 800,
                        fontSize: "0.65rem",
                        letterSpacing: "0.14em",
                        color: "#c5050c",
                        minWidth: "2rem",
                      }}
                      className="uppercase"
                    >
                      {event.sportCode}
                    </span>
                    <span className="flex-1 truncate text-sm font-medium text-white/90">
                      {event.title}
                    </span>
                    <div className="flex items-center gap-3 text-xs text-white/35">
                      <span
                        style={{ fontFamily: "var(--font-mono)" }}
                        className="tabular-nums"
                      >
                        {formatTime(event.startsAt)}
                      </span>
                      <span>
                        {event.shiftCount} shift{event.shiftCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Checkouts */}
          <div>
            <SectionHeader>Active Checkouts</SectionHeader>
            {dashboardLoading && !dashboard ? (
              <div className="space-y-2">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : dashboard?.checkouts.length === 0 ? (
              <p className="text-sm text-white/25">No active checkouts</p>
            ) : (
              <div className="space-y-1.5">
                {dashboard?.checkouts.map((checkout) => (
                  <div
                    key={checkout.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                    style={{
                      background: "#131316",
                      border: checkout.isOverdue
                        ? "1px solid rgba(197,5,12,0.35)"
                        : "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <Avatar className="size-7 shrink-0">
                      {checkout.requesterAvatarUrl && (
                        <AvatarImage
                          src={checkout.requesterAvatarUrl}
                          alt={checkout.requesterName}
                        />
                      )}
                      <AvatarFallback
                        className="text-xs font-bold"
                        style={{ background: "#1e1e24", color: "rgba(255,255,255,0.7)" }}
                      >
                        {checkout.requesterInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white/90">
                        {checkout.requesterName}
                      </p>
                      <p className="truncate text-xs text-white/35">
                        {summarizeItems(checkout.items)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      {checkout.isOverdue ? (
                        <span
                          style={{
                            ...HDG,
                            fontWeight: 800,
                            fontSize: "0.6rem",
                            letterSpacing: "0.12em",
                            color: "#c5050c",
                          }}
                          className="uppercase"
                        >
                          Overdue
                        </span>
                      ) : (
                        <span
                          style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem" }}
                          className="tabular-nums text-white/35"
                        >
                          {formatTime(checkout.endsAt)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column — roster */}
        <div className="flex w-[45%] flex-col">
          <div className="shrink-0 px-5 pb-2 pt-4 text-center">
            <p
              style={{ ...HDG, fontWeight: 700, letterSpacing: "0.1em", fontSize: "0.85rem" }}
              className="uppercase text-white/30"
            >
              Tap your name to start
            </p>
          </div>

          {usersError ? (
            <div className="flex flex-col items-center gap-3 p-6">
              <p className="text-sm text-red-400">{usersError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchUsers}
                className="border-white/10 text-white/60 hover:text-white"
              >
                <RefreshCw className="mr-1.5 size-3.5" />
                Retry
              </Button>
            </div>
          ) : (
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
    </div>
  );
}
