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
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (!json?.data) return;
        setProfile(json.data.user);
        setLocations(json.data.locations);
      });
  }, []);

  useEffect(() => {
    if (profile?.role !== "ADMIN") return;

    fetch("/api/users")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => setUsers(json?.data || []));
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

  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  async function updateRole(userId: string, role: ManagedUser["role"]) {
    setMessage("");
    setError("");
    setUpdatingRoleId(userId);

    try {
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
    } finally {
      setUpdatingRoleId(null);
    }
  }

  if (!profile) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <>
      <div className="page-header">
        <h1>Profile & Settings</h1>
      </div>

      {message && <div className="card form-message form-message-success">{message}</div>}
      {error && <div className="card form-message form-message-error">{error}</div>}

      <div className="card mb-12">
        <div className="card-header"><h2>My profile</h2></div>
        <form onSubmit={saveProfile} className="form-grid form-grid-narrow">
          <label>
            Name
            <input name="name" defaultValue={profile.name} required className="form-input" />
          </label>
          <label>
            Email
            <input value={profile.email} disabled className="form-input" />
          </label>
          <label>
            Default location
            <select name="locationId" defaultValue={profile.location?.id || ""} className="form-select">
              <option value="">None</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" type="submit">Save profile</button>
        </form>
      </div>

      <div className="card mb-12">
        <div className="card-header"><h2>Change password</h2></div>
        <form onSubmit={changePassword} className="form-grid form-grid-narrow">
          <label>
            Current password
            <input name="currentPassword" type="password" required minLength={8} className="form-input" />
          </label>
          <label>
            New password
            <input name="newPassword" type="password" required minLength={8} className="form-input" />
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
                      disabled={updatingRoleId === user.id}
                      className="form-select"
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
