"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Copy, Download, KeyRound, Shuffle, UserPlus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useFormSubmit } from "@/hooks/use-form-submit";
import { classifyError, handleAuthRedirect, isAbortError, parseErrorMessage, parseJsonSafely } from "@/lib/errors";

type Role = "ADMIN" | "STAFF" | "STUDENT";
type InviteRole = "STAFF" | "STUDENT";
type OnboardingMode = "invite" | "create";
type InviteMode = "bulk" | "single";
type CreateMode = "single" | "bulk";
type InvitePreviewStatus = "ready" | "duplicate" | "invalid-email" | "invalid-role" | "role-blocked";
type BulkCreatePreviewStatus = InvitePreviewStatus | "missing-name" | "invalid-location";

type Location = {
  id: string;
  name: string;
};

type CreatedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  locationId: string | null;
  location: string | null;
};

type InviteResponse = {
  skipped?: boolean | number;
  created?: number;
};

type CompletionResult =
  | {
      kind: "created";
      user: CreatedUser;
      temporaryPassword: string;
    }
  | {
      kind: "bulk-created";
      users: Array<CreatedUser & { temporaryPassword: string }>;
      requested: number;
    }
  | {
      kind: "invites";
      created: number;
      skipped: number;
      requested: number;
    };

type InvitePreviewRow = {
  line: number;
  email: string;
  role: InviteRole;
  status: InvitePreviewStatus;
  reason: string;
};

type BulkCreatePreviewRow = {
  line: number;
  name: string;
  email: string;
  role: Role;
  locationId: string | null;
  locationLabel: string;
  status: BulkCreatePreviewStatus;
  reason: string;
};

type ServerPreviewStatus = "ready" | "duplicate" | "existing_user" | "pending_invite" | "claimed_invite";

type ServerPreviewRow = {
  email: string;
  requestedRole: InviteRole;
  status: ServerPreviewStatus;
  existingRole?: Role;
};

type ServerPreviewResponse = {
  rows: ServerPreviewRow[];
  summary: Record<ServerPreviewStatus, number>;
};

type OnboardingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: Location[];
  locationsLoading?: boolean;
  locationsError?: boolean;
  onRetryLocations?: () => void;
  currentUserRole: Role | null;
  initialMode?: OnboardingMode;
  onCreated?: (user: CreatedUser) => void;
  onInvitesChanged?: () => void;
};

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "STAFF", "STUDENT"]),
  locationId: z.string().cuid().nullable(),
});

type CreateUserInput = z.infer<typeof createUserSchema>;

const ROLE_HELP: Record<CreateUserInput["role"], string> = {
  ADMIN: "Full system access. Use only for operators who manage settings and accounts.",
  STAFF: "Can create and edit users, inventory, reservations, and checkouts.",
  STUDENT: "Can view shared operations and manage only their own booking work.",
};

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  STAFF: "Staff",
  STUDENT: "Student",
};

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

function emailLooksValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if ((char === "," || char === "\t") && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }

  cells.push(cell.trim());
  return cells;
}

function normalizeInviteRole(rawRole: string, fallback: InviteRole): InviteRole | null {
  const normalized = rawRole.trim().toUpperCase();
  if (!normalized) return fallback;
  if (["STAFF", "EMPLOYEE", "COACH"].includes(normalized)) return "STAFF";
  if (["STUDENT", "STU", "ATHLETE"].includes(normalized)) return "STUDENT";
  return null;
}

function rowTokensForLine(line: string): Array<{ email: string; rawRole: string }> {
  const csvCells = splitCsvLine(line);
  const first = csvCells[0]?.trim() ?? "";
  const second = csvCells[1]?.trim() ?? "";
  const secondLooksLikeRole = !!second && !second.includes("@");

  if (csvCells.length > 1 && secondLooksLikeRole) {
    return [{ email: first, rawRole: second }];
  }

  return line
    .split(/[\s,;]+/)
    .map((email) => ({ email: email.trim(), rawRole: "" }))
    .filter((entry) => entry.email.length > 0);
}

function previewInviteRows(raw: string, fallbackRole: InviteRole, allowedRoles: InviteRole[]): InvitePreviewRow[] {
  const rows: InvitePreviewRow[] = [];
  const seen = new Set<string>();

  raw.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const tokens = rowTokensForLine(trimmed);
    const firstEmail = tokens[0]?.email.trim().toLowerCase() ?? "";
    if (index === 0 && ["email", "email address", "campus email"].includes(firstEmail)) return;

    for (const token of tokens) {
      const email = token.email.trim().toLowerCase();
      const role = normalizeInviteRole(token.rawRole, fallbackRole);

      if (!emailLooksValid(email)) {
        rows.push({
          line: index + 1,
          email: token.email.trim(),
          role: role ?? fallbackRole,
          status: "invalid-email",
          reason: "Email is not valid",
        });
        continue;
      }

      if (!role) {
        rows.push({
          line: index + 1,
          email,
          role: fallbackRole,
          status: "invalid-role",
          reason: "Role must be Staff or Student",
        });
        continue;
      }

      if (!allowedRoles.includes(role)) {
        rows.push({
          line: index + 1,
          email,
          role,
          status: "role-blocked",
          reason: "Your role cannot invite this account role",
        });
        continue;
      }

      if (seen.has(email)) {
        rows.push({
          line: index + 1,
          email,
          role,
          status: "duplicate",
          reason: "Duplicate in this paste",
        });
        continue;
      }

      seen.add(email);
      rows.push({
        line: index + 1,
        email,
        role,
        status: "ready",
        reason: "Ready",
      });
    }
  });

  return rows;
}

