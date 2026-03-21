"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Save Status Types ─────────────────────────────────── */

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/* ── useSaveField Hook ─────────────────────────────────── */

export function useSaveField(onSave: (v: string) => Promise<void>) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const save = useCallback(
    async (value: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setStatus("saving");
      try {
        await onSave(value);
        setStatus("saved");
        timerRef.current = setTimeout(() => setStatus("idle"), 2000);
      } catch {
        setStatus("error");
        timerRef.current = setTimeout(() => setStatus("idle"), 3000);
      }
    },
    [onSave],
  );

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus("idle");
  }, []);

  return { status, save, reset };
}

/* ── SaveStatusIndicator ───────────────────────────────── */

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs shrink-0 transition-opacity duration-300",
        status === "saving" && "text-muted-foreground",
        status === "saved" && "text-green-600 dark:text-green-400",
        status === "error" && "text-destructive",
      )}
    >
      {status === "saving" && (
        <>
          <Spinner className="size-3" />
          <span>Saving</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="size-3" />
          <span>Saved</span>
        </>
      )}
      {status === "error" && (
        <>
          <X className="size-3" />
          <span>Failed</span>
        </>
      )}
    </span>
  );
}

/* ── SaveableField Layout ──────────────────────────────── */

export function SaveableField({
  label,
  status = "idle",
  className,
  children,
}: {
  label: string;
  status?: SaveStatus;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/50 last:border-b-0",
        className,
      )}
    >
      <Label className="text-sm font-medium text-muted-foreground shrink-0 min-w-[100px]">
        {label}
      </Label>
      <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
        <div className="flex-1 min-w-0">{children}</div>
        <div className="w-[60px] flex justify-end">
          <SaveStatusIndicator status={status} />
        </div>
      </div>
    </div>
  );
}
