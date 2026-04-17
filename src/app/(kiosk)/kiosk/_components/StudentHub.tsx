"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Package, ScanLine, Undo2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from "@/lib/avatar";

type KioskInfo = { kioskId: string; locationId: string; locationName: string };
type KioskUser = { id: string; name: string; avatarUrl: string | null };

type Checkout = {
  id: string;
  title: string;
  refNumber: string;
  items: Array<{ name: string; tagName: string }>;
  endsAt: string;
  isOverdue: boolean;
};

type PendingPickup = {
  id: string;
  title: string;
  refNumber: string;
  serializedItems: Array<{ id: string; tagName: string; name: string }>;
  bulkItems: Array<{ name: string; quantity: number }>;
};

type Reservation = {
  id: string;
  title: string;
  startsAt: string;
};

type Props = {
  kioskInfo: KioskInfo;
  user: KioskUser;
  countdown: string;
  onBack: () => void;
  onCheckout: () => void;
  onPickup: (bookingId: string) => void;
  onReturn: (bookingId: string) => void;
  onScanLookup: () => void;
};

const HDG: React.CSSProperties = { fontFamily: "var(--font-heading)" };

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

function formatDueTime(endsAt: string) {
  return new Date(endsAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function StudentHub({
  kioskInfo,
  user,
  countdown,
  onBack,
  onCheckout,
  onPickup,
  onReturn,
  onScanLookup,
}: Props) {
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [pendingPickups, setPendingPickups] = useState<PendingPickup[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTeam, setShowTeam] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/kiosk/student/${user.id}`);
      if (!res.ok) throw new Error("Failed to load data");
      const data = await res.json();
      setCheckouts(data.checkouts ?? []);
      setPendingPickups(data.pendingPickups ?? []);
      setReservations(data.reservations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasCheckouts = checkouts.length > 0;
  // kioskInfo used for location context — available for future scoped queries
  void kioskInfo;

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ background: "#0b0b0d" }}
    >
      {/* ── Top bar ── */}
      <div
        className="flex h-[52px] shrink-0 items-center gap-3 px-5"
        style={{ borderBottom: "2px solid #c5050c" }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-white/40 transition-colors hover:text-white/80"
          style={HDG}
        >
          <ArrowLeft className="size-4" />
          Back
        </button>

        <div className="mx-1 h-4 w-px" style={{ background: "rgba(255,255,255,0.10)" }} />

        <div className="flex items-center gap-2.5">
          <Avatar className="size-7 ring-1 ring-[#c5050c]/40 ring-offset-1 ring-offset-[#0b0b0d]">
            {user.avatarUrl && (
              <AvatarImage src={user.avatarUrl} alt={user.name} />
            )}
            <AvatarFallback style={{ background: "#252530", fontFamily: "var(--font-heading)", fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <span
            style={{ ...HDG, fontWeight: 800, letterSpacing: "0.06em" }}
            className="text-sm uppercase text-white"
          >
            {user.name}
          </span>
        </div>

        <div className="ml-auto">
          <span
            style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}
            className="tabular-nums text-white/30"
          >
            {countdown}
          </span>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex min-h-0 flex-1 gap-4 p-4">
        {/* Left: gear + reservations */}
        <div className="flex w-[55%] flex-col gap-4 overflow-y-auto">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-24 rounded" />
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm text-red-400">{error}</p>
              <button
                type="button"
                onClick={fetchData}
                className="rounded-lg px-4 py-2 text-sm text-white/50 transition-colors hover:text-white"
                style={{ border: "1px solid rgba(255,255,255,0.10)" }}
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* My Gear */}
              <div>
                <SectionHeader>My Gear</SectionHeader>
                <div className="space-y-1.5">
                  {hasCheckouts ? (
                    checkouts.map((checkout) => (
                      <button
                        key={checkout.id}
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-all"
                        style={{
                          background: "#131316",
                          border: checkout.isOverdue
                            ? "1px solid rgba(197,5,12,0.35)"
                            : "1px solid rgba(255,255,255,0.07)",
                        }}
                        onClick={() => onReturn(checkout.id)}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = "#1e1e24";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = "#131316";
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white/90">
                            {checkout.title}
                          </p>
                          <p className="truncate text-xs text-white/35">
                            {checkout.items.map((i) => i.tagName).join(", ")}
                          </p>
                        </div>
                        <div className="ml-3 flex shrink-0 items-center gap-2">
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
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: "0.7rem",
                              }}
                              className="tabular-nums text-white/35"
                            >
                              Due {formatDueTime(checkout.endsAt)}
                            </span>
                          )}
                          <ChevronRight className="size-3.5 text-white/20" />
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="py-4 text-center text-sm text-white/25">
                      No active checkouts
                    </p>
                  )}
                </div>
              </div>

              {/* Pending Pickups */}
              {pendingPickups.length > 0 && (
                <div>
                  <SectionHeader>Pending Pickup</SectionHeader>
                  <div className="space-y-1.5">
                    {pendingPickups.map((pickup) => {
                      const itemCount = pickup.serializedItems.length + pickup.bulkItems.reduce((s, b) => s + b.quantity, 0);
                      return (
                        <button
                          key={pickup.id}
                          type="button"
                          className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-all"
                          style={{
                            background: "rgba(197,5,12,0.08)",
                            border: "1px solid rgba(197,5,12,0.30)",
                          }}
                          onClick={() => onPickup(pickup.id)}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "rgba(197,5,12,0.14)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "rgba(197,5,12,0.08)";
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white/90">{pickup.title}</p>
                            <p className="truncate text-xs text-white/40">
                              {itemCount} item{itemCount !== 1 ? "s" : ""} — tap to pick up
                            </p>
                          </div>
                          <div className="ml-3 flex shrink-0 items-center gap-2">
                            <span
                              style={{ ...HDG, fontWeight: 800, fontSize: "0.6rem", letterSpacing: "0.12em", color: "#c5050c" }}
                              className="uppercase"
                            >
                              Pick Up
                            </span>
                            <ChevronRight className="size-3.5 text-white/20" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Upcoming Reservations */}
              {reservations.length > 0 && (
                <div>
                  <SectionHeader>Upcoming Reservations</SectionHeader>
                  <div className="space-y-1.5">
                    {reservations.map((res) => (
                      <div
                        key={res.id}
                        className="flex items-center justify-between rounded-xl px-4 py-3"
                        style={{
                          background: "#131316",
                          border: "1px solid rgba(255,255,255,0.07)",
                        }}
                      >
                        <p className="truncate text-sm font-medium text-white/80">
                          {res.title}
                        </p>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.7rem",
                          }}
                          className="ml-3 shrink-0 text-white/35"
                        >
                          {formatDate(res.startsAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Team checkouts toggle */}
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-white/25 transition-colors hover:text-white/50"
                onClick={() => setShowTeam((prev) => !prev)}
              >
                All team checkouts
                <ChevronRight
                  className={`size-3.5 transition-transform ${showTeam ? "rotate-90" : ""}`}
                />
              </button>
              {showTeam && (
                <div
                  className="rounded-xl px-4 py-4"
                  style={{
                    background: "#131316",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <p className="text-center text-sm text-white/30">
                    Team checkout view coming soon
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: action buttons */}
        <div className="flex w-[45%] flex-col gap-3">
          {/* Check Out — primary action */}
          <button
            type="button"
            onClick={onCheckout}
            className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl transition-all"
            style={{
              background: "#c5050c",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#d90a13";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#c5050c";
            }}
          >
            <Package className="size-8 text-white" />
            <span
              style={{
                ...HDG,
                fontWeight: 900,
                fontSize: "1.1rem",
                letterSpacing: "0.12em",
              }}
              className="uppercase text-white"
            >
              Check Out
            </span>
          </button>

          {/* Return Gear — secondary, only if has checkouts */}
          {hasCheckouts && (
            <button
              type="button"
              onClick={() => onReturn(checkouts[0].id)}
              className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl transition-all"
              style={{
                background: "#1e1e24",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#28282f";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#1e1e24";
              }}
            >
              <Undo2 className="size-7 text-white/70" />
              <span
                style={{
                  ...HDG,
                  fontWeight: 800,
                  fontSize: "1rem",
                  letterSpacing: "0.10em",
                }}
                className="uppercase text-white/80"
              >
                Return Gear
              </span>
            </button>
          )}

          {/* Scan Lookup — tertiary */}
          <button
            type="button"
            onClick={onScanLookup}
            className="flex h-[72px] shrink-0 items-center justify-center gap-3 rounded-xl transition-all"
            style={{
              background: "#131316",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#1a1a1e";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#131316";
            }}
          >
            <ScanLine className="size-5 text-white/40" />
            <span
              style={{
                ...HDG,
                fontWeight: 700,
                fontSize: "0.85rem",
                letterSpacing: "0.10em",
              }}
              className="uppercase text-white/50"
            >
              Scan / Lookup
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
