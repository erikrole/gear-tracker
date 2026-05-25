"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Monitor, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/EmptyState";
import { useFetch } from "@/hooks/use-fetch";
import { handleAuthRedirect, isAbortError, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
import { SettingsPageShell } from "../SettingsPageShell";

type Session = {
  id: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

export default function SecuritySettingsPage() {
  // ── Sessions ──────────────────────────────────────────────────────────────
  const { data, loading, error, reload } = useFetch<{ data: Session[] }>({
    url: "/api/me/sessions",
    returnTo: "/settings/security",
  });
  const sessions = data?.data ?? [];

  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const revokingRef = useRef(false);

  async function handleRevokeOne(id: string) {
    if (revokingRef.current) return;
    revokingRef.current = true;
    setRevokingId(id);
    try {
      const res = await fetch(`/api/me/sessions/${id}`, { method: "DELETE" });
      if (res.status === 401) { handleAuthRedirect(res, "/settings/security"); return; }
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Could not sign out session.");
        toast.error(msg);
        return;
      }
      toast.success("Session signed out.");
      reload();
    } catch (err) {
      if (isAbortError(err)) return;
      toast.error("Could not reach the server. Check your connection.");
    } finally {
      revokingRef.current = false;
      setRevokingId(null);
    }
  }

  async function handleRevokeAll() {
    if (revokingRef.current) return;
    revokingRef.current = true;
    setRevokingAll(true);
    try {
      const res = await fetch("/api/me/sessions", { method: "DELETE" });
      if (res.status === 401) { handleAuthRedirect(res, "/settings/security"); return; }
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Could not sign out other sessions.");
        toast.error(msg);
        return;
      }
      const json = await parseJsonSafely<{ revokedCount?: number }>(res);
      const count = json?.revokedCount ?? 0;
      toast.success(count === 0 ? "No other sessions to sign out." : `Signed out ${count} other session${count === 1 ? "" : "s"}.`);
      reload();
    } catch (err) {
      if (isAbortError(err)) return;
      toast.error("Could not reach the server. Check your connection.");
    } finally {
      revokingRef.current = false;
      setRevokingAll(false);
    }
  }

  // ── Change password ───────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revokeOthers, setRevokeOthers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const savingRef = useRef(false);

  function resetForm() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setRevokeOthers(false);
    setPwError(null);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (savingRef.current) return;
    setPwError(null);

    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const res = await fetch("/api/me/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions: revokeOthers }),
      });
      if (res.status === 401) { handleAuthRedirect(res, "/settings/security"); return; }
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Failed to change password.");
        setPwError(msg);
        return;
      }
      toast.success("Password changed.");
      resetForm();
      if (revokeOthers) reload();
    } catch (err) {
      if (isAbortError(err)) return;
      toast.error("Could not reach the server. Check your connection.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const otherSessions = sessions.filter((s) => !s.isCurrent);
  const revoking = revokingId !== null || revokingAll;

  return (
    <SettingsPageShell title="Security" description="Change your password and manage active sessions.">
      <div className="space-y-4">
        {/* Change password */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="security-current-pw">Current password</Label>
                <Input
                  id="security-current-pw"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="security-new-pw">New password</Label>
                <Input
                  id="security-new-pw"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="security-confirm-pw">Confirm new password</Label>
                <Input
                  id="security-confirm-pw"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  aria-invalid={!!pwError}
                  disabled={saving}
                />
                {pwError && <p className="text-xs text-destructive">{pwError}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="security-revoke-others"
                  name="revokeOtherSessions"
                  aria-label="Sign out of all other devices"
                  checked={revokeOthers}
                  onCheckedChange={(v) => setRevokeOthers(!!v)}
                  disabled={saving}
                />
                <Label htmlFor="security-revoke-others" className="font-normal text-sm">
                  Sign out of all other devices
                </Label>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={saving || !currentPassword || !newPassword || !confirmPassword}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {saving ? "Saving…" : "Change password"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Active sessions */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base">Active sessions</CardTitle>
              {otherSessions.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={revoking}
                  onClick={handleRevokeAll}
                >
                  {revokingAll && <Loader2 className="size-4 animate-spin" />}
                  Sign out all other devices
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-4 pt-0">
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            ) : error ? (
              <div className="px-2 pb-2">
                <EmptyState
                  inline
                  icon={error === "network" ? "wifi-off" : "box"}
                  title={error === "network" ? "You are offline" : "Could not load sessions"}
                  description={error === "network" ? "Check your connection and retry." : "Retry before managing active sessions."}
                  actionLabel="Retry"
                  onAction={reload}
                />
              </div>
            ) : sessions.length === 0 ? (
              <div className="px-2 pb-2">
                <EmptyState
                  inline
                  icon="check"
                  title="No active sessions found"
                  description="Only current, unexpired sessions appear here."
                />
              </div>
            ) : (
              <ul className="divide-y">
                {sessions.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-6 py-3">
                    <Monitor className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {new Date(s.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        {s.isCurrent && (
                          <Badge variant="secondary" className="text-xs">This device</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Expires{" "}
                        {new Date(s.expiresAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    {!s.isCurrent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={revoking}
                        onClick={() => handleRevokeOne(s.id)}
                      >
                        {revokingId === s.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                        <span className="sr-only">Sign out</span>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </SettingsPageShell>
  );
}
