"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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
          <button type="button" className="login-btn">Request a new link</button>
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
          <button type="button" className="login-btn">Sign in</button>
        </Link>
      </>
    );
  }

  return (
    <>
      <p className="login-subtitle">Set a new password</p>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="password">New password</label>
          <div className="password-wrapper">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }}
              onBlur={() => handleBlur("password")}
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoFocus
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {fieldErrors.password && <div className="field-error">{fieldErrors.password}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm password</label>
          <input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError("confirmPassword"); }}
            onBlur={() => handleBlur("confirmPassword")}
            placeholder="Re-enter your password"
            required
            minLength={8}
          />
          {fieldErrors.confirmPassword && <div className="field-error">{fieldErrors.confirmPassword}</div>}
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}

        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? "Resetting..." : "Reset password"}
        </button>
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
