"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, EyeIcon, EyeOffIcon, Loader2, WifiOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

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
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isNetworkError, setIsNetworkError] = useState(false);
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
    if (error) {
      setError("");
      setIsNetworkError(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setIsNetworkError(false);

    const nameErr = validateName(name);
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    if (nameErr || emailErr || passErr) {
      setFieldErrors({ name: nameErr, email: emailErr, password: passErr });
      if (nameErr) nameRef.current?.focus();
      else if (emailErr) emailRef.current?.focus();
      else if (passErr) passwordRef.current?.focus();
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        let message = "Registration failed";
        try {
          const json = await res.json();
          message = json.error || message;
        } catch {
          // Non-JSON response
        }
        throw new Error(message);
      }

      router.replace("/");
    } catch (err) {
      if (err instanceof TypeError) {
        setIsNetworkError(true);
        setError("You're offline — check your internet connection and try again");
      } else {
        setError(err instanceof Error ? err.message : "Registration failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-black p-4">
      <Card className="w-full max-w-[400px] shadow-lg animate-in fade-in-0 zoom-in-95 duration-300">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold tracking-tight">Creative</CardTitle>
          <CardDescription className="text-base">Create your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                ref={nameRef}
                id="name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); clearFieldError("name"); }}
                onBlur={() => handleBlur("name")}
                placeholder="Your full name"
                autoComplete="name"
                required
                autoFocus
                disabled={loading}
                aria-invalid={!!fieldErrors.name}
                aria-describedby={fieldErrors.name ? "name-error" : undefined}
                className="h-11 text-base transition-colors"
              />
              <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 data-[visible=true]:grid-rows-[1fr]" data-visible={!!fieldErrors.name}>
                <p id="name-error" className="overflow-hidden text-destructive text-xs">{fieldErrors.name || "\u00A0"}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                ref={emailRef}
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
                onBlur={() => handleBlur("email")}
                placeholder="you@example.com"
                autoComplete="email"
                required
                disabled={loading}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
                className="h-11 text-base transition-colors"
              />
              <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 data-[visible=true]:grid-rows-[1fr]" data-visible={!!fieldErrors.email}>
                <p id="email-error" className="overflow-hidden text-destructive text-xs">{fieldErrors.email || "\u00A0"}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  ref={passwordRef}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }}
                  onBlur={() => handleBlur("password")}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  disabled={loading}
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? "password-error" : undefined}
                  className="h-11 text-base pr-11 transition-colors"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-11 w-11 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
                </Button>
              </div>
              <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 data-[visible=true]:grid-rows-[1fr]" data-visible={!!fieldErrors.password}>
                <p id="password-error" className="overflow-hidden text-destructive text-xs">{fieldErrors.password || "\u00A0"}</p>
              </div>
            </div>

            <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 data-[visible=true]:grid-rows-[1fr]" data-visible={!!error}>
              <div className="overflow-hidden">
                {error && (
                  <Alert variant="destructive" className="animate-in fade-in-0 slide-in-from-top-1 duration-200">
                    {isNetworkError ? <WifiOff className="size-4" /> : <AlertCircle className="size-4" />}
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full h-11 text-base font-semibold transition-all" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating account...
                </>
              ) : "Create account"}
            </Button>

            <Separator />

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-foreground hover:underline transition-colors">Sign in</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
