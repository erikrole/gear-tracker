"use client";

import { FormEvent, useCallback, useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { sportLabel } from "@/lib/sports";
import { SPORT_CODES } from "@/lib/sports";
import type { UserDetail, Location, Role, StudentYear } from "../types";
import { AREA_LABELS, AREA_OPTIONS, ROLE_OPTIONS, STUDENT_YEAR_OPTIONS, deriveStudentYear } from "../types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ChevronsUpDown, ClockIcon, Copy, RefreshCw, X } from "lucide-react";
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
        <SelectTrigger size="sm" className="text-sm">
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

/* ── Date Input Field ─────────────────────────────────── */

function DateInputField({
  label,
  value,
  canEdit,
  onSave,
}: {
  label: string;
  value: string | null;          // ISO datetime
  canEdit: boolean;
  onSave: (iso: string | null) => Promise<void>;
}) {
  const initial = value ? value.slice(0, 10) : "";
  const [draft, setDraft] = useState(initial);
  const { status, save } = useSaveField<string | null>(onSave);
  const id = useId();

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  const commit = useCallback(() => {
    if (draft === initial) return;
    if (!draft) {
      save(null);
      return;
    }
    // Normalize to UTC midnight; date column in Postgres ignores time.
    const iso = new Date(`${draft}T00:00:00.000Z`).toISOString();
    save(iso);
  }, [draft, initial, save]);

  return (
    <SaveableField label={label} status={status} htmlFor={id}>
      <Input
        id={id}
        type="date"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        disabled={!canEdit}
        className="h-8 text-sm"
      />
    </SaveableField>
  );
}

/* ── Number Input Field ───────────────────────────────── */

function NumberInputField({
  label,
  value,
  canEdit,
  onSave,
  placeholder,
}: {
  label: string;
  value: number | null;
  canEdit: boolean;
  onSave: (n: number | null) => Promise<void>;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const { status, save } = useSaveField<number | null>(onSave);
  const id = useId();

  useEffect(() => {
    setDraft(value == null ? "" : String(value));
  }, [value]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed === (value == null ? "" : String(value))) return;
    if (!trimmed) {
      save(null);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      toast.error(`${label} must be a whole number`);
      setDraft(value == null ? "" : String(value));
      return;
    }
    save(n);
  }, [draft, value, save, label]);

  return (
    <SaveableField label={label} status={status} htmlFor={id}>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        disabled={!canEdit}
        className="h-8 text-sm"
      />
    </SaveableField>
  );
}

/* ── Direct Report Autocomplete ───────────────────────── */

type DirectReportSearchResult = { id: string; name: string; email: string };

