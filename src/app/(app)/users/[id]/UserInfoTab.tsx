"use client";

import { FormEvent, useCallback, useEffect, useId, useState } from "react";
import { useToast } from "@/components/Toast";
import { sportLabel } from "@/lib/sports";
import { SPORT_CODES } from "@/lib/sports";
import type { UserDetail, Location, Role } from "../types";
import { AREA_LABELS, AREA_OPTIONS, ROLE_OPTIONS } from "../types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SaveableField, useSaveField } from "@/components/SaveableField";

/* ── Text Input Field ─────────────────────────────────── */

function TextInputField({
  label,
  value,
  placeholder,
  canEdit,
  onSave,
  type = "text",
}: {
  label: string;
  value: string;
  placeholder?: string;
  canEdit: boolean;
  onSave: (v: string) => Promise<void>;
  type?: "text" | "email" | "tel";
}) {
  const [draft, setDraft] = useState(value);
  const { status, save } = useSaveField(onSave);
  const id = useId();

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed === value) return;
    save(trimmed);
  }, [draft, value, save]);

  return (
    <SaveableField label={label} status={status} htmlFor={id}>
      <Input
        id={id}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
        disabled={!canEdit}
        className="h-8 text-sm text-right"
      />
    </SaveableField>
  );
}

/* ── Select Input Field ───────────────────────────────── */

function SelectInputField({
  label,
  value,
  options,
  canEdit,
  onSave,
  allowEmpty,
  emptyLabel,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  canEdit: boolean;
  onSave: (v: string) => Promise<void>;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const { status, save } = useSaveField(onSave);

  return (
    <SaveableField label={label} status={status}>
      <Select
        value={value || "__none__"}
        onValueChange={(v) => {
          const resolved = v === "__none__" ? "" : v;
          if (resolved === value) return;
          save(resolved);
        }}
        disabled={!canEdit}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder={emptyLabel || "None"} />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty && (
            <SelectItem value="__none__">{emptyLabel || "None"}</SelectItem>
          )}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SaveableField>
  );
}

/* ── Sport Options (for the add dropdown) ─────────────── */

const SPORT_OPTIONS = SPORT_CODES.map((s) => ({
  value: s.code,
  label: s.label,
}));

/* ── User Info Tab ─────────────────────────────────────── */

