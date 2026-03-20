"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { Category } from "./types";
import { buildTree } from "./types";
import CategoryRow from "./CategoryRow";

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
        <h2 className="settings-title">Categories</h2>
        <p className="settings-desc">
          Organize your inventory under categories and subcategories to make equipment easier to find and manage.
        </p>
      </div>

      <div className="settings-main">
        <div className="settings-action-row">
          <Button onClick={() => setAdding(true)}>
            Add new category
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="cat-search-wrap">
              <svg viewBox="0 0 20 20" fill="currentColor" className="cat-search-icon">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
              <input
                type="text"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="cat-search-input"
                aria-label="Search categories"
              />
            </div>
          </CardHeader>

          <div className="cat-list-header">
            <button onClick={() => setSortAsc((v) => !v)} className="cat-sort-btn">
              Name {sortAsc ? "\u2191\u2193" : "\u2193\u2191"}
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10"><Spinner className="size-8" /></div>
          ) : (
            <div className="cat-list">
              {adding && (
                <div className="cat-row" style={{ paddingLeft: 16 }}>
                  <div className="cat-row-name" style={{ fontWeight: 600 }}>
                    <input
                      ref={addRef}
                      className="cat-inline-input"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Category name"
                      onBlur={createRoot}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") createRoot();
                        if (e.key === "Escape") { setAdding(false); setNewName(""); }
                      }}
                      disabled={creatingRoot}
                      style={{ fontWeight: 600, opacity: creatingRoot ? 0.6 : 1 }}
                    />
                  </div>
                </div>
              )}
              {tree.length === 0 && !adding ? (
                <div className="py-10 px-5 text-center text-muted-foreground">
                  {search ? "No categories match your search" : "No categories yet"}
                </div>
              ) : (
                tree.map((node) => (
                  <CategoryRow key={node.id} node={node} depth={0} onRefresh={load} />
                ))
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
