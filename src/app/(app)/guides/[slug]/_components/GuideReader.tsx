"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/react/style.css";
import { ArrowLeftIcon, PencilIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Guide = {
  id: string;
  title: string;
  slug: string;
  category: string;
  published: boolean;
  content: unknown;
  author: { id: string; name: string };
  updatedAt: Date;
};

type Props = {
  guide: Guide;
  canEdit: boolean;
  slug: string;
};

type TocItem = { level: number; text: string };

function extractHeadings(content: unknown): TocItem[] {
  if (!Array.isArray(content)) return [];
  const items: TocItem[] = [];
  for (const block of content) {
    if (block?.type === "heading" && Array.isArray(block.content)) {
      const level = block.props?.level ?? 1;
      const text = block.content
        .filter((c: { type: string }) => c.type === "text")
        .map((c: { text: string }) => c.text)
        .join("")
        .trim();
      if (text) items.push({ level, text });
    }
  }
  return items;
}

function TableOfContents({ items, activeText }: { items: TocItem[]; activeText: string | null }) {
  const scrollToHeading = useCallback((text: string) => {
    // Find heading element in BlockNote's rendered output by text match
    const allNodes = document.querySelectorAll<HTMLElement>(".bn-block-content");
    for (const node of allNodes) {
      if (node.textContent?.trim() === text) {
        node.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
  }, []);

  if (items.length === 0) return null;

  return (
    <nav aria-label="Table of contents" className="hidden lg:block">
      <div className="sticky top-4 space-y-1">
        <p
          className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/50 mb-2 font-semibold"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          On this page
        </p>
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => scrollToHeading(item.text)}
            className={cn(
              "block w-full text-left text-xs leading-relaxed transition-colors py-0.5 hover:text-foreground",
              item.level === 1 && "font-medium",
              item.level === 2 && "pl-3",
              item.level === 3 && "pl-6",
              activeText === item.text
                ? "text-foreground font-medium"
                : "text-muted-foreground/70",
            )}
          >
            {item.text}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function GuideReader({ guide, canEdit, slug }: Props) {
  const editor = useCreateBlockNote({
    initialContent: Array.isArray(guide.content)
      ? (guide.content as PartialBlock[])
      : undefined,
  });

  const [isDark, setIsDark] = useState(() =>
    typeof window !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark"
  );
  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const headings = extractHeadings(guide.content);

  // Track active heading via IntersectionObserver
  useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveHeading(entry.target.textContent?.trim() ?? null);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );

    // Observe after a short delay to let BlockNote render
    const timer = setTimeout(() => {
      const nodes = document.querySelectorAll<HTMLElement>(".bn-block-content");
      for (const node of nodes) {
        const text = node.textContent?.trim();
        if (text && headings.some((h) => h.text === text)) {
          observer.observe(node);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide.id]);

  const hasToC = headings.length >= 2;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Back link */}
      <div>
        <Link
          href="/guides"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="size-3.5" />
          Guides
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold leading-tight">{guide.title}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{guide.category}</Badge>
            {!guide.published && (
              <Badge variant="outline" className="text-[10px]">Draft</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              Updated{" "}
              {new Date(guide.updatedAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
        {canEdit && (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href={`/guides/${slug}/edit`}>
              <PencilIcon className="size-3.5 mr-1.5" />
              Edit
            </Link>
          </Button>
        )}
      </div>

      {/* Content + optional ToC sidebar */}
      <div className={cn(hasToC && "lg:grid lg:grid-cols-[1fr_160px] lg:gap-8")}>
        {/* BlockNote reader */}
        <div ref={contentRef} className="prose-blocknote min-w-0">
          <BlockNoteView editor={editor} editable={false} theme={isDark ? "dark" : "light"} />
        </div>

        {hasToC && (
          <TableOfContents items={headings} activeText={activeHeading} />
        )}
      </div>
    </div>
  );
}
