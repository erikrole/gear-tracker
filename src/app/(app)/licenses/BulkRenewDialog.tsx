"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { LicenseCode } from "./types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  codes: LicenseCode[];
  onRenewed: () => void;
};

type RenewScope = "expiring" | "visible";

function isExpiringOrExpired(code: LicenseCode) {
  if (!code.expiresAt || code.status === "RETIRED") return false;
  const diff = new Date(code.expiresAt).getTime() - Date.now();
  return diff <= 30 * 86_400_000;
}

export function BulkRenewDialog({ open, onOpenChange, codes, onRenewed }: Props) {
  const activeCodes = useMemo(() => codes.filter((code) => code.status !== "RETIRED"), [codes]);
  const expiringCodes = useMemo(() => activeCodes.filter(isExpiringOrExpired), [activeCodes]);
  const [scope, setScope] = useState<RenewScope>(() => (expiringCodes.length > 0 ? "expiring" : "visible"));
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);

  const targetCodes = scope === "expiring" ? expiringCodes : activeCodes;
  const targetCount = targetCodes.length;

  useEffect(() => {
    if (!open) return;
    setScope(expiringCodes.length > 0 ? "expiring" : "visible");
  }, [expiringCodes.length, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!expiresAt || targetCount === 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/licenses/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "renew",
          ids: targetCodes.map((code) => code.id),
          expiresAt: new Date(expiresAt).toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to renew licenses");
      const updated = Number(json.data?.updated ?? 0);
      toast.success(`Renewed ${updated} license${updated === 1 ? "" : "s"}`);
      setExpiresAt("");
      onRenewed();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renew licenses</DialogTitle>
          <DialogDescription>
            Apply one annual expiry date to a bounded set of visible active license codes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <RadioGroup value={scope} onValueChange={(value) => setScope(value as RenewScope)}>
            <div className="flex items-start gap-2 rounded-md border p-3">
              <RadioGroupItem id="renew-expiring" value="expiring" disabled={expiringCodes.length === 0} />
              <div className="grid gap-1">
                <Label htmlFor="renew-expiring">Expiring or expired</Label>
                <p className="text-xs text-muted-foreground">
                  {expiringCodes.length} visible active code{expiringCodes.length === 1 ? "" : "s"} due within 30 days or already expired.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-md border p-3">
              <RadioGroupItem id="renew-visible" value="visible" />
              <div className="grid gap-1">
                <Label htmlFor="renew-visible">All visible active codes</Label>
                <p className="text-xs text-muted-foreground">
                  {activeCodes.length} code{activeCodes.length === 1 ? "" : "s"} currently visible, excluding retired records.
                </p>
              </div>
            </div>
          </RadioGroup>

          <div className="space-y-1.5">
            <Label htmlFor="renew-expiry">New annual expiry</Label>
            <Input
              id="renew-expiry"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={!expiresAt || targetCount === 0}>
              {loading ? "Renewing..." : `Renew ${targetCount}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
