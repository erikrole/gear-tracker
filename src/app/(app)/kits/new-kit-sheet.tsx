"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

type Location = { id: string; name: string };

interface NewKitSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: Location[];
  onCreated: (kitId: string) => void;
}

export function NewKitSheet({ open, onOpenChange, locations, onCreated }: NewKitSheetProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setDescription("");
    setLocationId(locations[0]?.id ?? "");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Kit name is required");
      return;
    }
    if (!locationId) {
      setError("Location is required");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/kits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          locationId,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to create kit");
      }

      const { data } = await res.json();
      reset();
      onOpenChange(false);
      onCreated(data.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!submitting) { onOpenChange(v); if (!v) reset(); } }}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>New Kit</SheetTitle>
          <SheetDescription>
            Create a named collection of gear items for quick checkout.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="kit-name">Name</Label>
            <Input
              id="kit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Interview Kit"
              disabled={submitting}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kit-description">Description</Label>
            <Textarea
              id="kit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this kit"
              disabled={submitting}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kit-location">Location</Label>
            <Select value={locationId} onValueChange={setLocationId} disabled={submitting}>
              <SelectTrigger id="kit-location">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <SheetFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Kit
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
