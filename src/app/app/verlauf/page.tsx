"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

type PastProtocol = {
  id: string;
  created_at: string;
  vehicle_name: string | null;
};

export default function VerlaufPage() {
  const { user, loading: authLoading } = useAuth();
  const [history, setHistory] = useState<PastProtocol[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;

    async function load() {
      const { data } = await supabase
        .from("user_protocols")
        .select("id, created_at, vehicle_id")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      const vehicleIds = [
        ...new Set((data ?? []).map((d: any) => d.vehicle_id).filter(Boolean)),
      ];

      let vehiclesMap = new Map();
      if (vehicleIds.length > 0) {
        const { data: vehicles } = await supabase
          .from("vehicles")
          .select("id, name")
          .in("id", vehicleIds);
        vehiclesMap = new Map(
          (vehicles ?? []).map((v: any) => [v.id, v.name])
        );
      }

      setHistory(
        (data ?? []).map((d: any) => ({
          id: d.id,
          created_at: d.created_at,
          vehicle_name: vehiclesMap.get(d.vehicle_id) ?? null,
        }))
      );
      setLoading(false);
    }

    load();
  }, [authLoading, user]);

  return (
    <div className="px-4 py-6">
      <h1 className="mb-6 text-lg font-bold">Deine Protokolle</h1>

      {loading ? (
        <div className="flex items-center gap-2 text-text-muted">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red" />
          Laden…
        </div>
      ) : history.length === 0 ? (
        <p className="text-sm text-text-muted">Noch keine Protokolle.</p>
      ) : (
        <div className="space-y-2">
          {history.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/${p.id}`}
              className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:border-red"
            >
              <div>
                <p className="text-sm font-medium">
                  {formatDate(p.created_at)}
                </p>
                <p className="text-xs text-text-muted">
                  {p.vehicle_name ?? "–"}
                </p>
              </div>
              <span className="text-xs text-red">→</span>
            </Link>
          ))}
        </div>
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
