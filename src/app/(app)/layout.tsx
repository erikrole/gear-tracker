import AppShell from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <TooltipProvider>
        <AppShell>{children}</AppShell>
      </TooltipProvider>
      <Toaster position="top-right" duration={4000} />
    </ConfirmProvider>
  );
}
