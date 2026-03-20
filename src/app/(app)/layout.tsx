import AppShell from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmProvider } from "@/components/ConfirmDialog";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <AppShell>{children}</AppShell>
      <Toaster position="top-right" duration={4000} />
    </ConfirmProvider>
  );
}