function createRoleOptionsFor(currentUserRole: Role | null): Array<{ value: CreateUserInput["role"]; label: string }> {
  const options: Array<{ value: CreateUserInput["role"]; label: string }> = [
    { value: "STAFF", label: "Staff" },
    { value: "STUDENT", label: "Student" },
  ];
  if (currentUserRole === "ADMIN") {
    options.unshift({ value: "ADMIN", label: "Admin" });
  }
  return options;
}

function inviteRoleOptionsFor(currentUserRole: Role | null): Array<{ value: InviteRole; label: string }> {
  const options: Array<{ value: InviteRole; label: string }> = [{ value: "STUDENT", label: "Student" }];
  if (currentUserRole === "ADMIN") {
    options.unshift({ value: "STAFF", label: "Staff" });
  }
  return options;
}

function serverPreviewLabel(status: ServerPreviewStatus): string {
  switch (status) {
    case "existing_user":
      return "Existing user";
    case "pending_invite":
      return "Pending invite";
    case "claimed_invite":
      return "Claimed invite";
    case "duplicate":
      return "Duplicate";
    case "ready":
      return "Ready";
  }
}

function csvCell(value: string): string {
  const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll("\"", "\"\"")}"`;
}

function temporaryPasswordCsv(user: CreatedUser, temporaryPassword: string): string {
  return [
    ["name", "email", "role", "temporary_password", "first_login_required"],
    [user.name, user.email, ROLE_LABEL[user.role], temporaryPassword, "yes"],
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
}

function temporaryPasswordBulkCsv(users: Array<CreatedUser & { temporaryPassword: string }>): string {
  return [
    ["name", "email", "role", "location", "temporary_password", "first_login_required"],
    ...users.map((user) => [user.name, user.email, ROLE_LABEL[user.role], user.location ?? "", user.temporaryPassword, "yes"]),
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
}

function locationLookup(locations: Location[]) {
  const byName = new Map(locations.map((location) => [location.name.trim().toLowerCase(), location]));
  const byId = new Map(locations.map((location) => [location.id, location]));
  return { byName, byId };
}

function previewBulkCreateRows(
  raw: string,
  fallbackRole: Role,
  fallbackLocationId: string | null,
  locations: Location[],
  allowedRoles: Role[],
): BulkCreatePreviewRow[] {
  const rows: BulkCreatePreviewRow[] = [];
  const seen = new Set<string>();
  const locationsBy = locationLookup(locations);
  const fallbackLocation = fallbackLocationId ? locationsBy.byId.get(fallbackLocationId) ?? null : null;

  raw.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const cells = splitCsvLine(trimmed);
    const first = cells[0]?.trim().toLowerCase() ?? "";
    if (index === 0 && ["name", "full name"].includes(first)) return;

    const name = cells[0]?.trim() ?? "";
    const email = (cells[1]?.trim() ?? "").toLowerCase();
    const role = normalizeInviteRole(cells[2] ?? "", fallbackRole === "ADMIN" ? "STAFF" : fallbackRole as InviteRole) as Role | null;
    const rawLocation = cells[3]?.trim() ?? "";
    const location = rawLocation
      ? locationsBy.byId.get(rawLocation) ?? locationsBy.byName.get(rawLocation.toLowerCase()) ?? null
      : fallbackLocation;
    const locationId = location?.id ?? null;
    const locationLabel = location?.name ?? (rawLocation ? rawLocation : "No location");

    if (!name) {
      rows.push({ line: index + 1, name, email, role: role ?? fallbackRole, locationId, locationLabel, status: "missing-name", reason: "Name is required" });
      return;
    }
    if (!emailLooksValid(email)) {
      rows.push({ line: index + 1, name, email, role: role ?? fallbackRole, locationId, locationLabel, status: "invalid-email", reason: "Email is not valid" });
      return;
    }
    if (!role || !["ADMIN", "STAFF", "STUDENT"].includes(role)) {
      rows.push({ line: index + 1, name, email, role: fallbackRole, locationId, locationLabel, status: "invalid-role", reason: "Role must be Admin, Staff, or Student" });
      return;
    }
    if (!allowedRoles.includes(role)) {
      rows.push({ line: index + 1, name, email, role, locationId, locationLabel, status: "role-blocked", reason: "Your role cannot create this account role" });
      return;
    }
    if (rawLocation && !location) {
      rows.push({ line: index + 1, name, email, role, locationId: null, locationLabel, status: "invalid-location", reason: "Location does not match a known location" });
      return;
    }
    if (seen.has(email)) {
      rows.push({ line: index + 1, name, email, role, locationId, locationLabel, status: "duplicate", reason: "Duplicate in this paste" });
      return;
    }

    seen.add(email);
    rows.push({ line: index + 1, name, email, role, locationId, locationLabel, status: "ready", reason: "Ready" });
  });

  return rows;
}