export default function UserInfoTab({
  user,
  locations,
  currentUserRole,
  isSelf = false,
  onUpdated,
}: {
  user: UserDetail;
  locations: Location[];
  currentUserRole: Role | null;
  isSelf?: boolean;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [savingPassword, setSavingPassword] = useState(false);
  const [addingSport, setAddingSport] = useState(false);
  const [addingArea, setAddingArea] = useState(false);

  const isAdmin = currentUserRole === "ADMIN";
  const isStaffOrAdmin = currentUserRole === "ADMIN" || currentUserRole === "STAFF";
  const targetIsStudent = user.role === "STUDENT";

  // Permission logic:
  // - Users can edit their own nominal details (name, phone, location)
  // - Admins can edit everything for everyone
  // - Staff can edit students' profiles but not admin profiles
  const canEditProfile = isAdmin || (isStaffOrAdmin && targetIsStudent);
  const canEditSelf = isSelf; // own name, phone, location
  const canEditRole = isAdmin || (isStaffOrAdmin && !isSelf && user.role !== "ADMIN");
  // Assignments: admin/staff can edit for self + students
  const canEditAssignments = isStaffOrAdmin;

  async function patchUser(payload: Record<string, unknown>) {
    const isSelfProfileField =
      isSelf &&
      Object.keys(payload).every((k) => k === "name" || k === "locationId" || k === "phone");

    const url = isSelfProfileField
      ? "/api/profile"
      : `/api/users/${user.id}`;

    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status === 401) { window.location.href = "/login"; return; }
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Failed to update user");
    }
    onUpdated();
  }

  async function changeRole(newRole: string) {
    const res = await fetch(`/api/users/${user.id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.status === 401) { window.location.href = "/login"; return; }
    const json = await res.json();
    if (!res.ok) {
      toast(json.error || "Failed to change role", "error");
      throw new Error(json.error);
    }
    onUpdated();
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
        body: JSON.stringify({ action: "change_password", currentPassword, newPassword }),
      });
      if (res.status === 401) { window.location.href = "/login"; return; }
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

  async function addSport(sportCode: string) {
    setAddingSport(true);
    try {
      const res = await fetch(`/api/sport-configs/${sportCode}/roster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (res.status === 401) { window.location.href = "/login"; return; }
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to add sport", "error");
      } else {
        onUpdated();
      }
    } catch {
      toast("Network error", "error");
    }
    setAddingSport(false);
  }

  async function removeSport(assignmentId: string, sportCode: string) {
    try {
      const res = await fetch(`/api/sport-configs/${sportCode}/roster?assignmentId=${assignmentId}`, {
        method: "DELETE",
      });
      if (res.status === 401) { window.location.href = "/login"; return; }
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to remove sport", "error");
      } else {
        onUpdated();
      }
    } catch {
      toast("Network error", "error");
    }
  }

  async function addArea(area: string) {
    setAddingArea(true);
    try {
      const res = await fetch("/api/student-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, area, isPrimary: false }),
      });
      if (res.status === 401) { window.location.href = "/login"; return; }
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to add area", "error");
      } else {
        onUpdated();
      }
    } catch {
      toast("Network error", "error");
    }
    setAddingArea(false);
  }

  async function removeArea(assignmentId: string) {
    try {
      const res = await fetch(`/api/student-areas?id=${assignmentId}`, {
        method: "DELETE",
      });
      if (res.status === 401) { window.location.href = "/login"; return; }
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to remove area", "error");
      } else {
        onUpdated();
      }
    } catch {
      toast("Network error", "error");
    }
  }

  async function toggleAreaPrimary(area: string, isPrimary: boolean) {
    try {
      const res = await fetch("/api/student-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, area, isPrimary }),
      });
      if (res.status === 401) { window.location.href = "/login"; return; }
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to update area", "error");
      } else {
        onUpdated();
      }
    } catch {
      toast("Network error", "error");
    }
  }

  const locationOptions = locations.map((l) => ({
    value: l.id,
    label: l.name,
  }));

  const assignedSportCodes = new Set((user.sportAssignments ?? []).map((sa) => sa.sportCode));
  const availableSports = SPORT_OPTIONS.filter((s) => !assignedSportCodes.has(s.value));

  const assignedAreas = new Set((user.areaAssignments ?? []).map((aa) => aa.area));
  const availableAreas = AREA_OPTIONS.filter((a) => !assignedAreas.has(a.value));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-1.5 mt-6">
      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="p-0 py-1">
          <TextInputField
            label="Name"
            value={user.name}
            canEdit={canEditProfile || canEditSelf}
            onSave={(v) => patchUser({ name: v })}
          />
          <TextInputField
            label="Email"
            value={user.email}
            canEdit={canEditProfile}
            onSave={(v) => patchUser({ email: v })}
            type="email"
          />
          <TextInputField
            label="Phone"
            value={user.phone || ""}
            placeholder="Add phone number"
            canEdit={canEditProfile || canEditSelf}
            onSave={(v) => patchUser({ phone: v || null })}
            type="tel"
          />
          <SelectInputField
            label="Role"
            value={user.role}
            options={ROLE_OPTIONS}
            canEdit={canEditRole}
            onSave={changeRole}
          />
          <SelectInputField
            label="Location"
            value={user.locationId || ""}
            options={locationOptions}
            canEdit={canEditProfile || canEditSelf}
            onSave={(v) => patchUser({ locationId: v || null })}
            allowEmpty
            emptyLabel="No location"
          />
          <SelectInputField
            label="Primary Area"
            value={user.primaryArea || ""}
            options={AREA_OPTIONS}
            canEdit={canEditProfile}
            onSave={(v) => patchUser({ primaryArea: v || null })}
            allowEmpty
            emptyLabel="Not assigned"
          />
        </CardContent>
      </Card>

      {/* Assignments Card */}
      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Sport Assignments */}
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Sports</h3>
          {(user.sportAssignments ?? []).length === 0 && !canEditAssignments ? (
            <p className="text-sm text-muted-foreground mb-1">No sport assignments</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {(user.sportAssignments ?? []).map((sa) => (
                <Badge key={sa.id} variant="blue" size="sm" className="gap-1">
                  {sportLabel(sa.sportCode)}
                  {canEditAssignments && (
                    <button
                      type="button"
                      className="ml-0.5 rounded-full hover:bg-blue-600/20 p-0.5"
                      onClick={() => removeSport(sa.id, sa.sportCode)}
                      aria-label={`Remove ${sportLabel(sa.sportCode)}`}
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </Badge>
              ))}
              {canEditAssignments && availableSports.length > 0 && (
                <Select
                  value=""
                  onValueChange={(v) => { if (v) addSport(v); }}
                  disabled={addingSport}
                >
                  <SelectTrigger className="h-6 w-auto gap-1 text-xs px-2 border-dashed">
                    <Plus className="size-3" />
                    <span>Add</span>
                  </SelectTrigger>
                  <SelectContent>
                    {availableSports.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          {(user.sportAssignments ?? []).length === 0 && canEditAssignments && availableSports.length > 0 && (
            <div className="mb-1">
              <Select
                value=""
                onValueChange={(v) => { if (v) addSport(v); }}
                disabled={addingSport}
              >
                <SelectTrigger className="h-6 w-auto gap-1 text-xs px-2 border-dashed">
                  <Plus className="size-3" />
                  <span>Add sport</span>
                </SelectTrigger>
                <SelectContent>
                  {availableSports.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Separator className="my-2" />

          {/* Area Assignments */}
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Areas</h3>
          {(user.areaAssignments ?? []).length === 0 && !canEditAssignments ? (
            <p className="text-sm text-muted-foreground">No area assignments</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {(user.areaAssignments ?? []).map((aa) => (
                <Badge
                  key={aa.id}
                  variant={aa.isPrimary ? "purple" : "gray"}
                  size="sm"
                  className="gap-1 cursor-default"
                >
                  <button
                    type="button"
                    className={canEditAssignments ? "hover:underline" : ""}
                    disabled={!canEditAssignments}
                    onClick={() => canEditAssignments && toggleAreaPrimary(aa.area, !aa.isPrimary)}
                    title={canEditAssignments ? (aa.isPrimary ? "Remove as primary" : "Set as primary") : undefined}
                  >
                    {AREA_LABELS[aa.area] || aa.area}
                    {aa.isPrimary && " (Primary)"}
                  </button>
                  {canEditAssignments && (
                    <button
                      type="button"
                      className="ml-0.5 rounded-full hover:bg-black/10 p-0.5"
                      onClick={() => removeArea(aa.id)}
                      aria-label={`Remove ${AREA_LABELS[aa.area] || aa.area}`}
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </Badge>
              ))}
              {canEditAssignments && availableAreas.length > 0 && (
                <Select
                  value=""
                  onValueChange={(v) => { if (v) addArea(v); }}
                  disabled={addingArea}
                >
                  <SelectTrigger className="h-6 w-auto gap-1 text-xs px-2 border-dashed">
                    <Plus className="size-3" />
                    <span>Add</span>
                  </SelectTrigger>
                  <SelectContent>
                    {availableAreas.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          {(user.areaAssignments ?? []).length === 0 && canEditAssignments && availableAreas.length > 0 && (
            <Select
              value=""
              onValueChange={(v) => { if (v) addArea(v); }}
              disabled={addingArea}
            >
              <SelectTrigger className="h-6 w-auto gap-1 text-xs px-2 border-dashed">
                <Plus className="size-3" />
                <span>Add area</span>
              </SelectTrigger>
              <SelectContent>
                {availableAreas.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Password Change Card — only shown when viewing own profile */}
      {isSelf && (
        <Card className="lg:col-span-full">
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="grid gap-3 max-w-sm">
              <div className="space-y-1.5">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input id="currentPassword" name="currentPassword" type="password" required minLength={8} disabled={savingPassword} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">New password</Label>
                <Input id="newPassword" name="newPassword" type="password" required minLength={8} disabled={savingPassword} />
              </div>
              <Button type="submit" disabled={savingPassword} className="w-fit">
                {savingPassword && <Loader2 className="mr-1.5 size-4 animate-spin" />}
                {savingPassword ? "Updating..." : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
