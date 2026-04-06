"use client";

import { FormEvent, useEffect, useRef } from "react";
import { z } from "zod";
import { useFormSubmit } from "@/hooks/use-form-submit";
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

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "STAFF", "STUDENT"]),
  locationId: z.string().cuid().nullable(),
});

type CreateUserInput = z.infer<typeof createUserSchema>;

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
  const formRef = useRef<HTMLFormElement>(null);

  const { submit, submitting, fieldErrors, clearErrors } = useFormSubmit<CreateUserInput>({
    schema: createUserSchema,
    url: "/api/users",
    successMessage: "User added successfully",
    onSuccess: () => {
      onOpenChange(false);
      onCreated();
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      formRef.current?.reset();
      clearErrors();
    }
  }, [open, clearErrors]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const locValue = String(form.get("locationId") || "");
    await submit({
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
      role: String(form.get("role") || "STAFF") as CreateUserInput["role"],
      locationId: locValue === "__none__" ? null : locValue || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="create-name">Full name</Label>
            <Input id="create-name" name="name" required autoFocus disabled={submitting} aria-invalid={!!fieldErrors.name} />
            {fieldErrors.name && <p className="text-sm text-destructive">{fieldErrors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-email">Email</Label>
            <Input id="create-email" name="email" type="email" required disabled={submitting} aria-invalid={!!fieldErrors.email} />
            {fieldErrors.email && <p className="text-sm text-destructive">{fieldErrors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-password">Temporary password</Label>
            <Input id="create-password" name="password" type="password" minLength={8} required disabled={submitting} aria-invalid={!!fieldErrors.password} />
            {fieldErrors.password && <p className="text-sm text-destructive">{fieldErrors.password}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select name="role" defaultValue="STAFF" disabled={submitting}>
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
              <Select name="locationId" defaultValue="__none__" disabled={submitting}>
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
