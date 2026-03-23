"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UserDetail, Location, Role } from "../types";
import RoleBadge from "../RoleBadge";
import UserInfoTab from "./UserInfoTab";
import UserActivityTab from "./UserActivityTab";
import { useToast } from "@/components/Toast";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CameraIcon, TrashIcon } from "lucide-react";

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

  const [user, setUser] = useState<UserDetail | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("info");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<Role | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [fetchError, setFetchError] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSelf = currentUserId != null && currentUserId === id;
  const canEdit = isSelf || currentUserRole === "ADMIN" || currentUserRole === "STAFF";

  const loadUser = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetch(`/api/users/${id}`, { signal: controller.signal })
      .then((res) => {
        if (res.status === 401) { window.location.href = "/login"; return null; }
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((json) => {
        if (json?.data) setUser(json.data);
        else if (json !== null) setFetchError(true);
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setFetchError(true);
      });
  }, [id]);

  useEffect(() => {
    loadUser();
    const controller = new AbortController();
    Promise.all([
      fetch("/api/me", { signal: controller.signal }),
      fetch("/api/form-options", { signal: controller.signal }),
    ]).then(async ([meRes, optionsRes]) => {
      if (meRes.ok) {
        const j = await meRes.json();
        if (j?.user?.id) setCurrentUserId(j.user.id);
        if (j?.user?.role) setCurrentUserRole(j.user.role);
      }
      if (optionsRes.ok) {
        const j = await optionsRes.json();
        setLocations(j.data?.locations || []);
      }
    }).catch(() => { /* auxiliary data — don't block the page */ });
    return () => {
      abortRef.current?.abort();
      controller.abort();
    };
  }, [loadUser]);

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
        setUser((u) => u ? { ...u, avatarUrl: json.data.avatarUrl } : u);
        toast("Avatar updated", "success");
      }
    } catch {
      toast("Network error", "error");
    }
    setUploadingAvatar(false);
  }

  async function removeAvatar() {
    setUploadingAvatar(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (res.status === 401) { window.location.href = "/login"; return; }
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to remove avatar", "error");
      } else {
        setUser((u) => u ? { ...u, avatarUrl: null } : u);
        toast("Avatar removed", "success");
      }
    } catch {
      toast("Network error", "error");
    }
    setUploadingAvatar(false);
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
              <Button variant="outline" size="sm" onClick={() => { setFetchError(false); loadUser(); }}>
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
        {/* Breadcrumb skeleton */}
        <Skeleton className="h-4 w-32" />
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-56" />
          </div>
        </div>
        {/* Tabs skeleton */}
        <Skeleton className="h-9 w-40" />
        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-1.5">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Breadcrumb */}
      <Breadcrumb className="mb-1">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/users">Users</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{user.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between flex-col sm:flex-row gap-3 mb-0">
        <div className="flex gap-3 items-center">
          <Avatar className="size-12" aria-hidden="true">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
            <AvatarFallback className="bg-secondary text-secondary-foreground text-xl font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="mb-0">{user.name}</h1>
            <div className="text-sm text-muted-foreground mt-1">{user.email}</div>
            {isSelf && (
              <div className="flex items-center gap-2 mt-1.5">
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <CameraIcon className="mr-1.5 size-3.5" />
                  {uploadingAvatar ? "Uploading..." : user.avatarUrl ? "Change photo" : "Upload photo"}
                </Button>
                {user.avatarUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={uploadingAvatar}
                    onClick={removeAvatar}
                  >
                    <TrashIcon className="mr-1.5 size-3.5" />
                    Remove
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
        <RoleBadge role={user.role} />
      </div>

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
          canEdit={canEdit}
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
