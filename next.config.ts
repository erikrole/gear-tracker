import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  experimental: {
    optimizePackageImports: ["date-fns", "motion"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  async headers() {
    // CSP for paths NOT covered by src/middleware.ts (static assets,
    // favicon, manifest, sw.js). Middleware overrides this per-request
    // with a nonce-based policy on every dynamic route.
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https://*.public.blob.vercel-storage.com",
      "font-src 'self' data:",
      "connect-src 'self' https://*.public.blob.vercel-storage.com https://*.sentry.io https://*.ingest.sentry.io",
      "worker-src 'self'",
      "manifest-src 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    const permissionsPolicy = [
      "camera=(self)",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "serial=()",
      "bluetooth=()",
      "magnetometer=()",
      "gyroscope=()",
      "accelerometer=()",
      "ambient-light-sensor=()",
      "autoplay=(self)",
      "encrypted-media=()",
      "fullscreen=(self)",
      "picture-in-picture=()",
      "display-capture=()",
      "midi=()",
      "screen-wake-lock=()",
      "web-share=(self)",
      "interest-cohort=()",
      "browsing-topics=()",
    ].join(", ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: permissionsPolicy },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
      // Auth pages: never cache — prevents BFCache from replaying the form
      // after sign-out and avoids any shared-cache leakage.
      {
        source: "/(login|register|forgot-password|reset-password)",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

const config = withBundleAnalyzer(nextConfig);

export default withSentryConfig(config, {
  // Upload source maps only when SENTRY_AUTH_TOKEN is set (CI/Vercel)
  silent: !process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Disable Sentry telemetry
  telemetry: false,
});
