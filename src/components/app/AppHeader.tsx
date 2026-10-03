"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { AvatarMenu } from "./AvatarMenu";

const TITLES: Record<string, string> = {
  "/app/profil": "Profil",
  "/app/bestand": "Bestand",
  "/app/verlauf": "Verlauf",
};

export function AppHeader() {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? "NEF";

  return (
    <header
      className="flex shrink-0 items-center gap-1 border-b border-white/10 bg-[#09090b] pr-2 pl-1"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <Link
        href="/app"
        className="flex h-11 items-center gap-1 pr-2 pl-2 text-sm text-zinc-400"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Zurück
      </Link>
      <span className="flex-1 text-center text-sm font-semibold text-zinc-100">{title}</span>
      <AvatarMenu variant="bar" />
    </header>
  );
}
