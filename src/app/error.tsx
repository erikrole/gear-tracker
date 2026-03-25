"use client";

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root error boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          background: "#fafafa",
          color: "#111",
        }}
      >
        <div
          style={{
            padding: 40,
            textAlign: "center",
            maxWidth: 480,
            margin: "120px auto",
          }}
        >
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>
            Something went wrong
          </h1>
          <p style={{ color: "#666", marginBottom: 24, lineHeight: 1.5 }}>
            An unexpected error occurred. This is usually temporary.
          </p>
          <div
            style={{ display: "flex", gap: 12, justifyContent: "center" }}
          >
            <button
              onClick={reset}
              style={{
                padding: "10px 20px",
                background: "#111",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                padding: "10px 20px",
                background: "transparent",
                color: "#111",
                border: "1px solid #ddd",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
