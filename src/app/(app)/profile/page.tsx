"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = { id: string; name: string; email: string; role: string };

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit name
  const [editName, setEditName] = useState("");
  const [nameMsg, setNameMsg] = useState("");

  // Change password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");

  // Role
  const [role, setRole] = useState("");
  const [roleMsg, setRoleMsg] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((json) => {
        setUser(json.user);
        setEditName(json.user.name);
        setRole(json.user.role);
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleUpdateName(e: React.FormEvent) {
    e.preventDefault();
    setNameMsg("");
    setSaving(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName }),
      });
      if (!res.ok) {
        const json = await res.json();
        setNameMsg(json.error || "Failed to update");
      } else {
        const json = await res.json();
        setUser(json.user);
        setNameMsg("Name updated");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    setPwMsg("");

    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPwError("Password must be at least 8 characters");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const json = await res.json();
        setPwError(json.error || "Failed to update password");
      } else {
        setPwMsg("Password updated successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateRole(e: React.FormEvent) {
    e.preventDefault();
    setRoleMsg("");
    setSaving(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const json = await res.json();
        setRoleMsg(json.error || "Failed to update role");
      } else {
        const json = await res.json();
        setUser(json.user);
        setRoleMsg("Role updated");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (loading || !user) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Profile</h1>
        <button className="btn btn-danger" onClick={handleLogout}>
          Sign out
        </button>
      </div>

      <div className="profile-grid">
        {/* User info + name edit */}
        <div className="card">
          <div className="card-header">
            <h2>Account</h2>
          </div>
          <div className="card-body">
            <div className="profile-field">
              <div className="profile-field-label">Email</div>
              <div className="profile-field-value">{user.email}</div>
            </div>
            <div className="profile-field">
              <div className="profile-field-label">Role</div>
              <div className="profile-field-value">
                <span className={`badge ${user.role === "ADMIN" ? "badge-purple" : user.role === "STAFF" ? "badge-blue" : "badge-gray"}`}>
                  {user.role}
                </span>
              </div>
            </div>
            <form onSubmit={handleUpdateName}>
              <div className="form-group">
                <label>Display name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                Update name
              </button>
              {nameMsg && <div className="form-success">{nameMsg}</div>}
            </form>
          </div>
        </div>

        {/* Change password */}
        <div className="card">
          <div className="card-header">
            <h2>Change password</h2>
          </div>
          <div className="card-body">
            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label>Current password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="form-group">
                <label>Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                Change password
              </button>
              {pwError && <div className="form-error">{pwError}</div>}
              {pwMsg && <div className="form-success">{pwMsg}</div>}
            </form>
          </div>
        </div>

        {/* Update role */}
        <div className="card">
          <div className="card-header">
            <h2>Update role</h2>
          </div>
          <div className="card-body">
            <form onSubmit={handleUpdateRole}>
              <div className="form-group">
                <label>Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    background: "white",
                  }}
                >
                  <option value="ADMIN">Admin</option>
                  <option value="STAFF">Staff</option>
                  <option value="STUDENT">Student</option>
                </select>
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                Update role
              </button>
              {roleMsg && <div className="form-success">{roleMsg}</div>}
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
