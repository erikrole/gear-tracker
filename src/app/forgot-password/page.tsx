"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Something went wrong");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Creative</h1>
        <p className="login-subtitle">Reset your password</p>

        {submitted ? (
          <>
            <p style={{ fontSize: "var(--text-base)", lineHeight: 1.5, marginBottom: 16 }}>
              If an account exists with that email, we&apos;ve sent a password reset link. Check your inbox.
            </p>
            <Link href="/login">
              <button type="button" className="login-btn">Back to sign in</button>
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
              />
            </div>

            {error && <div className="form-error" role="alert">{error}</div>}

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? "Sending..." : "Send reset link"}
            </button>

            <p style={{ textAlign: "center", marginTop: 16, fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              <Link href="/login">Back to sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
