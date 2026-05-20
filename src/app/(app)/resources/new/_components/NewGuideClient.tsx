"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  Building2Icon,
  ClipboardListIcon,
  FolderTreeIcon,
  HardDriveIcon,
  PhoneIcon,
  WrenchIcon,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";
import type { MDXEditorMethods } from "@mdxeditor/editor";
import { Role, ShiftArea } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useFetch } from "@/hooks/use-fetch";
import type { GuideListItem } from "@/lib/guides";
import { handleAuthRedirect } from "@/lib/errors";
import { KNOWLEDGE_BASE_CATEGORY_SUGGESTIONS } from "@/lib/guide-categories";
import { GuideTargetingControls } from "@/components/resources/GuideTargetingControls";
import { MarkdownEditor } from "@/components/resources/MarkdownEditor";

type GuideTemplate = {
  id: string;
  label: string;
  category: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  markdown: string;
};

const GUIDE_TEMPLATES: GuideTemplate[] = [
  {
    id: "contacts",
    label: "Contacts",
    category: "Contacts",
    title: "Key contacts",
    icon: PhoneIcon,
    markdown: `# Key contacts

Use this entry for phone numbers, escalation contacts, vendor contacts, and internal owners.

> Keep this current. Put the owner in the table so people know who can fix stale contact details.

## Emergency

| Contact | Role | Phone | When to use |
| --- | --- | --- | --- |
| Name | Role or team | \`555-555-5555\` | What situation triggers this contact |

## Internal

| Contact | Role | Phone | Email |
| --- | --- | --- | --- |
| Name | Owner or team | \`555-555-5555\` | name@wisc.edu |

## External

- Vendor: contact, phone, account/reference
- Account number or service tag:

\`\`\`text
ACCOUNT-OR-REFERENCE
\`\`\`

## Owner

| Field | Value |
| --- | --- |
| Maintainer | Name/team |
| Last verified | YYYY-MM-DD |`,
  },
  {
    id: "building-numbers",
    label: "Building Numbers",
    category: "Building Numbers",
    title: "Building numbers",
    icon: Building2Icon,
    markdown: `# Building numbers

Use this entry for building phone numbers, room numbers, elevator or dock notes, and location-specific reference details.

> Keep access-sensitive details limited to what staff and students are allowed to use.

## Quick lookup

| Building or location | Number or code | Use | Notes |
| --- | --- | --- | --- |
| Building name | \`0000\` | Room, phone, dock, elevator, or desk | Who should use it |

## Copyable reference

\`\`\`text
BUILDING OR LOCATION - 0000 - purpose
\`\`\`

## Location notes

- Entrance:
- Loading dock:
- Elevator or room:
- After-hours process:

## Owner

| Field | Value |
| --- | --- |
| Maintainer | Name/team |
| Last verified | YYYY-MM-DD |`,
  },
  {
    id: "media-drive",
    label: "Media Drive",
    category: "Media Drive",
    title: "Media Drive overview",
    icon: HardDriveIcon,
    markdown: `# Media Drive overview

Use this entry as the map for the Media Drive, the server that houses Creative files.

## What lives here

| Area | What belongs here | Owner | Notes |
| --- | --- | --- | --- |
| Photo | RAW, selects, exports, delivery folders | Team/person | Rules or exceptions |
| Video | Project files, footage, exports, delivery folders | Team/person | Rules or exceptions |
| Graphics | Templates, working files, final assets | Team/person | Rules or exceptions |

## Root paths

\`\`\`text
smb://media-drive/share
\`\`\`

## Folder map

| Folder | Purpose | Who uses it | Retention or cleanup rule |
| --- | --- | --- | --- |
| \`/PHOTO\` | Photo jobs and delivery | Photo staff/students | Cleanup rule |
| \`/VIDEO\` | Video projects and exports | Video staff/students | Cleanup rule |
| \`/GRAPHICS\` | Graphics source and final files | Graphics staff/students | Cleanup rule |

## Access

> Include how to request access, VPN or building-network requirements, and who approves access changes.

## Related exact paths

- Link or reference separate Server Paths guides for recurring workflow-specific folders.

## Owner

| Field | Value |
| --- | --- |
| Maintainer | Name/team |
| Last verified | YYYY-MM-DD |`,
  },
  {
    id: "server-paths",
    label: "Server Paths",
    category: "Server Paths",
    title: "Server paths",
    icon: FolderTreeIcon,
    markdown: `# Server paths

Keep paths copyable and include who can access each location.

## Common paths

| Path | Purpose | Access | Owner |
| --- | --- | --- | --- |
| \`smb://server/share/folder\` | What lives here | Who can use it | Team/person |

## Copyable examples

\`\`\`text
smb://server/share/folder
\`\`\`

## Access notes

> Include who approves access, where requests should go, and any VPN or building-network requirements.

## Naming rules

- Folder/file pattern: \`SPORT-YYYYMMDD-OPP-PHOTOGRAPHER-###\`
- Keep raw, selects, exports, and delivery folders visually distinct.

## Owner

| Field | Value |
| --- | --- |
| Maintainer | Name/team |
| Last verified | YYYY-MM-DD |`,
  },
  {
    id: "sop",
    label: "SOP",
    category: "SOPs",
    title: "Standard operating procedure",
    icon: ClipboardListIcon,
    markdown: `# Standard operating procedure

## When to use this

Describe the trigger or workflow this SOP covers.

## Before you start

| Check | Required value |
| --- | --- |
| Access | Account, drive, venue, credential, or tool |
| Source material | Where the starting files or request live |
| Deadline | When this must be complete |

## Steps

1. First step
2. Second step
3. Final handoff or confirmation step

## Copyable values

\`\`\`text
Paste any path, naming string, command, or metadata template here
\`\`\`

## Checks

- What must be true before the work is done
- What should be reviewed by another person
- Where completion should be noted

## Owner

| Field | Value |
| --- | --- |
| Maintainer | Name/team |
| Last reviewed | YYYY-MM-DD |`,
  },
  {
    id: "troubleshooting",
    label: "Troubleshooting",
    category: "Troubleshooting",
    title: "Troubleshooting note",
    icon: WrenchIcon,
    markdown: `# Troubleshooting note

## Symptom

What people see or report.

## Likely causes

| Cause | Evidence | First check |
| --- | --- | --- |
| Possible cause | What confirms it | Where to look first |

## Fix

1. Action to try first
2. Action to try next
3. Confirm the problem is resolved

## Useful references

\`\`\`text
Paste error text, server path, command, or reference value here
\`\`\`

> Note anything risky before someone repeats this fix.

## Escalate when

- Condition: owner
- Condition: vendor/contact

## Owner

| Field | Value |
| --- | --- |
| Maintainer | Name/team |
| Last verified | YYYY-MM-DD |`,
  },
];

