"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AlertCircle, EyeIcon, EyeOffIcon, WifiOff } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useFormSubmit } from "@/hooks/use-form-submit";

type LoginResponse = {
  user?: {
    forcePasswordChange?: boolean;
  };
};

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

export default function LoginForm() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { submit, submitting, formError, clearErrors } = useFormSubmit({
    url: "/api/auth/login",
    skipAuthRedirect: true,
    onSuccess: (data: LoginResponse) => {
      router.replace(data.user?.forcePasswordChange ? "/change-password" : "/");
    },
    onError: (kind) => setIsNetworkError(kind === "network"),
  });

  function handleBlur(field: string) {
    const msg = field === "email" ? validateEmail(email) : validatePassword(password);
    setFieldErrors((prev) => ({ ...prev, [field]: msg }));
  }

  function clearFieldError(field: string) {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    }
    if (formError) {
      clearErrors();
      setIsNetworkError(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    if (emailErr || passErr) {
      setFieldErrors({ email: emailErr, password: passErr });
      if (emailErr) emailRef.current?.focus();
      else if (passErr) passwordRef.current?.focus();
      return;
    }

    setIsNetworkError(false);
    await submit({ email, password, rememberMe });
  }

  return (
    <main className="login-bg min-h-screen flex items-center justify-center p-4">
      {/* Subtle noise texture overlay */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundRepeat: "repeat", backgroundSize: "256px" }} />
      <Card className="relative w-full max-w-[420px] shadow-2xl border-0 animate-in fade-in-0 zoom-in-95 duration-500">
        <CardHeader className="text-center pb-2 pt-8">
          {/* Brand mark — Motion W */}
          <div className="flex items-center justify-center mb-3">
            <Image src="/Badgers.png" alt="Wisconsin" width={48} height={48} className="size-12 object-contain" priority />
          </div>
          <CardTitle className="text-2xl tracking-tight" style={{ fontFamily: "var(--font-heading)", fontWeight: 800 }}>Wisconsin Creative</CardTitle>
          <CardDescription className="text-base">Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
                onBlur={() => handleBlur("email")}
                placeholder="you@example.com"
                autoComplete="email"
                required
                autoFocus
                disabled={submitting}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
                className="h-11 text-base transition-colors"
              />
              <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 data-[visible=true]:grid-rows-[1fr]" data-visible={!!fieldErrors.email} aria-hidden={!fieldErrors.email}>
                <p id="email-error" role="alert" className="overflow-hidden text-destructive text-xs">{fieldErrors.email || "\u00A0"}</p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  ref={passwordRef}
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }}
                  onBlur={() => handleBlur("password")}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  disabled={submitting}
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? "password-error" : undefined}
                  className="h-11 text-base pr-11 transition-colors"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 size-11 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={submitting}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {/* Animated icon swap via CSS — keeps motion/react out of the
                      auth route bundle. prefers-reduced-motion is honored by
                      the global @media rule in globals.css. */}
                  <span
                    key={showPassword ? "hide" : "show"}
                    className="flex items-center justify-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-50 motion-safe:duration-200"
                  >
                    {showPassword ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
                  </span>
                </Button>
              </div>
              <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 data-[visible=true]:grid-rows-[1fr]" data-visible={!!fieldErrors.password} aria-hidden={!fieldErrors.password}>
                <p id="password-error" role="alert" className="overflow-hidden text-destructive text-xs">{fieldErrors.password || "\u00A0"}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="rememberMe"
                name="rememberMe"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
                className="shrink-0"
              />
              <Label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer font-normal leading-none">
                Remember me for 30 days
              </Label>
            </div>

            <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 data-[visible=true]:grid-rows-[1fr]" data-visible={!!formError}>
              <div className="overflow-hidden">
                {formError && (
                  <Alert variant="destructive" className="animate-in fade-in-0 slide-in-from-top-1 duration-200">
                    {isNetworkError ? <WifiOff className="size-4" /> : <AlertCircle className="size-4" />}
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full h-11 text-base font-semibold transition-all" disabled={submitting}>
              {submitting ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Signing in...
                </>
              ) : "Sign in"}
            </Button>

            <Separator />

            <p className="text-center text-sm text-muted-foreground">
              Access is by invitation only.{" "}
              <a
                href="mailto:erole@athletics.wisc.edu?subject=Wisconsin%20Creative%20gear-tracker%20access"
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Contact an administrator
              </a>{" "}
              to request access.
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
