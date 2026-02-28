import AppShell from "@/components/AppShell";

export const runtime = "edge";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
