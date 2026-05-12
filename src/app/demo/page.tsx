import Link from "next/link";
import { DEMO_PROTOCOL } from "@/lib/demo-data";

export default function DemoMeineProtokollePage() {
  const submissions = [DEMO_PROTOCOL];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Meine Protokolle</h1>
        <span className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs text-text-muted">
          {submissions.length} Einträge
        </span>
      </div>

      {/* Mobile: card layout */}
      <div className="space-y-3 sm:hidden">
        {submissions.map((s) => (
          <Link
            key={s.id}
            href={`/demo/${s.id}`}
            className="block rounded-lg border border-border p-4 transition-colors hover:border-red"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">
                {s.user_first_name} {s.user_last_name}
              </span>
              <span className="font-mono text-xs text-text-muted">
                {formatDate(s.created_at)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">{s.vehicle_name}</span>
              <span className="text-xs text-red">Ansehen →</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop: table layout */}
      <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
        <table className="w-full min-w-[500px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-4 py-3 font-medium text-text-muted">Erstellt</th>
              <th className="px-4 py-3 font-medium text-text-muted">Person</th>
              <th className="px-4 py-3 font-medium text-text-muted">Fahrzeug</th>
              <th className="px-4 py-3 text-right font-medium text-text-muted" />
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr
                key={s.id}
                className="border-b border-border transition-colors last:border-0 hover:bg-surface2"
              >
                <td className="px-4 py-3 font-mono text-xs">
                  {formatDate(s.created_at)}
                </td>
                <td className="px-4 py-3">
                  {s.user_first_name} {s.user_last_name}
                </td>
                <td className="px-4 py-3 text-text-muted">{s.vehicle_name}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/demo/${s.id}`}
                    className="rounded border border-border bg-surface px-3 py-1 text-xs font-medium transition-colors hover:border-red hover:text-red"
                  >
                    Ansehen
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
