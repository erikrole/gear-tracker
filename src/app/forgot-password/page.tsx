"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, WifiOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setIsNetworkError(false);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        let message = "Something went wrong";
        try {
          const json = await res.json();
          message = json.error || message;
        } catch {
          // Non-JSON response
        }
        throw new Error(message);
      }

      setSubmitted(true);
    } catch (err) {
      if (err instanceof TypeError) {
        setIsNetworkError(true);
        setError("You're offline — check your internet connection and try again");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-black p-4">
      <Card className="w-full max-w-[400px] animate-in fade-in-0 zoom-in-95 duration-300">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Creative</CardTitle>
          <CardDescription>Reset your password</CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4">
              <p className="text-base leading-relaxed">
                If an account exists with that email, we&apos;ve sent a password reset link. Check your inbox.
              </p>
              <Link href="/login">
                <Button type="button" className="w-full h-11 text-base font-semibold">Back to sign in</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (error) { setError(""); setIsNetworkError(false); } }}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  disabled={loading}
                  className="h-11 text-base"
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  {isNetworkError ? <WifiOff className="size-4" /> : <AlertCircle className="size-4" />}
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Sending...
                  </>
                ) : "Send reset link"}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                <Link href="/login" className="hover:underline">Back to sign in</Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
