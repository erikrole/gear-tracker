"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, SearchIcon, WifiOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { FadeUp } from "@/components/ui/motion";
import { useFetch } from "@/hooks/use-fetch";
import { handleAuthRedirect, classifyError, isAbortError } from "@/lib/errors";
import type { Category } from "./types";
import { buildTree } from "./types";
import CategoryRow from "./CategoryRow";

export default function CategoriesPage() {
  const { data: categories, loading, error, reload } = useFetch<Category[]>({
    url: "/api/categories",
    returnTo: "/settings/categories",
    transform: (json) => (json.data as Category[]) ?? [],
  });
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [creatingRoot, setCreatingRoot] = useState(false);
  const addRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (adding) addRef.current?.focus(); }, [adding]);

  async function createRoot() {
    if (!newName.trim()) { setAdding(false); return; }
    setCreatingRoot(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (handleAuthRedirect(res, "/settings/categories")) return;
      setNewName("");
      setAdding(false);
      reload();
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(kind === "network" ? "You\u2019re offline. Check your connection." : "Failed to create category \u2014 please try again");
    }
    setCreatingRoot(false);
  }

  let tree = buildTree(categories ?? []);

  // Filter by search
  if (search) {
    const q = search.toLowerCase();
    const matchIds = new Set<string>();
    for (const c of (categories ?? [])) {
      if (c.name.toLowerCase().includes(q)) {
        matchIds.add(c.id);
        if (c.parentId) matchIds.add(c.parentId);
      }
    }
    const filtered = (categories ?? []).filter((c) => matchIds.has(c.id));
    tree = buildTree(filtered);
  }

  if (!sortAsc) {
    tree = [...tree].reverse();
  }

  const ErrorIcon = error === "network" ? WifiOff : AlertTriangle;
  const errorMessage =
    error === "network"
      ? "Unable to reach the server. Check your connection and try again."
      : "Something went wrong loading categories. Please try again.";

  return (
    <FadeUp>
    <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-md:grid-cols-1 max-md:gap-4">
      <div className="sticky top-20 max-md:static">
        <h2 className="text-2xl font-bold mb-2">Categories</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Organize your inventory under categories and subcategories to make equipment easier to find and manage.
        </p>
      </div>

      <div className="min-w-0">
        <div className="flex justify-end mb-3">
          <Button onClick={() => setAdding(true)}>
            Add new category
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="relative w-full max-w-[260px]">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9"
                aria-label="Search categories"
              />
            </div>
          </CardHeader>

          <div className="px-4 py-2.5 border-b border-border">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSortAsc((v) => !v)}
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wider h-auto px-0 hover:bg-transparent hover:text-foreground"
                >
                  Name {sortAsc ? "↑↓" : "↓↑"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{sortAsc ? "Sort Z\u2013A" : "Sort A\u2013Z"}</TooltipContent>
            </Tooltip>
          </div>

          {loading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-3 min-h-[48px]"
                >
                  <div className="flex items-center gap-2">
                    {i === 1 || i === 3 ? (
                      <Skeleton className="size-4 rounded-sm" />
                    ) : null}
                    <Skeleton
                      className={`h-4 rounded ${i % 2 === 0 ? "w-[140px]" : "w-[100px]"}`}
                    />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-12 px-5 text-center">
              <ErrorIcon className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground max-w-xs">
                {errorMessage}
              </p>
              <Button variant="outline" size="sm" onClick={reload}>
                Retry
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {adding && (
                <div className="flex items-center justify-between pl-4 pr-4 py-3 min-h-[48px] border-b border-border">
                  <div className="flex items-center font-semibold">
                    <Input
                      ref={addRef}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Category name"
                      className="w-full max-w-[200px] font-semibold"
                      onBlur={createRoot}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") createRoot();
                        if (e.key === "Escape") { setAdding(false); setNewName(""); }
                      }}
                      disabled={creatingRoot}
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
                  <CategoryRow key={node.id} node={node} depth={0} onRefresh={reload} />
                ))
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
    </FadeUp>
  );
}
