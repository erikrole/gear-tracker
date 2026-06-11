"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
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
import { Role, ShiftArea } from "@prisma/client";
import { handleAuthRedirect, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
import { KNOWLEDGE_BASE_CATEGORY_SUGGESTIONS } from "@/lib/guide-categories";
import { legacyGuideMarkdown } from "@/lib/guide-content";
import { GuideTargetingControls } from "@/components/resources/GuideTargetingControls";
import { MarkdownEditor } from "@/components/resources/MarkdownEditor";

type Guide = {
  id: string;
  title: string;
  slug: string;
  category: string;
  markdown: string | null;
  targetRoles: Role[];
  targetAreas: ShiftArea[];
  featured: boolean;
  featuredRank: number | null;
  published: boolean;
  content: unknown;
  author: { id: string; name: string };
  updatedAt: string;
};

type Props = { slug: string; userRole: Role };

type ResourceMutationResponse = {
  data?: {
    slug?: string;
  };
};

type ResourceUploadResponse = {
  url?: string;
};

export function EditGuideClient({ slug, userRole }: Props) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [targetRoles, setTargetRoles] = useState<Role[]>([]);
  const [targetAreas, setTargetAreas] = useState<ShiftArea[]>([]);
  const [featured, setFeatured] = useState(false);
  const [featuredRank, setFeaturedRank] = useState<number | null>(null);
  const [published, setPublished] = useState(false);
  const [guideId, setGuideId] = useState("");
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const submittingRef = useRef(false);
  const deletingRef = useRef(false);

  async function uploadFile(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/resources/upload-image", { method: "POST", body: fd });
    if (handleAuthRedirect(res)) throw new Error("Session expired");
    if (!res.ok) throw new Error(await parseErrorMessage(res, "Image upload failed"));
    const json = await parseJsonSafely<ResourceUploadResponse>(res);
    if (!json?.url) throw new Error("Upload succeeded but no image URL was returned");
    return json.url;
  }

  const { data: guide, loading } = useFetch<Guide>({
    url: `/api/resources/${slug}`,
    transform: (json) => (json as { data: Guide }).data,
  });

  const populate = useCallback(
    (g: Guide) => {
      setTitle(g.title);
      setCategory(g.category);
      setMarkdown(legacyGuideMarkdown(g.markdown, g.content));
      setTargetRoles(g.targetRoles ?? []);
      setTargetAreas(g.targetAreas ?? []);
      setFeatured(g.featured ?? false);
      setFeaturedRank(g.featuredRank ?? null);
      setPublished(g.published);
      setGuideId(g.id);
      setLoadedUpdatedAt(typeof g.updatedAt === "string" ? g.updatedAt : new Date(g.updatedAt).toISOString());
      setReady(true);
    },
    [],
  );

  useEffect(() => {
    if (guide && !ready) populate(guide);
  }, [guide, ready, populate]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const canDelete = userRole === Role.ADMIN;

  async function submit() {
    if (submittingRef.current) return;
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (!category.trim()) { toast.error("Category is required"); return; }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/resources/${guideId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category: category.trim(),
          markdown,
          targetRoles,
          targetAreas,
          featured,
          featuredRank: featured ? featuredRank : null,
          published,
          expectedUpdatedAt: loadedUpdatedAt || undefined,
        }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        toast.error(await parseErrorMessage(res, "Failed to save resource"));
        return;
      }
      const json = await parseJsonSafely<ResourceMutationResponse>(res);
      if (!json?.data?.slug) {
        toast.error("Resource was saved, but the response was incomplete. Refresh resources and try again.");
        return;
      }
      setDirty(false);
      toast.success("Resource saved");
      router.push(`/resources/${json.data.slug}`);
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/resources/${guideId}`, { method: "DELETE" });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        toast.error(await parseErrorMessage(res, "Failed to delete resource"));
        return;
      }
      toast.success("Resource deleted");
      router.push("/resources");
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      deletingRef.current = false;
      setSubmitting(false);
    }
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
        {dirty ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeftIcon className="size-3.5" />
                Back to resource
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
                <AlertDialogDescription>
                  You have unsaved edits. Leaving now will lose them.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep editing</AlertDialogCancel>
                <AlertDialogAction onClick={() => router.push(`/resources/${slug}`)}>
                  Discard
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Link
            href={`/resources/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeftIcon className="size-3.5" />
            Back to resource
          </Link>
        )}
      </div>

      <h1 className="text-2xl font-bold">Edit Resource</h1>

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
            list="knowledge-category-suggestions"
            disabled={submitting}
          />
          <datalist id="knowledge-category-suggestions">
            {KNOWLEDGE_BASE_CATEGORY_SUGGESTIONS.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
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

      <GuideTargetingControls
        featured={featured}
        featuredRank={featuredRank}
        targetRoles={targetRoles}
        targetAreas={targetAreas}
        disabled={submitting}
        onFeaturedChange={(value) => { setFeatured(value); setDirty(true); }}
        onFeaturedRankChange={(value) => { setFeaturedRank(value); setDirty(true); }}
        onTargetRolesChange={(value) => { setTargetRoles(value); setDirty(true); }}
        onTargetAreasChange={(value) => { setTargetAreas(value); setDirty(true); }}
      />

      <div className="min-h-[600px] overflow-hidden rounded-lg border">
        <MarkdownEditor
          markdown={markdown}
          onChange={(value, initialMarkdownNormalize) => {
            if (initialMarkdownNormalize) return;
            setMarkdown(value);
            setDirty(true);
          }}
          imageUploadHandler={uploadFile}
          contentEditableClassName="min-h-[560px] px-6 py-5 focus:outline-none"
          className="guide-mdx-editor"
          readOnly={submitting}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button onClick={submit} disabled={submitting}>
            Save
          </Button>
          {dirty ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={submitting}>
                  Cancel
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You have unsaved edits. Leaving now will lose them.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep editing</AlertDialogCancel>
                  <AlertDialogAction onClick={() => router.push(`/resources/${slug}`)}>
                    Discard
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button variant="outline" asChild disabled={submitting}>
              <Link href={`/resources/${slug}`}>Cancel</Link>
            </Button>
          )}
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
                <AlertDialogTitle>Delete resource?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &ldquo;{title}&rdquo;. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} variant="destructive">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
