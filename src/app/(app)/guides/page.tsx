"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Role } from "@prisma/client";
import { PlusIcon, SearchIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import { useFetch } from "@/hooks/use-fetch";
import type { GuideListItem } from "@/lib/guides";

type MeResponse = { id: string; role: Role };

export default function GuidesPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const { data: guides, loading: guidesLoading } = useFetch<GuideListItem[]>({
    url: "/api/guides",
    transform: (json) => (json as { data: GuideListItem[] }).data ?? [],
  });

  const { data: meData } = useFetch<MeResponse>({
    url: "/api/me",
    transform: (json) => (json as { user: MeResponse }).user,
  });

  const isStaffOrAdmin =
    meData?.role === Role.STAFF || meData?.role === Role.ADMIN;

  const categories = useMemo(() => {
    if (!guides) return [];
    const seen = new Set<string>();
    for (const g of guides) seen.add(g.category);
    return [...seen].sort();
  }, [guides]);

  const filtered = useMemo(() => {
    if (!guides) return [];
    return guides.filter((g) => {
      const matchesSearch =
        !search || g.title.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        activeCategory === "All" || g.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [guides, search, activeCategory]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Guides"
        description="SOPs and how-to guides for Wisconsin Athletics Creative"
      >
        {isStaffOrAdmin && (
          <Button asChild size="sm">
            <Link href="/guides/new">
              <PlusIcon className="size-4 mr-1.5" />
              New Guide
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* Search */}
      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search guides…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Category filter chips */}
      {!guidesLoading && categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {["All", ...categories].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={[
                "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                activeCategory === cat
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground",
              ].join(" ")}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {guidesLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="folder"
          title={search || activeCategory !== "All" ? "No guides match your filters" : "No guides yet"}
          description={
            isStaffOrAdmin
              ? "Create the first guide to get started."
              : "Check back later for guides."
          }
          actionLabel={isStaffOrAdmin ? "New Guide" : undefined}
          actionHref={isStaffOrAdmin ? "/guides/new" : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((guide) => (
            <Link
              key={guide.id}
              href={`/guides/${guide.slug}`}
              className="group rounded-lg border bg-card p-4 hover:border-foreground/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-sm font-semibold leading-snug group-hover:text-foreground line-clamp-2">
                  {guide.title}
                </span>
                {!guide.published && (
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    Draft
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-[10px]">
                  {guide.category}
                </Badge>
                <span>
                  {new Date(guide.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
