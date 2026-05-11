"use client";

import { useEffect, useState, type FormEvent } from "react";
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
  const defaultLocationId = locations[0]?.id ?? "";
  const hasLocations = locations.length > 0;

  useEffect(() => {
    if (open && !locationId && defaultLocationId) {
      setLocationId(defaultLocationId);
    }
  }, [defaultLocationId, locationId, open]);

  function reset() {
    setName("");
    setDescription("");
    setLocationId(defaultLocationId);
  }

  const { submit, submitting, fieldErrors, formError, clearErrors } = useFormSubmit<CreateKitInput, { id: string }>({
    schema: createKitSchema,
    url: "/api/kits",
    onSuccess: (data) => {
      reset();
      onOpenChange(false);
      onCreated(data.id);
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    if (submitting) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      reset();
      clearErrors();
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await submit({
      name: name.trim(),
      description: description.trim(),
      locationId,
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-lg">
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

          {!hasLocations && (
            <Alert>
              <AlertDescription>
                Add a location before creating kits. Kits are location-scoped so checkout availability stays accurate.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="kit-name">Name</Label>
            <Input
              id="kit-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name || formError) clearErrors();
              }}
              placeholder="e.g., Interview Kit"
              disabled={submitting}
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? "kit-name-error" : undefined}
              autoFocus
            />
            {fieldErrors.name && (
              <p id="kit-name-error" className="text-sm text-destructive">
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="kit-description">Description</Label>
            <Textarea
              id="kit-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (fieldErrors.description || formError) clearErrors();
              }}
              placeholder="Optional notes about this kit"
              disabled={submitting}
              aria-invalid={!!fieldErrors.description}
              aria-describedby={fieldErrors.description ? "kit-description-error" : undefined}
              rows={3}
            />
            {fieldErrors.description && (
              <p id="kit-description-error" className="text-sm text-destructive">
                {fieldErrors.description}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="kit-location">Location</Label>
            <Select
              value={locationId}
              onValueChange={(value) => {
                setLocationId(value);
                if (fieldErrors.locationId || formError) clearErrors();
              }}
              disabled={submitting || !hasLocations}
            >
              <SelectTrigger
                id="kit-location"
                aria-invalid={!!fieldErrors.locationId}
                aria-describedby={fieldErrors.locationId ? "kit-location-error" : undefined}
              >
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
            {fieldErrors.locationId && (
              <p id="kit-location-error" className="text-sm text-destructive">
                {fieldErrors.locationId}
              </p>
            )}
          </div>

          <SheetFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={!hasLocations || submitting}>
              Create and open kit
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
