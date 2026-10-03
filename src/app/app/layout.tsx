"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "@/lib/auth";
import { AppHeader } from "@/components/app/AppHeader";
import "./v19.css";

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const home = pathname === "/app" || pathname === "/app/notizen";

  return (
    <div className="v19-root">
      <div id="nef">
        {home ? (
          children
        ) : (
          <>
            <AppHeader />
            <div className="subpage">{children}</div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
