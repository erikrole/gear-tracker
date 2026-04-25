"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun, Type } from "lucide-react";
import { toast } from "sonner";
import { FadeUp } from "@/components/ui/motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const THEME_KEY = "theme";
const SCALE_KEY = "text-scale";

type ThemeChoice = "system" | "light" | "dark";

type ScaleChoice = {
  id: "small" | "default" | "large" | "xlarge";
  label: string;
  value: number;
};

const SCALE_CHOICES: ScaleChoice[] = [
  { id: "small",   label: "Small",       value: 0.9 },
  { id: "default", label: "Default",     value: 1.0 },
  { id: "large",   label: "Large",       value: 1.15 },
  { id: "xlarge",  label: "Extra large", value: 1.3 },
];

function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "light") {
    root.setAttribute("data-theme", "light");
  } else if (choice === "dark") {
    root.setAttribute("data-theme", "dark");
  } else {
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    root.setAttribute("data-theme", prefersDark ? "dark" : "light");
  }
}

function readStoredTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark") return v;
  } catch { /* ignore */ }
  return "system";
}

function applyScale(value: number) {
  document.documentElement.style.setProperty("--text-scale", String(value));
}

function readStoredScale(): number {
  try {
    const v = localStorage.getItem(SCALE_KEY);
    const n = v ? parseFloat(v) : NaN;
    if (Number.isFinite(n) && n >= 0.85 && n <= 1.4) return n;
  } catch { /* ignore */ }
  return 1;
}

export default function AppearancePage() {
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [scale, setScale] = useState<number>(1);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readStoredTheme());
    setScale(readStoredScale());
    setMounted(true);
  }, []);

  // Re-apply theme when OS preference changes while in "system" mode.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const handler = () => applyTheme("system");
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, [theme]);

  function pickTheme(choice: ThemeChoice) {
    setTheme(choice);
    applyTheme(choice);
    try {
      if (choice === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, choice);
    } catch { /* ignore */ }
    toast.success(
      choice === "system" ? "Following your system theme" : `Switched to ${choice} mode`,
      { duration: 1500 }
    );
  }

  function pickScale(value: number) {
    setScale(value);
    applyScale(value);
    try {
      if (value === 1) localStorage.removeItem(SCALE_KEY);
      else localStorage.setItem(SCALE_KEY, String(value));
    } catch { /* ignore */ }
  }

  function resetAll() {
    pickTheme("system");
    pickScale(1);
  }

  return (
    <FadeUp>
    <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-lg:grid-cols-1 max-lg:gap-4">
      <div className="sticky top-20 max-lg:static">
        <h2 className="text-2xl font-bold mb-2">Appearance</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Choose how the app looks. Saved on this device only — set it again on
          your phone or other browsers.
        </p>
      </div>

      <div className="min-w-0 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Theme</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
              <ChoiceCard
                icon={<Sun className="size-5" />}
                label="Light"
                description="Always light, regardless of system."
                active={mounted && theme === "light"}
                onClick={() => pickTheme("light")}
              />
              <ChoiceCard
                icon={<Moon className="size-5" />}
                label="Dark"
                description="Always dark, regardless of system."
                active={mounted && theme === "dark"}
                onClick={() => pickTheme("dark")}
              />
              <ChoiceCard
                icon={<Monitor className="size-5" />}
                label="System"
                description="Match your OS preference."
                active={mounted && theme === "system"}
                onClick={() => pickTheme("system")}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Type className="size-4" />
              Text size
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-2 max-sm:grid-cols-2">
              {SCALE_CHOICES.map((c) => {
                const isActive = mounted && Math.abs(scale - c.value) < 0.001;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickScale(c.value)}
                    aria-pressed={isActive}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-3 transition-colors hover:bg-muted/50 ${
                      isActive ? "border-[var(--wi-red)] bg-muted/40" : "border-border"
                    }`}
                  >
                    <span style={{ fontSize: `${14 * c.value}px` }} className="font-semibold">
                      Aa
                    </span>
                    <span className="text-xs text-muted-foreground">{c.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Live preview */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Preview
              </div>
              <p className="text-base m-0">
                A preview line at the body size, so you can feel the difference
                before committing.
              </p>
              <p className="text-sm text-muted-foreground m-0">
                Smaller secondary text, like the help copy under form fields.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetAll}
            disabled={!mounted || (theme === "system" && Math.abs(scale - 1) < 0.001)}
          >
            Reset to defaults
          </Button>
        </div>
      </div>
    </div>
    </FadeUp>
  );
}

function ChoiceCard({
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
        active ? "border-[var(--wi-red)] bg-muted/40" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2 w-full">
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
