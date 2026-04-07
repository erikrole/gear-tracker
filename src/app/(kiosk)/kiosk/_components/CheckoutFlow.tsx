"use client";

import { useCallback, useState } from "react";
import {
  ArrowLeft,
  Check,
  AlertTriangle,
  X,
  Package,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ScanInput } from "./ScanInput";

type KioskInfo = { kioskId: string; locationId: string; locationName: string };
type KioskUser = { id: string; name: string; avatarUrl: string | null };

type ScannedItem = {
  id: string;
  name: string;
  tagName: string;
  type: string;
};

type ScanFeedback = {
  type: "success" | "error" | "warning";
  message: string;
};

type Props = {
  kioskInfo: KioskInfo;
  user: KioskUser;
  countdown: string;
  onBack: () => void;
  onComplete: (itemCount: number) => void;
};

export function CheckoutFlow({
  kioskInfo,
  user,
  countdown,
  onBack,
  onComplete,
}: Props) {
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [scanning, setScanning] = useState(false);
  const [completing, setCompleting] = useState(false);

  const handleScan = useCallback(
    async (scanValue: string) => {
      setScanning(true);
      setFeedback(null);

      try {
        const res = await fetch("/api/kiosk/checkout/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scanValue,
            actorId: user.id,
            locationId: kioskInfo.locationId,
          }),
        });

        const data = (await res.json()) as {
          success: boolean;
          item?: ScannedItem;
          error?: string;
        };

        if (!data.success || !data.item) {
          setFeedback({
            type: "error",
            message: data.error || "Item not found",
          });
          return;
        }

        // Check for duplicate
        if (items.some((i) => i.id === data.item!.id)) {
          setFeedback({
            type: "warning",
            message: `${data.item.name} (${data.item.tagName}) already scanned`,
          });
          return;
        }

        setItems((prev) => [...prev, data.item!]);
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
    [user.id, kioskInfo.locationId, items],
  );

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const res = await fetch("/api/kiosk/checkout/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: user.id,
          locationId: kioskInfo.locationId,
          items: items.map((i) => ({ assetId: i.id })),
        }),
      });

      const data = (await res.json()) as { success: boolean; error?: string };

      if (data.success) {
        onComplete(items.length);
      } else {
        setFeedback({
          type: "error",
          message: data.error || "Failed to complete checkout",
        });
      }
    } catch {
      setFeedback({ type: "error", message: "Network error. Try again." });
    } finally {
      setCompleting(false);
    }
  };

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
            Checking Out &middot; {user.name}
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

        {/* Right column: scanned items list */}
        <div className="flex w-1/2 flex-col p-4">
          <div className="mb-3 flex items-center gap-2">
            <Package className="size-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">
              Scanned Items ({items.length})
            </h2>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Package className="size-10 mb-2 opacity-40" />
                <p className="text-sm">No items scanned yet</p>
                <p className="text-xs">Scan barcodes to add items</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
                  >
                    <Check className="size-4 text-green-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.name}
                      </p>
                    </div>
                    <Badge variant="secondary" size="sm">
                      {item.tagName}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Done button */}
          <div className="mt-4 pt-3 border-t">
            <Button
              className="w-full h-12 text-lg font-semibold"
              disabled={items.length === 0 || completing}
              onClick={handleComplete}
            >
              {completing ? (
                <>
                  <Spinner className="size-5" />
                  Processing...
                </>
              ) : (
                <>
                  DONE ({items.length} item{items.length !== 1 ? "s" : ""})
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
