import Link from "next/link";

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-text">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber/20 bg-amber/5 px-4 py-2 text-xs">
        <span className="rounded bg-amber/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber">
          DEMO
        </span>
        <span className="text-text-muted">
          Beispieldaten — Eingaben werden nicht gespeichert.
        </span>
        <Link
          href="/"
          className="ml-auto text-text-muted hover:text-text"
        >
          Demo verlassen ↗
        </Link>
      </div>
      <div className="mx-auto w-full max-w-md flex-1">{children}</div>
    </div>
  );
}
