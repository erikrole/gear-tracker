"use client";

import { useEffect, useState } from "react";
import { WifiOffIcon } from "lucide-react";

/**
 * Shows a fixed banner when the browser loses connectivity.
 * Automatically hides when connection is restored.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    function handleOffline() { setOffline(true); }
    function handleOnline() { setOffline(false); }

    if (!navigator.onLine) setOffline(true);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-amber-600 text-white text-sm font-medium px-4 py-2">
      <WifiOffIcon className="size-4" />
      You&apos;re offline. Changes won&apos;t save until you reconnect.
    </div>
  );
}
