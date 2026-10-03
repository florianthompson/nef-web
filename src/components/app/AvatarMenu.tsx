"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { canSeeBestand } from "@/lib/featureFlags";
import { getInitials } from "@/lib/utils";

export function AvatarMenu({ variant = "v19" }: { variant?: "v19" | "bar" }) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const initials = getInitials(profile);
  const bestand = canSeeBestand(user?.id);
  const admin = profile?.role === "admin";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const links = [
    { href: "/app/profil", label: "Profil" },
    ...(bestand ? [{ href: "/app/bestand", label: "Bestand" }] : []),
    ...(admin ? [{ href: "/dashboard", label: "Admin" }] : []),
  ];

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className={
          variant === "v19"
            ? `av${open ? " on" : ""}`
            : "-mr-1.5 flex h-11 w-11 items-center justify-center"
        }
        aria-label="Menü"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {variant === "v19" ? (
          initials || "…"
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-xs font-semibold text-text-muted">
            {initials || "…"}
          </span>
        )}
      </button>
      {open &&
        (variant === "v19" ? (
          <div className="menu" role="menu">
            {links.map((l) => (
              <Link key={l.href} href={l.href} role="menuitem" onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
          </div>
        ) : (
          <div
            role="menu"
            className="absolute top-11 right-0 z-50 min-w-[180px] overflow-hidden rounded-xl border border-white/10 bg-zinc-800 shadow-xl"
          >
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block px-4 py-3 text-[15px] text-zinc-100 no-underline hover:bg-white/5"
              >
                {l.label}
              </Link>
            ))}
          </div>
        ))}
    </div>
  );
}
