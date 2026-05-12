"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  ClipboardListIcon,
  StickyNoteIcon,
  LogOutIcon,
} from "lucide-react";
import { DEMO_USER } from "@/lib/demo-data";

function DemoSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link
          href="/"
          className="font-mono text-sm font-bold tracking-tight text-red"
        >
          NEF //
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Protokolle</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/demo"}
                render={<Link href="/demo" />}
              >
                <ClipboardListIcon />
                <span>Meine Protokolle</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/demo/notizen"}
                render={<Link href="/demo/notizen" />}
              >
                <StickyNoteIcon />
                <span>Notizen</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="mb-3 text-xs text-text-muted">
          {DEMO_USER.firstName} {DEMO_USER.lastName}
        </div>
        <Link
          href="/"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-muted transition-colors hover:bg-sidebar-accent hover:text-red"
        >
          <LogOutIcon className="h-3.5 w-3.5" />
          Demo verlassen
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}

function DemoBanner() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber/20 bg-amber/5 px-4 py-2 text-xs">
      <span className="rounded bg-amber/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber">
        DEMO
      </span>
      <span className="text-text-muted">
        Beispieldaten — Änderungen werden nicht gespeichert.
      </span>
      <Link
        href="/signup"
        className="ml-auto font-semibold text-red hover:underline"
      >
        Konto erstellen →
      </Link>
    </div>
  );
}

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <DemoSidebar />
        <SidebarInset className="flex max-h-svh flex-col overflow-hidden">
          <header className="flex h-12 shrink-0 items-center border-b border-border px-4">
            <SidebarTrigger />
          </header>
          <DemoBanner />
          <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-none">
            <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
              {children}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
