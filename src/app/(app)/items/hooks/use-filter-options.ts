"use client";

import { useEffect, useState } from "react";
import { parseJsonSafely } from "@/lib/errors";
import type { CategoryOption } from "@/types/category";

type Location = { id: string; name: string };
type Department = { id: string; name: string };
type Kit = { id: string; name: string };

export function useFilterOptions() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    fetch("/api/items-page-init")
      .then((res) => (res.ok ? parseJsonSafely<{
        data?: {
          user?: { role?: string };
          locations?: Location[];
          departments?: Department[];
          categories?: CategoryOption[];
          brands?: string[];
          kits?: Kit[];
        };
      }>(res) : null))
      .then((json) => {
        if (json?.data) {
          const d = json.data;
          if (d.user?.role) setUserRole(d.user.role);
          if (Array.isArray(d.locations)) setLocations(d.locations);
          if (Array.isArray(d.departments)) setDepartments(d.departments);
          if (Array.isArray(d.categories)) setCategories(d.categories);
          if (Array.isArray(d.brands)) setBrands(d.brands);
          if (Array.isArray(d.kits)) setKits(d.kits);
        }
      })
      .catch(() => {});
  }, []);

  const canEdit = userRole === "ADMIN" || userRole === "STAFF";

  // Build flat category options for filter dropdowns
  const categoryOptions = categories
    .filter((c) => !c.parentId)
    .flatMap((parent) => {
      const children = categories.filter((c) => c.parentId === parent.id);
      if (children.length === 0) return [{ value: parent.id, label: parent.name }];
      return children.map((child) => ({
        value: child.id,
        label: `${parent.name} / ${child.name}`,
      }));
    });

  return {
    locations,
    departments,
    categories,
    brands,
    kits,
    userRole,
    canEdit,
    categoryOptions,
  };
}
