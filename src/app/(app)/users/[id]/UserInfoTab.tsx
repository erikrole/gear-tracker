"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useToast } from "@/components/Toast";
import { sportLabel } from "@/lib/sports";
import type { UserDetail, Location } from "../types";
import { AREA_LABELS, AREA_OPTIONS, ROLE_OPTIONS } from "../types";
import RoleBadge from "../RoleBadge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

  const locationOptions = locations.map((l) => ({
    value: l.id,
    label: l.name,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 mt-6">
      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="p-0 py-1">
          <TextInputField
            label="Name"
            value={user.name}
            canEdit={canEdit}
            onSave={(v) => patchUser({ name: v })}
          />
          <TextInputField
            label="Email"
            value={user.email}
            canEdit={canEdit}
            onSave={(v) => patchUser({ email: v })}
            type="email"
          />
          <TextInputField
            label="Phone"
            value={user.phone || ""}
            placeholder="Add phone number"
            canEdit={canEdit}
            onSave={(v) => patchUser({ phone: v || null })}
            type="tel"
          />
          <SelectInputField
            label="Role"
            value={user.role}
            options={ROLE_OPTIONS}
            canEdit={canEdit}
            onSave={changeRole}
          />
          <SelectInputField
            label="Location"
            value={user.locationId || ""}
            options={locationOptions}
            canEdit={canEdit}
            onSave={(v) => patchUser({ locationId: v || null })}
            allowEmpty
            emptyLabel="No location"
          />
          <SelectInputField
            label="Primary Area"
            value={user.primaryArea || ""}
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
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Sports</h3>
          {user.sportAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-4">No sport assignments</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {user.sportAssignments.map((sa) => (
                <Badge key={sa.id} variant="blue" size="sm">
                  {sportLabel(sa.sportCode)}
                </Badge>
              ))}
            </div>
          )}

          <Separator className="my-2" />

          {/* Area Assignments */}
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Areas</h3>
          {user.areaAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No area assignments</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {user.areaAssignments.map((aa) => (
                <Badge
                  key={aa.id}
                  variant={aa.isPrimary ? "purple" : "gray"}
                  size="sm"
                >
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
