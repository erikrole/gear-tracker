"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FadeUp } from "@/components/ui/motion";
import { useConfirm } from "@/components/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Plus,
  RefreshCw,
  Trash2,
  WifiOff,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFetch } from "@/hooks/use-fetch";
import { useLastAudit } from "@/hooks/use-last-audit";
import { LastEditedHint } from "@/components/LastEditedHint";
import { handleAuthRedirect, classifyError, isAbortError, parseErrorMessage } from "@/lib/errors";

type AllowedEmail = {
  id: string;
  email: string;
  role: "STAFF" | "STUDENT";
  claimedAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
  claimedBy: { id: string; name: string } | null;
};

type AllowedEmailsResponse = { data: AllowedEmail[]; total: number };

export default function AllowedEmailsPage() {
  const confirm = useConfirm();

  // Filter (client-side so the count badges always reflect the unfiltered totals)
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: emailsData, loading, error, reload } = useFetch<AllowedEmailsResponse>({
    url: "/api/allowed-emails?limit=500",
    returnTo: "/settings/allowed-emails",
    transform: (json) => ({ data: (json.data as AllowedEmail[]) ?? [], total: (json.total as number) ?? 0 }),
  });

  // Local state for optimistic mutation updates
  const [localItems, setLocalItems] = useState<AllowedEmail[] | null>(null);
  const allItems = localItems ?? emailsData?.data ?? [];
  const [prevData, setPrevData] = useState(emailsData);
  if (emailsData !== prevData) {
    setPrevData(emailsData);
    setLocalItems(null);
  }

  const lastEdited = useLastAudit("allowed_email", allItems.map((i) => i.id));

  const totalAll = allItems.length;
  const totalPending = allItems.filter((i) => !i.claimedAt).length;
  const totalClaimed = totalAll - totalPending;
  const items = statusFilter === "unclaimed"
    ? allItems.filter((i) => !i.claimedAt)
    : statusFilter === "claimed"
      ? allItems.filter((i) => i.claimedAt)
      : allItems;

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<"single" | "bulk">("single");
  const [addEmail, setAddEmail] = useState("");
  const [addBulk, setAddBulk] = useState("");
  const [addRole, setAddRole] = useState<"STUDENT" | "STAFF">("STUDENT");
  const [adding, setAdding] = useState(false);

  function parseBulkEmails(raw: string): string[] {
    return Array.from(
      new Set(
        raw
          .split(/[\s,;\n]+/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      )
    );
  }

  async function handleBulkAdd(e: React.FormEvent) {
    e.preventDefault();
    const emails = parseBulkEmails(addBulk);
    if (emails.length === 0) {
      toast.error("Paste at least one email");
      return;
    }
    if (emails.length > 50) {
      toast.error(`Too many — max 50 per batch (got ${emails.length}).`);
      return;
    }
    // Basic shape filter to bail before the round-trip
    const malformed = emails.filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (malformed.length > 0) {
      toast.error(`Looks invalid: ${malformed.slice(0, 3).join(", ")}${malformed.length > 3 ? "…" : ""}`);
      return;
    }

    setAdding(true);
    try {
      const res = await fetch("/api/allowed-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: emails.map((email) => ({ email, role: addRole })) }),
      });
      if (handleAuthRedirect(res, "/settings/allowed-emails")) return;
      if (res.ok) {
        const json = await res.json();
        const created = (json.created as number) ?? 0;
        const skipped = (json.skipped as string[]) ?? [];
        if (created > 0 && skipped.length === 0) {
          toast.success(`Added ${created} email${created === 1 ? "" : "s"} to allowlist`);
        } else if (created > 0) {
          toast.success(`Added ${created}; skipped ${skipped.length} already on allowlist or registered`);
        } else {
          toast.message("All emails were already on the allowlist or registered.");
        }
        setAddBulk("");
        setShowAdd(false);
        setAddMode("single");
        reload();
      } else {
        const msg = await parseErrorMessage(res, "Bulk add failed");
        toast.error(msg);
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You’re offline. Check your connection." : "Bulk add failed");
    }
    setAdding(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = addEmail.trim().toLowerCase();
    if (!trimmed) return;

    setAdding(true);
    try {
      const res = await fetch("/api/allowed-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, role: addRole }),
      });
      if (handleAuthRedirect(res, "/settings/allowed-emails")) return;
      if (res.ok) {
        toast.success("Email added to allowlist");
        setAddEmail("");
        setAddRole("STUDENT");
        setShowAdd(false);
        reload();
      } else {
        const msg = await parseErrorMessage(res, "Failed to add email");
        toast.error(msg);
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You\u2019re offline. Check your connection." : "Failed to add email");
    }
    setAdding(false);
  }

  async function handleDelete(item: AllowedEmail) {
    const ok = await confirm({
      title: "Remove from allowlist",
      message: `Remove ${item.email} from the allowlist? They won't be able to register.`,
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (!ok) return;

    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/allowed-emails/${item.id}`, {
        method: "DELETE",
      });
      if (handleAuthRedirect(res, "/settings/allowed-emails")) return;
      if (res.ok) {
        setLocalItems((prev) => (prev ?? allItems).filter((i) => i.id !== item.id));
        toast.success("Email removed from allowlist");
      } else {
        const msg = await parseErrorMessage(res, "Failed to remove email");
        toast.error(msg);
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You\u2019re offline. Check your connection." : "Failed to remove email");
    }
    setDeletingId(null);
  }

  const sidebar = (
    <div className="sticky top-20 max-lg:static">
      <h2 className="text-2xl font-bold mb-2">Allowed Emails</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Manage which email addresses can register for an account.
        Only pre-approved emails can sign up.
      </p>
    </div>
  );

  if (loading) {
    return (
      <FadeUp>
        <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-lg:grid-cols-1 max-lg:gap-4">
          {sidebar}
          <div className="min-w-0 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 rounded-md border p-4">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </FadeUp>
    );
  }

  if (error) {
    const Icon = error === "network" ? WifiOff : AlertTriangle;
    return (
      <FadeUp>
        <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-lg:grid-cols-1 max-lg:gap-4">
          {sidebar}
          <div className="min-w-0">
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <Icon className="size-10 text-muted-foreground" />
                <div>
                  <p className="font-semibold">
                    {error === "network" ? "Connection Failed" : "Something Went Wrong"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {error === "network"
                      ? "Could not connect to server. Check your connection."
                      : "Failed to load allowed emails. Please try again."}
                  </p>
                </div>
                <Button variant="outline" onClick={reload}>
                  <RefreshCw className="size-4" />
                  Retry
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </FadeUp>
    );
  }

  return (
    <FadeUp>
    <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-lg:grid-cols-1 max-lg:gap-4">
      {sidebar}

      <div className="min-w-0 space-y-4">
        {/* Controls row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ({totalAll})</SelectItem>
                <SelectItem value="unclaimed">Pending ({totalPending})</SelectItem>
                <SelectItem value="claimed">Claimed ({totalClaimed})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!showAdd && (
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="size-4" />
              Add email
            </Button>
          )}
        </div>

        {/* Add form */}
        {showAdd && (
          <Card>
            <CardContent className="pt-6">
              <div className="mb-3 flex items-center gap-2 text-xs">
                <button
                  type="button"
                  className={`px-2 py-1 rounded-md font-medium ${addMode === "single" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setAddMode("single")}
                  disabled={adding}
                >
                  One email
                </button>
                <button
                  type="button"
                  className={`px-2 py-1 rounded-md font-medium ${addMode === "bulk" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setAddMode("bulk")}
                  disabled={adding}
                >
                  Bulk paste (up to 50)
                </button>
              </div>

              {addMode === "single" ? (
                <form onSubmit={handleAdd} className="space-y-4">
                  <div className="grid grid-cols-[1fr_140px] gap-3 max-sm:grid-cols-1">
                    <div className="space-y-1.5">
                      <Label htmlFor="add-email">Email address</Label>
                      <Input
                        id="add-email"
                        type="email"
                        value={addEmail}
                        onChange={(e) => setAddEmail(e.target.value)}
                        placeholder="user@example.com"
                        required
                        autoFocus
                        disabled={adding}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="add-role">Role</Label>
                      <Select value={addRole} onValueChange={(v) => setAddRole(v as "STUDENT" | "STAFF")}>
                        <SelectTrigger id="add-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="STUDENT">Student</SelectItem>
                          <SelectItem value="STAFF">Staff</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={adding}>
                      {adding ? (<><Spinner data-icon="inline-start" />Adding...</>) : "Add to allowlist"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { setShowAdd(false); setAddEmail(""); setAddRole("STUDENT"); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleBulkAdd} className="space-y-4">
                  <div className="grid grid-cols-[1fr_140px] gap-3 max-sm:grid-cols-1">
                    <div className="space-y-1.5">
                      <Label htmlFor="add-bulk">Paste emails — separated by spaces, commas, or new lines</Label>
                      <Textarea
                        id="add-bulk"
                        value={addBulk}
                        onChange={(e) => setAddBulk(e.target.value)}
                        placeholder={"alice@school.edu\nbob@school.edu\ncharlie@school.edu"}
                        rows={6}
                        autoFocus
                        disabled={adding}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground m-0">
                        {parseBulkEmails(addBulk).length} unique address{parseBulkEmails(addBulk).length === 1 ? "" : "es"} detected.
                        Already-allowlisted or registered emails are skipped automatically.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="add-bulk-role">Role for all</Label>
                      <Select value={addRole} onValueChange={(v) => setAddRole(v as "STUDENT" | "STAFF")}>
                        <SelectTrigger id="add-bulk-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="STUDENT">Student</SelectItem>
                          <SelectItem value="STAFF">Staff</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={adding || addBulk.trim().length === 0}>
                      {adding ? (<><Spinner data-icon="inline-start" />Adding...</>) : "Add all to allowlist"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { setShowAdd(false); setAddBulk(""); setAddMode("single"); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">
              {statusFilter === "unclaimed"
                ? "Pending invitations"
                : statusFilter === "claimed"
                  ? "Claimed invitations"
                  : "All allowed emails"}
            </CardTitle>
          </CardHeader>
          {items.length === 0 ? (
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                {statusFilter === "all"
                  ? "No emails on the allowlist yet. Add one to get started."
                  : "No results for this filter."}
              </p>
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added by</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-0.5">
                        <span>{item.email}</span>
                        <LastEditedHint info={lastEdited[item.id]} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.role === "STAFF" ? "blue" : "gray"} size="sm">
                        {item.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.claimedAt ? (
                        <Badge variant="green" size="sm">Claimed</Badge>
                      ) : (
                        <Badge variant="orange" size="sm">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {item.createdBy.name}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.claimedAt ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled
                                aria-label="Cannot remove a claimed allowlist entry"
                                className="text-muted-foreground/50 cursor-not-allowed"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            Already claimed — deactivate the user instead.
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item)}
                          disabled={deletingId === item.id}
                          className="text-destructive hover:text-destructive"
                        >
                          {deletingId === item.id ? <Spinner /> : <Trash2 className="size-4" />}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
    </FadeUp>
  );
}
