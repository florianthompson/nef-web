"use client";

import { useState } from "react";
import { CalendarIcon, CheckIcon, ChevronDownIcon, StickyNoteIcon } from "lucide-react";
import type { ItemOption, Note, NoteComment } from "@/lib/notes";
import { closedMeta, dueIsHot, dueLabel, shortAuthor, timeMeta } from "./format";
import type { CategoryFilter } from "./CategoryChips";

export function noteCategory(n: Note, items: Map<string, ItemOption>): string {
  const it = n.item_id ? items.get(n.item_id) : undefined;
  return it?.category ?? n.category ?? "Sonstiges";
}

const LONG_RAW = 110;

function Chip({
  note,
  items,
  filter,
}: {
  note: Note;
  items: Map<string, ItemOption>;
  filter: CategoryFilter;
}) {
  const it = note.item_id ? items.get(note.item_id) : undefined;
  const cat = noteCategory(note, items);
  const broad = filter === "Alle" || filter === "Termine";
  if (broad) {
    if (cat === "Sonstiges" && !it) return null;
    return (
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
    );
  }
  if (!it) return null;
  return (
    <span className="chip">
      <span>{it.title}</span>
    </span>
  );
}

export function NoteRow({
  note,
  items,
  filter,
  justDone,
  replies,
  onOpen,
  onPickMaterial,
}: {
  note: Note;
  items: Map<string, ItemOption>;
  filter: CategoryFilter;
  justDone: boolean;
  replies: NoteComment[];
  onOpen: () => void;
  onPickMaterial?: () => void;
}) {
  const [more, setMore] = useState(false);
  const done = note.is_resolved;
  const due = note.due_at ? new Date(note.due_at) : null;
  const dueHasTime = !!due && (due.getHours() !== 0 || due.getMinutes() !== 0);
  const raw = note.source === "raw";
  const long = raw && note.value.length > LONG_RAW;
  const last = replies[replies.length - 1];
  const it = note.item_id ? items.get(note.item_id) : undefined;
  const cat = noteCategory(note, items);
  const broad = filter === "Alle" || filter === "Termine";
  const showChip = broad ? !(cat === "Sonstiges" && !it) : !!it;
  const showMat = raw && !note.item_id && !!onPickMaterial;

  return (
    <div
      className={`tn${done ? " dn" : ""}${justDone ? " undo" : ""}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      {done ? (
        <span className="dck">
          <CheckIcon />
        </span>
      ) : (
        <i className="dot" />
      )}
      {(showChip || due || showMat) && (
        <div className="tg">
          {showChip && <Chip note={note} items={items} filter={filter} />}
          {due && (
            <span className={`due${!done && dueIsHot(due) ? " hot" : ""}`}>
              <CalendarIcon className="ic" />
              {dueLabel(due, dueHasTime)}
            </span>
          )}
          {showMat && (
            <button
              type="button"
              className="chip gen vpk"
              onClick={(e) => {
                e.stopPropagation();
                onPickMaterial();
              }}
            >
              <span>Material wählen</span>
              <ChevronDownIcon className="ic" />
            </button>
          )}
        </div>
      )}
      <p className={long && !more ? "clamp3" : undefined}>{note.value}</p>
      {long && (
        <button
          type="button"
          className="more"
          aria-expanded={more}
          onClick={(e) => {
            e.stopPropagation();
            setMore((v) => !v);
          }}
        >
          {more ? "weniger" : "mehr"}
        </button>
      )}
      <div className="mt">
        <span>
          {done
            ? closedMeta(note.resolved_by, note.resolved_at)
            : `${shortAuthor(note.author_name)} · ${timeMeta(note.created_at)}`}
        </span>
        {replies.length > 0 && (
          <span className="rpi" aria-label={`${replies.length} Antworten`}>
            <StickyNoteIcon className="ic" />
            {replies.length}
          </span>
        )}
      </div>
      {!done && last && (
        <span className="rpv">
          <b>{last.author_name}:</b> {last.value}
        </span>
      )}
    </div>
  );
}
