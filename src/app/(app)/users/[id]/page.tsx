"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import type { UserDetail, Location, Role } from "../types";
import RoleBadge from "../RoleBadge";
import UserInfoTab from "./UserInfoTab";
import UserActivityTab from "./UserActivityTab";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";

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
  const [currentUserRole, setCurrentUserRole] = useState<Role | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [fetchError, setFetchError] = useState(false);

  const canEdit = currentUserRole === "ADMIN" || currentUserRole === "STAFF";

  const loadUser = useCallback(() => {
    fetch(`/api/users/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((json) => {
        if (json?.data) setUser(json.data);
        else setFetchError(true);
      })
      .catch(() => setFetchError(true));
  }, [id]);

  useEffect(() => {
    loadUser();
    Promise.all([
      fetch("/api/me"),
      fetch("/api/form-options"),
    ]).then(async ([meRes, optionsRes]) => {
      if (meRes.ok) {
        const j = await meRes.json();
        if (j?.user?.role) setCurrentUserRole(j.user.role);
      }
      if (optionsRes.ok) {
        const j = await optionsRes.json();
        setLocations(j.data?.locations || []);
      }
    }).catch(() => { setFetchError(true); });
  }, [loadUser]);

  if (fetchError) {
    return (
      <div className="py-10 px-5 text-center text-muted-foreground">
        User not found or failed to load.{" "}
        <Link href="/users">Back to users</Link>
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
          <div className="flex gap-12 items-center">
            <Avatar className="size-12" aria-hidden="true">
              <AvatarFallback className="bg-secondary text-secondary-foreground text-xl font-semibold">
                {user.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="mb-0">{user.name}</h1>
              <div className="text-sm text-secondary mt-2">{user.email}</div>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <RoleBadge role={user.role} />
        </div>
      </div>

      {/* Tabs */}
      <div className="item-tabs" style={{ marginTop: 16 }}>
        {tabDefs.map((tab) => (
          <button
            key={tab.key}
            className={`item-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

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
