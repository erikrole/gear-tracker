"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFetch } from "@/hooks/use-fetch";
import { SETTINGS_SECTIONS, isSectionVisible } from "@/lib/nav-sections";

const STORAGE_KEY = "settings:last-tab";
const VALID_HREFS = new Set(SETTINGS_SECTIONS.map((s) => s.href));

type MeData = { user?: { role?: string } };

/**
 * Settings index — redirect to the user's last-visited tab if it's still
 * accessible to their role, otherwise to the first section their role can see.
 */
export default function SettingsPage() {
  const router = useRouter();
  const { data } = useFetch<MeData>({
    url: "/api/me",
    transform: (json) => json as unknown as MeData,
    refetchOnFocus: false,
  });

  useEffect(() => {
    const role = data?.user?.role;
    if (!role) return;

    const visible = SETTINGS_SECTIONS.filter((s) => isSectionVisible(s, role));
    const fallback = visible[0]?.href ?? "/";

    let target = fallback;
    try {
      const last = localStorage.getItem(STORAGE_KEY);
      if (last && VALID_HREFS.has(last)) {
        const lastSection = SETTINGS_SECTIONS.find((s) => s.href === last);
        if (lastSection && isSectionVisible(lastSection, role)) {
          target = last;
        }
      }
    } catch {
      // localStorage unavailable — fall through to first-visible
    }
    router.replace(target);
  }, [data, router]);

  return null;
}
