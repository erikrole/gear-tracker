"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error boundary caught:", error);
  }, [error]);

  return (
    <div style={{ padding: 40, textAlign: "center", maxWidth: 480, margin: "80px auto" }}>
      <h1 style={{ fontSize: "var(--text-2xl)", marginBottom: 12 }}>Something went wrong</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
        This may be caused by an expired session or a temporary loading issue.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <button className="btn btn-primary" onClick={reset}>
          Try again
        </button>
        <a href="/login" className="btn">
          Sign in
        </a>
      </div>
    </div>
  );
}
