import AppShell from "@/components/AppShell";
import { QueryProvider } from "@/components/QueryProvider";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OfflineBanner } from "@/components/OfflineBanner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ConfirmProvider>
        <TooltipProvider>
          <OfflineBanner />
          <AppShell>{children}</AppShell>
        </TooltipProvider>
        <Toaster position="top-right" duration={4000} />
      </ConfirmProvider>
    </QueryProvider>
  );
}
