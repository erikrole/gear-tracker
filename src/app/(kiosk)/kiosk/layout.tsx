import "@/app/globals.css";

export const metadata = {
  title: "Gear Tracker — Kiosk",
};

/**
 * Kiosk layout — full-screen, no sidebar, no header, no bottom nav.
 * Designed for landscape iPad with touch-optimized UI.
 * Always rendered in dark/command-terminal aesthetic.
 */
export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="h-dvh w-dvw overflow-hidden select-none"
      style={{ background: "#0b0b0d", color: "#fff" }}
      data-theme="dark"
    >
      {children}
    </div>
  );
}
