"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import type { TreeNode } from "./types";
import KebabMenu from "./KebabMenu";

export default function CategoryRow({
  node,
  depth,
  onRefresh,
}: {
  node: TreeNode;
  depth: number;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(node.name);
  const [addingSub, setAddingSub] = useState(false);
  const [subName, setSubName] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [savingSub, setSavingSub] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const subInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (renaming) inputRef.current?.focus(); }, [renaming]);
  useEffect(() => { if (addingSub) subInputRef.current?.focus(); }, [addingSub]);

  async function saveRename() {
    if (!newName.trim() || newName.trim() === node.name) {
      setRenaming(false);
      setNewName(node.name);
      return;
    }
    setSavingRename(true);
    try {
      await fetch(`/api/categories/${node.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      setRenaming(false);
      onRefresh();
    } catch {
      toast("Failed to rename", "error");
    }
    setSavingRename(false);
  }

  async function saveSub() {
    if (!subName.trim()) { setAddingSub(false); return; }
    setSavingSub(true);
    try {
      await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: subName.trim(), parentId: node.id }),
      });
      setSubName("");
      setAddingSub(false);
      onRefresh();
    } catch {
      toast("Failed to create subcategory", "error");
    }
    setSavingSub(false);
  }

  async function handleDelete() {
    if (deleting) return;
    const ok = await confirm({
      title: "Delete category",
      message: `Delete "${node.name}"? Items in this category will be uncategorized.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/categories/${node.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        toast(json.error || "Delete failed", "error");
      } else {
        onRefresh();
      }
    } catch {
      toast("Failed to delete", "error");
    }
    setDeleting(false);
  }

  const isChild = depth > 0;
  const totalChildItems = node.children.reduce((s, c) => s + c.itemCount, 0);
  const displayCount = node.itemCount + totalChildItems;

  return (
    <>
      <div className="cat-row" style={{ paddingLeft: depth > 0 ? 24 + depth * 24 : 16 }}>
        <div className="cat-row-name" style={{ fontWeight: isChild ? 400 : 600 }}>
          {isChild && <span style={{ color: "var(--text-muted)", marginRight: 8 }}>{"\u21AA"}</span>}
          {renaming ? (
            <input
              ref={inputRef}
              className="cat-inline-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={saveRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveRename();
                if (e.key === "Escape") { setRenaming(false); setNewName(node.name); }
              }}
              disabled={savingRename}
              style={{ fontWeight: isChild ? 400 : 600, opacity: savingRename ? 0.6 : 1 }}
            />
          ) : (
            node.name
          )}
        </div>
        <div className="cat-row-actions">
          {displayCount > 0 && (
            <span className="badge-sm badge-purple">
              {displayCount} item{displayCount !== 1 ? "s" : ""}
            </span>
          )}
          <KebabMenu
            onRename={() => { setNewName(node.name); setRenaming(true); }}
            onAddSub={() => setAddingSub(true)}
            onDelete={handleDelete}
            hasItems={node.itemCount > 0}
            hasChildren={node.children.length > 0}
          />
        </div>
      </div>

      {addingSub && (
        <div className="cat-row" style={{ paddingLeft: 24 + (depth + 1) * 24 }}>
          <div className="cat-row-name">
            <span style={{ color: "var(--text-muted)", marginRight: 8 }}>{"\u21AA"}</span>
            <input
              ref={subInputRef}
              className="cat-inline-input"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              placeholder="Subcategory name"
              onBlur={saveSub}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveSub();
                if (e.key === "Escape") { setAddingSub(false); setSubName(""); }
              }}
              disabled={savingSub}
              style={{ opacity: savingSub ? 0.6 : 1 }}
            />
          </div>
        </div>
      )}

      {node.children.map((child) => (
        <CategoryRow key={child.id} node={child} depth={depth + 1} onRefresh={onRefresh} />
      ))}
    </>
  );
}
