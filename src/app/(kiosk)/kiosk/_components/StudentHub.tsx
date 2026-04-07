"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Clock,
  ChevronRight,
  Package,
  ScanLine,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

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
  onReturn: (bookingId: string) => void;
  onScanLookup: () => void;
};

export function StudentHub({
  kioskInfo,
  user,
  countdown,
  onBack,
  onCheckout,
  onReturn,
  onScanLookup,
}: Props) {
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
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

  function formatDueTime(endsAt: string) {
    const date = new Date(endsAt);
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-background">
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-5" />
          Back
        </Button>
        <span className="text-lg font-semibold">{user.name}</span>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-4" />
          {countdown}
        </div>
      </div>

      {/* Main content */}
      <div className="flex min-h-0 flex-1 gap-4 p-4">
        {/* Left column */}
        <div className="flex w-[55%] flex-col gap-4 overflow-y-auto">
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <Spinner className="size-8" />
            </div>
          ) : error ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchData}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              {/* My Gear */}
              <Card elevation="flat">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    My Gear
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pb-4">
                  {hasCheckouts ? (
                    checkouts.map((checkout) => (
                      <button
                        key={checkout.id}
                        type="button"
                        className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                        onClick={() => onReturn(checkout.id)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {checkout.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {checkout.items
                              .map((i) => i.tagName)
                              .join(", ")}
                          </p>
                        </div>
                        <div className="ml-3 flex shrink-0 items-center gap-2">
                          {checkout.isOverdue ? (
                            <Badge variant="destructive">Overdue</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Due {formatDueTime(checkout.endsAt)}
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No active checkouts
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Upcoming Reservations */}
              {reservations.length > 0 && (
                <Card elevation="flat">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Upcoming Reservations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pb-4">
                    {reservations.map((reservation) => (
                      <div
                        key={reservation.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <p className="truncate text-sm font-medium">
                          {reservation.title}
                        </p>
                        <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                          {formatDate(reservation.startsAt)}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Team checkouts toggle */}
              <button
                type="button"
                className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setShowTeam((prev) => !prev)}
              >
                All team checkouts
                <ChevronRight
                  className={`size-4 transition-transform ${showTeam ? "rotate-90" : ""}`}
                />
              </button>
              {showTeam && (
                <Card elevation="flat">
                  <CardContent className="py-4">
                    <p className="text-center text-sm text-muted-foreground">
                      Team checkout view coming soon
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Right column */}
        <div className="flex w-[45%] flex-col gap-3">
          <Button
            className="h-24 text-lg font-semibold"
            onClick={onCheckout}
          >
            <Package className="size-6" />
            Check Out
          </Button>

          {hasCheckouts && (
            <Button
              variant="secondary"
              className="h-24 text-lg font-semibold"
              onClick={() => onReturn(checkouts[0].id)}
            >
              <Undo2 className="size-6" />
              Return Gear
            </Button>
          )}

          <Button
            variant="outline"
            className="h-24 text-lg font-semibold"
            onClick={onScanLookup}
          >
            <ScanLine className="size-6" />
            Scan / Lookup
          </Button>
        </div>
      </div>
    </div>
  );
}
