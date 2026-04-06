"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  WifiOff,
} from "lucide-react";

type AllowedEmail = {
  id: string;
  email: string;
  role: "STAFF" | "STUDENT";
  claimedAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
  claimedBy: { id: string; name: string } | null;
};

type ErrorState = { type: "network" | "server"; message: string };

export default function AllowedEmailsPage() {
  const { toast } = useToast();
  const confirm = useConfirm();

  const [items, setItems] = useState<AllowedEmail[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorState | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<"STUDENT" | "STAFF">("STUDENT");
  const [adding, setAdding] = useState(false);

  // Filter
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/allowed-emails?${params}`);
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (res.ok) {
        const json = await res.json();
        setItems(json.data);
        setTotal(json.total);
      } else {
        setError({ type: "server", message: "Failed to load allowed emails" });
      }
    } catch {
      setError({ type: "network", message: "Could not connect to server" });
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

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
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (res.ok) {
        toast("Email added to allowlist", "success");
        setAddEmail("");
        setAddRole("STUDENT");
        setShowAdd(false);
        load();
      } else {
        const json = await res.json().catch(() => ({}));
        toast(
          (json as Record<string, string>).error || "Failed to add email",
          "error"
        );
      }
    } catch {
      toast("Network error", "error");
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
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setTotal((prev) => prev - 1);
        toast("Email removed from allowlist", "success");
      } else {
        const json = await res.json().catch(() => ({}));
        toast(
          (json as Record<string, string>).error || "Failed to remove email",
          "error"
        );
      }
    } catch {
      toast("Network error", "error");
    }
    setDeletingId(null);
  }

  const sidebar = (
    <div className="sticky top-20 max-md:static">
      <h2 className="text-[22px] font-bold mb-2">Allowed Emails</h2>
      <p className="text-[var(--text-secondary)] text-sm leading-relaxed m-0">
        Manage which email addresses can register for an account.
        Only pre-approved emails can sign up.
      </p>
    </div>
  );

  if (loading) {
    return (
      <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-md:grid-cols-1 max-md:gap-4">
        {sidebar}
        <div className="min-w-0 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-md border p-4"
            >
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    const Icon = error.type === "network" ? WifiOff : AlertTriangle;
    return (
      <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-md:grid-cols-1 max-md:gap-4">
        {sidebar}
        <div className="min-w-0">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <Icon className="size-10 text-muted-foreground" />
              <div>
                <p className="font-semibold">
                  {error.type === "network"
                    ? "Connection Failed"
                    : "Something Went Wrong"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {error.message}
                </p>
              </div>
              <Button variant="outline" onClick={load}>
                <RefreshCw className="size-4" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
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
                        <Loader2 className="size-4 animate-spin" />
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
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Added by</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="font-medium">{item.email}</td>
                      <td>
                        <Badge
                          variant={
                            item.role === "STAFF" ? "blue" : "gray"
                          }
                          size="sm"
                        >
                          {item.role}
                        </Badge>
                      </td>
                      <td>
                        {item.claimedAt ? (
                          <Badge variant="green" size="sm">
                            Claimed
                          </Badge>
                        ) : (
                          <Badge variant="orange" size="sm">
                            Pending
                          </Badge>
                        )}
                      </td>
                      <td className="text-muted-foreground text-xs">
                        {item.createdBy.name}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {!item.claimedAt && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(item)}
                            disabled={deletingId === item.id}
                            className="text-destructive hover:text-destructive"
                          >
                            {deletingId === item.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
