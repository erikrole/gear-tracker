"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
};

type ConfirmContextType = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextType>({
  confirm: () => Promise.resolve(false),
});

export function useConfirm() {
  return useContext(ConfirmContext).confirm;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setState(options);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function handleClose(result: boolean) {
    setState(null);
    resolveRef.current?.(result);
    resolveRef.current = null;
  }

  // Focus trap + Escape key + focus restoration
  useEffect(() => {
    if (!state) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { handleClose(false); return; }

      if (e.key === "Tab") {
        const panel = overlayRef.current?.querySelector(".confirm-panel");
        if (!panel) return;
        const focusable = panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("keydown", handleKey);
      previousFocusRef.current?.focus();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div
          ref={overlayRef}
          className="modal-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose(false);
          }}
        >
          <div className="confirm-panel">
            <h3 id="confirm-dialog-title" className="confirm-title">{state.title}</h3>
            <p className="confirm-message">{state.message}</p>
            <div className="confirm-actions">
              <button className="btn" onClick={() => handleClose(false)}>
                {state.cancelLabel || "Cancel"}
              </button>
              <button
                className={`btn ${state.variant === "danger" ? "btn-danger" : "btn-primary"}`}
                onClick={() => handleClose(true)}
                autoFocus
              >
                {state.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
