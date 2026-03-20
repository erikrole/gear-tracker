"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { sportLabel } from "@/lib/sports";
import type { UserDetail, Location, Role } from "../types";
import { AREA_LABELS, AREA_OPTIONS, ROLE_OPTIONS } from "../types";
import RoleBadge from "../RoleBadge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/* ── Editable Text Field ───────────────────────────────── */

function EditableField({
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  async function commit() {
    const trimmed = draft.trim();
    if (trimmed === value) { setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch {
      setDraft(value);
      setEditing(false);
    }
    setSaving(false);
  }

  const isEmpty = !value;
  const displayText = isEmpty && placeholder ? placeholder : (value || "\u2014");
  const displayStyle = isEmpty && placeholder
    ? { color: "var(--text-muted)", fontStyle: "italic" as const, cursor: canEdit ? "pointer" : "default" }
    : { cursor: canEdit ? "pointer" : "default", borderBottom: canEdit ? "1px dashed var(--border)" : "none", padding: "0 2px" };

  return (
    <div className="data-list-row">
      <dt className="data-list-label">{label}</dt>
      <dd className="data-list-value">
        {editing ? (
          <input
            ref={inputRef}
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setDraft(value); setEditing(false); }
            }}
            disabled={saving}
            className="inline-edit-input"
          />
        ) : (
          <span
            onClick={() => canEdit && setEditing(true)}
            onKeyDown={(e) => { if (canEdit && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setEditing(true); } }}
            style={displayStyle}
            title={canEdit ? "Click to edit" : undefined}
            role={canEdit ? "button" : undefined}
            tabIndex={canEdit ? 0 : undefined}
          >
            {displayText}
          </span>
        )}
      </dd>
    </div>
  );
}

/* ── Select Field ──────────────────────────────────────── */

function SelectField({
  label,
  value,
  displayValue,
  options,
  canEdit,
  onSave,
  allowEmpty,
  emptyLabel,
}: {
  label: string;
  value: string;
  displayValue?: string;
  options: { value: string; label: string }[];
  canEdit: boolean;
  onSave: (v: string) => Promise<void>;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="data-list-row">
      <dt className="data-list-label">{label}</dt>
      <dd className="data-list-value">
        {editing ? (
          <select
            value={value}
            onChange={async (e) => { try { await onSave(e.target.value); } finally { setEditing(false); } }}
            onBlur={() => setEditing(false)}
            autoFocus
            className="form-select"
            style={{ fontSize: "var(--text-sm)", padding: "2px 6px" }}
          >
            {allowEmpty && <option value="">{emptyLabel || "None"}</option>}
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <span
            onClick={() => canEdit && setEditing(true)}
            onKeyDown={(e) => { if (canEdit && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setEditing(true); } }}
            style={{
              cursor: canEdit ? "pointer" : "default",
              borderBottom: canEdit ? "1px dashed var(--border)" : "none",
              padding: "0 2px",
            }}
            title={canEdit ? "Click to edit" : undefined}
            role={canEdit ? "button" : undefined}
            tabIndex={canEdit ? 0 : undefined}
          >
            {displayValue || value || "\u2014"}
          </span>
        )}
      </dd>
    </div>
  );
}

/* ── User Info Tab ─────────────────────────────────────── */

export default function UserInfoTab({
  user,
  locations,
  canEdit,
  onUpdated,
}: {
  user: UserDetail;
  locations: Location[];
  canEdit: boolean;
  onUpdated: () => void;
}) {
  const { toast } = useToast();

  async function patchUser(payload: Record<string, unknown>) {
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      toast(json.error || "Failed to update user", "error");
      throw new Error(json.error);
    }
    toast("Updated", "success");
    onUpdated();
  }

  async function changeRole(newRole: string) {
    const res = await fetch(`/api/users/${user.id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast(json.error || "Failed to change role", "error");
      throw new Error(json.error);
    }
    toast("Role updated", "success");
    onUpdated();
  }

  const locationOptions = locations.map((l) => ({ value: l.id, label: l.name }));

  return (
    <div className="details-grid mt-14">
      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="p-0 py-1">
          <EditableField
            label="Name"
            value={user.name}
            canEdit={canEdit}
            onSave={(v) => patchUser({ name: v })}
          />
          <EditableField
            label="Email"
            value={user.email}
            canEdit={canEdit}
            onSave={(v) => patchUser({ email: v })}
            type="email"
          />
          <EditableField
            label="Phone"
            value={user.phone || ""}
            placeholder="Add phone number"
            canEdit={canEdit}
            onSave={(v) => patchUser({ phone: v || null })}
            type="tel"
          />
          <SelectField
            label="Role"
            value={user.role}
            displayValue={user.role.charAt(0) + user.role.slice(1).toLowerCase()}
            options={ROLE_OPTIONS}
            canEdit={canEdit}
            onSave={changeRole}
          />
          <SelectField
            label="Location"
            value={user.locationId || ""}
            displayValue={user.location || undefined}
            options={locationOptions}
            canEdit={canEdit}
            onSave={(v) => patchUser({ locationId: v || null })}
            allowEmpty
            emptyLabel="No location"
          />
          <SelectField
            label="Primary Area"
            value={user.primaryArea || ""}
            displayValue={user.primaryArea ? AREA_LABELS[user.primaryArea] || user.primaryArea : undefined}
            options={AREA_OPTIONS}
            canEdit={canEdit}
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
          <h3 className="text-sm font-semibold text-secondary mb-8">Sports</h3>
          {user.sportAssignments.length === 0 ? (
            <p className="text-sm text-muted mb-16">No sport assignments</p>
          ) : (
            <div className="assignment-chips mb-16">
              {user.sportAssignments.map((sa) => (
                <Badge key={sa.id} variant="blue" size="sm">
                  {sportLabel(sa.sportCode)}
                </Badge>
              ))}
            </div>
          )}

          {/* Area Assignments */}
          <h3 className="text-sm font-semibold text-secondary mb-8">Areas</h3>
          {user.areaAssignments.length === 0 ? (
            <p className="text-sm text-muted">No area assignments</p>
          ) : (
            <div className="assignment-chips">
              {user.areaAssignments.map((aa) => (
                <Badge key={aa.id} variant={aa.isPrimary ? "purple" : "gray"} size="sm">
                  {AREA_LABELS[aa.area] || aa.area}
                  {aa.isPrimary && " (Primary)"}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
