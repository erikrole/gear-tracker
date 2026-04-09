"use client";

import { useState } from "react";
import { z } from "zod";
import { useFormSubmit } from "@/hooks/use-form-submit";
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
import { Spinner } from "@/components/ui/spinner";

type Location = { id: string; name: string };

interface NewKitSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: Location[];
  onCreated: (kitId: string) => void;
}

const createKitSchema = z.object({
  name: z.string().min(1, "Kit name is required"),
  description: z.string(),
  locationId: z.string().min(1, "Location is required"),
});

type CreateKitInput = z.infer<typeof createKitSchema>;

export function NewKitSheet({ open, onOpenChange, locations, onCreated }: NewKitSheetProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");

  function reset() {
    setName("");
    setDescription("");
    setLocationId(locations[0]?.id ?? "");
  }

  const { submit, submitting, fieldErrors, formError, clearErrors } = useFormSubmit<CreateKitInput, { id: string }>({
    schema: createKitSchema,
    url: "/api/kits",
    successMessage: "Kit created",
    onSuccess: (data) => {
      reset();
      onOpenChange(false);
      onCreated(data.id);
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submit({
      name: name.trim(),
      description: description.trim(),
      locationId,
    });
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!submitting) { onOpenChange(v); if (!v) { reset(); clearErrors(); } } }}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>New Kit</SheetTitle>
          <SheetDescription>
            Create a named collection of gear items for quick checkout.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2">
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

          <div className="flex flex-col gap-2">
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

          <div className="flex flex-col gap-2">
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
              {submitting && <Spinner data-icon="inline-start" />}
              Create Kit
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
