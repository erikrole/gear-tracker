"use client";

import { FormEvent, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { Spinner } from "@/components/ui/spinner";

type Location = { id: string; name: string };
type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF" | "STUDENT";
  location: Location | null;
};

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF" | "STUDENT";
  location: string | null;
};

export default function ProfilePage() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (!json?.data) { setLoadError(true); return; }
        setProfile(json.data.user);
        setLocations(json.data.locations);
      })
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    if (profile?.role !== "ADMIN") return;

    fetch("/api/users")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => setUsers(json?.data || []));
  }, [profile?.role]);

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingProfile(true);

    try {
      const form = new FormData(e.currentTarget);
      const payload = {
        name: String(form.get("name") || ""),
        locationId: String(form.get("locationId") || "") || null
      };

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to update profile", "error");
      } else {
        setProfile(json.data);
        toast("Profile saved", "success");
      }
    } catch {
      toast("Network error", "error");
    }
    setSavingProfile(false);
  }

  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingPassword(true);

    try {
      const form = new FormData(e.currentTarget);
      const currentPassword = String(form.get("currentPassword") || "");
      const newPassword = String(form.get("newPassword") || "");

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change_password", currentPassword, newPassword })
      });

      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to update password", "error");
      } else {
        e.currentTarget.reset();
        toast("Password updated", "success");
      }
    } catch {
      toast("Network error", "error");
    }
    setSavingPassword(false);
  }

  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  async function updateRole(userId: string, role: ManagedUser["role"]) {
    setUpdatingRoleId(userId);

    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role })
      });

      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to update role", "error");
        return;
      }

      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      toast("Role updated", "success");
    } finally {
      setUpdatingRoleId(null);
    }
  }

  if (loadError) {
    return <div className="py-10 px-5 text-center text-muted-foreground">Failed to load profile. Please refresh.</div>;
  }
  if (!profile) {
    return <div className="flex items-center justify-center py-10"><Spinner className="size-8" /></div>;
  }

  return (
    <>
      <div className="page-header">
        <h1>Profile & Settings</h1>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h2>My profile</h2></div>
        <form onSubmit={saveProfile} className="profile-form">
          <label>
            Name
            <input className="form-input" name="name" defaultValue={profile.name} required style={{ width: "100%" }} />
          </label>
          <label>
            Email
            <input className="form-input" value={profile.email} disabled style={{ width: "100%", background: "var(--bg-secondary)" }} />
          </label>
          <label>
            Default location
            <select className="form-select" name="locationId" defaultValue={profile.location?.id || ""} style={{ width: "100%" }}>
              <option value="">None</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" type="submit" disabled={savingProfile}>
            {savingProfile ? "Saving..." : "Save profile"}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h2>Change password</h2></div>
        <form onSubmit={changePassword} className="profile-form">
          <label>
            Current password
            <input className="form-input" name="currentPassword" type="password" required minLength={8} style={{ width: "100%" }} />
          </label>
          <label>
            New password
            <input className="form-input" name="newPassword" type="password" required minLength={8} style={{ width: "100%" }} />
          </label>
          <button className="btn btn-primary" type="submit" disabled={savingPassword}>
            {savingPassword ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>

      {profile.role === "ADMIN" && (
        <div className="card">
          <div className="card-header"><h2>User roles</h2></div>
          <table className="data-table roles-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Location</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.location || "-"}</td>
                  <td>
                    <select
                      className="form-select"
                      value={user.role}
                      onChange={(e) => updateRole(user.id, e.target.value as ManagedUser["role"])}
                      disabled={updatingRoleId === user.id}
                      style={{ opacity: updatingRoleId === user.id ? 0.6 : 1 }}
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="STAFF">Staff</option>
                      <option value="STUDENT">Student</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
