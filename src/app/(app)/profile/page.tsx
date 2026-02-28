"use client";

import { FormEvent, useEffect, useState } from "react";

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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((json) => {
        setProfile(json.data.user);
        setLocations(json.data.locations);
      });
  }, []);

  useEffect(() => {
    if (profile?.role !== "ADMIN") return;

    fetch("/api/users")
      .then((res) => res.json())
      .then((json) => setUsers(json.data || []));
  }, [profile?.role]);

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setError("");

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
      setError(json.error || "Failed to update profile");
      return;
    }

    setProfile(json.data);
    setMessage("Profile saved");
  }

  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setError("");

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
      setError(json.error || "Failed to update password");
      return;
    }

    e.currentTarget.reset();
    setMessage("Password updated");
  }

  async function updateRole(userId: string, role: ManagedUser["role"]) {
    setMessage("");
    setError("");

    const res = await fetch(`/api/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role })
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to update role");
      return;
    }

    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    setMessage("Role updated");
  }

  if (!profile) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <>
      <div className="page-header">
        <h1>Profile & Settings</h1>
      </div>

      {message && <div className="card" style={{ marginBottom: 12, color: "var(--green)" }}>{message}</div>}
      {error && <div className="card" style={{ marginBottom: 12, color: "var(--red)" }}>{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h2>My profile</h2></div>
        <form onSubmit={saveProfile} style={{ padding: 16, display: "grid", gap: 12, maxWidth: 520 }}>
          <label>
            Name
            <input name="name" defaultValue={profile.name} required style={{ width: "100%", padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
          </label>
          <label>
            Email
            <input value={profile.email} disabled style={{ width: "100%", padding: 8, border: "1px solid var(--border)", borderRadius: 8, background: "#f5f5f5" }} />
          </label>
          <label>
            Default location
            <select name="locationId" defaultValue={profile.location?.id || ""} style={{ width: "100%", padding: 8, border: "1px solid var(--border)", borderRadius: 8 }}>
              <option value="">None</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" type="submit">Save profile</button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h2>Change password</h2></div>
        <form onSubmit={changePassword} style={{ padding: 16, display: "grid", gap: 12, maxWidth: 520 }}>
          <label>
            Current password
            <input name="currentPassword" type="password" required minLength={8} style={{ width: "100%", padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
          </label>
          <label>
            New password
            <input name="newPassword" type="password" required minLength={8} style={{ width: "100%", padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
          </label>
          <button className="btn btn-primary" type="submit">Update password</button>
        </form>
      </div>

      {profile.role === "ADMIN" && (
        <div className="card">
          <div className="card-header"><h2>User roles</h2></div>
          <table className="data-table">
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
                      value={user.role}
                      onChange={(e) => updateRole(user.id, e.target.value as ManagedUser["role"])}
                      style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "white" }}
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
