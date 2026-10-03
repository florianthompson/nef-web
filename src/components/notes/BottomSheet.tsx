"use client";

import { useEffect, type ReactNode } from "react";
import { XIcon } from "lucide-react";

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  tall,
  z = 50,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  tall?: boolean;
  z?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: z }}>
      <button
        type="button"
        aria-label="Schließen"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex w-full max-w-lg flex-col rounded-t-xl border border-b-0 border-border bg-bg ${
          tall ? "h-[88dvh]" : "max-h-[88dvh]"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-zinc-700" />
        <div className="flex shrink-0 items-center gap-3 px-4 pt-3 pb-2">
          <h2 className="flex-1 text-xl font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-zinc-400"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="shrink-0 border-t border-border px-4 pt-2 pb-4">{footer}</div>}
      </div>
    </div>
  );
}
