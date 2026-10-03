"use client";

import { useEffect, type ReactNode } from "react";
import { XIcon } from "lucide-react";

export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  tall,
  z = 3,
  hideClose,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  tall?: boolean;
  z?: 2 | 3;
  hideClose?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const layer = z === 2 ? "z2" : "z3";
  return (
    <>
      <button type="button" className={`bd ${layer} show`} aria-label="Schließen" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`sheet ${layer} show${tall ? " tall" : ""}`}
      >
        <div className="grab" />
        <div className="sh-h">
          <div className="tx">
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {!hideClose && (
            <button type="button" className="x" aria-label="Schließen" onClick={onClose}>
              <XIcon className="ic" />
            </button>
          )}
        </div>
        <div className="sh-b">{children}</div>
        {footer && <div className="sh-f">{footer}</div>}
      </div>
    </>
  );
}
