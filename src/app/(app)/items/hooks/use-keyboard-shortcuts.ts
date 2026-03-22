"use client";

import { useEffect, type RefObject } from "react";

type ShortcutActions = {
  searchInputRef: RefObject<HTMLInputElement | null>;
  onClearSearch: () => void;
  onClearSelection: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  hasSelection: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
};

export function useKeyboardShortcuts({
  searchInputRef,
  onClearSearch,
  onClearSelection,
  onPreviousPage,
  onNextPage,
  hasSelection,
  canGoBack,
  canGoForward,
}: ShortcutActions) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target;
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      // "/" to focus search (only when not in an input)
      if (e.key === "/" && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Escape: clear search if focused, else clear selection
      if (e.key === "Escape") {
        if (document.activeElement === searchInputRef.current) {
          onClearSearch();
          searchInputRef.current?.blur();
        } else if (hasSelection) {
          onClearSelection();
        }
        return;
      }

      // Arrow keys for pagination (only when not in an input)
      if (!isInput) {
        if (e.key === "ArrowLeft" && canGoBack) {
          e.preventDefault();
          onPreviousPage();
          return;
        }
        if (e.key === "ArrowRight" && canGoForward) {
          e.preventDefault();
          onNextPage();
          return;
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [searchInputRef, onClearSearch, onClearSelection, onPreviousPage, onNextPage, hasSelection, canGoBack, canGoForward]);
}
