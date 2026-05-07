"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Database,
  Monitor,
  Package,
  RotateCcw,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import { FadeUp } from "@/components/ui/motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SETTINGS_GROUP_ORDER,
  SETTINGS_SECTIONS,
  isSectionVisible,
  type SettingsGroup,
  type SettingsSection,
} from "@/lib/nav-sections";
import { useFetch } from "@/hooks/use-fetch";

const STORAGE_KEY = "settings:last-tab";
const VALID_HREFS = new Set(SETTINGS_SECTIONS.map((section) => section.href));

type MeData = { user?: { role?: string } };

const GROUP_META: Record<SettingsGroup, {
  description: string;
  icon: ComponentType<{ className?: string }>;
}> = {
  Personal: {
    description: "Preferences that follow the signed-in user.",
    icon: Bell,
  },
  People: {
    description: "Access, sport context, and roster defaults.",
    icon: Users,
  },
  Inventory: {
    description: "The taxonomy and ownership labels that make gear findable.",
    icon: Package,
  },
  Scheduling: {
    description: "Calendar inputs, venues, booking presets, and overdue rules.",
    icon: CalendarDays,
  },
  Devices: {
    description: "Hardware endpoints used by self-serve workflows.",
    icon: Monitor,
  },
  System: {
    description: "Diagnostics and low-level operational checks.",
    icon: Database,
  },
};

export default function SettingsPage() {
  const { data, loading } = useFetch<MeData>({
    url: "/api/me",
    returnTo: "/settings",
    transform: (json) => json as unknown as MeData,
    refetchOnFocus: false,
  });
  const role = data?.user?.role;
  const [lastHref, setLastHref] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setLastHref(stored && VALID_HREFS.has(stored) ? stored : null);
    } catch {
      setLastHref(null);
    }
  }, []);

  const visibleSections = useMemo(() => (
    role ? SETTINGS_SECTIONS.filter((section) => isSectionVisible(section, role)) : []
  ), [role]);

  const groupedSections = useMemo(() => (
    SETTINGS_GROUP_ORDER.map((group) => ({
      group,
      sections: visibleSections.filter((section) => section.group === group),
    })).filter(({ sections }) => sections.length > 0)
  ), [visibleSections]);

  const lastSection = lastHref
    ? visibleSections.find((section) => section.href === lastHref) ?? null
    : null;

  if (loading || !role) {
    return (
      <FadeUp>
        <div className="space-y-4">
          <Skeleton className="h-20 w-full rounded-md" />
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-40 w-full rounded-md" />
            ))}
          </div>
        </div>
      </FadeUp>
    );
  }

  return (
    <FadeUp>
      <div className="space-y-5">
        <section className="rounded-md border bg-card p-4 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h2 className="text-xl font-semibold text-balance">Control center</h2>
              <p className="max-w-3xl text-sm text-muted-foreground text-pretty">
                A role-aware map of the settings that shape daily gear operations. Use the sections below when you know the domain, or search when you know the intent.
              </p>
            </div>
            {lastSection && (
              <Button asChild variant="outline" size="sm" className="min-h-10 active:scale-[0.96] transition-transform">
                <Link href={lastSection.href}>
                  <RotateCcw className="size-4" />
                  Resume {lastSection.label}
                </Link>
              </Button>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {groupedSections.map(({ group, sections }) => (
            <SettingsGroupCard key={group} group={group} sections={sections} />
          ))}
        </div>
      </div>
    </FadeUp>
  );
}

function SettingsGroupCard({
  group,
  sections,
}: {
  group: SettingsGroup;
  sections: SettingsSection[];
}) {
  const meta = GROUP_META[group];
  const Icon = meta.icon;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-start gap-3 border-b bg-muted/30 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground shadow-xs">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-tight">{group}</h3>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">{meta.description}</p>
          </div>
          <span className="ml-auto rounded-md bg-background px-2 py-1 text-xs font-medium tabular-nums text-muted-foreground shadow-xs">
            {sections.length}
          </span>
        </div>

        <div className="divide-y">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group flex min-h-16 items-center gap-3 px-4 py-3 no-underline transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground">{section.label}</div>
                <div className="mt-0.5 text-sm text-muted-foreground text-pretty">{section.description}</div>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
