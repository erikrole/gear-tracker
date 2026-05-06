import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
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
    icon: "/Badgers.png",
    apple: "/Badgers.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#A00000",
};

const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');else if(t==='light')document.documentElement.setAttribute('data-theme','light');else if(window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches)document.documentElement.setAttribute('data-theme','dark');var s=localStorage.getItem('text-scale');if(s){var n=parseFloat(s);if(n>=0.85&&n<=1.4)document.documentElement.style.setProperty('--text-scale',String(n))}}catch(e){}})()`;

const swScript = process.env.NODE_ENV === "production"
  ? `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')})}`
  : `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister()})});if(window.caches){caches.keys().then(function(keys){keys.filter(function(k){return k.indexOf('gear-tracker-')===0}).forEach(function(k){caches.delete(k)})})}})}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Per-request CSP nonce minted by src/middleware.ts. The two inline
  // scripts below carry it so we can keep `'unsafe-inline'` off script-src.
  const nonce = (await headers()).get("x-csp-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: swScript }} />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
