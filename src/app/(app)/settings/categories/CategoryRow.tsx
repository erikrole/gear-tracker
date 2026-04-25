"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CornerDownRightIcon } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { handleAuthRedirect, classifyError, isAbortError } from "@/lib/errors";
import type { TreeNode } from "./types";
import KebabMenu from "./KebabMenu";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function CategoryRow({
  node,
  depth,
  onRefresh,
}: {
  node: TreeNode;
  depth: number;
  onRefresh: () => void;
}) {
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
      const res = await fetch(`/api/categories/${node.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (handleAuthRedirect(res, "/settings/categories")) return;
      if (res.ok) {
        setRenaming(false);
        toast.success(`Renamed to "${newName.trim()}"`);
        onRefresh();
      } else {
        toast.error("Failed to rename");
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You\u2019re offline. Check your connection." : "Failed to rename");
    }
    setSavingRename(false);
  }

  async function saveSub() {
    if (!subName.trim()) { setAddingSub(false); return; }
    setSavingSub(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: subName.trim(), parentId: node.id }),
      });
      if (handleAuthRedirect(res, "/settings/categories")) return;
      if (res.ok) {
        toast.success(`Added "${subName.trim()}"`);
        setSubName("");
        setAddingSub(false);
        onRefresh();
      } else {
        toast.error("Failed to create subcategory");
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You\u2019re offline. Check your connection." : "Failed to create subcategory");
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
      if (handleAuthRedirect(res, "/settings/categories")) return;
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error || "Delete failed");
      } else {
        onRefresh();
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You\u2019re offline. Check your connection." : "Failed to delete");
    }
    setDeleting(false);
  }

  const isChild = depth > 0;
  const totalChildItems = node.children.reduce((s, c) => s + c.itemCount, 0);
  const displayCount = node.itemCount + totalChildItems;

  return (
    <>
      <div className="flex items-center justify-between py-3 px-4 border-b border-border min-h-12 last:border-b-0 hover:bg-muted max-md:!pl-3 max-md:!pr-3" style={{ paddingLeft: depth > 0 ? 24 + depth * 24 : 16 }}>
        <div className={`flex items-center text-base min-w-0 ${isChild ? "font-normal" : "font-semibold"}`}>
          {isChild && <CornerDownRightIcon className="size-3.5 text-muted-foreground mr-2 shrink-0" />}
          {renaming ? (
            <Input
              ref={inputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={saveRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveRename();
                if (e.key === "Escape") { setRenaming(false); setNewName(node.name); }
              }}
              disabled={savingRename}
              className={`w-[min(200px,100%)] h-8 ${isChild ? "font-normal" : "font-semibold"} ${savingRename ? "opacity-60" : ""}`}
            />
          ) : (
            <Link
              href={`/items?category=${node.id}`}
              className="no-underline text-foreground hover:text-[var(--wi-red)] transition-colors"
            >
              {node.name}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {displayCount > 0 && (
            <Link href={`/items?category=${node.id}`} className="no-underline">
              <Badge variant="purple" size="sm" className="cursor-pointer hover:opacity-80 transition-opacity">
                {displayCount} item{displayCount !== 1 ? "s" : ""}
              </Badge>
            </Link>
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
        <div className="flex items-center justify-between py-3 px-4 border-b border-border min-h-12 last:border-b-0 hover:bg-muted" style={{ paddingLeft: 24 + (depth + 1) * 24 }}>
          <div className="flex items-center text-base min-w-0">
            <CornerDownRightIcon className="size-3.5 text-muted-foreground mr-2 shrink-0" />
            <Input
              ref={subInputRef}
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              placeholder="Subcategory name"
              onBlur={saveSub}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveSub();
                if (e.key === "Escape") { setAddingSub(false); setSubName(""); }
              }}
              disabled={savingSub}
              className={`w-[min(200px,100%)] h-8 ${savingSub ? "opacity-60" : ""}`}
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
