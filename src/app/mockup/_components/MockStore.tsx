"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  ME,
  SEED_COMMENTS,
  SEED_LAST_HANDOVER,
  SEED_NOTES,
  type Comment,
  type Note,
  type NoteEvent,
  type NoteEventType,
} from "../_data";

type SheetState = { open: boolean; preset: "material" | null; nonce: number; vehicleId?: string };

type Store = {
  notes: Note[];
  comments: Comment[];
  ackedIds: string[];
  lastHandover: Record<string, string>;
  toastMsg: string | null;
  sheet: SheetState;
  addNote: (n: Note) => void;
  patchNote: (id: string, patch: Partial<Note>, event?: { type: NoteEventType; text?: string }) => void;
  addComment: (noteId: string, body: string, photo?: boolean) => void;
  setAck: (id: string, value: boolean) => void;
  completeNotes: (ids: string[]) => void;
  markHandover: (vehicleId: string) => void;
  toast: (msg: string) => void;
  openAddNote: (opts?: { preset?: "material"; vehicleId?: string }) => void;
  closeAddNote: () => void;
};

const Ctx = createContext<Store | null>(null);

export function useMock() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useMock outside MockProvider");
  return s;
}

let seq = 100;
export const newId = (p: string) => `${p}${++seq}`;

function mkEvent(type: NoteEventType, text?: string): NoteEvent {
  return { id: newId("e"), type, by: ME, at: new Date().toISOString(), text };
}

// Only rendered client-side (see MockRoot), so reading the URL in initialisers is safe.
function initialSheet(): SheetState {
  const p = new URLSearchParams(window.location.search).get("sheet");
  return { open: p === "neu" || p === "material", preset: p === "material" ? "material" : null, nonce: 1 };
}

export function MockProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<Note[]>(SEED_NOTES);
  const [comments, setComments] = useState<Comment[]>(SEED_COMMENTS);
  const [ackedIds, setAckedIds] = useState<string[]>([]);
  const [lastHandover, setLastHandover] = useState(SEED_LAST_HANDOVER);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>(initialSheet);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastMsg(null), 2500);
  }, []);

  const patchNote: Store["patchNote"] = useCallback((id, patch, event) => {
    setNotes((ns) =>
      ns.map((n) =>
        n.id === id
          ? { ...n, ...patch, events: event ? [...n.events, mkEvent(event.type, event.text)] : n.events }
          : n
      )
    );
  }, []);

  const store: Store = {
    notes,
    comments,
    ackedIds,
    lastHandover,
    toastMsg,
    sheet,
    addNote: (n) => setNotes((ns) => [...ns, n]),
    patchNote,
    addComment: (noteId, body, photo) =>
      setComments((cs) => [
        ...cs,
        { id: newId("c"), noteId, authorId: ME, body, createdAt: new Date().toISOString(), photo },
      ]),
    setAck: (id, value) =>
      setAckedIds((a) => (value ? (a.includes(id) ? a : [...a, id]) : a.filter((x) => x !== id))),
    completeNotes: (ids) =>
      setNotes((ns) =>
        ns.map((n) =>
          ids.includes(n.id) ? { ...n, status: "done", events: [...n.events, mkEvent("completed")] } : n
        )
      ),
    markHandover: (vehicleId) =>
      setLastHandover((h) => ({ ...h, [vehicleId]: new Date().toISOString() })),
    toast,
    openAddNote: (opts) =>
      setSheet((s) => ({ open: true, preset: opts?.preset ?? null, vehicleId: opts?.vehicleId, nonce: s.nonce + 1 })),
    closeAddNote: () => setSheet((s) => ({ ...s, open: false })),
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
