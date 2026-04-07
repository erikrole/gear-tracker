import "@/app/globals.css";

export const metadata = {
  title: "Gear Tracker — Kiosk",
};

/**
 * Kiosk layout — full-screen, no sidebar, no header, no bottom nav.
 * Designed for landscape iPad with touch-optimized UI.
 */
export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh w-dvw overflow-hidden bg-background text-foreground select-none">
      {children}
    </div>
  );
}
