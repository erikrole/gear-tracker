"use client";

import Link from "next/link";
import type { PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/react/style.css";
import { ArrowLeftIcon, PencilIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

export function GuideReader({ guide, canEdit, slug }: Props) {
  const editor = useCreateBlockNote({
    initialContent: Array.isArray(guide.content)
      ? (guide.content as PartialBlock[])
      : undefined,
  });

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
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

      {/* BlockNote reader */}
      <div className="prose-blocknote">
        <BlockNoteView editor={editor} editable={false} />
      </div>
    </div>
  );
}
