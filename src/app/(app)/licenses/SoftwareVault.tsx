"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  Check,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  LockKeyhole,
  Pencil,
  Plus,
  ShieldCheck,
} from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useFetch } from "@/hooks/use-fetch";
import { handleAuthRedirect, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
import type { SoftwareCredentialSummary } from "./types";

const SUGGESTED_SOFTWARE = ["Photo Mechanic", "Envato Elements", "APM Music", "Motion Array"];

function SecretAction({
  label,
  onClick,
  disabled = false,
  copied = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  copied?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-10 shrink-0 text-muted-foreground hover:text-foreground"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {copied ? <Check className="size-4 text-[var(--green-text)]" /> : <Copy className="size-4" />}
    </Button>
  );
}

function SoftwareCredentialDialog({
  open,
  editing,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  editing: SoftwareCredentialSummary | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setCategory(editing?.category ?? "");
    setWebsiteUrl(editing?.websiteUrl ?? "");
    setAccountEmail(editing?.accountEmail ?? "");
    setPassword("");
    setErrorMessage(null);
  }, [editing, open]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrorMessage(null);

    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        category: category.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        accountEmail: accountEmail.trim(),
      };
      if (password || !editing) body.password = password;

      const res = await fetch(editing ? `/api/software/${editing.id}` : "/api/software", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not save software account"));

      toast.success(editing ? "Software account updated" : "Software account added");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save software account");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(760px,calc(100vh-2rem))] overflow-y-auto">
        <DialogHeader className="block space-y-1">
          <DialogTitle>{editing ? "Edit software account" : "Add software account"}</DialogTitle>
          <DialogDescription>
            Store one department login. Secrets are encrypted before they reach the database.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="software-name">Software name</Label>
                <Input
                  id="software-name"
                  name="softwareName"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Motion Array"
                  maxLength={120}
                  autoComplete="off"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="software-category">Category</Label>
                <Input
                  id="software-category"
                  name="softwareCategory"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="Video, music, design"
                  maxLength={80}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="software-website">Website</Label>
                <Input
                  id="software-website"
                  name="softwareWebsite"
                  type="url"
                  value={websiteUrl}
                  onChange={(event) => setWebsiteUrl(event.target.value)}
                  placeholder="https://..."
                  maxLength={500}
                  autoComplete="url"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="software-email">Department login email</Label>
                <Input
                  id="software-email"
                  name="softwareEmail"
                  type="email"
                  value={accountEmail}
                  onChange={(event) => setAccountEmail(event.target.value)}
                  placeholder="creative@department.wisc.edu"
                  maxLength={320}
                  autoComplete="off"
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="software-password">
                  Password {editing && <span className="font-normal text-muted-foreground">(leave blank to keep it)</span>}
                </Label>
                <Input
                  id="software-password"
                  name="softwarePassword"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={editing ? "Leave unchanged" : "Enter the department password"}
                  maxLength={500}
                  autoComplete="new-password"
                  required={!editing}
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Passwords are never included in the software list or audit log. Reveals are explicit and audited.
                </p>
              </div>
            </div>
            {errorMessage && (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </p>
            )}
          </div>
          <DialogFooter className="border-t pt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={!name.trim() || !accountEmail.trim() || (!editing && !password)}>
              {editing ? "Save changes" : "Add account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SoftwareVault({ isAdmin }: { isAdmin: boolean }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SoftwareCredentialSummary | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<SoftwareCredentialSummary | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const revealTimers = useRef<Record<string, number>>({});

  const { data, loading, error, reload } = useFetch<SoftwareCredentialSummary[]>({
    url: isAdmin ? "/api/software?includeArchived=1" : "/api/software",
    transform: (json) => (json.data as SoftwareCredentialSummary[]) ?? [],
  });

  useEffect(() => {
    const timers = revealTimers.current;
    return () => {
      Object.values(timers).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const records = data ?? [];
  const activeRecords = records.filter((record) => !record.archivedAt);
  const archivedRecords = records.filter((record) => record.archivedAt);

  function openNewForm() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEditForm(record: SoftwareCredentialSummary) {
    setEditing(record);
    setFormOpen(true);
  }

  async function requestPassword(id: string): Promise<string> {
    const res = await fetch(`/api/software/${id}/secret`);
    if (handleAuthRedirect(res)) throw new Error("Session expired");
    if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not retrieve password"));
    const json = await parseJsonSafely<{ data?: { password?: unknown } }>(res);
    const password = json?.data?.password;
    if (typeof password !== "string" || !password) throw new Error("Password response was incomplete");
    return password;
  }

  function holdRevealedPassword(id: string, password: string) {
    setRevealedPasswords((current) => ({ ...current, [id]: password }));
    if (revealTimers.current[id]) window.clearTimeout(revealTimers.current[id]);
    revealTimers.current[id] = window.setTimeout(() => {
      setRevealedPasswords((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      delete revealTimers.current[id];
    }, 30_000);
  }

  async function togglePassword(record: SoftwareCredentialSummary) {
    if (revealedPasswords[record.id]) {
      setRevealedPasswords((current) => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
      return;
    }

    setRevealingId(record.id);
    try {
      const password = await requestPassword(record.id);
      holdRevealedPassword(record.id, password);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not retrieve password");
    } finally {
      setRevealingId(null);
    }
  }

  async function copyEmail(record: SoftwareCredentialSummary) {
    try {
      await navigator.clipboard.writeText(record.accountEmail);
      setCopiedId(`${record.id}:email`);
      window.setTimeout(() => setCopiedId(null), 1500);
      toast.success("Login email copied");
    } catch {
      toast.error("Could not copy the login email. Select it and copy manually.");
    }
  }

  async function copyPassword(record: SoftwareCredentialSummary) {
    try {
      const password = revealedPasswords[record.id] ?? await requestPassword(record.id);
      await navigator.clipboard.writeText(password);
      setCopiedId(`${record.id}:password`);
      window.setTimeout(() => setCopiedId(null), 1500);
      toast.success("Password copied");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not copy the password");
    }
  }

  async function archiveRecord() {
    if (!archiveTarget) return;
    try {
      const res = await fetch(`/api/software/${archiveTarget.id}`, { method: "DELETE" });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not archive software account"));
      toast.success(`${archiveTarget.name} archived`);
      setArchiveTarget(null);
      reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not archive software account");
    }
  }

  async function restoreRecord(record: SoftwareCredentialSummary) {
    try {
      const res = await fetch(`/api/software/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not restore software account"));
      toast.success(`${record.name} restored`);
      reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not restore software account");
    }
  }

  function renderCard(record: SoftwareCredentialSummary) {
    const password = revealedPasswords[record.id];
    const isArchived = Boolean(record.archivedAt);

    return (
      <Card key={record.id} className={isArchived ? "opacity-70" : undefined}>
        <CardHeader className="gap-3 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={isArchived ? "gray" : "blue"} size="sm">
                  {isArchived ? "Archived" : record.category || "Department account"}
                </Badge>
                {!isArchived && <LockKeyhole className="size-3.5 text-muted-foreground" aria-label="Password protected" />}
              </div>
              <CardTitle className="truncate text-base">{record.name}</CardTitle>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {record.websiteUrl && !isArchived && (
                <Button asChild type="button" variant="ghost" size="icon" className="size-10 text-muted-foreground hover:text-foreground">
                  <a href={record.websiteUrl} target="_blank" rel="noreferrer" aria-label={`Open ${record.name} website`}>
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              )}
              {isAdmin && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 text-muted-foreground hover:text-foreground"
                  aria-label={`Edit ${record.name}`}
                  onClick={() => openEditForm(record)}
                >
                  <Pencil className="size-4" />
                </Button>
              )}
            </div>
          </div>
          <CardDescription>
            {isArchived ? "Archived from the shared software list." : "Department login · available to the internal team"}
          </CardDescription>
        </CardHeader>
        {!isArchived ? (
          <CardContent className="space-y-3 pt-2">
            <div className="rounded-md border bg-muted/20 px-3 py-2">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Login email</p>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 break-all font-mono text-xs text-foreground">{record.accountEmail}</span>
                <SecretAction
                  label={`Copy ${record.name} login email`}
                  onClick={() => copyEmail(record)}
                  copied={copiedId === `${record.id}:email`}
                />
              </div>
            </div>
            <div className="rounded-md border bg-muted/20 px-3 py-2">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Password</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all font-mono text-sm text-foreground" aria-live="polite">
                  {password ?? "••••••••••••"}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label={password ? `Hide ${record.name} password` : `Show ${record.name} password`}
                  aria-pressed={Boolean(password)}
                  onClick={() => togglePassword(record)}
                  disabled={revealingId === record.id}
                >
                  {password ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
                <SecretAction
                  label={`Copy ${record.name} password`}
                  onClick={() => copyPassword(record)}
                  copied={copiedId === `${record.id}:password`}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Reveal or copy only when you need it. Reveals are logged.</p>
            </div>
          </CardContent>
        ) : (
          <CardContent className="pt-2">
            <p className="text-sm text-muted-foreground">Restore this account to make its login available again.</p>
          </CardContent>
        )}
        {isAdmin && (
          <CardFooter className="justify-between gap-3 border-t pt-4">
            {isArchived ? (
              <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => restoreRecord(record)}>
                Restore account
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" className="h-10 text-muted-foreground hover:text-destructive" onClick={() => setArchiveTarget(record)}>
                <Archive data-icon="inline-start" />
                Archive
              </Button>
            )}
            <span className="text-xs text-muted-foreground">Admin / staff control</span>
          </CardFooter>
        )}
      </Card>
    );
  }

  return (
    <section aria-labelledby="software-vault-title" className="mb-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Shared access</p>
          <h2 id="software-vault-title" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <KeyRound className="size-5 text-[var(--wi-red)]" />
            Software vault
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            One clear place for department software logins. Email is ready to copy; passwords stay masked until you ask.
          </p>
        </div>
        {isAdmin && (
          <Button type="button" className="h-10" onClick={openNewForm}>
            <Plus data-icon="inline-start" />
            Add software
          </Button>
        )}
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-[var(--blue)]/25 bg-[var(--blue-bg)]/35 px-4 py-3 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--blue-text)]" />
        <p className="leading-relaxed text-muted-foreground">
          Account emails and passwords are encrypted at rest. Passwords are fetched only for an explicit reveal or copy action, never in the list response.
        </p>
      </div>

      {loading && activeRecords.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading software accounts">
          {Array.from({ length: 3 }, (_, index) => (
            <Card key={index}>
              <CardHeader><Skeleton className="h-4 w-28" /><Skeleton className="h-5 w-44" /></CardHeader>
              <CardContent className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      ) : error && records.length === 0 ? (
        <EmptyState icon="wifi-off" title="Couldn't load software accounts" description="Check your connection and try again." actionLabel="Retry" onAction={reload} />
      ) : activeRecords.length === 0 ? (
        <Card className="border-dashed" elevation="flat">
          <CardContent className="py-8 text-center">
            <LockKeyhole className="mx-auto mb-3 size-6 text-muted-foreground" />
            <h3 className="font-medium">No shared software accounts yet</h3>
            <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
              Add the department logins your crew reaches for most often. Suggested entries: {SUGGESTED_SOFTWARE.join(", ")}.
            </p>
            {isAdmin && <Button type="button" className="mt-4 h-10" onClick={openNewForm}><Plus data-icon="inline-start" />Add first account</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{activeRecords.map(renderCard)}</div>
      )}

      {isAdmin && archivedRecords.length > 0 && (
        <details className="rounded-lg border bg-muted/10 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium">Archived accounts ({archivedRecords.length})</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{archivedRecords.map(renderCard)}</div>
        </details>
      )}

      <SoftwareCredentialDialog
        open={formOpen}
        editing={editing}
        onOpenChange={setFormOpen}
        onSaved={reload}
      />

      <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {archiveTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the account from the shared list without deleting its encrypted record. Admins can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep account</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={archiveRecord}>
              Archive account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
