"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { ArrowLeft, Clock, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type KioskInfo = {
  kioskId: string;
  locationId: string;
  locationName: string;
};

type LookupResult = {
  id: string;
  tagName: string;
  productName: string;
  type: string;
  status: string;
  holder?: string;
  dueAt?: string;
  bookingTitle?: string;
};

type Props = {
  kioskInfo: KioskInfo;
  countdown: string;
  onBack: () => void;
};

export function ScanLookup({ countdown, onBack }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Keep hidden input focused for hand scanner
  useEffect(() => {
    inputRef.current?.focus();
  }, [result]);

  const handleScan = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/kiosk/scan-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanValue: trimmed }),
      });

      if (res.ok) {
        const json = await res.json();
        setResult(json.item);
      } else {
        const json = await res.json().catch(() => null);
        setError(json?.error || "Item not found");
      }
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const value = e.currentTarget.value;
      e.currentTarget.value = "";
      handleScan(value);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "Available":
        return "default";
      case "Checked Out":
        return "secondary";
      case "Overdue":
        return "destructive";
      case "Reserved":
        return "outline";
      default:
        return "secondary";
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <Button variant="ghost" size="lg" onClick={onBack} className="gap-2 text-lg">
          <ArrowLeft className="h-5 w-5" />
          Back
        </Button>
        <h1 className="text-xl font-semibold">Scan / Lookup</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="font-mono">{countdown}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-lg space-y-6 text-center">
          {/* Hidden scanner input */}
          <input
            ref={inputRef}
            type="text"
            className="absolute opacity-0 pointer-events-none"
            onKeyDown={handleKeyDown}
            autoFocus
            tabIndex={-1}
          />

          <div>
            <Search className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold">Scan any item</h2>
            <p className="text-muted-foreground mt-1">
              Use the hand scanner or type an asset tag below
            </p>
          </div>

          {/* Manual entry */}
          <Input
            placeholder="Type asset tag and press Enter"
            className="text-center text-lg h-14"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const value = e.currentTarget.value.trim();
                if (value) {
                  e.currentTarget.value = "";
                  handleScan(value);
                }
              }
            }}
          />

          {loading && (
            <p className="text-muted-foreground animate-pulse">Looking up...</p>
          )}

          {error && (
            <Card className="border-destructive">
              <CardContent className="py-4">
                <p className="text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

          {result && (
            <Card>
              <CardContent className="py-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold font-mono">{result.tagName}</span>
                  <Badge variant={getStatusColor(result.status) as "default" | "secondary" | "destructive" | "outline"}>
                    {result.status}
                  </Badge>
                </div>
                <p className="text-lg text-muted-foreground">{result.productName}</p>
                <p className="text-sm text-muted-foreground">{result.type}</p>
                {result.holder && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Checked out by</span>
                    <span className="font-medium">{result.holder}</span>
                  </div>
                )}
                {result.dueAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Due back</span>
                    <span className="font-medium">
                      {new Date(result.dueAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
