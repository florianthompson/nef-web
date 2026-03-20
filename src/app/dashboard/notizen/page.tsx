"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  CheckCircleIcon,
  ArrowRightCircleIcon,
  Trash2Icon,
  ClockIcon,
  UserIcon,
} from "lucide-react";

type Note = {
  id: string;
  author_name: string;
  value: string;
  created_at: string;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
  vehicle_id: string | null;
  vehicle_name?: string;
  delegated: boolean;
};

export default function NotizenPage() {
  const { profile, loading: authLoading } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "delegated" | "resolved" | "deleted">(
    "open"
  );

  const fullName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : "";

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
        resolved_by: n.resolved_by ?? null,
        resolved_at: n.resolved_at ?? null,
        deleted_by: n.deleted_by ?? null,
        deleted_at: n.deleted_at ?? null,
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

  const isDeleted = (n: Note) => !!n.deleted_at;

  const filtered = notes.filter((n) => {
    if (filter === "deleted") return isDeleted(n);
    if (isDeleted(n)) return false;
    if (filter === "open") return !n.is_resolved && !n.delegated;
    if (filter === "delegated") return !n.is_resolved && n.delegated;
    return n.is_resolved;
  });

  const counts = {
    open: notes.filter((n) => !isDeleted(n) && !n.is_resolved && !n.delegated).length,
    delegated: notes.filter((n) => !isDeleted(n) && !n.is_resolved && n.delegated).length,
    resolved: notes.filter((n) => !isDeleted(n) && n.is_resolved).length,
    deleted: notes.filter((n) => isDeleted(n)).length,
  };

  async function markResolved(id: string) {
    const now = new Date().toISOString();
    await supabase
      .from("notes")
      .update({ is_resolved: true, resolved_by: fullName, resolved_at: now })
      .eq("id", id);
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, is_resolved: true, resolved_by: fullName, resolved_at: now }
          : n
      )
    );
  }

  async function markDeleted(id: string) {
    const now = new Date().toISOString();
    await supabase
      .from("notes")
      .update({ deleted_by: fullName, deleted_at: now })
      .eq("id", id);
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, deleted_by: fullName, deleted_at: now } : n
      )
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
            count={counts.open}
          >
            Offen
          </FilterButton>
          <FilterButton
            active={filter === "delegated"}
            onClick={() => setFilter("delegated")}
            count={counts.delegated}
          >
            Zentrale
          </FilterButton>
          <FilterButton
            active={filter === "resolved"}
            onClick={() => setFilter("resolved")}
            count={counts.resolved}
          >
            Erledigt
          </FilterButton>
          <FilterButton
            active={filter === "deleted"}
            onClick={() => setFilter("deleted")}
            count={counts.deleted}
          >
            Gelöscht
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
              <div className="mb-2 flex flex-wrap items-center gap-2">
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
                {note.is_resolved && !isDeleted(note) && (
                  <span className="rounded bg-green/10 px-1.5 py-0.5 text-[10px] font-medium text-green">
                    Erledigt
                  </span>
                )}
                {isDeleted(note) && (
                  <span className="rounded bg-red/10 px-1.5 py-0.5 text-[10px] font-medium text-red">
                    Gelöscht
                  </span>
                )}
              </div>
              <p className={`text-sm ${isDeleted(note) ? "text-text-muted line-through" : "text-text-muted"}`}>
                {note.value}
              </p>

              {/* Audit trail */}
              {(note.resolved_at || note.deleted_at) && (
                <div className="mt-3 space-y-1 border-t border-border pt-3">
                  {note.resolved_at && (
                    <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                      <CheckCircleIcon className="h-3 w-3 text-green" />
                      <span>
                        Erledigt von <span className="font-medium text-text">{note.resolved_by}</span>
                        {" "}am {formatDate(note.resolved_at)}
                      </span>
                    </div>
                  )}
                  {note.deleted_at && (
                    <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                      <Trash2Icon className="h-3 w-3 text-red" />
                      <span>
                        Gelöscht von <span className="font-medium text-text">{note.deleted_by}</span>
                        {" "}am {formatDate(note.deleted_at)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Created trail — always show on resolved/deleted */}
              {(note.is_resolved || isDeleted(note)) && (
                <div className={`flex items-center gap-1.5 text-[11px] text-text-muted ${!note.resolved_at && !note.deleted_at ? "mt-3 border-t border-border pt-3" : "mt-1"}`}>
                  <ClockIcon className="h-3 w-3" />
                  <span>
                    Erstellt von <span className="font-medium text-text">{note.author_name}</span>
                    {" "}am {formatDate(note.created_at)}
                  </span>
                </div>
              )}

              {/* Actions */}
              {!note.is_resolved && !isDeleted(note) && (
                <div className="mt-3 flex gap-2">
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
                  <button
                    onClick={() => markDeleted(note.id)}
                    className="ml-auto flex items-center gap-1.5 rounded-md border border-red/20 px-3 py-1.5 text-xs font-semibold text-red transition-opacity hover:opacity-80"
                  >
                    <Trash2Icon className="h-3.5 w-3.5" />
                    Löschen
                  </button>
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
