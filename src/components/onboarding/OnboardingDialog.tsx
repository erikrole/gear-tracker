"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, UserPlus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
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
import { classifyError, handleAuthRedirect, isAbortError, parseErrorMessage, parseJsonSafely } from "@/lib/errors";

type Role = "ADMIN" | "STAFF" | "STUDENT";
type InviteRole = "STAFF" | "STUDENT";
type InviteMode = "bulk" | "single";
type InvitePreviewStatus = "ready" | "duplicate" | "invalid-email" | "invalid-role" | "role-blocked";
type ServerPreviewStatus = "ready" | "duplicate" | "existing_user" | "pending_invite" | "claimed_invite";

type InviteResponse = {
  skipped?: boolean | number;
  created?: number;
};

type CompletionResult = {
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
  currentUserRole: Role | null;
  onInvitesChanged?: () => void;
};

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

export default function OnboardingDialog({
  open,
  onOpenChange,
  currentUserRole,
  onInvitesChanged,
}: OnboardingDialogProps) {
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

  useEffect(() => {
    if (!open) return;
    const inviteOptions = inviteRoleOptionsFor(currentUserRole);
    setInviteRole(inviteOptions.some((option) => option.value === "STUDENT") ? "STUDENT" : inviteOptions[0]?.value ?? "STUDENT");
    setInviteMode("bulk");
    setSingleEmail("");
    setBulkEmails("");
    setInviteError("");
    setServerPreview(null);
    setPreviewing(false);
    setPreviewError("");
    setCompletion(null);
  }, [currentUserRole, open]);

  useEffect(() => {
    if (
      !open ||
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
  }, [blockingPreviewCount, inviteMode, open, overBulkLimit, readyPreviewRows]);

  function resetForAnother() {
    setCompletion(null);
    setInviteError("");
    setPreviewError("");
    setServerPreview(null);
    setSingleEmail("");
    setBulkEmails("");
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
    <Dialog open={open} onOpenChange={(next) => { if (!inviting) onOpenChange(next); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 shrink-0" />
            Onboard users
          </DialogTitle>
          <DialogDescription className="sr-only">
            Add people to the registration allowlist.
          </DialogDescription>
        </DialogHeader>

        {completion ? (
          <>
            <DialogBody className="flex flex-col gap-4 py-5">
              <Alert className="border-[var(--green)]/40 bg-[var(--green-bg)]">
                <CheckCircle2 className="size-4 text-[var(--green-text)]" />
                <AlertTitle>Invitations saved</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  Share the registration link or send users to the app registration page. No shared first-login password is created.
                </AlertDescription>
              </Alert>

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
            </DialogBody>

            <DialogFooter className="border-t border-border/40 px-6 py-4">
              <Button type="button" variant="outline" className="h-10" onClick={resetForAnother}>
                Onboard another
              </Button>
              <Button asChild variant="outline" className="h-10" onClick={() => onOpenChange(false)}>
                <Link href="/users/onboarding-status">View status</Link>
              </Button>
              <Button type="button" className="h-10" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleInviteSubmit} className="contents">
            <DialogBody className="flex flex-col gap-4 py-5">
              <p className="text-sm text-muted-foreground">
                Users set their own password the first time they register. Existing registered or already-invited addresses are skipped without exposing private account details.
              </p>

              <Tabs value={inviteMode} onValueChange={(value) => { setInviteMode(value as InviteMode); setInviteError(""); }} className="grid gap-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="bulk">Bulk paste</TabsTrigger>
                  <TabsTrigger value="single">One email</TabsTrigger>
                </TabsList>

                <TabsContent value="bulk" className="m-0">
                  <div className="grid gap-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                      <Label htmlFor="onboard-bulk-emails">Paste emails separated by spaces, commas, or new lines</Label>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="onboard-bulk-role" className="text-xs font-normal text-muted-foreground whitespace-nowrap">Role for all</Label>
                        <Select name="bulkInvitationRole" value={inviteRole} onValueChange={(value) => setInviteRole(value as InviteRole)} disabled={inviting}>
                          <SelectTrigger id="onboard-bulk-role" className="h-9 w-[130px]">
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
                    <Textarea
                      id="onboard-bulk-emails"
                      name="bulkInvitationRows"
                      value={bulkEmails}
                      onChange={(event) => { setBulkEmails(event.target.value); setInviteError(""); }}
                      placeholder={"email, role\nalice@school.edu, student\ncoach@school.edu, staff\ncharlie@school.edu"}
                      rows={7}
                      disabled={inviting}
                      className="w-full font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Paste plain emails or CSV rows with `email, role`. Blank roles use the selected default. Max 50 ready rows per batch.
                    </p>
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
            </DialogBody>

            <DialogFooter className="border-t border-border/40 px-6 py-4">
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
        )}
      </DialogContent>
    </Dialog>
  );
}
