"use client";

import { FormEvent, useEffect, useState } from "react";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { FilterChip } from "@/components/FilterChip";
import { useToast } from "@/components/Toast";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF" | "STUDENT";
  locationId: string | null;
  location: string | null;
};

type Location = { id: string; name: string };
type Role = "ADMIN" | "STAFF" | "STUDENT";

export default function UsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<Role | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", locationId: "" });
  const [saving, setSaving] = useState<string | null>(null);

  const canEdit = currentUserRole === "ADMIN" || currentUserRole === "STAFF";

  async function load() {
    setLoading(true);
    try {
      const [usersRes, optionsRes, meRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/form-options"),
        fetch("/api/me"),
      ]);
      if (usersRes.ok) {
        const j = await usersRes.json();
        setUsers(j.data || []);
      }
      if (optionsRes.ok) {
        const j = await optionsRes.json();
        setLocations(j.data?.locations || []);
      }
      if (meRes.ok) {
        const j = await meRes.json();
        if (j?.user?.role) setCurrentUserRole(j.user.role);
      }
    } catch {
      /* network error */
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q);
    const matchesRole = !roleFilter || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  async function handleCreateUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
      role: String(form.get("role") || "STAFF"),
      locationId: String(form.get("locationId") || "") || null,
    };

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok) {
        toast(json.error || "Failed to create user", "error");
        setSubmitting(false);
        return;
      }

      e.currentTarget.reset();
      setSubmitting(false);
      toast(`${payload.name} added successfully`, "success");
      await load();
    } catch {
      toast("Network error", "error");
      setSubmitting(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: Role) {
    setSaving(userId);
    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
        toast("Role updated", "success");
      } else {
        const json = await res.json();
        toast(json.error || "Failed to update role", "error");
      }
    } catch {
      toast("Network error", "error");
    }
    setSaving(null);
  }

  function startEditing(user: UserRow) {
    setEditingId(user.id);
    setEditForm({
      name: user.name,
      email: user.email,
      locationId: user.locationId || "",
    });
  }

  function cancelEditing() {
    setEditingId(null);
  }

  async function saveEdit(userId: string) {
    setSaving(userId);
    const payload: Record<string, unknown> = {};
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    if (editForm.name !== user.name) payload.name = editForm.name;
    if (editForm.email !== user.email) payload.email = editForm.email;
    const newLocId = editForm.locationId || null;
    if (newLocId !== (user.locationId || null)) payload.locationId = newLocId;

    if (Object.keys(payload).length === 0) {
      cancelEditing();
      setSaving(null);
      return;
    }

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to update user", "error");
        setSaving(null);
        return;
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, ...json.data } : u))
      );
      setEditingId(null);
      toast("User updated", "success");
    } catch {
      toast("Network error", "error");
    }
    setSaving(null);
  }

  return (
    <>
      <div className="page-header">
        <h1>Users</h1>
        <span className="page-header-count">{users.length}</span>
      </div>

      {/* Add User Form — ADMIN/STAFF only */}
      {canEdit && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h2>Add user</h2>
          </div>
          <form
            onSubmit={handleCreateUser}
            className="form-grid form-grid-5"
            style={{ padding: 16 }}
          >
            <input className="form-input" name="name" placeholder="Full name" required aria-label="Full name" />
            <input className="form-input" name="email" type="email" placeholder="Email" required aria-label="Email" />
            <input className="form-input" name="password" type="password" minLength={8} placeholder="Temporary password" required aria-label="Temporary password" />
            <select className="form-select" name="role" defaultValue="STAFF" aria-label="Role">
              <option value="ADMIN">Admin</option>
              <option value="STAFF">Staff</option>
              <option value="STUDENT">Student</option>
            </select>
            <select className="form-select" name="locationId" defaultValue="" aria-label="Location">
              <option value="">No location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                className="btn btn-primary"
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Adding..." : "Add user"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="card">
        <div className="card-header filter-chip-bar">
          <input
            className="form-input filter-chip-search"
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search users"
          />
          <div className="filter-chips">
            <FilterChip
              label="Role"
              value={roleFilter}
              options={[
                { value: "ADMIN", label: "Admin" },
                { value: "STAFF", label: "Staff" },
                { value: "STUDENT", label: "Student" },
              ]}
              onSelect={(v) => setRoleFilter(v as Role)}
              onClear={() => setRoleFilter("")}
            />
            {roleFilter && (
              <button type="button" className="filter-chip-clear-all" onClick={() => setRoleFilter("")}>
                Clear all
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <SkeletonTable rows={5} cols={canEdit ? 5 : 4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="users"
            title={search || roleFilter ? "No users match your filters" : "No users yet"}
            description={
              search || roleFilter
                ? "Try adjusting your search or filter."
                : canEdit
                  ? "Add your first user above."
                  : undefined
            }
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Location</th>
                {canEdit && <th style={{ width: 100 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id}>
                  {editingId === user.id ? (
                    <>
                      <td>
                        <input
                          className="form-input"
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, name: e.target.value }))
                          }
                          style={{ width: "100%" }}
                        />
                      </td>
                      <td>
                        <input
                          className="form-input"
                          type="email"
                          value={editForm.email}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              email: e.target.value,
                            }))
                          }
                          style={{ width: "100%" }}
                        />
                      </td>
                      <td>
                        <select
                          className="form-select"
                          value={user.role}
                          onChange={(e) =>
                            handleRoleChange(user.id, e.target.value as Role)
                          }
                          disabled={saving === user.id}
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="STAFF">Staff</option>
                          <option value="STUDENT">Student</option>
                        </select>
                      </td>
                      <td>
                        <select
                          className="form-select"
                          value={editForm.locationId}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              locationId: e.target.value,
                            }))
                          }
                        >
                          <option value="">No location</option>
                          {locations.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => saveEdit(user.id)}
                            disabled={saving === user.id}
                          >
                            {saving === user.id ? "..." : "Save"}
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={cancelEditing}
                            disabled={saving === user.id}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>
                        {canEdit ? (
                          <select
                            className="form-select"
                            value={user.role}
                            onChange={(e) =>
                              handleRoleChange(user.id, e.target.value as Role)
                            }
                            disabled={saving === user.id}
                            style={{ background: "transparent" }}
                          >
                            <option value="ADMIN">Admin</option>
                            <option value="STAFF">Staff</option>
                            <option value="STUDENT">Student</option>
                          </select>
                        ) : (
                          user.role.toLowerCase()
                        )}
                      </td>
                      <td>{user.location || "-"}</td>
                      {canEdit && (
                        <td>
                          <button
                            className="btn btn-sm"
                            onClick={() => startEditing(user)}
                          >
                            Edit
                          </button>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

      </div>
    </>
  );
}
