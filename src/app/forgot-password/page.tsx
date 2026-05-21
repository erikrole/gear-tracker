"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertCircle, MailCheck, WifiOff } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useFormSubmit } from "@/hooks/use-form-submit";

type ForgotPasswordResponse = {
  message?: string;
  resetEmailConfigured?: boolean;
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState("");
  const [isNetworkError, setIsNetworkError] = useState(false);

  const { submit, submitting, formError, clearErrors } = useFormSubmit<Record<string, string>, ForgotPasswordResponse>({
    url: "/api/auth/forgot-password",
    skipAuthRedirect: true,
    onSuccess: (data) => {
      setSubmittedMessage(data.message || "If that account exists, password reset instructions are available.");
      setSubmitted(true);
    },
    onError: (kind) => setIsNetworkError(kind === "network"),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsNetworkError(false);
    await submit({ email });
  }

  return (
    <main className="login-bg min-h-screen flex items-center justify-center p-4">
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundRepeat: "repeat", backgroundSize: "256px" }} />
      <Card className="relative w-full max-w-[420px] shadow-2xl border-0 animate-in fade-in-0 zoom-in-95 duration-500">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="flex items-center justify-center mb-3">
            <Image src="/Badgers.png" alt="Wisconsin" width={48} height={48} className="size-12 object-contain" priority />
          </div>
          <CardTitle className="text-2xl tracking-tight" style={{ fontFamily: "var(--font-heading)", fontWeight: 800 }}>Wisconsin Creative</CardTitle>
          <CardDescription className="text-base">Reset your password</CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4 text-center animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
                <MailCheck className="size-6 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">Password reset request received</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {submittedMessage}
                </p>
              </div>
              <Link href="/login">
                <Button type="button" variant="outline" className="w-full h-11 text-base font-semibold">Back to sign in</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (formError) { clearErrors(); setIsNetworkError(false); } }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  autoFocus
                  disabled={submitting}
                  className="h-11 text-base transition-colors"
                />
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
                    Sending...
                  </>
                ) : "Request password reset"}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                <Link href="/login" className="font-medium text-foreground hover:underline transition-colors">Back to sign in</Link>
              </p>
              <p className="text-center text-xs text-muted-foreground">
                Need help?{" "}
                <a
                  href="mailto:erole@athletics.wisc.edu?subject=Wisconsin%20Creative%20gear-tracker%20help"
                  className="underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Contact an administrator
                </a>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
