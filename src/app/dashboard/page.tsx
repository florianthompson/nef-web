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

export default function DashboardPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;

    async function load() {
      console.log("[dashboard] auth user id:", user!.id);

      // Get current user's team_id
      const { data: me, error: meErr } = await supabase
        .from("users")
        .select("team_id")
        .eq("id", user!.id)
        .single();

      console.log("[dashboard] me:", me, "error:", meErr);

      if (meErr || !me) {
        console.error("Error fetching team:", meErr);
        setLoading(false);
        return;
      }

      // Get all team members
      const { data: teamMembers, error: tmErr } = await supabase
        .from("users")
        .select("id")
        .eq("team_id", me.team_id);

      console.log("[dashboard] team members:", teamMembers, "error:", tmErr);

      const teamUserIds = (teamMembers ?? []).map((m: any) => m.id);

      // Fetch submissions for the whole team
      const { data: protocols, error } = await supabase
        .from("user_protocols")
        .select("id, created_at, vehicle_id, user_id")
        .in("user_id", teamUserIds.length > 0 ? teamUserIds : ["__none__"])
        .order("created_at", { ascending: false });

      console.log("[dashboard] protocols:", protocols, "error:", error);

      if (error) {
        console.error("Error fetching submissions:", error);
        setLoading(false);
        return;
      }

      // Collect unique user_ids and vehicle_ids for batch lookup
      const userIds = [...new Set((protocols ?? []).map((p: any) => p.user_id).filter(Boolean))];
      const vehicleIds = [...new Set((protocols ?? []).map((p: any) => p.vehicle_id).filter(Boolean))];

      // Fetch users
      const { data: usersData } = await supabase
        .from("users")
        .select("id, first_name, last_name")
        .in("id", userIds.length > 0 ? userIds : ["__none__"]);

      const usersMap = new Map(
        (usersData ?? []).map((u: any) => [u.id, u])
      );

      // Fetch vehicles
      const { data: vehiclesData } = await supabase
        .from("vehicles")
        .select("id, name")
        .in("id", vehicleIds.length > 0 ? vehicleIds : ["__none__"]);

      const vehiclesMap = new Map(
        (vehiclesData ?? []).map((v: any) => [v.id, v])
      );

      const mapped: Submission[] = (protocols ?? []).map((row: any) => {
        const u = usersMap.get(row.user_id);
        const v = vehiclesMap.get(row.vehicle_id);
        return {
          id: row.id,
          created_at: row.created_at,
          vehicle_name: v?.name ?? null,
          user_first_name: u?.first_name ?? "–",
          user_last_name: u?.last_name ?? "",
        };
      });

      setSubmissions(mapped);
      setLoading(false);
    }

    load();
  }, [authLoading, user]);

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border px-6 py-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="font-mono text-sm font-bold tracking-tight text-red"
            >
              NEF //
            </Link>
            <span className="text-text-muted">/</span>
            <h1 className="text-sm font-semibold">Protokoll-Übersicht</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs text-text-muted">
              {submissions.length} Einträge
            </span>
            <button
              onClick={signOut}
              className="rounded border border-border bg-surface px-3 py-1 text-xs font-medium text-text-muted transition-colors hover:border-red hover:text-red"
            >
              Abmelden
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {loading ? (
          <div className="flex items-center gap-2 text-text-muted">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red" />
            Lade Protokolle…
          </div>
        ) : submissions.length === 0 ? (
          <p className="text-text-muted">Keine Protokolle vorhanden.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
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
        )}
      </main>
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
