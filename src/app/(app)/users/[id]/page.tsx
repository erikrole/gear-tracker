"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { UserDetail, Location, Role } from "../types";
import { deriveStudentYear, STUDENT_YEAR_OPTIONS } from "../types";
import { useFetch } from "@/hooks/use-fetch";
import RoleBadge from "../RoleBadge";
import UserInfoTab from "./UserInfoTab";
import UserActivityTab from "./UserActivityTab";
import UserAvailabilityTab from "./UserAvailabilityTab";
import UserBadgesTab from "./UserBadgesTab";
import { toast } from "sonner";
import { useBreadcrumbLabel } from "@/components/BreadcrumbContext";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { UserAvatar } from "@/components/UserAvatar";
import { useConfirm } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Award, AlertCircle, Briefcase, CalendarDays, CameraIcon, ChevronDown, Copy, GraduationCap, KeyRound, Shield, TrashIcon, UserRound } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { formatDateFull } from "@/lib/format";
import { FadeUp } from "@/components/ui/motion";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";

/* ── Tab Definitions ───────────────────────────────────── */

type TabKey = "info" | "activity" | "availability" | "badges";

type BadgeDefinitionOption = {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
};

const tabDefs: Array<{ key: TabKey; label: string }> = [
  { key: "info", label: "Info" },
  { key: "activity", label: "Activity" },
  { key: "availability", label: "Availability" },
  { key: "badges", label: "Badges" },
];

