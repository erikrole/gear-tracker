"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";
import { useFormSubmit } from "@/hooks/use-form-submit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { AlertCircle, Copy, KeyRound, Shuffle, UserPlus } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import type { Location, Role } from "./types";

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "STAFF", "STUDENT"]),
  locationId: z.string().cuid().nullable(),
});

type CreateUserInput = z.infer<typeof createUserSchema>;

type CreatedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  locationId: string | null;
  location: string | null;
};

const ROLE_HELP: Record<CreateUserInput["role"], string> = {
  ADMIN: "Full system access. Use only for operators who manage settings and accounts.",
  STAFF: "Can create and edit users, inventory, reservations, and checkouts.",
  STUDENT: "Can view shared operations and manage only their own booking work.",
};

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

export default function CreateUserDialog({
  open,
  onOpenChange,
  locations,
  currentUserRole,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: Location[];
  currentUserRole: Role | null;
  onCreated: (user: CreatedUser) => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<CreateUserInput["role"]>("STAFF");
  const roleOptions = useMemo(() => {
    const options: Array<{ value: CreateUserInput["role"]; label: string }> = [
      { value: "STAFF", label: "Staff" },
      { value: "STUDENT", label: "Student" },
    ];
    if (currentUserRole === "ADMIN") {
      options.unshift({ value: "ADMIN", label: "Admin" });
    }
    return options;
  }, [currentUserRole]);

  const { submit, submitting, fieldErrors, formError, clearErrors } = useFormSubmit<CreateUserInput, CreatedUser>({
    schema: createUserSchema,
    url: "/api/users",
    successMessage: "User added successfully",
    onSuccess: (created) => {
      onOpenChange(false);
      onCreated(created);
      router.push(`/users/${created.id}`);
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setPassword(generateTemporaryPassword());
      setRole("STAFF");
      formRef.current?.reset();
      clearErrors();
    }
  }, [open, clearErrors]);

  function regeneratePassword() {
    setPassword(generateTemporaryPassword());
  }

  async function copyPassword() {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    toast.success("Temporary password copied");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const locValue = String(form.get("locationId") || "");
    await submit({
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      password,
      role,
      locationId: locValue === "__none__" ? null : locValue || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-balance">
            <UserPlus className="size-5" />
            Add user
          </DialogTitle>
          <DialogDescription className="text-pretty">
            Create the login, then finish profile details from the new user page.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-name">Full name</Label>
              <Input
                id="create-name"
                name="name"
                required
                autoFocus
                disabled={submitting}
                aria-invalid={!!fieldErrors.name}
                autoComplete="name"
                className="h-10"
              />
              {fieldErrors.name && <p className="text-sm text-destructive">{fieldErrors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-email">Campus email</Label>
              <Input
                id="create-email"
                name="email"
                type="email"
                required
                disabled={submitting}
                aria-invalid={!!fieldErrors.email}
                autoComplete="email"
                className="h-10"
              />
              {fieldErrors.email && <p className="text-sm text-destructive">{fieldErrors.email}</p>}
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/20 p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <KeyRound className="size-4 text-muted-foreground" />
              Temporary password
            </div>
            <div className="flex gap-2">
              <Input
                id="create-password"
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
                disabled={submitting}
                aria-invalid={!!fieldErrors.password}
                className="h-10 font-mono"
                autoComplete="new-password"
              />
              <Button type="button" variant="outline" size="icon" className="size-10" onClick={regeneratePassword} disabled={submitting} aria-label="Generate temporary password">
                <Shuffle className="size-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" className="size-10" onClick={copyPassword} disabled={submitting || !password} aria-label="Copy temporary password">
                <Copy className="size-4" />
              </Button>
            </div>
            {fieldErrors.password ? (
              <p className="mt-1.5 text-sm text-destructive">{fieldErrors.password}</p>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">Share this password directly with the user. They will be asked to change it at first sign-in.</p>
            )}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="create-role">Role</Label>
              <Select name="role" value={role} onValueChange={(value) => setRole(value as CreateUserInput["role"])} disabled={submitting}>
                <SelectTrigger id="create-role" aria-label="Role" className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{ROLE_HELP[role]}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-location">Location</Label>
              <Select name="locationId" defaultValue="__none__" disabled={submitting}>
                <SelectTrigger id="create-location" aria-label="Location" className="h-10">
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

          {formError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="mt-1">
            <Button type="button" variant="outline" className="h-10" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" className="h-10" disabled={submitting}>
              {submitting && <Spinner data-icon="inline-start" />}
              {submitting ? "Adding..." : "Add and open profile"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
