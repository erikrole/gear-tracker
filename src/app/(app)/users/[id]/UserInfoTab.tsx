"use client";

import { FormEvent, useCallback, useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { sportLabel } from "@/lib/sports";
import { SPORT_CODES } from "@/lib/sports";
import type { UserDetail, Location, Role } from "../types";
import { AREA_LABELS, AREA_OPTIONS, ROLE_OPTIONS } from "../types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ChevronsUpDown, ClockIcon, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import { SaveableField, useSaveField } from "@/components/SaveableField";
import { cn } from "@/lib/utils";
import { handleAuthRedirect } from "@/lib/errors";

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
        className="h-8 text-sm"
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
  const [savingPassword, setSavingPassword] = useState(false);
  const [addingSport, setAddingSport] = useState(false);
  const [addingArea, setAddingArea] = useState(false);

  const isAdmin = currentUserRole === "ADMIN";
  const isStaffOrAdmin = currentUserRole === "ADMIN" || currentUserRole === "STAFF";
  const targetIsStudent = user.role === "STUDENT";

  // Permission logic:
  // - Everyone can edit their own nominal details (name, phone, location)
  // - Admins can edit everything for everyone
  // - Staff can only edit student profiles (not other staff or admins)
  const isStaff = currentUserRole === "STAFF";
  const canEditProfile = isAdmin || (isStaff && targetIsStudent);
  const canEditSelf = isSelf; // own name, phone, location
  const canEditRole = isAdmin || (isStaff && !isSelf && targetIsStudent);
  // Assignments: admin/staff can edit for self + students
  const canEditAssignments = isAdmin || (isStaff && (isSelf || targetIsStudent));

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
    if (handleAuthRedirect(res)) return;
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
    if (handleAuthRedirect(res)) return;
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Failed to change role");
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
      if (handleAuthRedirect(res)) return;
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to update password");
      } else {
        e.currentTarget.reset();
        toast.success("Password updated");
      }
    } catch {
      toast.error("Network error");
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
      if (handleAuthRedirect(res)) return;
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to add sport");
      } else {
        onUpdated();
      }
    } catch {
      toast.error("Network error");
    }
    setAddingSport(false);
  }

  async function removeSport(assignmentId: string, sportCode: string) {
    try {
      const res = await fetch(`/api/sport-configs/${sportCode}/roster?assignmentId=${assignmentId}`, {
        method: "DELETE",
      });
      if (handleAuthRedirect(res)) return;
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to remove sport");
      } else {
        onUpdated();
      }
    } catch {
      toast.error("Network error");
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
      if (handleAuthRedirect(res)) return;
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to add area");
      } else {
        onUpdated();
      }
    } catch {
      toast.error("Network error");
    }
    setAddingArea(false);
  }

  async function removeArea(assignmentId: string) {
    try {
      const res = await fetch(`/api/student-areas?id=${assignmentId}`, {
        method: "DELETE",
      });
      if (handleAuthRedirect(res)) return;
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to remove area");
      } else {
        onUpdated();
      }
    } catch {
      toast.error("Network error");
    }
  }

  async function toggleAreaPrimary(area: string, isPrimary: boolean) {
    try {
      const res = await fetch("/api/student-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, area, isPrimary }),
      });
      if (handleAuthRedirect(res)) return;
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to update area");
      } else {
        onUpdated();
      }
    } catch {
      toast.error("Network error");
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
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mt-6">
      <div className="flex flex-col gap-4">
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

      {/* My Hours Card — only shown for own profile */}
      {isSelf && <MyHoursCard />}
      </div>

      {/* Assignments Card */}
      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Sport Assignments — Multi-select */}
          <h3 className="text-sm font-semibold mb-2">Sports</h3>
          {canEditAssignments ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between h-auto min-h-9 font-normal"
                  disabled={addingSport}
                >
                  {(user.sportAssignments ?? []).length === 0 ? (
                    <span className="text-muted-foreground">Select sports...</span>
                  ) : (
                    <div className="flex flex-wrap gap-1 py-0.5">
                      {(user.sportAssignments ?? []).map((sa) => (
                        <Badge key={sa.id} variant="blue" size="sm" className="gap-1">
                          {sportLabel(sa.sportCode)}
                          <button
                            type="button"
                            className="ml-0.5 rounded-full hover:bg-blue-600/20 p-0.5"
                            onClick={(e) => { e.stopPropagation(); removeSport(sa.id, sa.sportCode); }}
                            aria-label={`Remove ${sportLabel(sa.sportCode)}`}
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search sports..." />
                  <CommandList>
                    <CommandEmpty>No sports found.</CommandEmpty>
                    <CommandGroup>
                      {SPORT_OPTIONS.map((s) => {
                        const isSelected = assignedSportCodes.has(s.value);
                        const assignment = (user.sportAssignments ?? []).find((sa) => sa.sportCode === s.value);
                        return (
                          <CommandItem
                            key={s.value}
                            value={s.label}
                            onSelect={() => {
                              if (isSelected && assignment) {
                                removeSport(assignment.id, s.value);
                              } else {
                                addSport(s.value);
                              }
                            }}
                          >
                            <Check className={cn("mr-2 size-4", isSelected ? "opacity-100" : "opacity-0")} />
                            {s.label}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : (user.sportAssignments ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground mb-1">No sport assignments</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {(user.sportAssignments ?? []).map((sa) => (
                <Badge key={sa.id} variant="blue" size="sm">
                  {sportLabel(sa.sportCode)}
                </Badge>
              ))}
            </div>
          )}

          <Separator className="my-3" />

          {/* Area Assignments — Multi-select */}
          <h3 className="text-sm font-semibold mb-2">Areas</h3>
          {canEditAssignments ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between h-auto min-h-9 font-normal"
                  disabled={addingArea}
                >
                  {(user.areaAssignments ?? []).length === 0 ? (
                    <span className="text-muted-foreground">Select areas...</span>
                  ) : (
                    <div className="flex flex-wrap gap-1 py-0.5">
                      {(user.areaAssignments ?? []).map((aa) => (
                        <Badge
                          key={aa.id}
                          variant={aa.isPrimary ? "purple" : "gray"}
                          size="sm"
                          className="gap-1"
                        >
                          <button
                            type="button"
                            className="hover:underline"
                            onClick={(e) => { e.stopPropagation(); toggleAreaPrimary(aa.area, !aa.isPrimary); }}
                            title={aa.isPrimary ? "Remove as primary" : "Set as primary"}
                          >
                            {AREA_LABELS[aa.area] || aa.area}
                            {aa.isPrimary && " (Primary)"}
                          </button>
                          <button
                            type="button"
                            className="ml-0.5 rounded-full hover:bg-black/10 p-0.5"
                            onClick={(e) => { e.stopPropagation(); removeArea(aa.id); }}
                            aria-label={`Remove ${AREA_LABELS[aa.area] || aa.area}`}
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandList>
                    <CommandGroup>
                      {AREA_OPTIONS.map((a) => {
                        const isSelected = assignedAreas.has(a.value);
                        const assignment = (user.areaAssignments ?? []).find((aa) => aa.area === a.value);
                        return (
                          <CommandItem
                            key={a.value}
                            value={a.label}
                            onSelect={() => {
                              if (isSelected && assignment) {
                                removeArea(assignment.id);
                              } else {
                                addArea(a.value);
                              }
                            }}
                          >
                            <Check className={cn("mr-2 size-4", isSelected ? "opacity-100" : "opacity-0")} />
                            {a.label}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : (user.areaAssignments ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No area assignments</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {(user.areaAssignments ?? []).map((aa) => (
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
                {savingPassword && <Spinner data-icon="inline-start" />}
                {savingPassword ? "Updating..." : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── My Hours Card ──────────────────────────────────────── */

type MyHoursData = {
  thisWeek: number;
  thisMonth: number;
  shiftCountWeek: number;
  shiftCountMonth: number;
};

async function fetchMyHours(): Promise<MyHoursData | null> {
  const r = await fetch("/api/shifts/my-hours");
  if (!r.ok) return null;
  const j = await r.json();
  return j?.data ?? null;
}

function MyHoursCard() {
  const { data: hours } = useQuery({
    queryKey: ["shifts", "my-hours"],
    queryFn: fetchMyHours,
    staleTime: 5 * 60_000,
  });

  if (!hours || (hours.shiftCountWeek === 0 && hours.shiftCountMonth === 0)) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClockIcon className="size-4" />
          My hours
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-2xl font-bold">{hours.thisWeek}h</div>
            <div className="text-xs text-muted-foreground">
              This week ({hours.shiftCountWeek} shift{hours.shiftCountWeek !== 1 ? "s" : ""})
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold">{hours.thisMonth}h</div>
            <div className="text-xs text-muted-foreground">
              This month ({hours.shiftCountMonth} shift{hours.shiftCountMonth !== 1 ? "s" : ""})
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
