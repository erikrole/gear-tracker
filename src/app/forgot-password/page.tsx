"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, MailCheck, WifiOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useFormSubmit } from "@/hooks/use-form-submit";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isNetworkError, setIsNetworkError] = useState(false);

  const { submit, submitting, formError, clearErrors } = useFormSubmit({
    url: "/api/auth/forgot-password",
    skipAuthRedirect: true,
    onSuccess: () => setSubmitted(true),
    onError: (kind) => setIsNetworkError(kind === "network"),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsNetworkError(false);
    await submit({ email });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-black p-4">
      <Card className="w-full max-w-[400px] shadow-lg animate-in fade-in-0 zoom-in-95 duration-300">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold tracking-tight">Creative</CardTitle>
          <CardDescription className="text-base">Reset your password</CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4 text-center animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
                <MailCheck className="size-6 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">Check your email</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  If an account exists for <span className="font-medium text-foreground">{email}</span>, we&apos;ve sent a password reset link.
                </p>
              </div>
              <Link href="/login">
                <Button type="button" variant="outline" className="w-full h-11 text-base font-semibold">
                  Back to sign in
                </Button>
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
                    <Loader2 className="size-4 animate-spin" />
                    Sending...
                  </>
                ) : "Send reset link"}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                <Link href="/login" className="font-medium text-foreground hover:underline transition-colors">Back to sign in</Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
