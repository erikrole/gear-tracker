"use client";

import { FormEvent, useState } from "react";
import { useToast } from "@/components/Toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Location } from "./types";

export default function CreateUserCard({
  locations,
  onCreated,
  onClose,
}: {
  locations: Location[];
  onCreated: () => void;
  onClose: () => void;
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
      onClose();
      onCreated();
    } catch {
      toast("Network error", "error");
      setSubmitting(false);
    }
  }

  return (
    <Card className="mb-4">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Add user</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </CardHeader>
      <form onSubmit={handleSubmit} className="px-6 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <Input
            name="name"
            placeholder="Full name"
            required
            aria-label="Full name"
            autoFocus
          />
          <Input
            name="email"
            type="email"
            placeholder="Email"
            required
            aria-label="Email"
          />
          <Input
            name="password"
            type="password"
            minLength={8}
            placeholder="Temporary password"
            required
            aria-label="Temporary password"
          />
          <Select name="role" defaultValue="STAFF" aria-label="Role">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="STAFF">Staff</SelectItem>
              <SelectItem value="STUDENT">Student</SelectItem>
            </SelectContent>
          </Select>
          <Select name="locationId" defaultValue="__none__" aria-label="Location">
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
        <div className="flex justify-end mt-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding..." : "Add user"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
