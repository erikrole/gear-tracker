"use client";

import { useEffect, useRef, useState } from "react";

export default function KebabMenu({
  onRename,
  onAddSub,
  onDelete,
  hasItems,
  hasChildren,
}: {
  onRename: () => void;
  onAddSub: () => void;
  onDelete: () => void;
  hasItems: boolean;
  hasChildren: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const canDelete = !hasItems && !hasChildren;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="overflow-btn"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-label="Category actions"
      >
        &#8942;
      </button>
      {open && (
        <div className="ctx-menu" style={{ position: "absolute", right: 0, top: "100%" }}>
          <button className="ctx-menu-item" onClick={() => { setOpen(false); onRename(); }}>
            Rename
          </button>
          <button className="ctx-menu-item" onClick={() => { setOpen(false); onAddSub(); }}>
            Add subcategory
          </button>
          <div className="ctx-menu-sep" />
          <button
            className={`ctx-menu-item${canDelete ? " danger" : ""}`}
            onClick={() => { if (canDelete) { setOpen(false); onDelete(); } }}
            disabled={!canDelete}
            title={hasItems ? "Remove linked items first" : hasChildren ? "Remove subcategories first" : ""}
            style={!canDelete ? { opacity: 0.4, cursor: "not-allowed" } : {}}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