export function NewGuideClient() {
  const router = useRouter();
  const editorRef = useRef<MDXEditorMethods>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [targetRoles, setTargetRoles] = useState<Role[]>([]);
  const [targetAreas, setTargetAreas] = useState<ShiftArea[]>([]);
  const [featured, setFeatured] = useState(false);
  const [featuredRank, setFeaturedRank] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function uploadFile(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/resources/upload-image", { method: "POST", body: fd });
    if (!res.ok) throw new Error("Image upload failed");
    const json = (await res.json()) as { url: string };
    return json.url;
  }

  const { data: guides } = useFetch<GuideListItem[]>({
    url: "/api/resources",
    transform: (json) => (json as { data: GuideListItem[] }).data ?? [],
  });

  const existingCategories = useMemo(() => {
    const seen = new Set<string>(KNOWLEDGE_BASE_CATEGORY_SUGGESTIONS);
    for (const g of guides ?? []) seen.add(g.category);
    return [...seen].sort();
  }, [guides]);

  function applyTemplate(template: GuideTemplate) {
    if (!title.trim()) setTitle(template.title);
    setCategory(template.category);
    setMarkdown(template.markdown);
    editorRef.current?.setMarkdown(template.markdown);
  }

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
      const res = await fetch("/api/resources", {
        method: "POST",
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
        }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(json.error ?? "Failed to create resource");
        return;
      }
      const json = (await res.json()) as { data: { slug: string } };
      toast.success(published ? "Resource published" : "Draft saved");
      router.push(`/resources/${json.data.slug}`);
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <div>
        <Link
          href="/resources"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="size-3.5" />
          Guides
        </Link>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold">New Resource</h1>
        <p className="text-sm text-muted-foreground">
          Capture reusable Creative operations context: contacts, building numbers, Media Drive details, server paths, SOPs, how-to steps, or general reference notes.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {GUIDE_TEMPLATES.map((template) => {
          const Icon = template.icon;
          return (
            <Button
              key={template.id}
              type="button"
              variant="outline"
              className="h-auto justify-start gap-3 p-3 text-left"
              onClick={() => applyTemplate(template)}
              disabled={submitting}
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 text-sm font-medium">{template.label}</span>
            </Button>
          );
        })}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="e.g. Emergency contacts and escalation numbers"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            placeholder="e.g. Contacts, Media Drive, Server Paths, SOPs"
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

      <GuideTargetingControls
        featured={featured}
        featuredRank={featuredRank}
        targetRoles={targetRoles}
        targetAreas={targetAreas}
        disabled={submitting}
        onFeaturedChange={setFeatured}
        onFeaturedRankChange={setFeaturedRank}
        onTargetRolesChange={setTargetRoles}
        onTargetAreasChange={setTargetAreas}
      />

      <div className="min-h-[600px] overflow-hidden rounded-lg border">
        <MarkdownEditor
          ref={editorRef}
          markdown={markdown}
          onChange={(value, initialMarkdownNormalize) => {
            if (!initialMarkdownNormalize) setMarkdown(value);
          }}
          imageUploadHandler={uploadFile}
          contentEditableClassName="min-h-[560px] px-6 py-5 focus:outline-none"
          className="guide-mdx-editor"
          readOnly={submitting}
        />
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
