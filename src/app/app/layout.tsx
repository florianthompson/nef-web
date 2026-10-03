"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppHeader } from "@/components/app/AppHeader";
import { canSeeBestand } from "@/lib/featureFlags";
import {
  ClipboardListIcon,
  PillIcon,
  StickyNoteIcon,
} from "lucide-react";

type AppTab = {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isAdmin?: boolean;
};

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
      />
    </svg>
  );
}

function useAppTabs(): { tabs: AppTab[]; ready: boolean } {
  const { user, profile, loading } = useAuth();

  const tabs: AppTab[] = [
    { href: "/app", icon: ClipboardListIcon, label: "Protokoll" },
    { href: "/app/notizen", icon: StickyNoteIcon, label: "Notizen" },
    ...(canSeeBestand(user?.id)
      ? [{ href: "/app/bestand", icon: PillIcon, label: "Bestand" }]
      : []),
    ...(profile?.role === "admin"
      ? [{ href: "/dashboard", icon: DashboardIcon, label: "Admin", isAdmin: true }]
      : []),
  ];

  return { tabs, ready: !loading };
}

function AppNav({ tabs }: { tabs: AppTab[] }) {
  const pathname = usePathname();

  return (
    <nav className="shrink-0 border-t border-border bg-bg/95 backdrop-blur-sm" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mx-auto flex max-w-sm px-4">
        {tabs.map((tab) => {
          const isActive = tab.isAdmin
            ? false
            : tab.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors ${
                isActive ? "text-red" : "text-text-muted"
              } ${tab.isAdmin ? "hover:text-red" : ""}`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { tabs, ready } = useAppTabs();
  const showNav = ready && tabs.length >= 2;
  // the notes feed scrolls internally and pins its composer to the bottom
  const fill = usePathname().startsWith("/app/notizen");

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-bg text-text">
      <AppHeader />
      <div className={`flex-1 overscroll-none ${fill ? "min-h-0 overflow-hidden" : "overflow-y-auto"}`}>
        <div
          className={`mx-auto max-w-lg ${fill ? "h-full" : ""} ${
            fill
              ? ""
              : showNav
                ? "pb-6"
                : "pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          }`}
        >
          {children}
        </div>
      </div>
      {showNav && <AppNav tabs={tabs} />}
    </div>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
