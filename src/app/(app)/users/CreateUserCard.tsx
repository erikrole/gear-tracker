"use client";

import { FormEvent, useState } from "react";
import { useToast } from "@/components/Toast";
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
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header flex-between">
        <h2>Add user</h2>
        <button type="button" className="btn btn-sm" onClick={onClose}>
          Cancel
        </button>
      </div>
      <form onSubmit={handleSubmit} className="p-16">
        <div className="form-grid form-grid-3">
          <input
            className="form-input"
            name="name"
            placeholder="Full name"
            required
            aria-label="Full name"
            autoFocus
          />
          <input
            className="form-input"
            name="email"
            type="email"
            placeholder="Email"
            required
            aria-label="Email"
          />
          <input
            className="form-input"
            name="password"
            type="password"
            minLength={8}
            placeholder="Temporary password"
            required
            aria-label="Temporary password"
          />
          <select className="form-select" name="role" defaultValue="STAFF" aria-label="Role">
            <option value="ADMIN">Admin</option>
            <option value="STAFF">Staff</option>
            <option value="STUDENT">Student</option>
          </select>
          <select className="form-select" name="locationId" defaultValue="" aria-label="Location">
            <option value="">No location</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Adding..." : "Add user"}
          </button>
        </div>
      </form>
    </div>
  );
}
