"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import type { PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/react/style.css";
import { ArrowLeftIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useFetch } from "@/hooks/use-fetch";
import { Role } from "@prisma/client";
import { handleAuthRedirect } from "@/lib/errors";

type Guide = {
  id: string;
  title: string;
  slug: string;
  category: string;
  published: boolean;
  content: unknown;
  author: { id: string; name: string };
  updatedAt: string;
};

type MeResponse = { id: string; role: Role };

type Props = { params: Promise<{ slug: string }> };

export default function EditGuidePage({ params }: Props) {
  const { slug } = use(params);
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [published, setPublished] = useState(false);
  const [guideId, setGuideId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [isDark, setIsDark] = useState(() =>
    typeof window !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark"
  );

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

  const { data: guide, loading } = useFetch<Guide>({
    url: `/api/guides/${slug}`,
    transform: (json) => (json as { data: Guide }).data,
  });

  // Pre-populate form once guide is loaded
  const populate = useCallback(
    (g: Guide) => {
      setTitle(g.title);
      setCategory(g.category);
      setPublished(g.published);
      setGuideId(g.id);
      if (Array.isArray(g.content)) {
        editor.replaceBlocks(editor.document, g.content as PartialBlock[]);
      }
      setReady(true);
    },
    [editor],
  );

  useEffect(() => {
    if (guide && !ready) populate(guide);
  }, [guide, ready, populate]);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  // Warn on navigation away with unsaved changes
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const canEdit = meData?.role === Role.ADMIN || meData?.role === Role.STAFF;
  const canDelete = meData?.role === Role.ADMIN;

  async function submit() {
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (!category.trim()) { toast.error("Category is required"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/guides/${guideId}`, {
        method: "PATCH",
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
        toast.error(json.error ?? "Failed to save guide");
        return;
      }
      const json = (await res.json()) as { data: { slug: string } };
      setDirty(false);
      toast.success("Guide saved");
      router.push(`/guides/${json.data.slug}`);
    } catch {
      toast.error("Network error — try again");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/guides/${guideId}`, { method: "DELETE" });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        toast.error("Failed to delete guide");
        return;
      }
      toast.success("Guide deleted");
      router.push("/guides");
    } catch {
      toast.error("Network error — try again");
    } finally {
      setSubmitting(false);
    }
  }

  if (meData && !canEdit) {
    router.replace(`/guides/${slug}`);
    return null;
  }

  if (loading || !ready) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <div>
        <Link
          href={`/guides/${slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back to guide
        </Link>
      </div>

      <h1 className="text-2xl font-bold">Edit Guide</h1>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
            disabled={submitting}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setDirty(true); }}
            disabled={submitting}
          />
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id="published"
            checked={published}
            onCheckedChange={(v) => { setPublished(v); setDirty(true); }}
            disabled={submitting}
          />
          <Label htmlFor="published" className="cursor-pointer">
            {published ? "Published" : "Draft"}
          </Label>
        </div>
      </div>

      <div className="rounded-lg border min-h-[600px]">
        <BlockNoteView
          editor={editor}
          editable={!submitting}
          theme={isDark ? "dark" : "light"}
          onChange={() => setDirty(true)}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button onClick={submit} disabled={submitting}>
            Save
          </Button>
          <Button
            variant="outline"
            asChild
            disabled={submitting}
          >
            <Link href={`/guides/${slug}`}>Cancel</Link>
          </Button>
        </div>

        {canDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={submitting}>
                <Trash2Icon className="size-4 mr-1.5" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete guide?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &ldquo;{title}&rdquo;. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
