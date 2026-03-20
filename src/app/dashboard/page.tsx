"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

type Submission = {
  id: string;
  created_at: string;
  vehicle_name: string | null;
  user_first_name: string;
  user_last_name: string;
};

export default function MeineProtokollePage() {
  const { user, loading: authLoading } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;

    async function load() {
      // Fetch only my submissions
      const { data: protocols, error } = await supabase
        .from("user_protocols")
        .select("id, created_at, vehicle_id, user_id")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching submissions:", error);
        setLoading(false);
        return;
      }

      const vehicleIds = [
        ...new Set(
          (protocols ?? []).map((p: any) => p.vehicle_id).filter(Boolean)
        ),
      ];

      const { data: vehiclesData } = await supabase
        .from("vehicles")
        .select("id, name")
        .in("id", vehicleIds.length > 0 ? vehicleIds : ["__none__"]);

      const vehiclesMap = new Map(
        (vehiclesData ?? []).map((v: any) => [v.id, v])
      );

      // Fetch own user name
      const { data: me } = await supabase
        .from("users")
        .select("first_name, last_name")
        .eq("id", user!.id)
        .single();

      const mapped: Submission[] = (protocols ?? []).map((row: any) => {
        const v = vehiclesMap.get(row.vehicle_id);
        return {
          id: row.id,
          created_at: row.created_at,
          vehicle_name: v?.name ?? null,
          user_first_name: me?.first_name ?? "–",
          user_last_name: me?.last_name ?? "",
        };
      });

      setSubmissions(mapped);
      setLoading(false);
    }

    load();
  }, [authLoading, user]);

  return <SubmissionsTable submissions={submissions} loading={loading} title="Meine Protokolle" />;
}

export function SubmissionsTable({
  submissions,
  loading,
  title,
}: {
  submissions: Submission[];
  loading: boolean;
  title: string;
}) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">{title}</h1>
        <span className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs text-text-muted">
          {submissions.length} Einträge
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-text-muted">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red" />
          Lade Protokolle…
        </div>
      ) : submissions.length === 0 ? (
        <p className="text-text-muted">Keine Protokolle vorhanden.</p>
      ) : (
        <>
        {/* Mobile: card layout */}
        <div className="space-y-3 sm:hidden">
          {submissions.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/${s.id}`}
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
                <span className="text-xs text-text-muted">
                  {s.vehicle_name ?? "–"}
                </span>
                <span className="text-xs text-red">Ansehen →</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Desktop: table layout */}
        <div className="hidden overflow-hidden rounded-lg border border-border sm:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="px-4 py-3 font-medium text-text-muted">
                  Erstellt
                </th>
                <th className="px-4 py-3 font-medium text-text-muted">
                  Person
                </th>
                <th className="px-4 py-3 font-medium text-text-muted">
                  Fahrzeug
                </th>
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
                  <td className="px-4 py-3 text-text-muted">
                    {s.vehicle_name ?? "–"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/${s.id}`}
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
        </>
      )}
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
