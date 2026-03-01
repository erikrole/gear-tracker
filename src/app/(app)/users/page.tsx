"use client";

import { FormEvent, useEffect, useState } from "react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF" | "STUDENT";
  location: string | null;
};

type Location = { id: string; name: string };

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [usersRes, optionsRes] = await Promise.all([fetch("/api/users"), fetch("/api/form-options")]);
      if (usersRes.ok) { const j = await usersRes.json(); setUsers(j.data || []); }
      if (optionsRes.ok) { const j = await optionsRes.json(); setLocations(j.data?.locations || []); }
    } catch { /* network error */ }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreateUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
      role: String(form.get("role") || "STAFF"),
      locationId: String(form.get("locationId") || "") || null
    };

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error || "Failed to create user");
      setSubmitting(false);
      return;
    }

    e.currentTarget.reset();
    setSubmitting(false);
    await load();
  }

  return (
    <>
      <div className="page-header"><h1>Users</h1></div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h2>Add user</h2></div>
        <form onSubmit={handleCreateUser} style={{ padding: 16, display: "grid", gap: 10, gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
          <input name="name" placeholder="Full name" required style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
          <input name="email" type="email" placeholder="Email" required style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
          <input name="password" type="password" minLength={8} placeholder="Temporary password" required style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
          <select name="role" defaultValue="STAFF" style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }}>
            <option value="ADMIN">Admin</option>
            <option value="STAFF">Staff</option>
            <option value="STUDENT">Student</option>
          </select>
          <select name="locationId" defaultValue="" style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 8 }}>
            <option value="">No location</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? "Adding..." : "Add user"}</button>
          </div>
          {error && <div style={{ gridColumn: "1 / -1", color: "var(--red)" }}>{error}</div>}
        </form>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Location</th></tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role.toLowerCase()}</td>
                  <td>{user.location || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
