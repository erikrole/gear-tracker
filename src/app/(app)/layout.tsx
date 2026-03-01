import AppShell from "@/components/AppShell";
import { ToastProvider } from "@/components/Toast";

export const runtime = "edge";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AppShell>{children}</AppShell>
    </ToastProvider>
  );
}
