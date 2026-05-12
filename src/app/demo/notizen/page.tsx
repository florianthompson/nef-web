"use client";

import { useState } from "react";
import {
  CheckCircleIcon,
  ArrowRightCircleIcon,
  Trash2Icon,
  ClockIcon,
} from "lucide-react";
import { DEMO_NOTES, DEMO_USER, type DemoNote } from "@/lib/demo-data";

export default function DemoNotizenPage() {
  const [notes, setNotes] = useState<DemoNote[]>(DEMO_NOTES);
  const [filter, setFilter] = useState<
    "open" | "delegated" | "resolved" | "deleted"
  >("open");

  const fullName = `${DEMO_USER.firstName} ${DEMO_USER.lastName}`;

  const isDeleted = (n: DemoNote) => !!n.deleted_at;

  const filtered = notes.filter((n) => {
    if (filter === "deleted") return isDeleted(n);
    if (isDeleted(n)) return false;
    if (filter === "open") return !n.is_resolved && !n.delegated;
    if (filter === "delegated") return !n.is_resolved && n.delegated;
    return n.is_resolved;
  });

  const counts = {
    open: notes.filter((n) => !isDeleted(n) && !n.is_resolved && !n.delegated)
      .length,
    delegated: notes.filter(
      (n) => !isDeleted(n) && !n.is_resolved && n.delegated
    ).length,
    resolved: notes.filter((n) => !isDeleted(n) && n.is_resolved).length,
    deleted: notes.filter((n) => isDeleted(n)).length,
  };

  function markResolved(id: string) {
    const now = new Date().toISOString();
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, is_resolved: true, resolved_by: fullName, resolved_at: now }
          : n
      )
    );
  }

  function markDeleted(id: string) {
    const now = new Date().toISOString();
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, deleted_by: fullName, deleted_at: now } : n
      )
    );
  }

  function markDelegated(id: string) {
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

      {filtered.length === 0 ? (
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
              <p
                className={`text-sm ${
                  isDeleted(note)
                    ? "text-text-muted line-through"
                    : "text-text-muted"
                }`}
              >
                {note.value}
              </p>

              {(note.resolved_at || note.deleted_at) && (
                <div className="mt-3 space-y-1 border-t border-border pt-3">
                  {note.resolved_at && (
                    <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                      <CheckCircleIcon className="h-3 w-3 text-green" />
                      <span>
                        Erledigt von{" "}
                        <span className="font-medium text-text">
                          {note.resolved_by}
                        </span>{" "}
                        am {formatDate(note.resolved_at)}
                      </span>
                    </div>
                  )}
                  {note.deleted_at && (
                    <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                      <Trash2Icon className="h-3 w-3 text-red" />
                      <span>
                        Gelöscht von{" "}
                        <span className="font-medium text-text">
                          {note.deleted_by}
                        </span>{" "}
                        am {formatDate(note.deleted_at)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {(note.is_resolved || isDeleted(note)) && (
                <div
                  className={`flex items-center gap-1.5 text-[11px] text-text-muted ${
                    !note.resolved_at && !note.deleted_at
                      ? "mt-3 border-t border-border pt-3"
                      : "mt-1"
                  }`}
                >
                  <ClockIcon className="h-3 w-3" />
                  <span>
                    Erstellt von{" "}
                    <span className="font-medium text-text">
                      {note.author_name}
                    </span>{" "}
                    am {formatDate(note.created_at)}
                  </span>
                </div>
              )}

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
