"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

type Category = {
  id: string;
  name: string;
  parentId: string | null;
  itemCount: number;
};

type TreeNode = Category & { children: TreeNode[] };

function buildTree(cats: Category[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const c of cats) {
    map.set(c.id, { ...c, children: [] });
  }
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Sort children
  for (const node of map.values()) {
    node.children.sort((a, b) => a.name.localeCompare(b.name));
  }
  return roots.sort((a, b) => a.name.localeCompare(b.name));
}

function KebabMenu({
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

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="overflow-btn"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        style={{ minHeight: 32, minWidth: 28 }}
      >
        &#8942;
      </button>
      {open && (
        <div className="ctx-menu" style={{ position: "absolute", right: 0, top: "100%", zIndex: 60 }}>
          <button className="ctx-menu-item" onClick={() => { setOpen(false); onRename(); }}>
            Rename
          </button>
          <button className="ctx-menu-item" onClick={() => { setOpen(false); onAddSub(); }}>
            Add subcategory
          </button>
          <div className="ctx-menu-sep" />
          <button
            className={`ctx-menu-item${!hasItems && !hasChildren ? " danger" : ""}`}
            onClick={() => { setOpen(false); onDelete(); }}
            disabled={hasItems || hasChildren}
            title={hasItems ? "Remove linked items first" : hasChildren ? "Remove subcategories first" : ""}
            style={hasItems || hasChildren ? { opacity: 0.4, cursor: "not-allowed" } : {}}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function CategoryRow({
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

  useEffect(() => {
    if (renaming) inputRef.current?.focus();
  }, [renaming]);

  useEffect(() => {
    if (addingSub) subInputRef.current?.focus();
  }, [addingSub]);

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
    if (!subName.trim()) {
      setAddingSub(false);
      return;
    }
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
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={saveRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveRename();
                if (e.key === "Escape") { setRenaming(false); setNewName(node.name); }
              }}
              disabled={savingRename}
              style={{
                padding: "4px 8px",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: isChild ? 400 : 600,
                width: 200,
                opacity: savingRename ? 0.6 : 1,
              }}
            />
          ) : (
            node.name
          )}
        </div>
        <div className="cat-row-actions">
          {displayCount > 0 && (
            <span className="badge badge-purple" style={{ fontSize: 11, padding: "2px 8px" }}>
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
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              placeholder="Subcategory name"
              onBlur={saveSub}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveSub();
                if (e.key === "Escape") { setAddingSub(false); setSubName(""); }
              }}
              disabled={savingSub}
              style={{
                padding: "4px 8px",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 13,
                width: 200,
                opacity: savingSub ? 0.6 : 1,
              }}
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

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [creatingRoot, setCreatingRoot] = useState(false);
  const addRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/categories");
      if (res.ok) {
        const json = await res.json();
        setCategories(json.data ?? []);
      }
    } catch { /* network error */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { if (adding) addRef.current?.focus(); }, [adding]);

  async function createRoot() {
    if (!newName.trim()) { setAdding(false); return; }
    setCreatingRoot(true);
    try {
      await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName("");
      setAdding(false);
      load();
    } catch { /* network */ }
    setCreatingRoot(false);
  }

  let tree = buildTree(categories);

  // Filter by search
  if (search) {
    const q = search.toLowerCase();
    const matchIds = new Set<string>();
    for (const c of categories) {
      if (c.name.toLowerCase().includes(q)) {
        matchIds.add(c.id);
        // Also include parent so tree structure is preserved
        if (c.parentId) matchIds.add(c.parentId);
      }
    }
    const filtered = categories.filter((c) => matchIds.has(c.id));
    tree = buildTree(filtered);
  }

  if (!sortAsc) {
    tree = [...tree].reverse();
  }

  return (
    <div className="settings-split">
      <div className="settings-sidebar">
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>Categories</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5, margin: 0 }}>
          You can store different types of inventory under different categories so your equipment is easier to navigate
        </p>
      </div>

      <div className="settings-main">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button
            className="btn btn-primary"
            onClick={() => setAdding(true)}
          >
            Add new category
          </button>
        </div>

        <div className="card">
          <div className="card-header">
            <div style={{ position: "relative", width: 260 }}>
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "var(--text-muted)" }}
              >
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
              <input
                type="text"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 12px 7px 34px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  outline: "none",
                  fontSize: 13,
                }}
              />
            </div>
          </div>

          <div className="cat-list-header">
            <button
              onClick={() => setSortAsc((v) => !v)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 4 }}
            >
              Name {sortAsc ? "\u2191\u2193" : "\u2193\u2191"}
            </button>
          </div>

          {loading ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : (
            <div className="cat-list">
              {adding && (
                <div className="cat-row" style={{ paddingLeft: 16 }}>
                  <div className="cat-row-name" style={{ fontWeight: 600 }}>
                    <input
                      ref={addRef}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Category name"
                      onBlur={createRoot}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") createRoot();
                        if (e.key === "Escape") { setAdding(false); setNewName(""); }
                      }}
                      disabled={creatingRoot}
                      style={{
                        padding: "4px 8px",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 600,
                        width: 200,
                        opacity: creatingRoot ? 0.6 : 1,
                      }}
                    />
                  </div>
                </div>
              )}
              {tree.length === 0 && !adding ? (
                <div className="empty-state">
                  {search ? "No categories match your search" : "No categories yet"}
                </div>
              ) : (
                tree.map((node) => (
                  <CategoryRow key={node.id} node={node} depth={0} onRefresh={load} />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
