"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { SETTINGS_SECTIONS } from "@/lib/nav-sections";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const role = json?.user?.role;
        if (role === "ADMIN" || role === "STAFF") {
          setAuthorized(true);
        } else {
          router.replace("/");
        }
      })
      .catch(() => router.replace("/"));
  }, [router]);

  if (!authorized) return null;

  return (
    <>
      <div className="flex items-center justify-between mb-0 max-md:flex-col max-md:items-start max-md:gap-3">
        <h1 className="text-[30px] tracking-[-0.03em] leading-none m-0 max-md:text-[22px]">Settings</h1>
      </div>

      <nav className="flex gap-0 border-b mb-5">
        {SETTINGS_SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={`px-4 py-2.5 text-sm font-medium no-underline transition-colors border-b-2 -mb-px ${pathname.startsWith(s.href) ? "text-foreground border-primary font-semibold" : "text-muted-foreground border-transparent hover:text-foreground"}`}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      {children}
    </>
  );
}
