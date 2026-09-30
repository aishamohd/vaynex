"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { create } from "zustand";
import { cn } from "@/lib/utils/cn";

type ToastTone = "ok" | "error" | "info";
interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
}

let seq = 0;
const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 5000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = {
  ok: (title: string, message?: string) => useToasts.getState().push({ tone: "ok", title, message }),
  error: (title: string, message?: string) => useToasts.getState().push({ tone: "error", title, message }),
  info: (title: string, message?: string) => useToasts.getState().push({ tone: "info", title, message }),
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed bottom-10 right-4 z-[60] flex w-[360px] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = t.tone === "ok" ? CheckCircle2 : t.tone === "error" ? AlertTriangle : Info;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              className={cn(
                "pointer-events-auto flex gap-3 border bg-panel px-3 py-2.5",
                t.tone === "ok" && "border-green/50",
                t.tone === "error" && "border-red/50",
                t.tone === "info" && "border-cyan/40",
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  t.tone === "ok" && "text-green",
                  t.tone === "error" && "text-red",
                  t.tone === "info" && "text-cyan",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs uppercase tracking-wider text-ink">{t.title}</p>
                {t.message && <p className="mt-0.5 text-xs text-muted">{t.message}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="text-dim hover:text-ink" aria-label="Dismiss">
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
