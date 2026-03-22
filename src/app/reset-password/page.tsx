"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function validatePassword(password: string): string {
  if (!password) return "Password is required";
  if (password.length < 8) return "Must be at least 8 characters";
  return "";
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function handleBlur(field: string) {
    if (field === "password") {
      setFieldErrors((prev) => ({ ...prev, password: validatePassword(password) }));
    } else if (field === "confirmPassword") {
      const msg = confirmPassword && confirmPassword !== password ? "Passwords do not match" : "";
      setFieldErrors((prev) => ({ ...prev, confirmPassword: msg }));
    }
  }

  function clearFieldError(field: string) {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const passErr = validatePassword(password);
    const confirmErr = password !== confirmPassword ? "Passwords do not match" : "";
    if (passErr || confirmErr) {
      setFieldErrors({ password: passErr, confirmPassword: confirmErr });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Reset failed");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <>
        <p className="login-subtitle">Invalid reset link</p>
        <p style={{ marginBottom: 16 }}>This password reset link is invalid or has expired.</p>
        <Link href="/forgot-password">
          <Button type="button" className="w-full h-11 text-base font-semibold">Request a new link</Button>
        </Link>
      </>
    );
  }

  if (success) {
    return (
      <>
        <p className="login-subtitle">Set a new password</p>
        <p style={{ fontSize: "var(--text-base)", lineHeight: 1.5, marginBottom: 16 }}>
          Your password has been reset. You can now sign in with your new password.
        </p>
        <Link href="/login">
          <Button type="button" className="w-full h-11 text-base font-semibold">Sign in</Button>
        </Link>
      </>
    );
  }

  return (
    <>
      <p className="login-subtitle">Set a new password</p>
      <form onSubmit={handleSubmit}>
        <div className="mb-1 space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <div className="password-wrapper">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }}
              onBlur={() => handleBlur("password")}
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoFocus
              className="h-11 text-base"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
            </button>
          </div>
          {fieldErrors.password && <p className="text-destructive text-xs mt-1">{fieldErrors.password}</p>}
        </div>

        <div className="mb-1 space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError("confirmPassword"); }}
            onBlur={() => handleBlur("confirmPassword")}
            placeholder="Re-enter your password"
            required
            minLength={8}
            className="h-11 text-base"
          />
          {fieldErrors.confirmPassword && <p className="text-destructive text-xs mt-1">{fieldErrors.confirmPassword}</p>}
        </div>

        {error && <p className="text-destructive text-sm mt-3" role="alert">{error}</p>}

        <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
          {loading ? "Resetting..." : "Reset password"}
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Creative</h1>
        <Suspense fallback={<p className="login-subtitle">Loading...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
