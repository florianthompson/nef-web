"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  isAssignmentSupported,
  loadItemOptions,
  loadNotes,
  reopenNote,
  resolveNote,
  type ItemOption,
  type Note,
} from "@/lib/notes";
import { CategoryChips, type CategoryFilter } from "./CategoryChips";
import { Composer } from "./Composer";
import { dayLabel } from "./format";
import { NoteDetail } from "./NoteDetail";
import { noteCategory, NoteRow } from "./NoteRow";
import { SegmentedFilter, type Segment } from "./SegmentedFilter";
import { UndoToast, type ToastState } from "./UndoToast";

const UNDO_MS = 5000;

export function Feed() {
  const { user, profile } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [itemOptions, setItemOptions] = useState<ItemOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [segment, setSegment] = useState<Segment>("open");
  const [category, setCategory] = useState<CategoryFilter>("Alle");
  const [openId, setOpenId] = useState<string | null>(null);
  const [lingering, setLingering] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastState>(null);
  const [composerH, setComposerH] = useState(72);
  const [assignment, setAssignment] = useState<boolean | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lingerTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const toastSeq = useRef(0);

  const teamId = profile?.teamId;
  const fullName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : "";
  const items = useMemo(() => new Map(itemOptions.map((i) => [i.id, i])), [itemOptions]);

  const reload = useCallback(async () => {
    if (!teamId) return;
    const res = await loadNotes(teamId);
    setAssignment(isAssignmentSupported());
    if (res.error) setLoadError(res.error);
    else {
      setLoadError(null);
      setNotes(res.notes);
    }
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!teamId) return;
    let live = true;
    loadItemOptions(teamId).then((o) => live && setItemOptions(o));
    return () => {
      live = false;
    };
  }, [teamId]);

  useEffect(() => {
    const on = () => void reload();
    window.addEventListener("focus", on);
    window.addEventListener("online", on);
    const timers = lingerTimers.current;
    return () => {
      window.removeEventListener("focus", on);
      window.removeEventListener("online", on);
      clearTimeout(toastTimer.current);
      timers.forEach(clearTimeout);
    };
  }, [reload]);

  const showToast = useCallback((message: string, undo?: () => void) => {
    clearTimeout(toastTimer.current);
    setToast({ id: ++toastSeq.current, message, undo });
    toastTimer.current = setTimeout(() => setToast(null), UNDO_MS);
  }, []);

  const patchNote = (id: string, p: Partial<Note>) =>
    setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, ...p } : n)));

  const stopLinger = (id: string) => {
    clearTimeout(lingerTimers.current.get(id));
    lingerTimers.current.delete(id);
    setLingering((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  };

  async function complete(note: Note) {
    if (note.is_resolved) return;
    const prev = { is_resolved: false, resolved_by: null, resolved_at: null };
    patchNote(note.id, {
      is_resolved: true,
      resolved_by: fullName || "—",
      resolved_at: new Date().toISOString(),
    });
    setLingering((s) => new Set(s).add(note.id));
    lingerTimers.current.set(
      note.id,
      setTimeout(() => stopLinger(note.id), UNDO_MS)
    );
    const ok = await resolveNote(note.id, fullName || "—");
    if (!ok) {
      patchNote(note.id, prev);
      stopLinger(note.id);
      showToast("Konnte nicht gespeichert werden");
      return;
    }
    showToast("Erledigt", async () => {
      patchNote(note.id, prev);
      stopLinger(note.id);
      if (!(await reopenNote(note.id))) {
        showToast("Konnte nicht rückgängig gemacht werden");
        void reload();
      }
    });
  }

  async function reopen(note: Note) {
    const prevDone = { is_resolved: true, resolved_by: note.resolved_by, resolved_at: note.resolved_at };
    patchNote(note.id, { is_resolved: false, resolved_by: null, resolved_at: null });
    stopLinger(note.id);
    if (!(await reopenNote(note.id))) {
      patchNote(note.id, prevDone);
      showToast("Konnte nicht gespeichert werden");
      return;
    }
    setSegment("open");
    setOpenId(null);
  }

  const showChips = assignment !== false;

  const inSegment = useMemo(
    () =>
      notes.filter((n) =>
        segment === "open" ? !n.is_resolved || lingering.has(n.id) : n.is_resolved && !lingering.has(n.id)
      ),
    [notes, segment, lingering]
  );

  const counts = useMemo(() => {
    const c: Record<CategoryFilter, number> = {
      Alle: inSegment.length,
      Medikamente: 0,
      BTM: 0,
      Fahrzeug: 0,
      Ausrüstung: 0,
      Sonstiges: 0,
    };
    inSegment.forEach((n) => {
      const k = noteCategory(n, items) as CategoryFilter;
      if (k in c) c[k]++;
      else c.Sonstiges++;
    });
    return c;
  }, [inSegment, items]);

  const segCounts = useMemo(
    () => ({
      open: notes.filter((n) => !n.is_resolved || lingering.has(n.id)).length,
      done: notes.filter((n) => n.is_resolved && !lingering.has(n.id)).length,
    }),
    [notes, lingering]
  );

  const activeCategory = showChips && counts[category] > 0 ? category : "Alle";

  const visible = useMemo(() => {
    const list = inSegment.filter(
      (n) => activeCategory === "Alle" || noteCategory(n, items) === activeCategory
    );
    const key = (n: Note) => (segment === "done" ? (n.resolved_at ?? n.created_at) : n.created_at);
    return [...list].sort((a, b) => +new Date(key(b)) - +new Date(key(a)));
  }, [inSegment, activeCategory, items, segment]);

  const groups = useMemo(() => {
    const out: { label: string; notes: Note[] }[] = [];
    for (const n of visible) {
      const label = dayLabel(segment === "done" ? (n.resolved_at ?? n.created_at) : n.created_at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.notes.push(n);
      else out.push({ label, notes: [n] });
    }
    return out;
  }, [visible, segment]);

  const openNote = notes.find((n) => n.id === openId) ?? null;

  return (
    <div className="relative flex h-full flex-col">
      <div className="shrink-0 pt-4 pb-1">
        <h1 className="mb-3 px-4 text-[28px] leading-[34px] font-bold tracking-[-0.02em]">Notizen</h1>
        <SegmentedFilter value={segment} onChange={setSegment} counts={segCounts} />
      </div>
      {showChips && (
        <div className="shrink-0 border-b border-border">
          <CategoryChips value={activeCategory} onChange={setCategory} counts={counts} />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-3">
        {loading || !teamId ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-text-muted border-t-red" />
          </div>
        ) : loadError ? (
          <div className="px-6 py-16 text-center text-sm text-text-muted">
            Notizen konnten nicht geladen werden.
            <button
              type="button"
              onClick={() => void reload()}
              className="mt-2 block min-h-11 w-full font-medium text-text underline underline-offset-4"
            >
              Erneut versuchen
            </button>
          </div>
        ) : groups.length === 0 ? (
          <div className="px-6 py-16 text-center text-[15px] text-zinc-500">
            {segment === "open"
              ? activeCategory === "Alle"
                ? "Keine offenen Notizen"
                : `Keine offenen Notizen in ${activeCategory}`
              : activeCategory === "Alle"
                ? "Noch nichts erledigt"
                : `Nichts erledigt in ${activeCategory}`}
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.label}>
              <div className="mx-4 mt-4 mb-1 flex items-center gap-3 text-[13px] font-medium text-zinc-500">
                <span className="h-px flex-1 bg-border" />
                {g.label}
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="divide-y divide-border">
                {g.notes.map((n) => (
                  <NoteRow
                    key={n.id}
                    note={n}
                    items={items}
                    showChips={showChips}
                    justDone={lingering.has(n.id)}
                    segment={segment}
                    onOpen={() => setOpenId(n.id)}
                    onComplete={() => void complete(n)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {teamId && user && (
        <Composer
          items={itemOptions}
          teamId={teamId}
          userId={user.id}
          authorName={fullName || "Unbekannt"}
          onHeight={setComposerH}
          onNotice={(m) => showToast(m)}
          onSaved={(m) => {
            setSegment("open");
            setCategory("Alle");
            showToast(m);
            void reload();
          }}
        />
      )}

      <UndoToast toast={toast} onDismiss={() => setToast(null)} bottom={composerH + 8} />

      {openNote && (
        <NoteDetail
          note={openNote}
          items={items}
          showChips={showChips}
          onClose={() => setOpenId(null)}
          onComplete={() => {
            void complete(openNote);
            setOpenId(null);
          }}
          onReopen={() => void reopen(openNote)}
        />
      )}
    </div>
  );
}
