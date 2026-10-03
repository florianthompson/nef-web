"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  MoreHorizontalIcon,
  PencilIcon,
  XIcon,
} from "lucide-react";
import {
  addComment,
  loadComments,
  updateNoteValue,
  type ItemOption,
  type Note,
  type NoteComment,
} from "@/lib/notes";
import { dueIsHot, dueLabel, dm, hm, rtime, closedMeta } from "./format";
import { noteCategory } from "./NoteRow";

export function NoteDetail({
  note,
  items,
  authorName,
  onClose,
  onAskDone,
  onReopen,
  onChanged,
  onPickMaterial,
}: {
  note: Note;
  items: Map<string, ItemOption>;
  authorName: string;
  onClose: () => void;
  onAskDone: () => void;
  onReopen: () => void;
  onChanged: () => void;
  onPickMaterial?: () => void;
}) {
  const [comments, setComments] = useState<NoteComment[] | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.value);

  useEffect(() => {
    let live = true;
    loadComments(note.id).then((c) => live && setComments(c));
    return () => {
      live = false;
    };
  }, [note.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (menu) setMenu(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, menu]);

  const it = note.item_id ? items.get(note.item_id) : undefined;
  const cat = noteCategory(note, items);
  const due = note.due_at ? new Date(note.due_at) : null;
  const dueHasTime = !!due && (due.getHours() !== 0 || due.getMinutes() !== 0);
  const when = `${note.author_name} · ${
    new Date(note.created_at).toDateString() === new Date().toDateString()
      ? "Heute"
      : dm(new Date(note.created_at))
  }, ${hm(new Date(note.created_at))}`;

  async function send() {
    const v = reply.trim();
    if (!v || sending) return;
    setSending(true);
    const ok = await addComment(note.id, authorName || "Unbekannt", v);
    setSending(false);
    if (!ok) return;
    setReply("");
    const next = await loadComments(note.id);
    setComments(next);
    onChanged();
  }

  async function saveEdit() {
    const v = draft.trim();
    if (!v) return;
    const ok = await updateNoteValue(note.id, v);
    if (!ok) return;
    setEditing(false);
    onChanged();
  }

  const countLabel =
    comments === null
      ? "Antworten"
      : comments.length === 0
        ? "Antworten"
        : comments.length === 1
          ? "1 Antwort"
          : `${comments.length} Antworten`;

  return (
    <div className="nd show" role="dialog" aria-label="Notiz">
      <div className="nd-h">
        <button type="button" className="back" aria-label="Schließen" onClick={onClose}>
          <ChevronLeftIcon className="ic" style={{ width: 22, height: 22 }} />
        </button>
        <div className="tt">
          {(it || cat !== "Sonstiges") && (
            <span className="chip">
              <span>
                {it ? (
                  <>
                    <em className="cc">{cat} · </em>
                    {it.title}
                  </>
                ) : (
                  cat
                )}
              </span>
            </span>
          )}
        </div>
        <button
          type="button"
          className="back"
          aria-label="Mehr"
          aria-haspopup="menu"
          onClick={() => setMenu(true)}
        >
          <MoreHorizontalIcon className="ic" />
        </button>
      </div>
      <div className={`nd-b${note.is_resolved ? " cl" : ""}`}>
        {editing ? (
          <>
            <textarea className="ta" style={{ marginTop: 8 }} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="row2">
              <button type="button" className="btn btn-s" onClick={() => setEditing(false)}>
                Abbrechen
              </button>
              <button type="button" className="btn btn-p" onClick={() => void saveEdit()}>
                Speichern
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="nd-t">{note.value}</div>
            <div className="nd-m">{when}</div>
            {note.source === "raw" && !note.item_id && onPickMaterial && (
              <div className="vx">
                <button type="button" className="chip gen vpk" onClick={onPickMaterial}>
                  <span>Material wählen</span>
                  <ChevronDownIcon className="ic" />
                </button>
              </div>
            )}
            {due && (
              <div className="nd-due">
                <span className={`due${!note.is_resolved && dueIsHot(due) ? " hot" : ""}`}>
                  <CalendarIcon className="ic" />
                  {dueLabel(due, dueHasTime)}
                </span>
              </div>
            )}
            {note.is_resolved ? (
              <div className="nd-st">
                <span>
                  <CheckIcon className="ic" />
                  {closedMeta(note.resolved_by, note.resolved_at)}
                </span>
                <button type="button" className="nd-re" onClick={onReopen}>
                  Wieder öffnen
                </button>
              </div>
            ) : (
              <button type="button" className="btn nd-done" onClick={onAskDone}>
                Als erledigt markieren
              </button>
            )}
          </>
        )}
        <div className="rps">
          <div className="rps-l">{countLabel}</div>
          {comments?.length ? (
            comments.map((c) => (
              <div key={c.id} className="rpl">
                <div className="a">
                  <b>{c.author_name}</b>
                  <span>{rtime(c.created_at)}</span>
                </div>
                <p>{c.value}</p>
              </div>
            ))
          ) : (
            <div className="rp-none">{comments === null ? "Lädt …" : "Noch keine Antworten"}</div>
          )}
        </div>
      </div>
      <div className="nd-c">
        <textarea
          rows={1}
          placeholder="Antworten …"
          aria-label="Antwort"
          value={reply}
          onChange={(e) => {
            setReply(e.target.value);
            const t = e.target;
            t.style.height = "auto";
            t.style.height = Math.min(t.scrollHeight + 2, 108) + "px";
          }}
        />
        <button
          type="button"
          className="rb send"
          aria-label="Antwort senden"
          disabled={!reply.trim() || sending}
          onClick={() => void send()}
        >
          <ArrowUpIcon className="ic" />
        </button>
      </div>
      {menu && (
        <div className="nd-mb show" onClick={() => setMenu(false)}>
          <div className="nd-menu" role="menu" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setDraft(note.value);
                setEditing(true);
                setMenu(false);
              }}
            >
              <PencilIcon className="ic" />
              Bearbeiten
            </button>
            <button type="button" role="menuitem" onClick={() => setMenu(false)}>
              <XIcon className="ic" />
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
