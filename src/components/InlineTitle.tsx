"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function InlineTitle({
  value,
  canEdit,
  onSave,
  className,
  placeholder,
}: {
  value: string;
  canEdit: boolean;
  onSave: (v: string) => Promise<void>;
  className?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  async function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed || trimmed === value) { setDraft(value); return; }
    setStatus("saving");
    try {
      await onSave(trimmed);
      setStatus("saved");
      timerRef.current = setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setDraft(value);
      setStatus("error");
      timerRef.current = setTimeout(() => setStatus("idle"), 3000);
    }
  }

  if (!canEdit) {
    return <span className={className}>{value || placeholder}</span>;
  }

  const statusIndicator = status !== "idle" && (
    <span className={cn(
      "inline-flex items-center gap-1 text-xs ml-2 align-middle transition-opacity duration-300",
      status === "saving" && "text-muted-foreground",
      status === "saved" && "text-[var(--green-text)]",
      status === "error" && "text-destructive",
    )}>
      {status === "saving" && <Spinner className="size-3.5" />}
      {status === "saved" && <Check className="size-3.5" />}
      {status === "error" && <X className="size-3.5" />}
    </span>
  );

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        aria-label={placeholder || "Edit title"}
        className={`${className} bg-transparent border-none outline-none ring-1 ring-ring rounded px-1 -mx-1`}
      />
    );
  }

  return (
    <span className="inline-flex items-center">
      <span
        role="button"
        tabIndex={0}
        aria-label={`${value || placeholder} — click to edit`}
        className={`${className} cursor-pointer hover:bg-muted/60 rounded px-1 -mx-1 transition-colors`}
        onClick={() => setEditing(true)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setEditing(true); }}
        title="Click to edit"
      >
        {value || <span className="text-muted-foreground">{placeholder}</span>}
      </span>
      {statusIndicator}
    </span>
  );
}
