"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { CheckCircleIcon, ArrowRightCircleIcon } from "lucide-react";

type Note = {
  id: string;
  author_name: string;
  value: string;
  created_at: string;
  is_resolved: boolean;
  vehicle_id: string | null;
  vehicle_name?: string;
  delegated: boolean;
};

export default function NotizenPage() {
  const { profile, loading: authLoading } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "delegated" | "resolved">(
    "open"
  );

  const loadNotes = useCallback(async () => {
    if (!profile) return;

    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("team_id", profile.teamId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching notes:", error);
      setLoading(false);
      return;
    }

    // Fetch vehicle names
    const vehicleIds = [
      ...new Set((data ?? []).map((n: any) => n.vehicle_id).filter(Boolean)),
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

    const allNotes: Note[] = (data ?? []).map((n: any) => {
      const isDelegated =
        typeof n.author_name === "string" &&
        n.author_name.includes("→ Zentrale");
      return {
        id: n.id,
        author_name: isDelegated
          ? n.author_name.replace(" → Zentrale", "")
          : n.author_name,
        value: n.value,
        created_at: n.created_at,
        is_resolved: n.is_resolved,
        vehicle_id: n.vehicle_id,
        vehicle_name: vehiclesMap.get(n.vehicle_id) ?? undefined,
        delegated: isDelegated,
      };
    });

    setNotes(allNotes);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    if (authLoading || !profile) return;
    setLoading(true);
    loadNotes();
  }, [authLoading, profile, loadNotes]);

  const filtered = notes.filter((n) => {
    if (filter === "open") return !n.is_resolved && !n.delegated;
    if (filter === "delegated") return !n.is_resolved && n.delegated;
    return n.is_resolved;
  });

  async function markResolved(id: string) {
    await supabase.from("notes").update({ is_resolved: true }).eq("id", id);
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_resolved: true } : n))
    );
  }

  async function markDelegated(id: string) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    await supabase
      .from("notes")
      .update({
        author_name: `${note.author_name} → Zentrale`,
      })
      .eq("id", id);
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, delegated: true } : n))
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Notizen</h1>
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-0.5">
          <FilterButton
            active={filter === "open"}
            onClick={() => setFilter("open")}
            count={notes.filter((n) => !n.is_resolved && !n.delegated).length}
          >
            Offen
          </FilterButton>
          <FilterButton
            active={filter === "delegated"}
            onClick={() => setFilter("delegated")}
            count={notes.filter((n) => !n.is_resolved && n.delegated).length}
          >
            Zentrale
          </FilterButton>
          <FilterButton
            active={filter === "resolved"}
            onClick={() => setFilter("resolved")}
            count={notes.filter((n) => n.is_resolved).length}
          >
            Erledigt
          </FilterButton>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-text-muted">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red" />
          Lade Notizen…
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-text-muted">Keine Notizen.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((note) => (
            <div key={note.id} className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-medium">{note.author_name}</span>
                <span className="font-mono text-xs text-text-muted">
                  {formatDate(note.created_at)}
                </span>
                {note.vehicle_name && (
                  <span className="rounded bg-purple/10 px-1.5 py-0.5 text-[10px] font-medium text-purple">
                    {note.vehicle_name}
                  </span>
                )}
                {note.delegated && (
                  <span className="rounded bg-amber/10 px-1.5 py-0.5 text-[10px] font-medium text-amber">
                    → Zentrale
                  </span>
                )}
                {note.is_resolved && (
                  <span className="rounded bg-green/10 px-1.5 py-0.5 text-[10px] font-medium text-green">
                    Erledigt
                  </span>
                )}
              </div>
              <p className="mb-3 text-sm text-text-muted">{note.value}</p>

              {!note.is_resolved && (
                <div className="flex gap-2">
                  <button
                    onClick={() => markResolved(note.id)}
                    className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-80"
                  >
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                    Erledigt
                  </button>
                  {!note.delegated && (
                    <button
                      onClick={() => markDelegated(note.id)}
                      className="flex items-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-80"
                    >
                      <ArrowRightCircleIcon className="h-3.5 w-3.5" />
                      An Zentrale
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
        active ? "bg-red text-white" : "text-text-muted hover:text-text"
      }`}
    >
      {children}
      {count > 0 && (
        <span className={`ml-1.5 ${active ? "text-white/70" : ""}`}>
          {count}
        </span>
      )}
    </button>
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
