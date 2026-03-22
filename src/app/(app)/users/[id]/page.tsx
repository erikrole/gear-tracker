"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UserDetail, Location, Role } from "../types";
import RoleBadge from "../RoleBadge";
import UserInfoTab from "./UserInfoTab";
import UserActivityTab from "./UserActivityTab";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* ── Tab Definitions ───────────────────────────────────── */

type TabKey = "info" | "activity";

const tabDefs: Array<{ key: TabKey; label: string }> = [
  { key: "info", label: "Info" },
  { key: "activity", label: "Activity" },
];

/* ── Main Page ─────────────────────────────────────────── */

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("info");
  const [currentUserRole, setCurrentUserRole] = useState<Role | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [fetchError, setFetchError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const canEdit = currentUserRole === "ADMIN" || currentUserRole === "STAFF";

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

  if (fetchError) {
    return (
      <div className="py-10 px-5 text-center text-muted-foreground space-y-2">
        <p>User not found or failed to load.</p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" onClick={() => { setFetchError(false); loadUser(); }}>
            Retry
          </Button>
          <Link href="/users" className="text-sm underline">Back to users</Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return <div className="flex items-center justify-center py-10"><Spinner className="size-8" /></div>;
  }

  return (
    <>
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link href="/users">Users</Link> <span>{"\u203a"}</span> {user.name}
      </div>

      {/* Header */}
      <div className="page-header mb-0">
        <div>
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
            </div>
          </div>
        </div>
        <div className="header-actions">
          <RoleBadge role={user.role} />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="mt-4">
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
          onUpdated={loadUser}
        />
      )}

      {activeTab === "activity" && (
        <UserActivityTab userId={user.id} />
      )}
    </>
  );
}
