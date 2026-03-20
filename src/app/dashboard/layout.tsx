"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth";
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
  ShieldIcon,
  LogOutIcon,
  StickyNoteIcon,
  UsersIcon,
  SmartphoneIcon,
} from "lucide-react";

function DashboardSidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();

  const isAdmin = profile?.role === "admin";

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
                isActive={pathname === "/dashboard" || pathname === "/dashboard/meine"}
                render={<Link href="/dashboard" />}
              >
                <ClipboardListIcon />
                <span>Meine Protokolle</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/dashboard/notizen"}
                render={<Link href="/dashboard/notizen" />}
              >
                <StickyNoteIcon />
                <span>Notizen</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {isAdmin && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === "/dashboard/alle"}
                    render={<Link href="/dashboard/alle" />}
                  >
                    <ShieldIcon />
                    <span>Alle Protokolle</span>
                    <span className="ml-auto rounded bg-red/10 px-1.5 py-0.5 text-[10px] font-semibold text-red">
                      ADMIN
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === "/dashboard/team"}
                    render={<Link href="/dashboard/team" />}
                  >
                    <UsersIcon />
                    <span>Team</span>
                    <span className="ml-auto rounded bg-red/10 px-1.5 py-0.5 text-[10px] font-semibold text-red">
                      ADMIN
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/app" />}>
              <SmartphoneIcon />
              <span>Protokoll ausfüllen</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="mt-3 mb-3 text-xs text-text-muted">
          {profile ? `${profile.firstName} ${profile.lastName}` : "…"}
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-muted transition-colors hover:bg-sidebar-accent hover:text-red"
        >
          <LogOutIcon className="h-3.5 w-3.5" />
          Abmelden
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset className="overflow-x-hidden">
        <header className="flex h-12 items-center border-b border-border px-4">
          <SidebarTrigger />
        </header>
        <main className="mx-auto w-full max-w-5xl overflow-x-auto px-4 py-8 sm:px-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <TooltipProvider>
        <DashboardShell>{children}</DashboardShell>
      </TooltipProvider>
    </AuthProvider>
  );
}
