"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeftIcon, UserIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn, getInitials } from "@/lib/utils";

export function AppHeader() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const onProfile = pathname.startsWith("/app/profil");
  const initials = getInitials(profile);

  return (
    <header
      className="shrink-0 border-b border-border bg-bg/95 backdrop-blur-sm"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex h-12 max-w-lg items-center justify-between px-4">
        {onProfile ? (
          <Link
            href="/app"
            className="-ml-2 flex h-11 items-center gap-1 pr-3 pl-1 text-sm text-text-muted transition-colors hover:text-text"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Zurück
          </Link>
        ) : (
          <span className="rounded-lg bg-red px-2 py-1 font-mono text-[11px] font-bold text-white">
            NEF
          </span>
        )}
        <Link
          href="/app/profil"
          aria-label="Profil öffnen"
          aria-current={onProfile ? "page" : undefined}
          className="-mr-1.5 flex h-11 w-11 items-center justify-center"
        >
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-xs font-semibold text-text-muted",
              onProfile && "border-red text-red ring-1 ring-red"
            )}
          >
            {initials || <UserIcon className="h-4 w-4" />}
          </span>
        </Link>
      </div>
    </header>
  );
}
