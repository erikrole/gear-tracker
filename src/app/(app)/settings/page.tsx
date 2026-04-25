"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SETTINGS_SECTIONS } from "@/lib/nav-sections";

const STORAGE_KEY = "settings:last-tab";
const VALID_HREFS = new Set(SETTINGS_SECTIONS.map((s) => s.href));

/**
 * Settings index — redirect to the user's last-visited tab if it's still valid,
 * otherwise fall back to Categories. The role-aware layout will redirect away
 * if they don't have access to the remembered tab.
 */
export default function SettingsPage() {
  const router = useRouter();
  useEffect(() => {
    let target = "/settings/categories";
    try {
      const last = localStorage.getItem(STORAGE_KEY);
      if (last && VALID_HREFS.has(last)) target = last;
    } catch {
      // localStorage unavailable — fall through to default
    }
    router.replace(target);
  }, [router]);
  return null;
}
