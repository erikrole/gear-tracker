"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { UserDetail, Location, Role } from "../types";
import { useFetch } from "@/hooks/use-fetch";
import RoleBadge from "../RoleBadge";
import UserInfoTab from "./UserInfoTab";
import UserActivityTab from "./UserActivityTab";
import { useToast } from "@/components/Toast";
import { useBreadcrumbLabel } from "@/components/BreadcrumbContext";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, getAvatarColor } from "@/lib/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertCircle, CalendarDays, CameraIcon, Copy, KeyRound, Loader2, TrashIcon } from "lucide-react";
import { formatDateFull } from "@/lib/format";

/* ── Tab Definitions ───────────────────────────────────── */

type TabKey = "info" | "activity";

const tabDefs: Array<{ key: TabKey; label: string }> = [
  { key: "info", label: "Info" },
  { key: "activity", label: "Activity" },
];

/* ── Main Page ─────────────────────────────────────────── */

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { setBreadcrumbLabel } = useBreadcrumbLabel();

  const [activeTab, setActiveTab] = useState<TabKey>("info");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [resetPwDialog, setResetPwDialog] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function uploadAvatar(file: File) {
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      if (res.status === 401) { window.location.href = "/login"; return; }
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to upload avatar", "error");
      } else {
        setUserOverrides((prev) => ({ ...prev, avatarUrl: json.data?.avatarUrl ?? null }));
        toast("Avatar updated", "success");
      }
    } catch {
      toast("Network error", "error");
    }
    setUploadingAvatar(false);
  }

  async function removeAvatar() {
    // Optimistic: remove avatar immediately, rollback on failure
    const previousUrl = effectiveUser?.avatarUrl ?? null;
    setUserOverrides((prev) => ({ ...prev, avatarUrl: null }));
    setUploadingAvatar(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (res.status === 401) { window.location.href = "/login"; return; }
      const json = await res.json();
      if (!res.ok) {
        setUserOverrides((prev) => ({ ...prev, avatarUrl: previousUrl }));
        toast(json.error || "Failed to remove avatar", "error");
      } else {
        toast("Avatar removed", "success");
      }
    } catch {
      setUserOverrides((prev) => ({ ...prev, avatarUrl: previousUrl }));
      toast("Network error", "error");
    }
    setUploadingAvatar(false);
  }

  async function toggleActive() {
    if (!effectiveUser) return;
    const newActive = !effectiveUser.active;
    setUserOverrides((prev) => ({ ...prev, active: newActive }));
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newActive }),
      });
      if (!res.ok) {
        setUserOverrides((prev) => ({ ...prev, active: !newActive }));
        toast("Failed to update status", "error");
      } else {
        toast(newActive ? "User activated" : "User deactivated", "success");
      }
    } catch {
      setUserOverrides((prev) => ({ ...prev, active: !newActive }));
      toast("Network error", "error");
    }
  }

  async function handlePasswordReset() {
    setResetBusy(true);
    try {
      const res = await fetch(`/api/users/${id}/reset-password`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Password reset failed", "error");
      } else {
        const json = await res.json();
        setTempPassword(json.data?.temporaryPassword ?? null);
        toast("Password reset successfully", "success");
      }
    } catch {
      toast("Network error", "error");
    }
    setResetBusy(false);
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

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between flex-col sm:flex-row gap-3 mb-0">
        <div className="flex gap-3 items-center">
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
                  <button type="button" className="relative group rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    <Avatar className="size-12 cursor-pointer">
                      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-xl font-semibold">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      {uploadingAvatar ? (
                        <Loader2 className="size-5 text-white animate-spin" />
                      ) : (
                        <CameraIcon className="size-5 text-white" />
                      )}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                    <CameraIcon className="mr-2 size-4" />
                    {user.avatarUrl ? "Change photo" : "Upload photo"}
                  </DropdownMenuItem>
                  {user.avatarUrl && (
                    <DropdownMenuItem variant="destructive" onClick={removeAvatar}>
                      <TrashIcon className="mr-2 size-4" />
                      Remove photo
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Avatar className="size-12" aria-hidden="true">
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
              <AvatarFallback className="bg-secondary text-secondary-foreground text-xl font-semibold">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
          )}
          <div>
            <h1 className="mb-0">{isSelf ? "My profile" : user.name}</h1>
            <div className="text-sm text-muted-foreground mt-1">{user.email}</div>
            {user.createdAt && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <CalendarDays className="size-3" />
                Member since {formatDateFull(user.createdAt)}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RoleBadge role={user.role} />
          {user.active === false && <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>}
          {currentUserRole === "ADMIN" && !isSelf && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">Admin</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={toggleActive}>
                  {user.active !== false ? "Deactivate user" : "Activate user"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setResetPwDialog(true)}>
                  <KeyRound className="mr-2 size-4" />
                  Reset password
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
                  <p>New temporary password for <strong>{user.name}</strong>:</p>
                  <div className="flex items-center gap-2">
                    <Input value={tempPassword} readOnly className="font-mono" />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(tempPassword);
                        toast("Copied to clipboard", "success");
                      }}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                  <p className="text-xs">This password is shown only once. The user&apos;s existing sessions have been invalidated.</p>
                </div>
              ) : (
                <>This will generate a new temporary password for <strong>{user.name}</strong> and invalidate all their current sessions.</>
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="mt-1">
        <TabsList>
          {tabDefs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {tab.label}
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
    </>
  );
}
