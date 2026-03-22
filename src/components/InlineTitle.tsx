"use client";

import { useEffect, useRef, useState } from "react";

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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  async function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed || trimmed === value) { setDraft(value); return; }
    try { await onSave(trimmed); } catch { setDraft(value); }
  }

  if (!canEdit) {
    return <span className={className}>{value || placeholder}</span>;
  }

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
  );
}
