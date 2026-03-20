"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth";
import {
  ClipboardListIcon,
  HistoryIcon,
  UserIcon,
} from "lucide-react";

function AppNav() {
  const pathname = usePathname();
  const { profile } = useAuth();

  const tabs = [
    { href: "/app", icon: ClipboardListIcon, label: "Protokoll" },
    { href: "/app/profil", icon: UserIcon, label: "Profil" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-bg/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-sm px-4">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors ${
                isActive ? "text-red" : "text-text-muted"
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </Link>
          );
        })}
        {profile?.role === "admin" && (
          <Link
            href="/dashboard"
            className="flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-medium text-text-muted transition-colors hover:text-red"
          >
            <svg
              className="h-5 w-5"
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
            Admin
          </Link>
        )}
      </div>
    </nav>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-bg text-text">
      <div className="mx-auto max-w-lg pb-20">{children}</div>
      <AppNav />
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