export default function OnboardingDialog({
  open,
  onOpenChange,
  locations,
  locationsLoading = false,
  locationsError = false,
  onRetryLocations,
  currentUserRole,
  initialMode = "invite",
  onCreated,
  onInvitesChanged,
}: OnboardingDialogProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [mode, setMode] = useState<OnboardingMode>(initialMode);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<CreateUserInput["role"]>("STAFF");
  const [createMode, setCreateMode] = useState<CreateMode>("single");
  const [bulkCreateRows, setBulkCreateRows] = useState("");
  const [bulkCreateRole, setBulkCreateRole] = useState<Role>("STUDENT");
  const [bulkCreateLocationId, setBulkCreateLocationId] = useState<string>("__none__");
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkCreateError, setBulkCreateError] = useState("");
  const [inviteMode, setInviteMode] = useState<InviteMode>("bulk");
  const [inviteRole, setInviteRole] = useState<InviteRole>("STUDENT");
  const [singleEmail, setSingleEmail] = useState("");
  const [bulkEmails, setBulkEmails] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);
  const [serverPreview, setServerPreview] = useState<ServerPreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [completion, setCompletion] = useState<CompletionResult | null>(null);

  const locationOptionsUnavailable = locationsLoading || locationsError;
  const roleOptions = useMemo(() => createRoleOptionsFor(currentUserRole), [currentUserRole]);
  const inviteRoleOptions = useMemo(() => inviteRoleOptionsFor(currentUserRole), [currentUserRole]);
  const allowedInviteRoles = useMemo(() => inviteRoleOptions.map((option) => option.value), [inviteRoleOptions]);
  const previewRows = useMemo(
    () => previewInviteRows(bulkEmails, inviteRole, allowedInviteRoles),
    [allowedInviteRoles, bulkEmails, inviteRole],
  );
  const readyPreviewRows = useMemo(
    () => previewRows.filter((row) => row.status === "ready"),
    [previewRows],
  );
  const bulkCreatePreviewRows = useMemo(
    () => previewBulkCreateRows(
      bulkCreateRows,
      bulkCreateRole,
      bulkCreateLocationId === "__none__" ? null : bulkCreateLocationId,
      locations,
      roleOptions.map((option) => option.value),
    ),
    [bulkCreateLocationId, bulkCreateRole, bulkCreateRows, locations, roleOptions],
  );
  const readyBulkCreateRows = useMemo(
    () => bulkCreatePreviewRows.filter((row) => row.status === "ready"),
    [bulkCreatePreviewRows],
  );
  const bulkCreateBlockingRows = useMemo(
    () => bulkCreatePreviewRows.filter((row) => row.status !== "ready"),
    [bulkCreatePreviewRows],
  );
  const overBulkCreateLimit = readyBulkCreateRows.length > 50;
  const previewCounts = useMemo(() => {
    const counts: Record<InvitePreviewStatus, number> = {
      ready: 0,
      duplicate: 0,
      "invalid-email": 0,
      "invalid-role": 0,
      "role-blocked": 0,
    };
    for (const row of previewRows) {
      counts[row.status] += 1;
    }
    return counts;
  }, [previewRows]);
  const blockingPreviewCount = previewRows.length - previewCounts.ready;
  const overBulkLimit = readyPreviewRows.length > 50;
  const serverPreviewRows = serverPreview?.rows ?? [];
  const serverPreviewSummary = serverPreview?.summary ?? {
    ready: 0,
    duplicate: 0,
    existing_user: 0,
    pending_invite: 0,
    claimed_invite: 0,
  };
  const serverBlockingRows = useMemo(
    () => serverPreviewRows.filter((row) => row.status !== "ready"),
    [serverPreviewRows],
  );
  const serverReadyEmails = useMemo(
    () => new Set(serverPreviewRows.filter((row) => row.status === "ready").map((row) => row.email)),
    [serverPreviewRows],
  );
  const finalReadyPreviewRows = useMemo(
    () => readyPreviewRows.filter((row) => serverReadyEmails.has(row.email)),
    [readyPreviewRows, serverReadyEmails],
  );
  const serverPreviewComplete = serverPreviewRows.length > 0 && serverPreviewRows.length === readyPreviewRows.length;

  const { submit, submitting, fieldErrors, formError, clearErrors } = useFormSubmit<CreateUserInput, CreatedUser>({
    schema: createUserSchema,
    url: "/api/users",
    successMessage: "Account created with temporary password",
    onSuccess: (created) => {
      setCompletion({ kind: "created", user: created, temporaryPassword: password });
      onCreated?.(created);
    },
  });

  useEffect(() => {
    if (!open) return;
    const createOptions = createRoleOptionsFor(currentUserRole);
    const inviteOptions = inviteRoleOptionsFor(currentUserRole);
    setMode(initialMode);
    setPassword(generateTemporaryPassword());
    setRole(createOptions.some((option) => option.value === "STAFF") ? "STAFF" : createOptions[0]?.value ?? "STUDENT");
    setCreateMode("single");
    setBulkCreateRows("");
    setBulkCreateRole(createOptions.some((option) => option.value === "STUDENT") ? "STUDENT" : createOptions[0]?.value ?? "STUDENT");
    setBulkCreateLocationId("__none__");
    setBulkCreateError("");
    setBulkCreating(false);
    setInviteRole(inviteOptions.some((option) => option.value === "STUDENT") ? "STUDENT" : inviteOptions[0]?.value ?? "STUDENT");
    setInviteMode("bulk");
    setSingleEmail("");
    setBulkEmails("");
    setInviteError("");
    setServerPreview(null);
    setPreviewing(false);
    setPreviewError("");
    setCompletion(null);
    formRef.current?.reset();
    clearErrors();
  }, [clearErrors, currentUserRole, initialMode, open]);

  useEffect(() => {
    if (
      !open ||
      mode !== "invite" ||
      inviteMode !== "bulk" ||
      readyPreviewRows.length === 0 ||
      blockingPreviewCount > 0 ||
      overBulkLimit
    ) {
      setServerPreview(null);
      setPreviewing(false);
      setPreviewError("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPreviewing(true);
      setPreviewError("");
      try {
        const response = await fetch("/api/allowed-emails/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emails: readyPreviewRows.map((row) => ({ email: row.email, role: row.role })),
          }),
          signal: controller.signal,
        });

        if (handleAuthRedirect(response, "/settings/allowed-emails")) return;

        if (!response.ok) {
          const message = await parseErrorMessage(response, "Failed to preview account status");
          setPreviewError(message);
          setServerPreview(null);
          return;
        }

        const result = await parseJsonSafely<ServerPreviewResponse>(response);
        if (!result) {
          setPreviewError("Account status preview could not be read. Try again before saving.");
          setServerPreview(null);
          return;
        }

        setServerPreview(result);
      } catch (error) {
        if (isAbortError(error)) return;
        const kind = classifyError(error);
        setPreviewError(kind === "network" ? "You're offline. Check your connection." : "Failed to preview account status");
        setServerPreview(null);
      } finally {
        if (!controller.signal.aborted) {
          setPreviewing(false);
        }
      }
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [blockingPreviewCount, inviteMode, mode, open, overBulkLimit, readyPreviewRows]);

  function regeneratePassword() {
    setPassword(generateTemporaryPassword());
  }

  async function copyPassword() {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    toast.success("Temporary password copied");
  }

  async function copyCompletedPassword() {
    if (completion?.kind !== "created") return;
    await navigator.clipboard.writeText(completion.temporaryPassword);
    toast.success("Temporary password copied");
  }

  function downloadCompletedPasswordCsv() {
    if (completion?.kind !== "created") return;
    const blob = new Blob([temporaryPasswordCsv(completion.user, completion.temporaryPassword)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `temporary-password-${completion.user.email}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function downloadBulkCompletedPasswordCsv() {
    if (completion?.kind !== "bulk-created") return;
    const blob = new Blob([temporaryPasswordBulkCsv(completion.users)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "temporary-passwords-bulk-onboarding.csv";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function resetForAnother() {
    setCompletion(null);
    setInviteError("");
    setPreviewError("");
    setServerPreview(null);
    setSingleEmail("");
    setBulkEmails("");
    setBulkCreateRows("");
    setBulkCreateError("");
    setPassword(generateTemporaryPassword());
    formRef.current?.reset();
    clearErrors();
  }

  function openCreatedProfile() {
    if (completion?.kind !== "created") return;
    onOpenChange(false);
    router.push(`/users/${completion.user.id}`);
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locationsLoading || locationsError) return;
    const form = new FormData(event.currentTarget);
    const locValue = String(form.get("locationId") || "");
    await submit({
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      password,
      role,
      locationId: locValue === "__none__" ? null : locValue || null,
    });
  }

  async function handleBulkCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBulkCreateError("");

    if (locationsLoading || locationsError) return;
    if (readyBulkCreateRows.length === 0) {
      const message = "Paste at least one ready account row.";
      setBulkCreateError(message);
      toast.error(message);
      return;
    }
    if (bulkCreateBlockingRows.length > 0) {
      const message = "Fix preview issues before creating accounts.";
      setBulkCreateError(message);
      toast.error(message);
      return;
    }
    if (overBulkCreateLimit) {
      const message = "Reduce the batch to 50 ready accounts before creating.";
      setBulkCreateError(message);
      toast.error(message);
      return;
    }

    setBulkCreating(true);
    try {
      const response = await fetch("/api/users/bulk-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          users: readyBulkCreateRows.map((row) => ({
            name: row.name,
            email: row.email,
            role: row.role,
            locationId: row.locationId,
          })),
        }),
      });
      if (handleAuthRedirect(response, "/users")) return;
      if (!response.ok) {
        const message = await parseErrorMessage(response, "Failed to create accounts");
        setBulkCreateError(message);
        toast.error(message);
        return;
      }
      const result = await parseJsonSafely<{ data: Array<CreatedUser & { temporaryPassword: string }> }>(response);
      const users = result?.data ?? [];
      setCompletion({ kind: "bulk-created", users, requested: readyBulkCreateRows.length });
      toast.success(`Created ${users.length} account${users.length === 1 ? "" : "s"}`);
      onInvitesChanged?.();
    } catch (error) {
      if (isAbortError(error)) return;
      const kind = classifyError(error);
      const message = kind === "network" ? "You're offline. Check your connection." : "Failed to create accounts";
      setBulkCreateError(message);
      toast.error(message);
    } finally {
      setBulkCreating(false);
    }
  }

  async function handleInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviteError("");

    const emails = inviteMode === "single" ? [singleEmail.trim().toLowerCase()].filter(Boolean) : finalReadyPreviewRows.map((row) => row.email);
    if (emails.length === 0) {
      const message = inviteMode === "single" ? "Email address is required." : "Paste at least one email.";
      setInviteError(message);
      toast.error(message);
      return;
    }
    if (inviteMode === "bulk" && blockingPreviewCount > 0) {
      const message = "Fix preview issues before saving invitations.";
      setInviteError(message);
      toast.error(message);
      return;
    }
    if (inviteMode === "bulk" && (overBulkLimit || previewing || previewError || !serverPreviewComplete || serverBlockingRows.length > 0)) {
      const message = "Review account status before saving invitations.";
      setInviteError(message);
      toast.error(message);
      return;
    }
    if (emails.length > 50) {
      const message = `Too many addresses. Max 50 per batch, got ${emails.length}.`;
      setInviteError(message);
      toast.error(message);
      return;
    }

    const malformed = emails.filter((email) => !emailLooksValid(email));
    if (malformed.length > 0) {
      const message = `Looks invalid: ${malformed.slice(0, 3).join(", ")}${malformed.length > 3 ? "..." : ""}`;
      setInviteError(message);
      toast.error(message);
      return;
    }

    setInviting(true);
    try {
      const body = inviteMode === "single"
        ? { email: emails[0], role: inviteRole }
        : { emails: finalReadyPreviewRows.map((row) => ({ email: row.email, role: row.role })) };
      const response = await fetch("/api/allowed-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (handleAuthRedirect(response, "/settings/allowed-emails")) return;

      if (!response.ok) {
        const message = await parseErrorMessage(response, "Failed to save invitations");
        setInviteError(message);
        toast.error(message);
        return;
      }

      const result = await parseJsonSafely<InviteResponse>(response);
      if (inviteMode === "single") {
        if (result?.skipped === true) {
          toast.message("No new invitation was created. This address is already allowlisted or registered.");
        } else {
          toast.success("Invitation added");
        }
      } else {
        const created = result?.created ?? 0;
        const skipped = typeof result?.skipped === "number" ? result.skipped : 0;
        if (created > 0 && skipped === 0) {
          toast.success(`Added ${created} invitation${created === 1 ? "" : "s"}`);
        } else if (created > 0) {
          toast.success(`Added ${created}; skipped ${skipped} already allowlisted or registered`);
        } else {
          toast.message("All addresses were already allowlisted or registered.");
        }
      }

      onInvitesChanged?.();
      setSingleEmail("");
      setBulkEmails("");
      setInviteError("");
      setCompletion({
        kind: "invites",
        created: result?.created ?? (result?.skipped === true ? 0 : 1),
        skipped: typeof result?.skipped === "number" ? result.skipped : result?.skipped === true ? 1 : 0,
        requested: emails.length,
      });
    } catch (error) {
      if (isAbortError(error)) return;
      const kind = classifyError(error);
      const message = kind === "network" ? "You're offline. Check your connection." : "Failed to save invitations";
      setInviteError(message);
      toast.error(message);
    } finally {
      setInviting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!submitting && !inviting) onOpenChange(next); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-balance">
            <UserPlus className="size-5" />
            Onboard users
          </DialogTitle>
          <DialogDescription className="text-pretty">
            Add a class or staff cohort by invitation, or create one active account with a temporary password.
          </DialogDescription>
        </DialogHeader>

        {completion ? (
          <div className="grid gap-4">
            <Alert className="border-[var(--green)]/40 bg-[var(--green-bg)]">
              <CheckCircle2 className="size-4 text-[var(--green-text)]" />
              <AlertTitle>
                {completion.kind === "created" ? "Account created" : completion.kind === "bulk-created" ? "Accounts created" : "Invitations saved"}
              </AlertTitle>
              <AlertDescription className="text-muted-foreground">
                {completion.kind === "created" || completion.kind === "bulk-created"
                  ? "Temporary passwords are only visible in this handoff step."
                  : "Review the counts before closing or starting another batch."}
              </AlertDescription>
            </Alert>

            {completion.kind === "created" ? (
              <div className="grid gap-3 rounded-md border border-border/70 bg-muted/20 p-3">
                <div className="grid gap-2 text-sm sm:grid-cols-3">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Name</div>
                    <div className="truncate font-medium">{completion.user.name}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Email</div>
                    <div className="truncate font-medium">{completion.user.email}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Role</div>
                    <div className="font-medium">{ROLE_LABEL[completion.user.role]}</div>
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="created-temporary-password">Temporary password</Label>
                  <div className="flex gap-2">
                    <Input
                      id="created-temporary-password"
                      value={completion.temporaryPassword}
                      readOnly
                      className="h-10 font-mono"
                    />
                    <Button type="button" variant="outline" size="icon" className="size-10" onClick={copyCompletedPassword} aria-label="Copy temporary password">
                      <Copy className="size-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="size-10" onClick={downloadCompletedPasswordCsv} aria-label="Download temporary password CSV">
                      <Download className="size-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The user can sign in on web or iOS with this password and will be forced to set a new one.
                  </p>
                </div>
              </div>
            ) : completion.kind === "bulk-created" ? (
              <div className="grid gap-3 rounded-md border border-border/70 bg-muted/20 p-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-md border border-border/70 bg-background p-3">
                    <div className="text-xs font-medium text-muted-foreground">Requested</div>
                    <div className="text-2xl font-semibold tabular-nums">{completion.requested}</div>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background p-3">
                    <div className="text-xs font-medium text-muted-foreground">Created</div>
                    <div className="text-2xl font-semibold tabular-nums">{completion.users.length}</div>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background p-3">
                    <div className="text-xs font-medium text-muted-foreground">Passwords</div>
                    <div className="text-2xl font-semibold tabular-nums">{completion.users.length}</div>
                  </div>
                </div>
                <Button type="button" variant="outline" className="h-10 justify-self-start" onClick={downloadBulkCompletedPasswordCsv}>
                  <Download data-icon="inline-start" />
                  Download temporary password CSV
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Requested</div>
                  <div className="text-2xl font-semibold tabular-nums">{completion.requested}</div>
                </div>
                <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Added</div>
                  <div className="text-2xl font-semibold tabular-nums">{completion.created}</div>
                </div>
                <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Skipped</div>
                  <div className="text-2xl font-semibold tabular-nums">{completion.skipped}</div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" className="h-10" onClick={resetForAnother}>
                Onboard another
              </Button>
              {completion.kind === "created" ? (
                <Button type="button" className="h-10" onClick={openCreatedProfile}>
                  Open profile
                </Button>
              ) : completion.kind === "bulk-created" ? (
                <>
                  <Button asChild variant="outline" className="h-10" onClick={() => onOpenChange(false)}>
                    <Link href="/users">View users</Link>
                  </Button>
                  <Button type="button" className="h-10" onClick={() => onOpenChange(false)}>
                    Done
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild variant="outline" className="h-10" onClick={() => onOpenChange(false)}>
                    <Link href="/users/onboarding-status">View status</Link>
                  </Button>
                  <Button type="button" className="h-10" onClick={() => onOpenChange(false)}>
                    Done
                  </Button>
                </>
              )}
            </DialogFooter>
          </div>
        ) : (
        <Tabs value={mode} onValueChange={(value) => setMode(value as OnboardingMode)} className="grid gap-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="invite">Invite to register</TabsTrigger>
            <TabsTrigger value="create">Create account</TabsTrigger>
          </TabsList>

          <TabsContent value="invite" className="m-0">
            <form onSubmit={handleInviteSubmit} className="grid gap-4">
              <div className="rounded-md border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground">
                Pending invitations let users set their own password. Existing registered or already-invited addresses are skipped without exposing private account details.
              </div>

              <Tabs value={inviteMode} onValueChange={(value) => { setInviteMode(value as InviteMode); setInviteError(""); }} className="grid gap-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="bulk">Bulk paste</TabsTrigger>
                  <TabsTrigger value="single">One email</TabsTrigger>
                </TabsList>

                <TabsContent value="bulk" className="m-0">
                  <div className="grid grid-cols-[minmax(0,1fr)_160px] gap-3 max-sm:grid-cols-1">
                    <div className="grid gap-1.5">
                      <Label htmlFor="onboard-bulk-emails">Paste emails separated by spaces, commas, or new lines</Label>
                      <Textarea
                        id="onboard-bulk-emails"
                        name="bulkInvitationRows"
                        value={bulkEmails}
                        onChange={(event) => { setBulkEmails(event.target.value); setInviteError(""); }}
                        placeholder={"email, role\nalice@school.edu, student\ncoach@school.edu, staff\ncharlie@school.edu"}
                        rows={7}
                        disabled={inviting}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Paste plain emails or CSV rows with `email, role`. Blank roles use the selected default. Max 50 ready rows per batch.
                      </p>
                    </div>
                    <div className="grid content-start gap-1.5">
                      <Label htmlFor="onboard-bulk-role">Role for all</Label>
                      <Select name="bulkInvitationRole" value={inviteRole} onValueChange={(value) => setInviteRole(value as InviteRole)} disabled={inviting}>
                        <SelectTrigger id="onboard-bulk-role" className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {inviteRoleOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {previewRows.length > 0 && (
                    <div className="mt-3 grid gap-3 rounded-md border border-border/70 bg-muted/20 p-3">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-sm bg-background p-2">
                          <div className="text-xs font-medium text-muted-foreground">Ready</div>
                          <div className="text-lg font-semibold tabular-nums">{previewCounts.ready}</div>
                        </div>
                        <div className="rounded-sm bg-background p-2">
                          <div className="text-xs font-medium text-muted-foreground">Duplicates</div>
                          <div className="text-lg font-semibold tabular-nums">{previewCounts.duplicate}</div>
                        </div>
                        <div className="rounded-sm bg-background p-2">
                          <div className="text-xs font-medium text-muted-foreground">Invalid</div>
                          <div className="text-lg font-semibold tabular-nums">{previewCounts["invalid-email"] + previewCounts["invalid-role"]}</div>
                        </div>
                        <div className="rounded-sm bg-background p-2">
                          <div className="text-xs font-medium text-muted-foreground">Blocked</div>
                          <div className="text-lg font-semibold tabular-nums">{previewCounts["role-blocked"]}</div>
                        </div>
                      </div>

                      {blockingPreviewCount > 0 ? (
                        <div className="grid gap-2">
                          <p className="text-xs font-medium text-destructive">Fix these rows before saving.</p>
                          <div className="grid max-h-36 gap-1 overflow-auto text-xs">
                            {previewRows.filter((row) => row.status !== "ready").slice(0, 6).map((row) => (
                              <div key={`${row.line}-${row.email}-${row.status}`} className="flex items-center justify-between gap-2 rounded-sm bg-background px-2 py-1.5">
                                <span className="min-w-0 truncate">Line {row.line}: {row.email || "blank email"}</span>
                                <Badge variant="orange" size="sm">{row.reason}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {readyPreviewRows.length} invitation{readyPreviewRows.length === 1 ? "" : "s"} ready. Existing registered or already-invited addresses may still be skipped by the server.
                        </p>
                      )}
                    </div>
                  )}

                  {overBulkLimit && (
                    <Alert variant="destructive" className="mt-3">
                      <AlertCircle className="size-4" />
                      <AlertDescription>Reduce the batch to 50 ready invitations before saving.</AlertDescription>
                    </Alert>
                  )}

                  {blockingPreviewCount === 0 && readyPreviewRows.length > 0 && !overBulkLimit && (
                    <div className="mt-3 grid gap-3 rounded-md border border-border/70 bg-background p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">Account status</div>
                          <p className="text-xs text-muted-foreground">Authenticated preview checks existing users and invitations before commit.</p>
                        </div>
                        {previewing && <Spinner />}
                      </div>

                      {previewError ? (
                        <Alert variant="destructive">
                          <AlertCircle className="size-4" />
                          <AlertDescription>{previewError}</AlertDescription>
                        </Alert>
                      ) : serverPreviewComplete ? (
                        <>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <div className="rounded-sm bg-muted/30 p-2">
                              <div className="text-xs font-medium text-muted-foreground">Ready to save</div>
                              <div className="text-lg font-semibold tabular-nums">{serverPreviewSummary.ready}</div>
                            </div>
                            <div className="rounded-sm bg-muted/30 p-2">
                              <div className="text-xs font-medium text-muted-foreground">Existing users</div>
                              <div className="text-lg font-semibold tabular-nums">{serverPreviewSummary.existing_user}</div>
                            </div>
                            <div className="rounded-sm bg-muted/30 p-2">
                              <div className="text-xs font-medium text-muted-foreground">Pending invites</div>
                              <div className="text-lg font-semibold tabular-nums">{serverPreviewSummary.pending_invite}</div>
                            </div>
                            <div className="rounded-sm bg-muted/30 p-2">
                              <div className="text-xs font-medium text-muted-foreground">Claimed invites</div>
                              <div className="text-lg font-semibold tabular-nums">{serverPreviewSummary.claimed_invite}</div>
                            </div>
                          </div>

                          {serverBlockingRows.length > 0 ? (
                            <div className="grid gap-2">
                              <p className="text-xs font-medium text-destructive">Remove or correct these rows before saving.</p>
                              <div className="grid max-h-36 gap-1 overflow-auto text-xs">
                                {serverBlockingRows.slice(0, 6).map((row) => (
                                  <div key={`${row.email}-${row.status}`} className="flex items-center justify-between gap-2 rounded-sm bg-muted/30 px-2 py-1.5">
                                    <span className="min-w-0 truncate">{row.email}</span>
                                    <Badge variant="orange" size="sm">{serverPreviewLabel(row.status)}</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              All {finalReadyPreviewRows.length} invitation{finalReadyPreviewRows.length === 1 ? "" : "s"} are ready to save.
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Waiting for account-status preview...</p>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="single" className="m-0">
                  <div className="grid grid-cols-[minmax(0,1fr)_160px] gap-3 max-sm:grid-cols-1">
                    <div className="grid gap-1.5">
                      <Label htmlFor="onboard-single-email">Email address</Label>
                      <Input
                        id="onboard-single-email"
                        name="singleInvitationEmail"
                        type="email"
                        value={singleEmail}
                        onChange={(event) => { setSingleEmail(event.target.value); setInviteError(""); }}
                        placeholder="user@example.com"
                        disabled={inviting}
                        autoComplete="email"
                        className="h-10"
                      />
                    </div>
                    <div className="grid content-start gap-1.5">
                      <Label htmlFor="onboard-single-role">Role</Label>
                      <Select name="singleInvitationRole" value={inviteRole} onValueChange={(value) => setInviteRole(value as InviteRole)} disabled={inviting}>
                        <SelectTrigger id="onboard-single-role" className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {inviteRoleOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {inviteError && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{inviteError}</AlertDescription>
                </Alert>
              )}

              <DialogFooter className="mt-1">
                <Button type="button" variant="outline" className="h-10" onClick={() => onOpenChange(false)} disabled={inviting}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-10"
                  disabled={
                    inviting ||
                    (inviteMode === "bulk"
                      ? finalReadyPreviewRows.length === 0 ||
                        blockingPreviewCount > 0 ||
                        overBulkLimit ||
                        previewing ||
                        !!previewError ||
                        !serverPreviewComplete ||
                        serverBlockingRows.length > 0
                      : singleEmail.trim().length === 0)
                  }
                >
                  {inviting && <Spinner data-icon="inline-start" />}
                  {inviting ? "Saving..." : "Add invitations"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="create" className="m-0">
            <Tabs value={createMode} onValueChange={(value) => setCreateMode(value as CreateMode)} className="grid gap-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="single">One account</TabsTrigger>
                <TabsTrigger value="bulk">Bulk create</TabsTrigger>
              </TabsList>

              <TabsContent value="single" className="m-0">
            <form ref={formRef} onSubmit={handleCreateSubmit} className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="create-name">Full name</Label>
                  <Input
                    id="create-name"
                    name="name"
                    required
                    disabled={submitting}
                    aria-invalid={!!fieldErrors.name}
                    autoComplete="name"
                    className="h-10"
                  />
                  {fieldErrors.name && <p className="text-sm text-destructive">{fieldErrors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-email">Campus email</Label>
                  <Input
                    id="create-email"
                    name="email"
                    type="email"
                    required
                    disabled={submitting}
                    aria-invalid={!!fieldErrors.email}
                    autoComplete="email"
                    className="h-10"
                  />
                  {fieldErrors.email && <p className="text-sm text-destructive">{fieldErrors.email}</p>}
                </div>
              </div>

              <div className="rounded-lg border border-border/70 bg-muted/20 p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <KeyRound className="size-4 text-muted-foreground" />
                  Temporary password
                </div>
                <div className="flex gap-2">
                  <Input
                    id="create-password"
                    name="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    required
                    disabled={submitting}
                    aria-invalid={!!fieldErrors.password}
                    className="h-10 font-mono"
                    autoComplete="new-password"
                  />
                  <Button type="button" variant="outline" size="icon" className="size-10" onClick={regeneratePassword} disabled={submitting} aria-label="Generate temporary password">
                    <Shuffle className="size-4" />
                  </Button>
                  <Button type="button" variant="outline" size="icon" className="size-10" onClick={copyPassword} disabled={submitting || !password} aria-label="Copy temporary password">
                    <Copy className="size-4" />
                  </Button>
                </div>
                {fieldErrors.password ? (
                  <p className="mt-1.5 text-sm text-destructive">{fieldErrors.password}</p>
                ) : (
                  <p className="mt-1.5 text-xs text-muted-foreground">Share this password directly with the user. They will be asked to change it at first sign-in.</p>
                )}
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 max-sm:grid-cols-1">
                <div className="space-y-1.5">
                  <Label htmlFor="create-role">Role</Label>
                  <Select name="role" value={role} onValueChange={(value) => setRole(value as CreateUserInput["role"])} disabled={submitting}>
                    <SelectTrigger id="create-role" aria-label="Role" className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {roleOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{ROLE_HELP[role]}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-location">Location</Label>
                  <Select name="locationId" defaultValue="__none__" disabled={submitting || locationOptionsUnavailable}>
                    <SelectTrigger id="create-location" aria-label="Location" className="h-10">
                      <SelectValue placeholder={locationsLoading ? "Loading locations" : locationsError ? "Locations unavailable" : "No location"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="__none__">No location</SelectItem>
                        {locations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {locationsError && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span>Locations could not load, so location assignment is unavailable. Retry before creating users so roster location stays intentional.</span>
                    {onRetryLocations && (
                      <Button type="button" variant="outline" onClick={onRetryLocations} className="h-10 shrink-0">
                        Retry locations
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {locationsLoading && !locationsError && (
                <Alert>
                  <Spinner />
                  <AlertDescription>Loading locations before user creation is available.</AlertDescription>
                </Alert>
              )}

              {formError && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <Alert>
                <KeyRound className="size-4" />
                <AlertDescription>
                  After creation, the profile opens so staff can finish details. The temporary password is only visible here.
                </AlertDescription>
              </Alert>

              <DialogFooter className="mt-1">
                <Button type="button" variant="outline" className="h-10" onClick={() => onOpenChange(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" className="h-10" disabled={submitting || locationsLoading || locationsError}>
                  {submitting && <Spinner data-icon="inline-start" />}
                  {submitting ? "Creating..." : "Create and open profile"}
                </Button>
              </DialogFooter>
            </form>
              </TabsContent>

              <TabsContent value="bulk" className="m-0">
                <form onSubmit={handleBulkCreateSubmit} className="grid gap-4">
                  <div className="rounded-md border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground">
                    Bulk-created users can sign in immediately with a temporary password and will be forced to change it on web or iOS.
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_160px_180px] gap-3 max-md:grid-cols-1">
                    <div className="grid gap-1.5">
                      <Label htmlFor="bulk-create-users">Paste CSV rows</Label>
                      <Textarea
                        id="bulk-create-users"
                        name="bulkCreateRows"
                        value={bulkCreateRows}
                        onChange={(event) => { setBulkCreateRows(event.target.value); setBulkCreateError(""); }}
                        placeholder={"name,email,role,location\nAlice Smith,alice@school.edu,student,Camp Randall\nCoach Lee,coach@school.edu,staff"}
                        rows={7}
                        disabled={bulkCreating}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Use `name, email, role, location`. Blank role or location uses the defaults. Max 50 ready rows.
                      </p>
                    </div>
                    <div className="grid content-start gap-1.5">
                      <Label htmlFor="bulk-create-role">Default role</Label>
                      <Select name="bulkCreateRole" value={bulkCreateRole} onValueChange={(value) => setBulkCreateRole(value as Role)} disabled={bulkCreating}>
                        <SelectTrigger id="bulk-create-role" className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {roleOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid content-start gap-1.5">
                      <Label htmlFor="bulk-create-location">Default location</Label>
                      <Select name="bulkCreateLocationId" value={bulkCreateLocationId} onValueChange={setBulkCreateLocationId} disabled={bulkCreating || locationOptionsUnavailable}>
                        <SelectTrigger id="bulk-create-location" className="h-10">
                          <SelectValue placeholder={locationsLoading ? "Loading" : "No location"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="__none__">No location</SelectItem>
                            {locations.map((loc) => (
                              <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {bulkCreatePreviewRows.length > 0 && (
                    <div className="grid gap-3 rounded-md border border-border/70 bg-muted/20 p-3">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-sm bg-background p-2">
                          <div className="text-xs font-medium text-muted-foreground">Ready</div>
                          <div className="text-lg font-semibold tabular-nums">{readyBulkCreateRows.length}</div>
                        </div>
                        <div className="rounded-sm bg-background p-2">
                          <div className="text-xs font-medium text-muted-foreground">Needs fix</div>
                          <div className="text-lg font-semibold tabular-nums">{bulkCreateBlockingRows.length}</div>
                        </div>
                        <div className="rounded-sm bg-background p-2">
                          <div className="text-xs font-medium text-muted-foreground">Default role</div>
                          <div className="text-sm font-semibold">{ROLE_LABEL[bulkCreateRole]}</div>
                        </div>
                        <div className="rounded-sm bg-background p-2">
                          <div className="text-xs font-medium text-muted-foreground">Default location</div>
                          <div className="truncate text-sm font-semibold">{bulkCreateLocationId === "__none__" ? "None" : locations.find((loc) => loc.id === bulkCreateLocationId)?.name ?? "Selected"}</div>
                        </div>
                      </div>

                      {bulkCreateBlockingRows.length > 0 ? (
                        <div className="grid gap-2">
                          <p className="text-xs font-medium text-destructive">Fix these rows before creating accounts.</p>
                          <div className="grid max-h-36 gap-1 overflow-auto text-xs">
                            {bulkCreateBlockingRows.slice(0, 6).map((row) => (
                              <div key={`${row.line}-${row.email}-${row.status}`} className="flex items-center justify-between gap-2 rounded-sm bg-background px-2 py-1.5">
                                <span className="min-w-0 truncate">Line {row.line}: {row.name || row.email || "blank row"}</span>
                                <Badge variant="orange" size="sm">{row.reason}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {readyBulkCreateRows.length} account{readyBulkCreateRows.length === 1 ? "" : "s"} ready. Temporary passwords will be generated by the server after submit.
                        </p>
                      )}
                    </div>
                  )}

                  {overBulkCreateLimit && (
                    <Alert variant="destructive">
                      <AlertCircle className="size-4" />
                      <AlertDescription>Reduce the batch to 50 ready accounts before creating.</AlertDescription>
                    </Alert>
                  )}

                  {bulkCreateError && (
                    <Alert variant="destructive">
                      <AlertCircle className="size-4" />
                      <AlertDescription>{bulkCreateError}</AlertDescription>
                    </Alert>
                  )}

                  <DialogFooter className="mt-1">
                    <Button type="button" variant="outline" className="h-10" onClick={() => onOpenChange(false)} disabled={bulkCreating}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="h-10"
                      disabled={bulkCreating || locationsLoading || locationsError || readyBulkCreateRows.length === 0 || bulkCreateBlockingRows.length > 0 || overBulkCreateLimit}
                    >
                      {bulkCreating && <Spinner data-icon="inline-start" />}
                      {bulkCreating ? "Creating..." : "Create accounts"}
                    </Button>
                  </DialogFooter>
                </form>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
