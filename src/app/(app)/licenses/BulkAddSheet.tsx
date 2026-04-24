"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function BulkAddSheet({ open, onOpenChange, onCreated }: Props) {
  const [codes, setCodes] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!codes.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/licenses/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codes,
          accountEmail: accountEmail.trim() || undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to bulk add licenses");
      const { created, skipped } = json.data as { created: number; skipped: number };
      toast.success(`Added ${created} license${created !== 1 ? "s" : ""}`, {
        description: skipped > 0 ? `${skipped} duplicate${skipped !== 1 ? "s" : ""} skipped` : undefined,
      });
      setCodes("");
      setAccountEmail("");
      setExpiresAt("");
      onCreated();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Bulk add licenses</SheetTitle>
          <SheetDescription>Paste one license code per line. Duplicates are skipped.</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
          <div className="space-y-1.5">
            <Label htmlFor="bulk-codes">License codes</Label>
            <Textarea
              id="bulk-codes"
              value={codes}
              onChange={(e) => setCodes(e.target.value)}
              placeholder={"PM6-XXXX-XXXX-0001\nPM6-XXXX-XXXX-0002\nPM6-XXXX-XXXX-0003"}
              className="font-mono text-sm min-h-[200px]"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bulk-account">
              Shared account email <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="bulk-account"
              type="email"
              value={accountEmail}
              onChange={(e) => setAccountEmail(e.target.value)}
              placeholder="kms@athletics.wisc.edu"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bulk-expiry">
              Shared expiry <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="bulk-expiry"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !codes.trim()}>
              {loading ? "Adding…" : "Add licenses"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
