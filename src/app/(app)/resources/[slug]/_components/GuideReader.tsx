"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, CheckCircle2Icon, PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownReader } from "@/components/resources/MarkdownReader";
import { handleAuthRedirect, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
import { formatFreshnessDate, getGuideFreshness } from "@/lib/guide-freshness";
import { legacyGuideMarkdown, markdownHeadings } from "@/lib/guide-content";
import { cn } from "@/lib/utils";

type Guide = {
  id: string;
  title: string;
  slug: string;
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
    lastVerifiedAt?: string | null;
    lastVerifiedBy?: { id: string; name: string } | null;
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
          className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          On this page
        </p>
        <div className="space-y-1">
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

export function GuideReader({ guide, canEdit, slug }: Props) {
  const [lastVerifiedAt, setLastVerifiedAt] = useState<Date | string | null>(guide.lastVerifiedAt);
  const [lastVerifiedBy, setLastVerifiedBy] = useState<{ id: string; name: string } | null>(guide.lastVerifiedBy);
  const [updatedAt, setUpdatedAt] = useState<Date | string>(guide.updatedAt);
  const [verifying, setVerifying] = useState(false);
  const verifyingRef = useRef(false);
  const markdown = useMemo(
    () => legacyGuideMarkdown(guide.markdown, guide.content),
    [guide.content, guide.markdown],
  );
  const freshness = getGuideFreshness({ updatedAt, lastVerifiedAt });
  const headings = useMemo(() => markdownHeadings(markdown), [markdown]);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);

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
        toast.error(await parseErrorMessage(res, "Failed to mark resource verified"));
        return;
      }
      const json = await parseJsonSafely<ResourceVerifyResponse>(res);
      if (!json?.data?.updatedAt) {
        toast.error("Resource was verified, but the response was incomplete. Refresh and try again.");
        return;
      }
      setLastVerifiedAt(json.data.lastVerifiedAt ?? null);
      setLastVerifiedBy(json.data.lastVerifiedBy ?? null);
      setUpdatedAt(json.data.updatedAt);
      toast.success("Resource marked verified");
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

  return (
    <div className="guide-reader-shell mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div>
        <Link
          href="/resources"
          className="inline-flex min-h-10 items-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Guides
        </Link>
      </div>

      <div className="guide-reader-header flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 max-w-4xl flex-col gap-3">
          <h1 className="guide-reader-title">{guide.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{guide.category}</Badge>
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
            <Badge
              variant={freshness.status === "verified" ? "green" : "orange"}
              title={freshness.detail}
            >
              {freshness.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {lastVerifiedAt
                ? `Last verified ${formatFreshnessDate(lastVerifiedAt)}${lastVerifiedBy ? ` by ${lastVerifiedBy.name}` : ""}`
                : "Never verified"}
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
              disabled={verifying}
              onClick={markVerified}
            >
              <CheckCircle2Icon className="mr-1.5 size-3.5" />
              {verifying ? "Verifying..." : "Mark verified"}
            </Button>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href={`/resources/${slug}/edit`}>
                <PencilIcon className="mr-1.5 size-3.5" />
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
    </div>
  );
}
