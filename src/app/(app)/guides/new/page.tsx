"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/react/style.css";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useFetch } from "@/hooks/use-fetch";
import type { GuideListItem } from "@/lib/guides";
import { Role } from "@prisma/client";
import { handleAuthRedirect } from "@/lib/errors";

type MeResponse = { id: string; role: Role };

export default function NewGuidePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function uploadFile(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/guides/upload-image", { method: "POST", body: fd });
    if (!res.ok) throw new Error("Image upload failed");
    const json = (await res.json()) as { url: string };
    return json.url;
  }

  const editor = useCreateBlockNote({ uploadFile });

  const { data: meData } = useFetch<MeResponse>({
    url: "/api/me",
    transform: (json) => (json as { user: MeResponse }).user,
  });

  const { data: guides } = useFetch<GuideListItem[]>({
    url: "/api/guides",
    transform: (json) => (json as { data: GuideListItem[] }).data ?? [],
  });

  const existingCategories = useMemo(() => {
    if (!guides) return [];
    const seen = new Set<string>();
    for (const g of guides) seen.add(g.category);
    return [...seen].sort();
  }, [guides]);

  // Redirect non-staff away
  const canCreate = meData?.role === Role.STAFF || meData?.role === Role.ADMIN;

  async function submit(published: boolean) {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!category.trim()) {
      toast.error("Category is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/guides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category: category.trim(),
          content: editor.document as PartialBlock[],
          published,
        }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(json.error ?? "Failed to create guide");
        return;
      }
      const json = (await res.json()) as { data: { slug: string } };
      toast.success(published ? "Guide published" : "Draft saved");
      router.push(`/guides/${json.data.slug}`);
    } catch {
      toast.error("Network error — try again");
    } finally {
      setSubmitting(false);
    }
  }

  if (meData && !canCreate) {
    router.replace("/guides");
    return null;
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <div>
        <Link
          href="/guides"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="size-3.5" />
          Guides
        </Link>
      </div>

      <h1 className="text-2xl font-bold">New Guide</h1>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="e.g. Clip Naming Guide"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            placeholder="e.g. Photo, Video, Graphics"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            list="category-suggestions"
            disabled={submitting}
          />
          {existingCategories.length > 0 && (
            <datalist id="category-suggestions">
              {existingCategories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          )}
        </div>
      </div>

      <div className="rounded-lg border min-h-[600px]">
        <BlockNoteView editor={editor} editable={!submitting} />
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={() => submit(false)}
          variant="outline"
          disabled={submitting}
        >
          Save as Draft
        </Button>
        <Button onClick={() => submit(true)} disabled={submitting}>
          Publish
        </Button>
      </div>
    </div>
  );
}
