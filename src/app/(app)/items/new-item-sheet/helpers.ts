"use client";

import { useEffect, useRef, useState } from "react";
import type { ParentSearchResult } from "./types";

export function generateQrCode(): string {
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  const hex = Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `QR-${hex}`;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);
  return isMobile;
}

export function getFiscalYearOptions(): string[] {
  const now = new Date();
  const calYear = now.getFullYear();
  const currentFY = now.getMonth() >= 6 ? calYear + 1 : calYear;
  const options: string[] = [];
  for (let y = currentFY - 5; y <= currentFY + 2; y++) {
    options.push(`FY${String(y).slice(-2)}`);
  }
  return options.reverse();
}

export const FISCAL_YEARS = getFiscalYearOptions();

export function useParentSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ParentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/assets?q=${encodeURIComponent(query)}&limit=5`);
        const json = await res.json();
        if (res.ok) {
          setResults(
            (json.data || []).map((a: Record<string, unknown>) => ({
              id: a.id,
              assetTag: a.assetTag,
              name: a.name,
              brand: a.brand,
              model: a.model,
            }))
          );
        }
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return {
    query,
    setQuery,
    results,
    searching,
    clear: () => {
      setQuery("");
      setResults([]);
    },
  };
}
