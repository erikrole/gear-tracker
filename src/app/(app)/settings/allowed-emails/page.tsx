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
import { useFetch } from "@/hooks/use-fetch";
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

  // Filter
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Build fetch URL from filter state
  const fetchUrl = (() => {
    const params = new URLSearchParams({ limit: "100" });
    if (statusFilter !== "all") params.set("status", statusFilter);
    return `/api/allowed-emails?${params}`;
  })();

  const { data: emailsData, loading, error, reload } = useFetch<AllowedEmailsResponse>({
    url: fetchUrl,
    returnTo: "/settings/allowed-emails",
    transform: (json) => ({ data: (json.data as AllowedEmail[]) ?? [], total: (json.total as number) ?? 0 }),
  });

  // Local state for optimistic mutation updates
  const [localItems, setLocalItems] = useState<AllowedEmail[] | null>(null);
  const [localTotal, setLocalTotal] = useState<number | null>(null);
  const items = localItems ?? emailsData?.data ?? [];
  const total = localTotal ?? emailsData?.total ?? 0;
  const [prevData, setPrevData] = useState(emailsData);
  if (emailsData !== prevData) {
    setPrevData(emailsData);
    setLocalItems(null);
    setLocalTotal(null);
  }

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<"STUDENT" | "STAFF">("STUDENT");
  const [adding, setAdding] = useState(false);

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
        setLocalItems((prev) => (prev ?? items).filter((i) => i.id !== item.id));
        setLocalTotal((prev) => (prev ?? total) - 1);
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
    <div className="sticky top-20 max-md:static">
      <h2 className="text-[22px] font-bold mb-2">Allowed Emails</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Manage which email addresses can register for an account.
        Only pre-approved emails can sign up.
      </p>
    </div>
  );

  if (loading) {
    return (
      <FadeUp>
        <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-md:grid-cols-1 max-md:gap-4">
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
        <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-md:grid-cols-1 max-md:gap-4">
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
    <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-md:grid-cols-1 max-md:gap-4">
      {sidebar}

      <div className="min-w-0 space-y-4">
        {/* Controls row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ({total})</SelectItem>
                <SelectItem value="unclaimed">Pending</SelectItem>
                <SelectItem value="claimed">Claimed</SelectItem>
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
                    <Select
                      value={addRole}
                      onValueChange={(v) =>
                        setAddRole(v as "STUDENT" | "STAFF")
                      }
                    >
                      <SelectTrigger id="add-role" className="h-9">
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
                    {adding ? (
                      <>
                        <Spinner data-icon="inline-start" />
                        Adding...
                      </>
                    ) : (
                      "Add to allowlist"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAdd(false);
                      setAddEmail("");
                      setAddRole("STUDENT");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
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
                    <TableCell className="font-medium">{item.email}</TableCell>
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
                      {!item.claimedAt && (
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