async function resizeAvatarFile(file: File): Promise<File> {
  if (file.type === "image/gif" || !file.type.startsWith("image/")) return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image could not be loaded"));
      img.src = objectUrl;
    });
    const size = 512;
    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    if (sourceSize <= 0) return file;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    const sx = Math.floor((image.naturalWidth - sourceSize) / 2);
    const sy = Math.floor((image.naturalHeight - sourceSize) / 2);
    ctx.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, size, size);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.88);
    });
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") || "avatar";
    return new File([blob], `${name}.webp`, { type: "image/webp" });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/* ── Main Page ─────────────────────────────────────────── */

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { setBreadcrumbLabel } = useBreadcrumbLabel();

  const initialTab = (searchParams.get("tab") as TabKey) || "info";
  const [activeTab, setActiveTab] = useState<TabKey>(
    tabDefs.some((tab) => tab.key === initialTab) ? initialTab : "info",
  );
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [resetPwDialog, setResetPwDialog] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [awardDialogOpen, setAwardDialogOpen] = useState(false);
  const [awardDefinitions, setAwardDefinitions] = useState<BadgeDefinitionOption[] | null>(null);
  const [awardDefinitionsLoading, setAwardDefinitionsLoading] = useState(false);
  const [selectedAwardDefinitionId, setSelectedAwardDefinitionId] = useState("");
  const [awardNote, setAwardNote] = useState("");
  const [awardBusy, setAwardBusy] = useState(false);
  const [badgesTabRevision, setBadgesTabRevision] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  // ── Data fetching via useFetch ──
  const {
    data: user,
    loading: userLoading,
    error: fetchError,
    reload: loadUser,
  } = useFetch<UserDetail>({
    url: `/api/users/${id}`,
    returnTo: `/users/${id}`,
  });

  // We need local user state for optimistic updates (avatar, active toggle)
  const [userOverrides, setUserOverrides] = useState<Partial<UserDetail>>({});
  const effectiveUser = user ? { ...user, ...userOverrides } : null;

  const { data: meData } = useFetch<{ id: string; role: Role }>({
    url: "/api/me",
    transform: (json) => (json as Record<string, unknown>).user as { id: string; role: Role },
    refetchOnFocus: false,
  });
  const currentUserId = meData?.id ?? null;
  const currentUserRole = meData?.role ?? null;

  const { data: formOptions } = useFetch<{ locations: Location[] }>({
    url: "/api/form-options",
    transform: (json) => (json as Record<string, unknown>).data as { locations: Location[] },
    refetchOnFocus: false,
  });
  const locations = formOptions?.locations ?? [];

  useEffect(() => {
    if (user?.name) setBreadcrumbLabel(user.name);
  }, [user?.name, setBreadcrumbLabel]);

  const isSelf = currentUserId != null && currentUserId === id;
  const isStaffOrAdmin = currentUserRole === "ADMIN" || currentUserRole === "STAFF";
  const canEdit = isSelf || isStaffOrAdmin;

  function switchTab(tab: TabKey) {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "info") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  }

  useEffect(() => {
    if (user && user.role !== "STUDENT" && (activeTab === "availability" || activeTab === "badges")) {
      switchTab("info");
    }
  }, [activeTab, user]);

  async function uploadAvatar(file: File) {
    setUploadingAvatar(true);
    try {
      const uploadFile = await resizeAvatarFile(file);
      const formData = new FormData();
      formData.append("file", uploadFile);
      const res = await fetch(`/api/users/${id}/avatar`, { method: "POST", body: formData });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Failed to upload avatar");
        toast.error(msg);
      } else {
        const json = await res.json();
        setUserOverrides((prev) => ({ ...prev, avatarUrl: json.data?.avatarUrl ?? null }));
        toast.success("Avatar updated");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function removeAvatar() {
    const ok = await confirm({
      title: `Remove ${effectiveUser?.name ? effectiveUser.name + "'s " : ""}photo?`,
      message: "The current avatar will be deleted permanently. The user can upload a new one anytime.",
      confirmLabel: "Remove photo",
      variant: "danger",
    });
    if (!ok) return;
    // Optimistic: remove avatar immediately, rollback on failure
    const previousUrl = effectiveUser?.avatarUrl ?? null;
    setUserOverrides((prev) => ({ ...prev, avatarUrl: null }));
    setUploadingAvatar(true);
    try {
      const res = await fetch(`/api/users/${id}/avatar`, { method: "DELETE" });
      if (handleAuthRedirect(res)) return;
      const json = await res.json();
      if (!res.ok) {
        setUserOverrides((prev) => ({ ...prev, avatarUrl: previousUrl }));
        toast.error(json.error || "Failed to remove avatar");
      } else {
        toast.success("Avatar removed");
      }
    } catch {
      setUserOverrides((prev) => ({ ...prev, avatarUrl: previousUrl }));
      toast.error("Network error");
    }
    setUploadingAvatar(false);
  }

  async function toggleActive() {
    if (!effectiveUser || togglingActive) return;
    setTogglingActive(true);
    const newActive = !effectiveUser.active;
    setUserOverrides((prev) => ({ ...prev, active: newActive }));
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newActive }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        setUserOverrides((prev) => ({ ...prev, active: !newActive }));
        const msg = await parseErrorMessage(res, "Failed to update status");
        toast.error(msg);
      } else {
        toast.success(newActive ? "User activated" : "User deactivated");
      }
    } catch {
      setUserOverrides((prev) => ({ ...prev, active: !newActive }));
      toast.error("Network error");
    } finally {
      setTogglingActive(false);
    }
  }

  async function handlePasswordReset() {
    setResetBusy(true);
    try {
      const res = await fetch(`/api/users/${id}/reset-password`, { method: "POST" });
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Password reset failed");
        toast.error(msg);
      } else {
        const json = await res.json();
        setTempPassword(json.data?.temporaryPassword ?? null);
        toast.success("Password reset successfully");
      }
    } catch {
      toast.error("Network error");
    }
    setResetBusy(false);
  }

  async function openManualAwardDialog() {
    setAwardDialogOpen(true);
    if (awardDefinitions !== null || awardDefinitionsLoading) return;

    setAwardDefinitionsLoading(true);
    try {
      const res = await fetch("/api/badges");
      if (handleAuthRedirect(res)) return;
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to load badges");
        setAwardDefinitions([]);
        return;
      }
      const definitions = ((json.data ?? []) as BadgeDefinitionOption[])
        .filter((definition) => definition.category !== "SHIFT");
      setAwardDefinitions(definitions);
      setSelectedAwardDefinitionId((prev) => prev || definitions[0]?.id || "");
    } catch {
      toast.error("Network error");
      setAwardDefinitions([]);
    } finally {
      setAwardDefinitionsLoading(false);
    }
  }

  async function handleManualAward() {
    if (!selectedAwardDefinitionId || awardBusy) return;
    setAwardBusy(true);
    try {
      const res = await fetch("/api/badges/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: id,
          definitionId: selectedAwardDefinitionId,
          note: awardNote.trim() || undefined,
        }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Failed to award badge");
        toast.error(msg);
        return;
      }
      toast.success("Badge awarded");
      setAwardDialogOpen(false);
      setAwardNote("");
      setBadgesTabRevision((value) => value + 1);
      if (activeTab !== "badges") {
        switchTab("badges");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setAwardBusy(false);
    }
  }

  if (fetchError) {
    return (
      <div className="py-10 px-5 flex justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="size-4" />
          <AlertTitle>Failed to load user</AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p>User not found or something went wrong.</p>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={loadUser}>
                Retry
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/users">Back to users</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3.5 w-48" />
          </div>
        </div>
        {/* Tabs skeleton */}
        <Skeleton className="h-9 w-36" />
        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-1.5">
          <div className="rounded-xl border p-4 space-y-4">
            {[72, 56, 44, 60, 48, 52].map((w, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-[120px] shrink-0" />
                <Skeleton className="h-8 flex-1" style={{ maxWidth: `${w}%` }} />
              </div>
            ))}
          </div>
          <div className="rounded-xl border p-4 space-y-3">
            <Skeleton className="h-4 w-16" />
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  const profile = effectiveUser ?? user;
  const availableTabs = profile.role === "STUDENT"
    ? tabDefs
    : tabDefs.filter((tab) => tab.key !== "availability" && tab.key !== "badges");

  return (
    <FadeUp>
      {/* ── Profile hero ── */}
      <div className="relative mb-5 rounded-xl border bg-card overflow-hidden">
        {/* Atmospheric red wash — very subtle */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 0% 0%, rgba(160,0,0,0.045) 0%, transparent 55%)" }}
        />

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5 p-5 sm:p-6">
          {/* Avatar */}
          <div className="shrink-0">
            {isSelf ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadAvatar(file);
                    e.target.value = "";
                  }}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={uploadingAvatar}>
                    <button
                      type="button"
                      aria-label={profile.avatarUrl ? "Change profile photo" : "Upload profile photo"}
                      className="relative group rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <UserAvatar
                        name={profile.name}
                        avatarUrl={profile.avatarUrl}
                        size="xl"
                        className="cursor-pointer ring-2 ring-border ring-offset-2 ring-offset-card"
                      />
                      <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        {uploadingAvatar ? (
                          <Spinner className="size-6 text-white" />
                        ) : (
                          <CameraIcon className="size-6 text-white" />
                        )}
                      </div>
                    </button>
                  </DropdownMenuTrigger>
	                  <DropdownMenuContent align="start">
	                    <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
	                      <CameraIcon className="mr-2 size-4" />
	                      {profile.avatarUrl ? "Change photo" : "Upload photo"}
	                    </DropdownMenuItem>
	                    {profile.avatarUrl && (
	                      <DropdownMenuItem variant="destructive" onClick={removeAvatar}>
	                        <TrashIcon className="mr-2 size-4" />
	                        Remove photo
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <UserAvatar
                name={profile.name}
                avatarUrl={profile.avatarUrl}
                size="xl"
                className="ring-2 ring-border ring-offset-2 ring-offset-card"
              />
            )}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <h1
              className="text-[28px] sm:text-[32px] leading-none tracking-tight mb-0"
              style={{ fontFamily: "var(--font-heading)", fontWeight: 800 }}
            >
              {isSelf ? "My Profile" : profile.name}
            </h1>
            <div className="mt-2.5 space-y-1">
              <p
                className="text-[12px] text-muted-foreground leading-none"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {profile.email}
              </p>
              {profile.role !== "STUDENT" && profile.title && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Briefcase className="size-3 shrink-0" />
                  {profile.title}
                </p>
              )}
              {profile.role === "STUDENT" && (() => {
                const y = deriveStudentYear(profile.gradYear, profile.studentYearOverride);
                if (!y) return null;
                const label = STUDENT_YEAR_OPTIONS.find((o) => o.value === y)?.label ?? y;
                return (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <GraduationCap className="size-3 shrink-0" />
                    {label}
                    {profile.gradYear ? ` · Class of ${profile.gradYear}` : ""}
                  </p>
                );
              })()}
              {(profile.directReport || profile.directReportName) && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <UserRound className="size-3 shrink-0" />
                  Reports to{" "}
                  {profile.directReport ? (
                    <Link
                      href={`/users/${profile.directReport.id}`}
                      className="hover:underline"
                    >
                      {profile.directReport.name}
                    </Link>
                  ) : (
                    <span>{profile.directReportName} <span className="text-[10px] uppercase tracking-wide opacity-70">external</span></span>
                  )}
                </p>
              )}
              {profile.createdAt && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="size-3 shrink-0" />
                  Member since {formatDateFull(profile.createdAt)}
                </p>
              )}
            </div>
          </div>

          {/* Badges + admin controls */}
          <div className="flex items-center gap-2 flex-wrap sm:self-start sm:mt-0.5">
            <RoleBadge role={profile.role} />
            {profile.active === false && (
              <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
            )}
            {currentUserRole === "ADMIN" && !isSelf && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5" disabled={togglingActive}>
                    <Shield className="size-3.5" />
                    Admin actions
                    <ChevronDown className="size-3.5 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={toggleActive} disabled={togglingActive}>
                    {togglingActive
                      ? "Updating status..."
                      : profile.active !== false ? "Deactivate user" : "Activate user"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setResetPwDialog(true)}>
                    <KeyRound className="mr-2 size-4" />
                    Reset password
                  </DropdownMenuItem>
                  {profile.role === "STUDENT" && (
                    <DropdownMenuItem onClick={openManualAwardDialog}>
                      <Award className="mr-2 size-4" />
                      Award badge
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Password Reset Dialog */}
      <AlertDialog open={resetPwDialog || !!tempPassword} onOpenChange={(open) => {
        if (!open) { setResetPwDialog(false); setTempPassword(null); }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tempPassword ? "Password Reset" : "Reset password?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {tempPassword ? (
                <div className="space-y-3">
                  <p>New temporary password for <strong>{profile.name}</strong>:</p>
                  <div className="flex items-center gap-2">
                    <Input value={tempPassword} readOnly className="font-mono" />
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Copy temporary password"
                      onClick={() => {
                        navigator.clipboard.writeText(tempPassword);
                        toast.success("Copied to clipboard");
                      }}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                  <p className="text-xs">This password is shown only once. The user&apos;s existing sessions have been invalidated.</p>
                </div>
              ) : (
                <>This will generate a new temporary password for <strong>{profile.name}</strong> and invalidate all their current sessions.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {tempPassword ? (
              <AlertDialogAction onClick={() => { setTempPassword(null); setResetPwDialog(false); }}>Done</AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handlePasswordReset} disabled={resetBusy}>
                  {resetBusy ? "Resetting…" : "Reset password"}
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={awardDialogOpen} onOpenChange={setAwardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div>
              <DialogTitle>Award badge</DialogTitle>
              <DialogDescription>
                Add a manual badge to {profile.name}&apos;s profile.
              </DialogDescription>
            </div>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4 py-1">
            <div className="flex flex-col gap-2">
              <label htmlFor="badge-definition" className="text-sm font-medium">
                Badge
              </label>
              <Select
                value={selectedAwardDefinitionId}
                onValueChange={setSelectedAwardDefinitionId}
                disabled={awardDefinitionsLoading || awardBusy}
              >
                <SelectTrigger id="badge-definition">
                  <SelectValue placeholder={awardDefinitionsLoading ? "Loading badges..." : "Select a badge"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(awardDefinitions ?? []).map((definition) => (
                      <SelectItem key={definition.id} value={definition.id}>
                        {definition.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {awardDefinitions?.length === 0 && !awardDefinitionsLoading && (
                <p className="text-sm text-muted-foreground">
                  No active manual-awardable badges are available.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="badge-note" className="text-sm font-medium">
                Note
              </label>
              <Textarea
                id="badge-note"
                value={awardNote}
                onChange={(event) => setAwardNote(event.target.value)}
                placeholder="Optional staff context"
                maxLength={500}
                disabled={awardBusy}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAwardDialogOpen(false)}
              disabled={awardBusy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleManualAward}
              disabled={awardBusy || awardDefinitionsLoading || !selectedAwardDefinitionId}
            >
              {awardBusy && <Spinner />}
              Award badge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => switchTab(v as TabKey)}>
        <TabsList className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm overflow-x-auto scrollbar-hide">
          {availableTabs.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="relative shrink-0 gap-1.5 border-b-transparent data-[state=active]:border-b-transparent after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--wi-red)] after:opacity-0 after:transition-opacity data-[state=active]:after:opacity-100"
            >
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}>{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Tab Content */}
      {activeTab === "info" && (
        <UserInfoTab
          user={user}
          locations={locations}
          currentUserRole={currentUserRole}
          isSelf={isSelf}
          onUpdated={loadUser}
        />
      )}

      {activeTab === "activity" && (
        <UserActivityTab userId={user.id} />
      )}

      {activeTab === "availability" && profile.role === "STUDENT" && (
        <UserAvailabilityTab userId={user.id} canEdit={canEdit} />
      )}

      {activeTab === "badges" && profile.role === "STUDENT" && (
        <UserBadgesTab key={badgesTabRevision} userId={user.id} />
      )}
    </FadeUp>
  );
}
