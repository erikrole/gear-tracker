"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { SETTINGS_SECTIONS, isSectionVisible } from "@/lib/nav-sections";

type AuthState = "loading" | "authorized" | "denied";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        const r = json?.user?.role;
        if (r === "ADMIN" || r === "STAFF") {
          setRole(r);
          setAuthState("authorized");
        } else {
          setAuthState("denied");
          router.replace("/");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setAuthState("denied");
        router.replace("/");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const visibleSections = role
    ? SETTINGS_SECTIONS.filter((s) => isSectionVisible(s, role))
    : SETTINGS_SECTIONS;

  // Render shell immediately to avoid blank flicker on every settings nav.
  return (
    <>
      <PageHeader title="Settings" className="mb-0" />

      <nav className="flex gap-0 border-b mb-6 overflow-x-auto" aria-label="Settings sections">
        {visibleSections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={`px-4 py-2.5 text-sm font-medium no-underline transition-colors border-b-2 -mb-px whitespace-nowrap ${pathname.startsWith(s.href) ? "text-foreground border-[var(--wi-red)] font-semibold" : "text-muted-foreground border-transparent hover:text-foreground"}`}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      {authState === "loading" ? (
        <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-md:grid-cols-1 max-md:gap-4">
          <div className="sticky top-20 max-md:static space-y-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="min-w-0 space-y-3">
            <Skeleton className="h-9 w-full max-w-md" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      ) : authState === "authorized" ? (
        children
      ) : null}
    </>
  );
}
