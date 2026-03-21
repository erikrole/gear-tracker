"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CameraIcon, TrashIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Location = { id: string; name: string };
type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF" | "STUDENT";
  avatarUrl: string | null;
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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function uploadAvatar(file: File) {
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to upload avatar", "error");
      } else {
        setProfile((p) => p ? { ...p, avatarUrl: json.data.avatarUrl } : p);
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
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to remove avatar", "error");
      } else {
        setProfile((p) => p ? { ...p, avatarUrl: null } : p);
        toast("Avatar removed", "success");
      }
    } catch {
      toast("Network error", "error");
    }
    setUploadingAvatar(false);
  }

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingProfile(true);

    try {
      const form = new FormData(e.currentTarget);
      const payload = {
        name: String(form.get("name") || ""),
        locationId: (String(form.get("locationId") || "") === "__none__" ? null : String(form.get("locationId") || "")) || null
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

      <Card style={{ marginBottom: 16 }}>
        <CardHeader><CardTitle>My profile</CardTitle></CardHeader>
        <div className="profile-avatar-section">
          <Avatar className="size-20 border-2 border-border">
            {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={profile.name} />}
            <AvatarFallback className="text-2xl font-semibold">
              {profile.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="profile-avatar-actions">
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
              <CameraIcon className="mr-1.5 size-4" />
              {uploadingAvatar ? "Uploading..." : profile.avatarUrl ? "Change photo" : "Upload photo"}
            </Button>
            {profile.avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={uploadingAvatar}
                onClick={removeAvatar}
              >
                <TrashIcon className="mr-1.5 size-4" />
                Remove
              </Button>
            )}
          </div>
        </div>
        <form onSubmit={saveProfile} className="profile-form">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Name</Label>
            <Input id="profile-name" name="name" defaultValue={profile.name} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={profile.email} disabled className="bg-muted" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-location">Default location</Label>
            <Select name="locationId" defaultValue={profile.location?.id || "__none__"}>
              <SelectTrigger id="profile-location" className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {locations.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={savingProfile}>
            {savingProfile ? "Saving..." : "Save profile"}
          </Button>
        </form>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
        <form onSubmit={changePassword} className="profile-form">
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input id="currentPassword" name="currentPassword" type="password" required minLength={8} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <Input id="newPassword" name="newPassword" type="password" required minLength={8} />
          </div>
          <Button type="submit" disabled={savingPassword}>
            {savingPassword ? "Updating..." : "Update password"}
          </Button>
        </form>
      </Card>

      {profile.role === "ADMIN" && (
        <Card>
          <CardHeader><CardTitle>User roles</CardTitle></CardHeader>
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
                    <Select
                      value={user.role}
                      onValueChange={(v) => updateRole(user.id, v as ManagedUser["role"])}
                      disabled={updatingRoleId === user.id}
                    >
                      <SelectTrigger className={updatingRoleId === user.id ? "opacity-60" : ""}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="STAFF">Staff</SelectItem>
                        <SelectItem value="STUDENT">Student</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
