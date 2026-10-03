"use client";

export type ToastState = { id: number; message: string; undo?: () => void } | null;

export function UndoToast({
  toast,
  onDismiss,
  bottom,
}: {
  toast: ToastState;
  onDismiss: () => void;
  bottom: number;
}) {
  if (!toast) return null;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-4"
      style={{ bottom }}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto flex min-h-11 max-w-sm items-center gap-3 rounded-xl border border-border bg-zinc-800 py-1 pr-1 pl-4 text-sm text-zinc-100 shadow-lg">
        <span>{toast.message}</span>
        {toast.undo && (
          <button
            type="button"
            onClick={() => {
              toast.undo?.();
              onDismiss();
            }}
            className="min-h-11 px-3 font-medium underline underline-offset-4"
          >
            Rückgängig
          </button>
        )}
      </div>
    </div>
  );
}
