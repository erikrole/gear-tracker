import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "./globals.css";
import { Providers } from "./_providers";

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

const swScript = `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')})}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: swScript }} />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
