"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { ClipboardListIcon, MessageSquareIcon, PillIcon, PlusIcon, UserIcon } from "lucide-react";
import { unreadCount } from "../_lib";
import { AddNoteSheet } from "./AddNoteSheet";
import { MockProvider, useMock } from "./MockStore";

const noopSubscribe = () => () => {};

/** Renders nothing on the server: mock timestamps are computed at load, so SSR/prerender would go stale. */
export function MockRoot({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return <div className="h-[100dvh] bg-bg" />;
  return (
    <MockProvider>
      <Shell>{children}</Shell>
    </MockProvider>
  );
}

function Nav() {
  const pathname = usePathname();
  const { notes } = useMock();
  const unread = unreadCount(notes);
  const hasCritical = notes.some((n) => n.priority === "critical" && n.status !== "dismissed" && n.status !== "done");

  const tabs = [
    { href: "/mockup/protokoll", icon: ClipboardListIcon, label: "Protokoll" },
    { href: "/mockup/notizen", icon: MessageSquareIcon, label: "Notizen", badge: unread },
    { href: null, icon: PillIcon, label: "Bestand" },
    { href: null, icon: UserIcon, label: "Profil" },
  ];

  return (
    <nav className="shrink-0 border-t border-border bg-bg/95 backdrop-blur-sm" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mx-auto flex max-w-sm px-4">
        {tabs.map((tab) => {
          const active = tab.href !== null && pathname.startsWith(tab.href);
          const cls = `relative flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors ${
            active ? "text-red" : "text-text-muted"
          }`;
          const inner = (
            <>
              <span className="relative">
                <tab.icon className="h-5 w-5" />
                {tab.badge ? (
                  <span
                    className={`absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[9px] font-bold text-white ${
                      hasCritical ? "bg-red" : "bg-amber"
                    }`}
                  >
                    {tab.badge}
                  </span>
                ) : null}
              </span>
              {tab.label}
            </>
          );
          return tab.href ? (
            <Link key={tab.label} href={tab.href} className={cls}>
              {inner}
            </Link>
          ) : (
            <span key={tab.label} className={`${cls} cursor-default opacity-70`}>
              {inner}
            </span>
          );
        })}
      </div>
    </nav>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { openAddNote, toastMsg } = useMock();
  const isIndex = pathname === "/mockup";
  const isDetail = /^\/mockup\/notizen\/[^/]+$/.test(pathname);

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-bg text-text">
      <div className="flex shrink-0 items-center justify-center gap-2 pt-[max(0.25rem,env(safe-area-inset-top))]">
        {!isIndex && (
          <Link href="/mockup" className="text-[10px] text-text-muted hover:text-text">
            Übersicht
          </Link>
        )}
        <span className="rounded-full border border-amber/30 bg-amber/10 px-2 py-px text-[10px] font-medium text-amber">
          Mockup
        </span>
      </div>

      <div id="mock-scroll" className="flex-1 overflow-y-auto overscroll-none">
        <div className="mx-auto flex min-h-full max-w-lg flex-col">{children}</div>
      </div>

      {!isIndex && <Nav />}

      {!isIndex && (
        <div
          className={`pointer-events-none absolute inset-x-0 z-30 mx-auto flex max-w-lg justify-end px-4 ${
            isDetail ? "bottom-[calc(8.25rem+env(safe-area-inset-bottom))]" : "bottom-[calc(4.75rem+env(safe-area-inset-bottom))]"
          }`}
        >
          <button
            onClick={() => openAddNote()}
            aria-label="Notiz hinzufügen"
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-red text-white shadow-lg shadow-red/30 transition-transform active:scale-95"
          >
            <PlusIcon className="h-6 w-6" />
          </button>
        </div>
      )}

      {toastMsg && (
        <div className="pointer-events-none fixed inset-x-0 top-[calc(2.5rem+env(safe-area-inset-top))] z-[70] flex justify-center px-4">
          <div className="rounded-lg border border-green/30 bg-surface px-4 py-2.5 text-sm font-medium text-green shadow-lg">
            {toastMsg}
          </div>
        </div>
      )}

      <AddNoteSheet />
    </div>
  );
}
