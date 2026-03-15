"use client";

import { useEffect, useRef, useState } from "react";

export function FilterChip({
  label,
  value,
  displayValue,
  options,
  onSelect,
  onClear,
}: {
  label: string;
  value: string;
  displayValue?: string;
  options: { value: string; label: string }[];
  onSelect: (v: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const active = value !== "";

  return (
    <div ref={ref} className="filter-chip-wrap">
      <button
        type="button"
        className={`filter-chip ${active ? "filter-chip-active" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="filter-chip-label">{label}{active && ":"}</span>
        {active && <span className="filter-chip-value">{displayValue || value}</span>}
        {active ? (
          <span
            className="filter-chip-clear"
            onClick={(e) => { e.stopPropagation(); onClear(); setOpen(false); }}
          >&times;</span>
        ) : (
          <span className="filter-chip-chevron">{"\u25BE"}</span>
        )}
      </button>
      {open && (
        <div className="filter-chip-dropdown">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`filter-chip-option ${opt.value === value ? "filter-chip-option-active" : ""}`}
              onClick={() => { onSelect(opt.value); setOpen(false); }}
            >
              {opt.label}
            </button>
          ))}
          {options.length === 0 && (
            <div className="filter-chip-empty">No options</div>
          )}
        </div>
      )}
    </div>
  );
}
