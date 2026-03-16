"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ padding: 40, textAlign: "center", maxWidth: 480, margin: "80px auto", fontFamily: "system-ui, sans-serif" }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>Something went wrong</h1>
          <p style={{ color: "var(--text-secondary, #6b7280)", marginBottom: 24 }}>
            Try refreshing the page, or sign in again if the issue persists.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "var(--primary, #7c3aed)", color: "#fff", cursor: "pointer", fontWeight: 600 }}
            >
              Try again
            </button>
            <a
              href="/login"
              style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid var(--border, #e5e7eb)", textDecoration: "none", color: "var(--text-primary, #111827)", cursor: "pointer" }}
            >
              Sign in
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
