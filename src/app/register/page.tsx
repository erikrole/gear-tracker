"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function validateName(name: string): string {
  if (!name.trim()) return "Name is required";
  return "";
}

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

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function handleBlur(field: string) {
    const validators: Record<string, () => string> = {
      name: () => validateName(name),
      email: () => validateEmail(email),
      password: () => validatePassword(password),
    };
    const msg = validators[field]?.() ?? "";
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

    const nameErr = validateName(name);
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    if (nameErr || emailErr || passErr) {
      setFieldErrors({ name: nameErr, email: emailErr, password: passErr });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Registration failed");
      }

      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Creative</h1>
        <p className="login-subtitle">Create your account</p>

        <div className="mb-4 space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); clearFieldError("name"); }}
            onBlur={() => handleBlur("name")}
            placeholder="Your full name"
            required
            autoFocus
            className="h-11 text-base"
          />
          {fieldErrors.name && <p className="text-destructive text-xs mt-1">{fieldErrors.name}</p>}
        </div>

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
              placeholder="At least 8 characters"
              required
              minLength={8}
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

        {error && <p className="text-destructive text-sm mt-3" role="alert">{error}</p>}

        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </button>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          Already have an account?{" "}
          <Link href="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
