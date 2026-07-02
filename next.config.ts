import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const isVercelDeployment = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  experimental: {
    optimizePackageImports: ["date-fns", "motion"],
    devtoolSegmentExplorer: false,
  },
  transpilePackages: ["@mdxeditor/editor"],
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
      // Next App Router emits inline bootstrap/RSC scripts. A nonce-based CSP is
      // the stricter future path; until then, production needs unsafe-inline to render.
      isVercelDeployment ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https:",
      "font-src 'self' data:",
      isVercelDeployment
        ? "connect-src 'self' https://*.public.blob.vercel-storage.com https://*.sentry.io https://*.ingest.sentry.io"
        : "connect-src 'self' http: https: ws: wss:",
      "worker-src 'self'",
      "manifest-src 'self'",
      isVercelDeployment ? "frame-ancestors 'none'" : null,
      "form-action 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      isVercelDeployment ? "upgrade-insecure-requests" : null,
    ].filter(Boolean).join("; ");

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
      "autoplay=(self)",
      "encrypted-media=()",
      "fullscreen=(self)",
      "picture-in-picture=()",
      "display-capture=()",
      "midi=()",
      "screen-wake-lock=()",
      "web-share=(self)",
    ].join(", ");

    return [
      {
        source: "/:path*",
        headers: [
          isVercelDeployment ? { key: "X-Frame-Options", value: "DENY" } : null,
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: permissionsPolicy },
          isVercelDeployment ? { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" } : null,
          isVercelDeployment ? { key: "Cross-Origin-Opener-Policy", value: "same-origin" } : null,
          isVercelDeployment ? { key: "Cross-Origin-Resource-Policy", value: "same-origin" } : null,
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Content-Security-Policy", value: csp },
        ].filter((header): header is { key: string; value: string } => Boolean(header)),
      },
      // Auth pages: never cache — prevents BFCache from replaying the form
      // after sign-out and avoids any shared-cache leakage.
      {
        source: "/(login|register|forgot-password|reset-password)",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/guides", destination: "/resources", permanent: true },
      { source: "/guides/:path*", destination: "/resources/:path*", permanent: true },
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
