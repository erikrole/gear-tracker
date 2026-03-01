"use client";

import { createContext, useCallback, useContext, useState } from "react";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextType = {
  toast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`toast toast-${t.type}`}
              onClick={() => dismiss(t.id)}
            >
              <span className="toast-icon">
                {t.type === "success" ? "\u2713" : t.type === "error" ? "\u2717" : "\u2139"}
              </span>
              <span className="toast-message">{t.message}</span>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
