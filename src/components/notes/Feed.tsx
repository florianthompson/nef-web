"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import {
  assignNote,
  isAssignmentSupported,
  loadCommentsFor,
  loadItemOptions,
  loadNotes,
  reopenNote,
  resolveNote,
  type ItemOption,
  type Note,
  type NoteCategory,
  type NoteComment,
} from "@/lib/notes";
import { createVehicleFeed, visibleFeed } from "@/lib/vehicleNotes.mjs";
import { CategoryChips, type CategoryFilter } from "./CategoryChips";
import { Composer } from "./Composer";
import { dayLabel, rtime, shortAuthor } from "./format";
import { ItemPicker } from "./ItemPicker";
import { ItemScreen } from "./ItemScreen";
import { NoteDetail } from "./NoteDetail";
import { noteCategory, NoteRow } from "./NoteRow";
import { SegmentedFilter, type Segment } from "./SegmentedFilter";
import { BottomSheet } from "./BottomSheet";
import { UndoToast, type ToastState } from "./UndoToast";

const UNDO_MS = 5000;

type FeedState = {
  vehicleId: string | null | undefined;
  notes: Note[];
  comments: Record<string, NoteComment[]>;
  loading: boolean;
  error: string | null;
};

export function Feed({
  top,
  openItemId,
  onOpenItemConsumed,
  onStats,
  vehicleId,
  legacyVehicleId,
}: {
  /** undefined = the vehicle is not known yet (loading), null = the team has no vehicles (all notes) */
  vehicleId?: string | null;
  /** the vehicle that also shows legacy notes without vehicle_id */
  legacyVehicleId?: string | null;
  top?: ReactNode;
  openItemId?: string | null;
  onOpenItemConsumed?: () => void;
  onStats?: (stats: { open: number }) => void;
}) {
  const { user, profile } = useAuth();
  const [feed, setFeed] = useState<FeedState>({
    vehicleId: undefined,
    notes: [],
    comments: {},
    loading: true,
    error: null,
  });
  const [store, setStore] = useState<ReturnType<typeof createVehicleFeed> | null>(null);
  const [itemOptions, setItemOptions] = useState<ItemOption[]>([]);
  const [segment, setSegment] = useState<Segment>("open");
  const [category, setCategory] = useState<CategoryFilter>("Alle");
  const [openId, setOpenId] = useState<string | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [itemSeg, setItemSeg] = useState<Segment>("open");
  const [ask, setAsk] = useState<Note | null>(null);
  const [pickNote, setPickNote] = useState<Note | null>(null);
  const [lingering, setLingering] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastState>(null);
  const [composerH, setComposerH] = useState(72);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lingerTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const toastSeq = useRef(0);

  const teamId = profile?.teamId;
  const fullName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : "";
  const items = useMemo(() => new Map(itemOptions.map((i) => [i.id, i])), [itemOptions]);

  // never render another vehicle's rows: anything not loaded for the selected vehicle counts as empty
  const { notes, comments, loading, error: loadError } = visibleFeed(feed, vehicleId);

  const legacyRef = useRef(legacyVehicleId ?? null);
  useEffect(() => {
    legacyRef.current = legacyVehicleId ?? null;
  }, [legacyVehicleId]);

  useEffect(() => {
    if (!teamId) return;
    const s = createVehicleFeed({
      legacyId: () => legacyRef.current,
      onChange: setFeed,
      fetchFor: async (vid: string | null) => {
        const res = await loadNotes(teamId, vid ? { id: vid, includeLegacy: vid === legacyRef.current } : null);
        if (res.error) return { notes: [], comments: {}, error: res.error };
        return { notes: res.notes, comments: await loadCommentsFor(res.notes.map((n) => n.id)), error: null };
      },
    });
    setStore(s);
    return () => setStore(null);
  }, [teamId]);

  useEffect(() => {
    if (store && vehicleId !== undefined) void store.select(vehicleId);
  }, [store, vehicleId]);

  // switching vehicles starts from a clean view: open tab, all categories, nothing opened
  const [shownFor, setShownFor] = useState(vehicleId);
  if (shownFor !== vehicleId) {
    setShownFor(vehicleId);
    setSegment("open");
    setCategory("Alle");
    setOpenId(null);
    setItemId(null);
    setItemSeg("open");
    setAsk(null);
    setPickNote(null);
  }

  const reload = useCallback(async () => {
    await store?.refresh();
  }, [store]);

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

  const openCount = notes.filter((n) => !n.is_resolved).length;
  useEffect(() => {
    onStats?.({ open: openCount });
  }, [openCount, onStats]);

  useEffect(() => {
    if (!openItemId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItemId(openItemId);
    setItemSeg("open");
    onOpenItemConsumed?.();
  }, [openItemId, onOpenItemConsumed]);

  const showToast = useCallback((message: string, undo?: () => void) => {
    clearTimeout(toastTimer.current);
    setToast({ id: ++toastSeq.current, message, undo });
    toastTimer.current = setTimeout(() => setToast(null), UNDO_MS);
  }, []);

  const patchNote = (id: string, p: Partial<Note>) => store?.patch(id, p);

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
      resolved_by: fullName || "-",
      resolved_at: new Date().toISOString(),
    });
    setLingering((s) => new Set(s).add(note.id));
    lingerTimers.current.set(
      note.id,
      setTimeout(() => stopLinger(note.id), UNDO_MS)
    );
    const ok = await resolveNote(note.id, fullName || "-");
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
  }

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
      Termine: inSegment.filter((n) => n.due_at).length,
      Medikamente: 0,
      BTM: 0,
      Fahrzeug: 0,
      Ausrüstung: 0,
      Sonstiges: 0,
    };
    inSegment.forEach((n) => {
      const k = noteCategory(n, items) as CategoryFilter;
      if (k in c && k !== "Alle" && k !== "Termine") c[k]++;
    });
    return c;
  }, [inSegment, items]);

  const activeCategory = counts[category] > 0 || category === "Alle" ? category : "Alle";

  const visible = useMemo(() => {
    let list = inSegment.filter((n) => {
      if (activeCategory === "Termine") return !!n.due_at;
      if (activeCategory === "Alle") return true;
      return noteCategory(n, items) === activeCategory;
    });
    if (segment === "done") {
      list = [...list].sort(
        (a, b) => +new Date(b.resolved_at ?? b.created_at) - +new Date(a.resolved_at ?? a.created_at)
      );
    } else if (activeCategory === "Termine") {
      list = [...list].sort((a, b) => +new Date(a.due_at ?? 0) - +new Date(b.due_at ?? 0));
    } else {
      list = [...list].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    }
    return list;
  }, [inSegment, activeCategory, items, segment]);

  const grouped = segment === "open" && activeCategory !== "Termine";

  const groups = useMemo(() => {
    if (!grouped) return [{ label: "", notes: visible }];
    const out: { label: string; notes: Note[] }[] = [];
    for (const n of visible) {
      const label = dayLabel(n.created_at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.notes.push(n);
      else out.push({ label, notes: [n] });
    }
    return out;
  }, [visible, grouped]);

  const openNote = notes.find((n) => n.id === openId) ?? null;
  const item = itemId ? items.get(itemId) : undefined;
  const itemNotes = itemId ? notes.filter((n) => n.item_id === itemId) : [];

  function openRow(n: Note) {
    if (n.item_id && items.has(n.item_id)) {
      setItemId(n.item_id);
      setItemSeg(n.is_resolved && !lingering.has(n.id) ? "done" : "open");
      return;
    }
    setOpenId(n.id);
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div className="feed">
        {top}
        <SegmentedFilter value={segment} onChange={setSegment} />
        {isAssignmentSupported() !== false && (
          <CategoryChips value={activeCategory} onChange={setCategory} counts={counts} />
        )}
        {loading || !teamId ? (
          <div className="fempty">
            <i className="spin" />
          </div>
        ) : loadError ? (
          <div className="fempty">
            Notizen konnten nicht geladen werden.
            <button type="button" className="more" onClick={() => void reload()}>
              Erneut versuchen
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="fempty">
            {segment === "open" ? "Keine offenen Notizen" : "Noch keine erledigten Notizen"}
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.label || "list"}>
              {g.label && <div className="day">{g.label}</div>}
              {g.notes.map((n) => (
                <NoteRow
                  key={n.id}
                  note={n}
                  items={items}
                  filter={activeCategory}
                  justDone={lingering.has(n.id)}
                  replies={comments[n.id] ?? []}
                  onOpen={() => openRow(n)}
                  onPickMaterial={
                    n.source === "raw" && !n.item_id ? () => setPickNote(n) : undefined
                  }
                />
              ))}
            </div>
          ))
        )}
      </div>

      {teamId && user && vehicleId !== undefined && (
        <Composer
          items={itemOptions}
          teamId={teamId}
          vehicleId={vehicleId}
          legacyVehicleId={legacyVehicleId ?? null}
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
          authorName={fullName}
          onClose={() => setOpenId(null)}
          onAskDone={() => setAsk(openNote)}
          onReopen={() => void reopen(openNote)}
          onChanged={() => void reload()}
          onPickMaterial={
            openNote.source === "raw" && !openNote.item_id ? () => setPickNote(openNote) : undefined
          }
        />
      )}

      {item && (
        <ItemScreen
          item={item}
          notes={itemNotes}
          comments={comments}
          segment={itemSeg}
          onSegment={setItemSeg}
          authorName={fullName}
          checkedAt={null}
          onClose={() => setItemId(null)}
          onAskDone={(n) => setAsk(n)}
          onReopen={(n) => void reopen(n)}
          onChanged={() => void reload()}
        />
      )}

      <BottomSheet
        open={!!ask}
        onClose={() => setAsk(null)}
        title="Notiz wirklich erledigt?"
        hideClose
        footer={
          <>
            <button
              type="button"
              className="btn btn-p"
              onClick={() => {
                if (ask) void complete(ask);
                setAsk(null);
              }}
            >
              Erledigt
            </button>
            <button type="button" className="btn btn-s" onClick={() => setAsk(null)}>
              Abbrechen
            </button>
          </>
        }
      >
        {ask && (
          <>
            <div className="dq">{ask.value}</div>
            <div className="dqm">
              {shortAuthor(ask.author_name)} · {rtime(ask.created_at)}
            </div>
          </>
        )}
      </BottomSheet>

      <ItemPicker
        open={!!pickNote}
        items={itemOptions}
        current={{
          itemId: pickNote?.item_id ?? null,
          category: (["Medikamente", "BTM", "Fahrzeug", "Ausrüstung", "Sonstiges"] as string[]).includes(
            pickNote?.category ?? ""
          )
            ? (pickNote?.category as NoteCategory)
            : "Sonstiges",
        }}
        onClose={() => setPickNote(null)}
        onPick={(pk) => {
          const n = pickNote;
          setPickNote(null);
          if (!n) return;
          void assignNote(n.id, pk.itemId, pk.category).then((ok) => {
            if (!ok) showToast("Konnte nicht gespeichert werden");
            else void reload();
          });
        }}
      />
    </div>
  );
}
