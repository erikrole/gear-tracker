"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ padding: 40, textAlign: "center", maxWidth: 480, margin: "80px auto", fontFamily: "system-ui, sans-serif" }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>Something went wrong</h1>
          <p style={{ color: "#666", marginBottom: 24 }}>
            Try refreshing the page, or sign in again if the issue persists.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #ddd", background: "#7c3aed", color: "#fff", cursor: "pointer" }}
            >
              Try again
            </button>
            <a
              href="/login"
              style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #ddd", textDecoration: "none", color: "#333", cursor: "pointer" }}
            >
              Sign in
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
