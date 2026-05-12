import { MotionConfig } from "motion/react";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { QueryProvider } from "@/components/QueryProvider";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OfflineBanner } from "@/components/OfflineBanner";
import { requireAuth } from "@/lib/auth";
import { HttpError } from "@/lib/http";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await requireAuth();
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      redirect("/login");
    }
    throw error;
  }
  if (user.forcePasswordChange) {
    redirect("/change-password");
  }

  return (
    <MotionConfig reducedMotion="user">
      <QueryProvider>
        <ConfirmProvider>
          <TooltipProvider>
            <OfflineBanner />
            <AppShell initialUser={user}>{children}</AppShell>
          </TooltipProvider>
          <Toaster position="top-right" duration={4000} />
        </ConfirmProvider>
      </QueryProvider>
    </MotionConfig>
  );
}
