"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Database,
  Eye,
  Monitor,
  Package,
  RotateCcw,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import { FadeUp } from "@/components/ui/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const roleLabel = role ? role.charAt(0) + role.slice(1).toLowerCase() : "User";

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
        <section className="rounded-lg border bg-card p-4 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-balance">Control center</h2>
                <Badge variant="outline" className="gap-1.5">
                  <ShieldCheck className="size-3" />
                  {roleLabel}
                </Badge>
              </div>
              <p className="max-w-3xl text-sm text-muted-foreground text-pretty">
                A role-aware map of the settings that shape daily gear operations. Use the sections below when you know the domain, or search when you know the intent.
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
                  <Eye className="size-3.5" />
                  <span className="tabular-nums">{visibleSections.length}</span> visible sections
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
                  <span className="tabular-nums">{groupedSections.length}</span> groups
                </span>
              </div>
            </div>
            {lastSection && (
              <Button asChild variant="outline" size="sm" className="min-h-10">
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
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="border-b bg-muted/30 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground shadow-xs">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base leading-tight text-balance">{group}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">{meta.description}</p>
          </div>
          <Badge variant="outline" className="shrink-0 tabular-nums">
            {sections.length}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="divide-y">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group flex min-h-16 items-center gap-3 px-4 py-3 no-underline transition-[background-color,scale] hover:bg-muted/50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium text-foreground">{section.label}</div>
                  <SettingsRoleBadge requiredRole={section.requiredRole} />
                </div>
                <div className="mt-0.5 text-sm text-muted-foreground text-pretty">{section.description}</div>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-60 transition-[color,opacity,translate] group-hover:translate-x-0.5 group-hover:text-foreground group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsRoleBadge({ requiredRole }: { requiredRole: SettingsSection["requiredRole"] }) {
  if (requiredRole === "STUDENT") {
    return (
      <Badge variant="gray" size="sm">
        Everyone
      </Badge>
    );
  }

  return (
    <Badge variant={requiredRole === "ADMIN" ? "purple" : "blue"} size="sm">
      {requiredRole === "ADMIN" ? "Admin" : "Staff+"}
    </Badge>
  );
}
