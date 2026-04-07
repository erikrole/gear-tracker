"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IdleScreen } from "./IdleScreen";
import { StudentHub } from "./StudentHub";
import { CheckoutFlow } from "./CheckoutFlow";
import { ReturnFlow } from "./ReturnFlow";
import { ScanLookup } from "./ScanLookup";
import { SuccessScreen } from "./SuccessScreen";

type KioskInfo = {
  kioskId: string;
  locationId: string;
  locationName: string;
};

type KioskUser = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

type Screen =
  | { type: "idle" }
  | { type: "hub"; user: KioskUser }
  | { type: "checkout"; user: KioskUser }
  | { type: "return"; user: KioskUser; bookingId: string }
  | { type: "scan-lookup"; user: KioskUser }
  | { type: "success"; message: string; detail?: string };

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const SUCCESS_AUTO_RETURN_MS = 5 * 1000; // 5 seconds

type Props = {
  kioskInfo: KioskInfo;
};

export function KioskShell({ kioskInfo }: Props) {
  const [screen, setScreen] = useState<Screen>({ type: "idle" });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goIdle = useCallback(() => {
    setScreen({ type: "idle" });
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    // Only set timeout if not on idle screen
    if (screen.type !== "idle") {
      timeoutRef.current = setTimeout(goIdle, INACTIVITY_TIMEOUT_MS);
    }
  }, [screen.type, goIdle]);

  // Listen for any user interaction to reset timer
  useEffect(() => {
    if (screen.type === "idle") return;

    function handleActivity() {
      resetInactivityTimer();
    }

    window.addEventListener("touchstart", handleActivity, { passive: true });
    window.addEventListener("mousedown", handleActivity);
    window.addEventListener("keydown", handleActivity);

    // Start the timer
    resetInactivityTimer();

    return () => {
      window.removeEventListener("touchstart", handleActivity);
      window.removeEventListener("mousedown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [screen.type, resetInactivityTimer]);

  // Auto-return from success screen
  useEffect(() => {
    if (screen.type !== "success") return;
    const timer = setTimeout(goIdle, SUCCESS_AUTO_RETURN_MS);
    return () => clearTimeout(timer);
  }, [screen.type, goIdle]);

  // Countdown for inactivity display
  const [countdown, setCountdown] = useState(300);
  useEffect(() => {
    if (screen.type === "idle" || screen.type === "success") return;
    setCountdown(300);
    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [screen.type]);

  // Reset countdown on activity
  useEffect(() => {
    if (screen.type === "idle") return;
    function handleActivity() {
      setCountdown(300);
    }
    window.addEventListener("touchstart", handleActivity, { passive: true });
    window.addEventListener("mousedown", handleActivity);
    window.addEventListener("keydown", handleActivity);
    return () => {
      window.removeEventListener("touchstart", handleActivity);
      window.removeEventListener("mousedown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
    };
  }, [screen.type]);

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  switch (screen.type) {
    case "idle":
      return (
        <IdleScreen
          kioskInfo={kioskInfo}
          onSelectUser={(user) => setScreen({ type: "hub", user })}
        />
      );

    case "hub":
      return (
        <StudentHub
          kioskInfo={kioskInfo}
          user={screen.user}
          countdown={formatCountdown(countdown)}
          onBack={goIdle}
          onCheckout={() => setScreen({ type: "checkout", user: screen.user })}
          onReturn={(bookingId) =>
            setScreen({ type: "return", user: screen.user, bookingId })
          }
          onScanLookup={() =>
            setScreen({ type: "scan-lookup", user: screen.user })
          }
        />
      );

    case "checkout":
      return (
        <CheckoutFlow
          kioskInfo={kioskInfo}
          user={screen.user}
          countdown={formatCountdown(countdown)}
          onBack={() => setScreen({ type: "hub", user: screen.user })}
          onComplete={(itemCount) =>
            setScreen({
              type: "success",
              message: `Checked out ${itemCount} item${itemCount !== 1 ? "s" : ""}`,
            })
          }
        />
      );

    case "return":
      return (
        <ReturnFlow
          kioskInfo={kioskInfo}
          user={screen.user}
          bookingId={screen.bookingId}
          countdown={formatCountdown(countdown)}
          onBack={() => setScreen({ type: "hub", user: screen.user })}
          onComplete={(itemCount) =>
            setScreen({
              type: "success",
              message: `Returned ${itemCount} item${itemCount !== 1 ? "s" : ""}`,
            })
          }
        />
      );

    case "scan-lookup":
      return (
        <ScanLookup
          kioskInfo={kioskInfo}
          countdown={formatCountdown(countdown)}
          onBack={() => setScreen({ type: "hub", user: screen.user as KioskUser })}
        />
      );

    case "success":
      return (
        <SuccessScreen
          message={screen.message}
          detail={screen.detail}
          onDone={goIdle}
        />
      );
  }
}
