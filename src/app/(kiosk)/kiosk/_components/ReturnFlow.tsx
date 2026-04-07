"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Circle,
  AlertTriangle,
  X,
  Package,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { ScanInput } from "./ScanInput";

type KioskInfo = { kioskId: string; locationId: string; locationName: string };
type KioskUser = { id: string; name: string; avatarUrl: string | null };

type BookingItem = {
  id: string;
  name: string;
  tagName: string;
  returned: boolean;
};

type ScanFeedback = {
  type: "success" | "error" | "warning";
  message: string;
};

type Props = {
  kioskInfo: KioskInfo;
  user: KioskUser;
  bookingId: string;
  countdown: string;
  onBack: () => void;
  onComplete: (itemCount: number) => void;
};

export function ReturnFlow({
  kioskInfo,
  user,
  bookingId,
  countdown,
  onBack,
  onComplete,
}: Props) {
  const [bookingItems, setBookingItems] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [scanning, setScanning] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Load booking items on mount
  useEffect(() => {
    let mounted = true;

    async function loadBooking() {
      try {
        const res = await fetch(`/api/kiosk/checkout/${bookingId}`);
        const data = (await res.json()) as {
          success: boolean;
          items?: Array<{
            id: string;
            name: string;
            tagName: string;
            returned: boolean;
          }>;
          error?: string;
        };

        if (!mounted) return;

        if (!data.success || !data.items) {
          setLoadError(data.error || "Failed to load booking");
          return;
        }

        setBookingItems(data.items);
      } catch {
        if (mounted) setLoadError("Network error loading booking");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadBooking();
    return () => {
      mounted = false;
    };
  }, [bookingId]);

  const returnedCount = bookingItems.filter((i) => i.returned).length;
  const totalCount = bookingItems.length;
  const progressPercent = totalCount > 0 ? (returnedCount / totalCount) * 100 : 0;

  const handleScan = useCallback(
    async (scanValue: string) => {
      setScanning(true);
      setFeedback(null);

      try {
        const res = await fetch(`/api/kiosk/checkin/${bookingId}/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scanValue,
            actorId: user.id,
          }),
        });

        const data = (await res.json()) as {
          success: boolean;
          item?: { id: string; name: string; tagName: string };
          error?: string;
        };

        if (!data.success || !data.item) {
          setFeedback({
            type: "error",
            message: data.error || "Item not found in this booking",
          });
          return;
        }

        // Mark item as returned in local state
        setBookingItems((prev) =>
          prev.map((i) =>
            i.id === data.item!.id ? { ...i, returned: true } : i,
          ),
        );

        setFeedback({
          type: "success",
          message: `${data.item.name} (${data.item.tagName})`,
        });
      } catch {
        setFeedback({ type: "error", message: "Network error. Try again." });
      } finally {
        setScanning(false);
      }
    },
    [bookingId, user.id],
  );

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const res = await fetch(`/api/kiosk/checkin/${bookingId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: user.id }),
      });

      const data = (await res.json()) as { success: boolean; error?: string };

      if (data.success) {
        onComplete(returnedCount);
      } else {
        setFeedback({
          type: "error",
          message: data.error || "Failed to complete return",
        });
      }
    } catch {
      setFeedback({ type: "error", message: "Network error. Try again." });
    } finally {
      setCompleting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="size-8" />
          <p className="text-sm text-muted-foreground">Loading booking...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <X className="size-10 text-destructive" />
          <p className="text-lg font-semibold">Could not load booking</p>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <span className="text-lg font-semibold">
            Returning &middot; {user.name}
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="size-4" />
          <span className="text-sm font-mono">{countdown}</span>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left column: scan input + feedback */}
        <div className="flex w-1/2 flex-col gap-4 border-r p-4">
          <ScanInput onScan={handleScan} disabled={scanning || completing} />

          {/* Scan feedback */}
          {scanning && (
            <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3">
              <Spinner className="size-4" />
              <span className="text-sm">Looking up item...</span>
            </div>
          )}

          {feedback && (
            <div
              className={`flex items-center gap-2 rounded-lg border px-4 py-3 ${
                feedback.type === "success"
                  ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
                  : feedback.type === "warning"
                    ? "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200"
                    : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
              }`}
            >
              {feedback.type === "success" && <Check className="size-4" />}
              {feedback.type === "warning" && (
                <AlertTriangle className="size-4" />
              )}
              {feedback.type === "error" && <X className="size-4" />}
              <span className="text-sm">{feedback.message}</span>
            </div>
          )}
        </div>

        {/* Right column: booking items checklist + progress */}
        <div className="flex w-1/2 flex-col p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="size-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Booking Items</h2>
            </div>
            <Badge variant={returnedCount === totalCount ? "green" : "secondary"}>
              {returnedCount} of {totalCount} returned
            </Badge>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <Progress value={progressPercent} className="h-3" />
          </div>

          {/* Scrollable checklist */}
          <div className="flex-1 overflow-y-auto">
            <ul className="flex flex-col gap-2">
              {bookingItems.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                    item.returned
                      ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
                      : "bg-card"
                  }`}
                >
                  {item.returned ? (
                    <Check className="size-4 text-green-600 shrink-0" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        item.returned ? "text-green-800 dark:text-green-200" : ""
                      }`}
                    >
                      {item.name}
                    </p>
                  </div>
                  <Badge
                    variant={item.returned ? "green" : "outline"}
                    size="sm"
                  >
                    {item.tagName}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>

          {/* Done button */}
          <div className="mt-4 pt-3 border-t">
            <Button
              className="w-full h-12 text-lg font-semibold"
              disabled={completing}
              onClick={handleComplete}
            >
              {completing ? (
                <>
                  <Spinner className="size-5" />
                  Processing...
                </>
              ) : (
                "DONE"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
