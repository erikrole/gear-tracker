"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { FadeUp } from "@/components/ui/motion";
import { Card, CardContent } from "@/components/ui/card";

const STORAGE_KEY = "theme";
type ThemeChoice = "system" | "light" | "dark";

/**
 * Apply a theme choice to the document. Mirrors the inline script in
 * src/app/layout.tsx so the choice survives a page reload.
 */
function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "light") {
    root.setAttribute("data-theme", "light");
  } else if (choice === "dark") {
    root.setAttribute("data-theme", "dark");
  } else {
    // system — follow OS preference
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    if (prefersDark) root.setAttribute("data-theme", "dark");
    else root.setAttribute("data-theme", "light");
  }
}

function readStoredTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

export default function AppearancePage() {
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readStoredTheme());
    setMounted(true);
  }, []);

  // Re-apply if the OS preference changes while in "system" mode.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const handler = () => applyTheme("system");
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, [theme]);

  function pick(choice: ThemeChoice) {
    setTheme(choice);
    applyTheme(choice);
    try {
      if (choice === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      /* ignore */
    }
    toast.success(
      choice === "system"
        ? "Following your system theme"
        : `Switched to ${choice} mode`,
      { duration: 1500 }
    );
  }

  return (
    <FadeUp>
    <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-lg:grid-cols-1 max-lg:gap-4">
      <div className="sticky top-20 max-lg:static">
        <h2 className="text-2xl font-bold mb-2">Appearance</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Choose how the app looks. Saved on this device only.
        </p>
      </div>

      <div className="min-w-0">
        <Card>
          <CardContent className="py-6">
            <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
              <ThemeOption
                icon={<Sun className="size-5" />}
                label="Light"
                description="Always light, regardless of system."
                active={mounted && theme === "light"}
                onClick={() => pick("light")}
              />
              <ThemeOption
                icon={<Moon className="size-5" />}
                label="Dark"
                description="Always dark, regardless of system."
                active={mounted && theme === "dark"}
                onClick={() => pick("dark")}
              />
              <ThemeOption
                icon={<Monitor className="size-5" />}
                label="System"
                description="Match your OS preference."
                active={mounted && theme === "system"}
                onClick={() => pick("system")}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </FadeUp>
  );
}

function ThemeOption({
  icon,
  label,
  description,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 ${
        active
          ? "border-[var(--wi-red)] bg-muted/40"
          : "border-border"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-foreground">{icon}</span>
        <span className="font-semibold">{label}</span>
        {active && (
          <span className="ml-auto text-xs text-[var(--wi-red)] font-medium">Active</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground m-0">{description}</p>
    </button>
  );
}
