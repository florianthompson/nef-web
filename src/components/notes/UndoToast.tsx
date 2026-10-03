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
  return (
    <div
      className={`toast${toast ? " show" : ""}`}
      style={{ bottom }}
      role="status"
      aria-live="polite"
    >
      <span>{toast?.message ?? ""}</span>
      {toast?.undo && (
        <button
          type="button"
          onClick={() => {
            toast.undo?.();
            onDismiss();
          }}
        >
          Rückgängig
        </button>
      )}
    </div>
  );
}