function DirectReportField({
  user,
  canEdit,
  onSavePicked,
  onSaveFreeText,
}: {
  user: UserDetail;
  canEdit: boolean;
  onSavePicked: (pickedUserId: string | null) => Promise<void>;
  onSaveFreeText: (name: string | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectReportSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const linkedName = user.directReport?.name ?? null;
  const displayValue = linkedName ?? user.directReportName ?? "";

  // Debounced search against the existing /api/users endpoint.
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users?q=${encodeURIComponent(trimmed)}&limit=8&active=all`);
        if (!res.ok) return;
        const json = await res.json();
        const data: DirectReportSearchResult[] = (json.data ?? [])
          .filter((u: { id: string }) => u.id !== user.id)
          .map((u: { id: string; name: string; email: string }) => ({
            id: u.id, name: u.name, email: u.email,
          }));
        setResults(data);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [query, open, user.id]);

  async function pickUser(picked: DirectReportSearchResult) {
    setOpen(false);
    setQuery("");
    await onSavePicked(picked.id);
  }

  async function saveFreeTextFromQuery() {
    const trimmed = query.trim();
    if (!trimmed) return;
    setOpen(false);
    setQuery("");
    await onSaveFreeText(trimmed);
  }

  async function clear() {
    setOpen(false);
    setQuery("");
    if (user.directReportId) {
      await onSavePicked(null);
    } else if (user.directReportName) {
      await onSaveFreeText(null);
    }
  }

  return (
    <SaveableField label="Direct Report" status="idle">
      <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            disabled={!canEdit}
            className="w-full justify-between h-8 font-normal text-sm"
          >
            {displayValue ? (
              <span className="flex items-center gap-1.5 truncate">
                <span className="truncate">{displayValue}</span>
                {linkedName ? (
                  <Badge variant="blue" size="sm">Linked</Badge>
                ) : (
                  user.directReportName && (
                    <Badge variant="gray" size="sm">Unlinked</Badge>
                  )
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">No direct report</span>
            )}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search users or type a name..."
              value={query}
              onValueChange={setQuery}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results.length === 0 && query.trim()) {
                  e.preventDefault();
                  void saveFreeTextFromQuery();
                }
              }}
            />
            <CommandList>
              {searching && (
                <CommandEmpty>Searching…</CommandEmpty>
              )}
              {!searching && results.length === 0 && query.trim().length >= 2 && (
                <CommandEmpty>
                  <button
                    type="button"
                    className="text-sm text-left w-full px-2 py-1 hover:bg-accent rounded"
                    onClick={saveFreeTextFromQuery}
                  >
                    Use “{query.trim()}” as free-text
                  </button>
                </CommandEmpty>
              )}
              {!searching && results.length === 0 && query.trim().length < 2 && (
                <CommandEmpty>Type at least 2 characters…</CommandEmpty>
              )}
              {results.length > 0 && (
                <CommandGroup heading="Users">
                  {results.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={r.id}
                      onSelect={() => pickUser(r)}
                    >
                      <div className="flex flex-col">
                        <span>{r.name}</span>
                        <span className="text-xs text-muted-foreground">{r.email}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {(user.directReportId || user.directReportName) && (
                <CommandGroup>
                  <CommandItem onSelect={clear} className="text-destructive">
                    <X className="mr-2 size-4" /> Clear
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </SaveableField>
  );
}

/* ── Sizes Row (compact 2- or 3-column inline edit) ───── */

function SizeMiniInput({
  label,
  value,
  placeholder,
  canEdit,
  onSave,
}: {
  label: string;
  value: string;
  placeholder: string;
  canEdit: boolean;
  onSave: (v: string | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const { status, save } = useSaveField<string | null>(onSave);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed === value.trim()) return;
    save(trimmed || null);
  }, [draft, value, save]);

  return (
    <label className="flex flex-col gap-0.5 min-w-0 flex-1">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
        {status === "saving" && " · saving"}
        {status === "saved" && " · saved"}
        {status === "error" && " · error"}
      </span>
      <Input
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        disabled={!canEdit}
        className="h-7 text-sm px-2"
      />
    </label>
  );
}

function SizesRow({
  user,
  isStudent,
  canEdit,
  onPatch,
}: {
  user: UserDetail;
  isStudent: boolean;
  canEdit: boolean;
  onPatch: (payload: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <div className="px-3 py-2 border-t flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">Sizes</span>
      <div className="flex items-end gap-2">
        <SizeMiniInput
          label={isStudent ? "Clothing" : "Top"}
          value={user.topSize ?? ""}
          placeholder="e.g. M"
          canEdit={canEdit}
          onSave={(v) => onPatch({ topSize: v })}
        />
        {!isStudent && (
          <SizeMiniInput
            label="Bottom"
            value={user.bottomSize ?? ""}
            placeholder="e.g. M, 32"
            canEdit={canEdit}
            onSave={(v) => onPatch({ bottomSize: v })}
          />
        )}
        <SizeMiniInput
          label="Shoes"
          value={user.shoeSize ?? ""}
          placeholder="e.g. 10.5"
          canEdit={canEdit}
          onSave={(v) => onPatch({ shoeSize: v })}
        />
      </div>
    </div>
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

  // Fields a user can edit on their own profile (mirrors updateProfileSchema).
  const SELF_EDITABLE_FIELDS = new Set([
    "name", "locationId", "phone",
    "title", "athleticsEmail", "startDate", "gradYear", "studentYearOverride",
    "topSize", "bottomSize", "shoeSize",
  ]);

  async function patchUser(payload: Record<string, unknown>) {
    const isSelfProfileField =
      isSelf && Object.keys(payload).every((k) => SELF_EDITABLE_FIELDS.has(k));

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
            label="Campus Email"
            value={user.email}
            canEdit={canEditProfile}
            onSave={(v) => patchUser({ email: v })}
            type="email"
          />
          <TextInputField
            label="Athletics Email"
            value={user.athleticsEmail || ""}
            placeholder="name@athletics.wisc.edu"
            canEdit={canEditProfile || canEditSelf}
            onSave={(v) => patchUser({ athleticsEmail: v || null })}
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

      {/* Details Card — fields migrated from the team Sheet */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="p-0 py-1">
          {!targetIsStudent && (
            <TextInputField
              label="Title"
              value={user.title || ""}
              placeholder="e.g. Digital Producer"
              canEdit={canEditProfile || canEditSelf}
              onSave={(v) => patchUser({ title: v || null })}
            />
          )}
          <DateInputField
            label="Start Date"
            value={user.startDate}
            canEdit={canEditProfile || canEditSelf}
            onSave={(iso) => patchUser({ startDate: iso })}
          />
          {targetIsStudent && (
            <>
              <NumberInputField
                label="Grad Year"
                value={user.gradYear}
                placeholder="e.g. 2027"
                canEdit={canEditProfile || canEditSelf}
                onSave={(n) => patchUser({ gradYear: n })}
              />
              <SelectInputField
                label="Year (override)"
                value={user.studentYearOverride || ""}
                options={STUDENT_YEAR_OPTIONS as { value: string; label: string }[]}
                canEdit={canEditProfile || canEditSelf}
                onSave={(v) => patchUser({ studentYearOverride: (v || null) as StudentYear | null })}
                allowEmpty
                emptyLabel={
                  user.gradYear
                    ? `Auto: ${(deriveStudentYear(user.gradYear, null) ?? "—")}`
                    : "Auto"
                }
              />
            </>
          )}
          <DirectReportField
            user={user}
            canEdit={canEditProfile && !isSelf}
            onSavePicked={(pickedId) => patchUser({ directReportId: pickedId })}
            onSaveFreeText={(name) => patchUser({ directReportName: name })}
          />
          <SizesRow
            user={user}
            isStudent={targetIsStudent}
            canEdit={canEditProfile || canEditSelf}
            onPatch={patchUser}
          />
        </CardContent>
      </Card>

      {/* My Hours Card — only shown for own profile */}
      {isSelf && <MyHoursCard />}

      {/* Calendar Subscription — only shown for own profile */}
      {isSelf && (
        <CalendarSubscriptionCard
          initialToken={user.icsToken ?? null}
          onTokenChange={onUpdated}
        />
      )}
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

/* ── Calendar Subscription Card ─────────────────────────── */

function CalendarSubscriptionCard({
  initialToken,
  onTokenChange,
}: {
  initialToken: string | null;
  onTokenChange: () => void;
}) {
  const [token, setToken] = useState(initialToken);
  const [generating, setGenerating] = useState(false);

  const feedUrl = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/shifts/ics/${token}`
    : null;
  const webcalUrl = feedUrl ? feedUrl.replace(/^https?/, "webcal") : null;

  async function generateToken() {
    setGenerating(true);
    try {
      const res = await fetch("/api/shifts/ics-token", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to generate token");
      } else {
        setToken(json.data?.token);
        onTokenChange();
      }
    } catch {
      toast.error("Network error");
    }
    setGenerating(false);
  }

  function copyUrl() {
    if (!feedUrl) return;
    navigator.clipboard.writeText(feedUrl).then(() => toast.success("Feed URL copied"));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendar subscription</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {token ? (
          <>
            <p className="text-sm text-muted-foreground">
              Subscribe to your shifts in Apple Calendar, Google Calendar, or any app that supports ICS feeds.
              The URL stays in sync — no re-subscribing needed.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={feedUrl ?? ""}
                className="h-8 text-xs font-mono"
                onFocus={(e) => e.target.select()}
              />
              <Button variant="outline" size="sm" onClick={copyUrl} title="Copy URL">
                <Copy className="size-4" />
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button asChild size="sm">
                <a href={webcalUrl ?? "#"}>Subscribe in Calendar</a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={generateToken}
                disabled={generating}
                title="Rotate token — invalidates the old URL"
              >
                {generating ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Rotate URL
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Generate a private URL to subscribe to your shifts in any calendar app.
            </p>
            <Button size="sm" onClick={generateToken} disabled={generating}>
              {generating && <RefreshCw className="size-4 animate-spin mr-2" />}
              Generate feed URL
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
