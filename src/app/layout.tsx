import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wisconsin Creative",
  description: "Equipment checkout, reservation, and scan tracking for university athletics",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Wisconsin Creative",
  },
  icons: {
    icon: [
      { url: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: "/Badgers.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#A00000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- critical theme boot runs before paint; script body stays CSP-compatible in /public. */}
        <script src="/theme-init.js" suppressHydrationWarning />
        <script src="/sw-init.js" defer suppressHydrationWarning />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
