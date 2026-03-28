"use client";

import { toast as sonnerToast } from "sonner";

type ToastType = "success" | "error" | "warning" | "info";

/**
 * Drop-in replacement for the old useToast() hook.
 * Returns { toast(message, type?) } — same API, powered by Sonner.
 * No provider needed; just render <Toaster /> once in the layout.
 */
export function useToast() {
  function toast(message: string, type: ToastType = "info") {
    switch (type) {
      case "success":
        sonnerToast.success(message);
        break;
      case "error":
        sonnerToast.error(message);
        break;
      case "warning":
        sonnerToast.warning(message);
        break;
      case "info":
        sonnerToast.info(message);
        break;
    }
  }

  return { toast };
}
