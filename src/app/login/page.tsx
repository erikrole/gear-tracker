"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

function validateEmail(email: string): string {
  if (!email) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email format";
  return "";
}

function validatePassword(password: string): string {
  if (!password) return "Password is required";
  if (password.length < 8) return "Must be at least 8 characters";
  return "";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function handleBlur(field: string) {
    const msg = field === "email" ? validateEmail(email) : validatePassword(password);
    setFieldErrors((prev) => ({ ...prev, [field]: msg }));
  }

  function clearFieldError(field: string) {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    if (emailErr || passErr) {
      setFieldErrors({ email: emailErr, password: passErr });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Invalid credentials");
      }

      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Creative</h1>
        <p className="login-subtitle">Sign in to your account</p>

        <div className="mb-4 space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
            onBlur={() => handleBlur("email")}
            placeholder="you@example.com"
            required
            autoFocus
            className="h-11 text-base"
          />
          {fieldErrors.email && <p className="text-destructive text-xs mt-1">{fieldErrors.email}</p>}
        </div>

        <div className="mb-4 space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="password-wrapper">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }}
              onBlur={() => handleBlur("password")}
              placeholder="Enter your password"
              required
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

        <div className="flex items-center gap-2 mb-4">
          <Checkbox
            id="rememberMe"
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(checked === true)}
            className="shrink-0"
          />
          <Label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer font-normal leading-none">
            Remember me for 30 days
          </Label>
        </div>

        {error && <p className="text-destructive text-sm mt-3" role="alert">{error}</p>}

        <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          <Link href="/forgot-password">Forgot password?</Link>
        </p>
        <p style={{ textAlign: "center", marginTop: 8, fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          Don&apos;t have an account?{" "}
          <Link href="/register">Create one</Link>
        </p>
      </form>
    </div>
  );
}
