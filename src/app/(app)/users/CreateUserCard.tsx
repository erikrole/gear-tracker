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
      locationId: String(form.get("locationId") || "") || null,
    };

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
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
    <Card style={{ marginBottom: 16 }}>
      <CardHeader className="flex-between">
        <CardTitle>Add user</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </CardHeader>
      <form onSubmit={handleSubmit} className="p-16">
        <div className="form-grid form-grid-3">
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
          <Select name="locationId" defaultValue="" aria-label="Location">
            <SelectTrigger>
              <SelectValue placeholder="No location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No location</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding..." : "Add user"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
