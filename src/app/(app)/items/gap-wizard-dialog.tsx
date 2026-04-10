"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AssetImage } from "@/components/AssetImage";
import { CategoryCombobox, FormCombobox } from "@/components/FormCombobox";
import { handleAuthRedirect } from "@/lib/errors";
import type { CategoryOption } from "@/types/category";

type GapField = "category" | "department";

type GapItem = {
  id: string;
  assetTag: string;
  name: string | null;
  brand: string;
  model: string;
  imageUrl: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryOption[];
  departments: { id: string; name: string }[];
  onAssigned?: () => void;
}

export function GapWizardDialog({ open, onOpenChange, categories, departments, onAssigned }: Props) {
  const [stage, setStage] = useState<"pick" | "wizard" | "done">("pick");
  const [field, setField] = useState<GapField | null>(null);
  const [counts, setCounts] = useState<{ category: number | null; department: number | null }>({
    category: null,
    department: null,
  });
  const [item, setItem] = useState<GapItem | null>(null);
  const [total, setTotal] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [assigned, setAssigned] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedValue, setSelectedValue] = useState("");

  // Fetch missing-field counts for the pick screen
  useEffect(() => {
    if (!open) return;
    setCounts({ category: null, department: null });
    Promise.all([
      fetch("/api/assets?missing=category&limit=1")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j?.total ?? 0)
        .catch(() => 0),
      fetch("/api/assets?missing=department&limit=1")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j?.total ?? 0)
        .catch(() => 0),
    ]).then(([cat, dep]) => setCounts({ category: cat, department: dep }));
  }, [open]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setStage("pick");
      setField(null);
      setSkipped(0);
      setAssigned(0);
      setSelectedValue("");
      setItem(null);
    }
  }, [open]);

  const fetchCurrent = useCallback(async (f: GapField, skipCount: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/assets?missing=${f}&limit=1&offset=${skipCount}`);
      if (handleAuthRedirect(res)) return;
      const json = await res.json();
      const newTotal: number = json.total ?? 0;
      setTotal(newTotal);
      const items: GapItem[] = json.data ?? [];
      if (items.length === 0 || skipCount >= newTotal) {
        setStage("done");
      } else {
        setItem(items[0]);
        setSelectedValue("");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const startWizard = useCallback(
    (f: GapField) => {
      setField(f);
      setStage("wizard");
      setSkipped(0);
      setAssigned(0);
      fetchCurrent(f, 0);
    },
    [fetchCurrent]
  );

  const handleSkip = useCallback(() => {
    if (!field || !item) return;
    const newSkipped = skipped + 1;
    setSkipped(newSkipped);
    if (newSkipped >= total) {
      setStage("done");
    } else {
      fetchCurrent(field, newSkipped);
    }
  }, [field, item, skipped, total, fetchCurrent]);

  const handleAssign = useCallback(async () => {
    if (!field || !item || !selectedValue) return;
    setSaving(true);
    try {
      const body = field === "category" ? { categoryId: selectedValue } : { departmentId: selectedValue };
      const res = await fetch(`/api/assets/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        toast.error("Failed to update item");
        return;
      }
      const newAssigned = assigned + 1;
      setAssigned(newAssigned);
      onAssigned?.();
      // The assigned item drops out of the missing set; total decreases by 1
      const newTotal = total - 1;
      if (skipped >= newTotal) {
        setStage("done");
      } else {
        fetchCurrent(field, skipped);
      }
    } finally {
      setSaving(false);
    }
  }, [field, item, selectedValue, assigned, skipped, total, fetchCurrent, onAssigned]);

  const handlePickAnother = useCallback(() => {
    setStage("pick");
    setField(null);
    setSkipped(0);
    setAssigned(0);
    setSelectedValue("");
    setItem(null);
    // Re-fetch counts
    setCounts({ category: null, department: null });
    Promise.all([
      fetch("/api/assets?missing=category&limit=1")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j?.total ?? 0)
        .catch(() => 0),
      fetch("/api/assets?missing=department&limit=1")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j?.total ?? 0)
        .catch(() => 0),
    ]).then(([cat, dep]) => setCounts({ category: cat, department: dep }));
  }, []);

  const departmentOptions = departments.map((d) => ({ value: d.id, label: d.name }));
  const remaining = Math.max(0, total - skipped);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {/* ── Pick field ── */}
        {stage === "pick" && (
          <>
            <DialogHeader>
              <DialogTitle>Fill data gaps</DialogTitle>
              <DialogDescription>
                Pick a field to fill in — items missing it will appear one at a time.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 mt-1">
              {(["category", "department"] as GapField[]).map((f) => {
                const count = counts[f];
                const label = f === "category" ? "Category" : "Department";
                const isEmpty = count === 0;
                return (
                  <button
                    key={f}
                    onClick={() => !isEmpty && count !== null ? startWizard(f) : undefined}
                    disabled={count === null || isEmpty}
                    className="flex items-center justify-between rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div>
                      <div className="font-medium text-sm">{label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {count === null
                          ? "Counting…"
                          : isEmpty
                          ? "All items have a value"
                          : `${count} item${count !== 1 ? "s" : ""} missing`}
                      </div>
                    </div>
                    {count !== null && !isEmpty && (
                      <Badge variant="secondary">{count}</Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ── Wizard ── */}
        {stage === "wizard" && field && (
          <>
            <DialogHeader>
              <DialogTitle>Assign {field === "category" ? "category" : "department"}</DialogTitle>
              <DialogDescription>
                {loading
                  ? "Loading…"
                  : `${remaining} remaining · ${assigned} assigned this session`}
              </DialogDescription>
            </DialogHeader>

            {loading || !item ? (
              <div className="flex flex-col gap-3 py-2">
                <Skeleton className="h-[68px] w-full rounded-lg" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : (
              <div className="flex flex-col gap-4 py-1">
                {/* Item card */}
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <AssetImage src={item.imageUrl} alt={item.assetTag} size={48} className="shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{item.assetTag}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[item.brand, item.model].filter(Boolean).join(" ")}
                    </div>
                    {item.name && (
                      <div className="text-xs text-muted-foreground truncate">{item.name}</div>
                    )}
                  </div>
                </div>

                {/* Picker */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium capitalize">{field}</label>
                  {field === "category" ? (
                    <CategoryCombobox
                      value={selectedValue}
                      onValueChange={setSelectedValue}
                      categories={categories}
                    />
                  ) : (
                    <FormCombobox
                      value={selectedValue}
                      onValueChange={setSelectedValue}
                      options={departmentOptions}
                      placeholder="Select department…"
                    />
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <Button variant="ghost" size="sm" onClick={handleSkip} disabled={saving}>
                    Skip
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setStage("done")}>
                      Stop
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAssign}
                      disabled={!selectedValue || saving}
                    >
                      {saving ? "Saving…" : "Assign & next"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Done ── */}
        {stage === "done" && (
          <>
            <DialogHeader>
              <DialogTitle>All done</DialogTitle>
              <DialogDescription>
                {assigned > 0
                  ? `You assigned ${assigned} item${assigned !== 1 ? "s" : ""}.`
                  : "No items were changed."}
                {skipped > 0 && ` ${skipped} skipped.`}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="outline" onClick={handlePickAnother}>
                Fill another gap
              </Button>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
