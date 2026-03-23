"use client";

import { FormEvent, useState } from "react";
import { useToast } from "@/components/Toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Location } from "./types";

export default function CreateUserDialog({
  open,
  onOpenChange,
  locations,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: Location[];
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
      role: String(form.get("role") || "STAFF"),
      locationId: (() => { const v = String(form.get("locationId") || ""); return v === "__none__" ? null : v || null; })(),
    };

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) { window.location.href = "/login"; return; }
      const json = await res.json();

      if (!res.ok) {
        toast(json.error || "Failed to create user", "error");
        setSubmitting(false);
        return;
      }

      toast(`${payload.name} added successfully`, "success");
      setSubmitting(false);
      onOpenChange(false);
      onCreated();
    } catch {
      toast("Network error", "error");
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="create-name">Full name</Label>
            <Input id="create-name" name="name" required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-email">Email</Label>
            <Input id="create-email" name="email" type="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-password">Temporary password</Label>
            <Input id="create-password" name="password" type="password" minLength={8} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select name="role" defaultValue="STAFF">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="STAFF">Staff</SelectItem>
                  <SelectItem value="STUDENT">Student</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Select name="locationId" defaultValue="__none__">
                <SelectTrigger>
                  <SelectValue placeholder="No location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No location</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding..." : "Add user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
