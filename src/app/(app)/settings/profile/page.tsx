"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/UserAvatar";
import { useFetch } from "@/hooks/use-fetch";
import {
  handleAuthRedirect,
  isAbortError,
  parseErrorMessage,
} from "@/lib/errors";
import { AREA_OPTIONS } from "@/app/(app)/users/types";
import { SettingsPageShell } from "../SettingsPageShell";

type Profile = {
  id: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  primaryArea: "VIDEO" | "PHOTO" | "GRAPHICS" | "COMMS" | null;
  title: string | null;
  athleticsEmail: string | null;
  slackHandle: string | null;
};

type FormState = Omit<Profile, "id" | "avatarUrl">;

function toForm(p: Profile): FormState {
  return {
    name: p.name,
    phone: p.phone ?? "",
    primaryArea: p.primaryArea,
    title: p.title ?? "",
    athleticsEmail: p.athleticsEmail ?? "",
    slackHandle: p.slackHandle ?? "",
  };
}

function isDirty(local: FormState, base: FormState): boolean {
  return (Object.keys(local) as (keyof FormState)[]).some(
    (k) => local[k] !== base[k]
  );
}

export default function ProfileSettingsPage() {
  const { data: fetched, loading, error, reload } = useFetch<Profile>({
    url: "/api/me/profile",
    returnTo: "/settings/profile",
    transform: (json) => json.data as Profile,
  });

  const [local, setLocal] = useState<FormState | null>(null);
  const [prevFetched, setPrevFetched] = useState(fetched);
  if (fetched !== prevFetched) {
    setPrevFetched(fetched);
    setLocal(null);
  }

  const base = fetched ? toForm(fetched) : null;
  const form = local ?? base;
  const dirty = base && form ? isDirty(form, base) : false;

  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Avatar state managed separately (different endpoint)
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(undefined);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveAvatarUrl = avatarUrl === undefined ? (fetched?.avatarUrl ?? null) : avatarUrl;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setLocal((prev) => ({ ...(prev ?? base!), [key]: value }));
    if (key === "name") setNameError(null);
  }

  async function handleSave() {
    if (!form || !fetched) return;
    if (!form.name.trim()) {
      setNameError("Name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone || null,
          primaryArea: form.primaryArea || null,
          title: form.title || null,
          athleticsEmail: form.athleticsEmail || null,
          slackHandle: form.slackHandle || null,
        }),
      });

      if (res.status === 401) { handleAuthRedirect(res, "/settings/profile"); return; }

      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Failed to save profile.");
        toast.error(msg);
        return;
      }

      toast.success("Profile saved.");
      reload();
    } catch (err) {
      if (isAbortError(err)) return;
      toast.error("Could not reach the server. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(file: File) {
    if (!fetched) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/users/${fetched.id}/avatar`, { method: "POST", body: fd });
      if (res.status === 401) { handleAuthRedirect(res, "/settings/profile"); return; }
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        toast.error(msg || "Avatar upload failed.");
        return;
      }
      const json = await res.json();
      setAvatarUrl(json.data?.avatarUrl ?? null);
      toast.success("Profile photo updated.");
    } catch (err) {
      if (isAbortError(err)) return;
      toast.error("Upload failed. Check your connection.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleAvatarRemove() {
    if (!fetched || !effectiveAvatarUrl) return;
    setUploadingAvatar(true);
    try {
      const res = await fetch(`/api/users/${fetched.id}/avatar`, { method: "DELETE" });
      if (res.status === 401) { handleAuthRedirect(res, "/settings/profile"); return; }
      if (!res.ok) {
        toast.error("Could not remove photo.");
        return;
      }
      setAvatarUrl(null);
      toast.success("Profile photo removed.");
    } catch (err) {
      if (isAbortError(err)) return;
      toast.error("Remove failed. Check your connection.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  if (loading) {
    return (
      <SettingsPageShell title="Profile" description="Your name, contact info, area, and profile photo.">
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </SettingsPageShell>
    );
  }

  if (error || !form) {
    const msg = error === "network"
      ? "Could not reach the server. Check your connection."
      : "Could not load profile.";
    return (
      <SettingsPageShell title="Profile" description="Your name, contact info, area, and profile photo.">
        <p className="text-sm text-destructive">{msg}</p>
      </SettingsPageShell>
    );
  }

  return (
    <SettingsPageShell title="Profile" description="Your name, contact info, area, and profile photo.">
      <div className="space-y-4">
        {/* Avatar card */}
        <Card>
          <CardContent className="py-5 flex items-center gap-4">
            <div className="relative shrink-0">
              <UserAvatar
                name={form.name || "?"}
                avatarUrl={effectiveAvatarUrl}
                size="xl"
              />
              {uploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Profile photo</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="size-4" />
                  Change photo
                </Button>
                {effectiveAvatarUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={uploadingAvatar}
                    onClick={handleAvatarRemove}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">JPG, PNG, or WebP. Max 4.5 MB.</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAvatarUpload(file);
                e.target.value = "";
              }}
            />
          </CardContent>
        </Card>

        {/* Identity fields card */}
        <Card>
          <CardContent className="py-5 space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Full name"
                aria-invalid={!!nameError}
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>

            {/* Phone + Primary Area */}
            <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              <div className="space-y-1.5">
                <Label htmlFor="profile-phone">Phone</Label>
                <Input
                  id="profile-phone"
                  type="tel"
                  value={form.phone ?? ""}
                  onChange={(e) => setField("phone", e.target.value)}
                  placeholder="(555) 000-0000"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-area">Primary Area</Label>
                <Select
                  value={form.primaryArea ?? ""}
                  onValueChange={(v) =>
                    setField("primaryArea", v as FormState["primaryArea"] || null)
                  }
                >
                  <SelectTrigger id="profile-area">
                    <SelectValue placeholder="Select area" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {AREA_OPTIONS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="profile-title">Title</Label>
              <Input
                id="profile-title"
                value={form.title ?? ""}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="e.g. Video Producer"
              />
            </div>

            {/* Athletics email */}
            <div className="space-y-1.5">
              <Label htmlFor="profile-athletics-email">Athletics email</Label>
              <Input
                id="profile-athletics-email"
                type="email"
                value={form.athleticsEmail ?? ""}
                onChange={(e) => setField("athleticsEmail", e.target.value)}
                placeholder="you@athletics.wisc.edu"
              />
              <p className="text-xs text-muted-foreground">
                Your UW Athletics email -- separate from your login email.
              </p>
            </div>

            {/* Slack handle */}
            <div className="space-y-1.5">
              <Label htmlFor="profile-slack">Slack handle</Label>
              <Input
                id="profile-slack"
                value={form.slackHandle ?? ""}
                onChange={(e) => setField("slackHandle", e.target.value)}
                placeholder="yourhandle"
              />
              <p className="text-xs text-muted-foreground">Without the @ prefix.</p>
            </div>

            {/* Save */}
            <div className="flex justify-end pt-1">
              <Button
                onClick={handleSave}
                disabled={!dirty || saving}
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </SettingsPageShell>
  );
}
