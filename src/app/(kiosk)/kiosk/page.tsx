"use client";

import { useCallback, useEffect, useState } from "react";
import { ActivationForm } from "./_components/ActivationForm";
import { KioskShell } from "./_components/KioskShell";
import { Spinner } from "@/components/ui/spinner";

type KioskInfo = {
  kioskId: string;
  locationId: string;
  locationName: string;
};

export default function KioskPage() {
  const [checking, setChecking] = useState(true);
  const [kioskInfo, setKioskInfo] = useState<KioskInfo | null>(null);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/kiosk/me");
      if (res.ok) {
        const json = await res.json();
        setKioskInfo({
          kioskId: json.kioskId,
          locationId: json.locationId,
          locationName: json.locationName,
        });
      }
    } catch {
      // Not activated — show activation form
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Heartbeat — every 60 seconds
  useEffect(() => {
    if (!kioskInfo) return;
    const interval = setInterval(() => {
      fetch("/api/kiosk/heartbeat", { method: "POST" }).catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, [kioskInfo]);

  if (checking) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!kioskInfo) {
    return (
      <ActivationForm
        onActivated={({ kioskId, locationName }) => {
          // After activation, re-check to get full kiosk info
          setKioskInfo({ kioskId, locationId: "", locationName });
          checkSession();
        }}
      />
    );
  }

  return <KioskShell kioskInfo={kioskInfo} />;
}
