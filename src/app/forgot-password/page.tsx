"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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
              <Button type="button" className="w-full h-11 text-base font-semibold">Back to sign in</Button>
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-1 space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className="h-11 text-base"
              />
            </div>

            {error && <p className="text-destructive text-sm mt-3" role="alert">{error}</p>}

            <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
              {loading ? "Sending..." : "Send reset link"}
            </Button>

            <p style={{ textAlign: "center", marginTop: 16, fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              <Link href="/login">Back to sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
