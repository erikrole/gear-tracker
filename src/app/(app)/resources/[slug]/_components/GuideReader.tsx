"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ResourceType } from "@prisma/client";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircle2Icon, PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownReader } from "@/components/resources/MarkdownReader";
import { useFetch } from "@/hooks/use-fetch";
import { handleAuthRedirect, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
import { legacyGuideMarkdown, markdownHeadings } from "@/lib/guide-content";
import { inferResourceTypeFromCategory, RESOURCE_TYPE_LABELS } from "@/lib/guide-categories";
import type { GuideListItem } from "@/lib/guides";
import { buildSectionNav, type SectionNav } from "@/lib/resource-search";
import { cn } from "@/lib/utils";

type Guide = {
  id: string;
  title: string;
  slug: string;
  type: ResourceType;
  category: string;
  markdown: string | null;
  published: boolean;
  content: unknown;
  author: { id: string; name: string };
  lastVerifiedAt: Date | string | null;
  lastVerifiedBy: { id: string; name: string } | null;
  updatedAt: Date | string;
};

type Props = {
  guide: Guide;
  canEdit: boolean;
  slug: string;
};

type TocItem = { id: string; level: number; text: string };

type ResourceVerifyResponse = {
  data?: {
    updatedAt?: string;
  };
};

function TableOfContents({ items, activeId }: { items: TocItem[]; activeId: string | null }) {
  const scrollToHeading = useCallback((id: string) => {
    const node = document.getElementById(id);
    if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (items.length === 0) return null;

  return (
    <nav aria-label="Table of contents" className="hidden xl:block">
      <div className="guide-toc sticky top-8">
        <p
          className="mb-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
        >
          On this page
        </p>
        <div className="flex flex-col gap-1">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToHeading(item.id)}
              className={cn(
                "guide-toc-link min-h-10 w-full rounded-md px-2 py-2 text-left text-sm leading-snug transition-colors hover:text-foreground",
                item.level === 1 && "font-semibold",
                item.level === 2 && "pl-4",
                item.level === 3 && "pl-7",
                activeId === item.id
                  ? "guide-toc-link-active font-semibold text-foreground"
                  : "text-muted-foreground/70",
              )}
            >
              {item.text}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

function SiblingNav({ nav }: { nav: SectionNav }) {
  if (nav.siblings.length === 0) return null;

  return (
    <nav aria-label="In this section" className="hidden shrink-0 2xl:block 2xl:w-[220px]">
      <div className="guide-section-nav sticky top-8">
        <p
          className="mb-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
        >
          {nav.typeLabel ?? "In this section"}
        </p>
        <div className="flex flex-col gap-1">
          {nav.siblings.map((item) => (
            <Link
              key={item.id}
              href={`/resources/${item.slug}`}
              aria-current={item.current ? "page" : undefined}
              className={cn(
                "guide-section-link min-h-10 rounded-md px-2 py-2 text-sm leading-snug transition-colors hover:text-foreground",
                item.current
                  ? "guide-section-link-active font-semibold text-foreground"
                  : "text-muted-foreground/70",
              )}
            >
              {item.title}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

function PrevNext({ nav }: { nav: SectionNav }) {
  if (!nav.prev && !nav.next) return null;

  return (
    <nav
      aria-label="Section pagination"
      className="mt-2 grid gap-3 border-t border-border pt-6 sm:grid-cols-2"
    >
      {nav.prev ? (
        <Link
          href={`/resources/${nav.prev.slug}`}
          className="flex flex-col gap-1 rounded-lg border p-4 transition-colors hover:border-foreground/30 hover:bg-muted/40"
        >
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
            Previous
          </span>
          <span className="line-clamp-1 text-sm font-medium text-foreground">{nav.prev.title}</span>
        </Link>
      ) : (
        <span className="hidden sm:block" aria-hidden="true" />
      )}
      {nav.next ? (
        <Link
          href={`/resources/${nav.next.slug}`}
          className="flex flex-col items-end gap-1 rounded-lg border p-4 text-right transition-colors hover:border-foreground/30 hover:bg-muted/40"
        >
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            Next
            <ArrowRightIcon className="size-3.5" aria-hidden="true" />
          </span>
          <span className="line-clamp-1 text-sm font-medium text-foreground">{nav.next.title}</span>
        </Link>
      ) : (
        <span className="hidden sm:block" aria-hidden="true" />
      )}
    </nav>
  );
}

export function GuideReader({ guide, canEdit, slug }: Props) {
  const [updatedAt, setUpdatedAt] = useState<Date | string>(guide.updatedAt);
  const [verifying, setVerifying] = useState(false);
  const verifyingRef = useRef(false);
  const markdown = useMemo(
    () => legacyGuideMarkdown(guide.markdown, guide.content),
    [guide.content, guide.markdown],
  );
  const headings = useMemo(() => markdownHeadings(markdown), [markdown]);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);

  const { data: guideList } = useFetch<GuideListItem[]>({
    url: "/api/resources",
    transform: (json) => (json as { data: GuideListItem[] }).data ?? [],
  });
  const sectionNav = useMemo(
    () => buildSectionNav(guideList ?? [], guide.id),
    [guideList, guide.id],
  );

  async function markVerified() {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setVerifying(true);
    try {
      const res = await fetch(`/api/resources/${guide.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markVerified: true,
          expectedUpdatedAt: new Date(updatedAt).toISOString(),
        }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        toast.error(await parseErrorMessage(res, "Failed to mark guide verified"));
        return;
      }
      const json = await parseJsonSafely<ResourceVerifyResponse>(res);
      if (!json?.data?.updatedAt) {
        toast.error("Guide was verified, but the response was incomplete. Refresh and try again.");
        return;
      }
      setUpdatedAt(json.data.updatedAt);
      toast.success("Guide marked verified");
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  }

  useEffect(() => {
    if (headings.length === 0) return;

    let frame = 0;
    const updateActiveHeading = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        let activeId = headings[0]?.id ?? null;
        for (const heading of headings) {
          const node = document.getElementById(heading.id);
          if (!node) continue;
          if (node.getBoundingClientRect().top <= 140) {
            activeId = heading.id;
          } else {
            break;
          }
        }
        setActiveHeadingId(activeId);
      });
    };

    updateActiveHeading();
    window.addEventListener("scroll", updateActiveHeading, { passive: true });
    window.addEventListener("resize", updateActiveHeading);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateActiveHeading);
      window.removeEventListener("resize", updateActiveHeading);
    };
  }, [guide.id, headings]);

  const hasToC = headings.length >= 2;
  const guideType = guide.type ?? inferResourceTypeFromCategory(guide.category);
  const typeLabel = RESOURCE_TYPE_LABELS[guideType];

  return (
    <div className="guide-reader-shell mx-auto flex w-full max-w-[1440px] justify-center gap-10 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <SiblingNav nav={sectionNav} />

      <div className="flex w-full min-w-0 max-w-[1120px] flex-col gap-8">
      <div>
        <Link
          href="/resources"
          className="inline-flex min-h-10 items-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          All guides
        </Link>
      </div>

      <div className="guide-reader-header flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 max-w-4xl flex-col gap-3">
          <h1 className="guide-reader-title">{guide.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{typeLabel}</Badge>
            {guide.category && guide.category !== typeLabel && (
              <Badge variant="outline">{guide.category}</Badge>
            )}
            {!guide.published && (
              <Badge variant="outline" className="text-[10px]">Draft</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              Updated{" "}
              {new Date(updatedAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              loading={verifying}
              disabled={verifying}
              onClick={markVerified}
            >
              {!verifying && <CheckCircle2Icon data-icon="inline-start" />}
              Mark verified
            </Button>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href={`/resources/${slug}/edit`}>
                <PencilIcon data-icon="inline-start" />
                Edit
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className={cn("guide-reader-grid", hasToC && "xl:grid xl:grid-cols-[minmax(0,860px)_220px] xl:gap-12")}>
        <article className="guide-article min-w-0">
          <MarkdownReader markdown={markdown || "_No content yet._"} />
        </article>

        {hasToC && (
          <TableOfContents items={headings} activeId={activeHeadingId} />
        )}
      </div>

      <PrevNext nav={sectionNav} />
      </div>
    </div>
  );
}
