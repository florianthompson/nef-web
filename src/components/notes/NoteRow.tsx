"use client";

import { CalendarIcon, CheckIcon } from "lucide-react";
import type { ItemOption, Note } from "@/lib/notes";
import { dateTime, dueIsHot, dueLabel, hm } from "./format";

export function noteCategory(n: Note, items: Map<string, ItemOption>): string {
  const it = n.item_id ? items.get(n.item_id) : undefined;
  return it?.category ?? n.category ?? "Sonstiges";
}

/** Category · item chip and date chip (only meaningful when assignment is stored). */
export function NoteChips({
  note,
  items,
  done,
}: {
  note: Note;
  items: Map<string, ItemOption>;
  done?: boolean;
}) {
  const it = note.item_id ? items.get(note.item_id) : undefined;
  const cat = noteCategory(note, items);
  const due = note.due_at ? new Date(note.due_at) : null;
  const dueHasTime = !!due && (due.getHours() !== 0 || due.getMinutes() !== 0);
  const showCat = it || cat !== "Sonstiges";
  if (!showCat && !due) return null;
  return (
    <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
      {showCat && (
        <span className="inline-flex h-[22px] max-w-full items-center rounded-full bg-zinc-800 px-2.5 text-[13px] font-medium text-zinc-300">
          <span className="truncate">
            {it ? (
              <>
                <em className="text-zinc-400 not-italic">{cat} · </em>
                {it.title}
              </>
            ) : (
              cat
            )}
          </span>
        </span>
      )}
      {due && (
        <span
          className={`inline-flex h-[22px] items-center gap-1 rounded-full bg-zinc-800 px-2.5 text-[13px] font-medium whitespace-nowrap ${
            !done && dueIsHot(due) ? "text-[#fb923c]" : "text-zinc-300"
          } ${done ? "opacity-60" : ""}`}
        >
          <CalendarIcon className="h-3 w-3" />
          {dueLabel(due, dueHasTime)}
        </span>
      )}
    </div>
  );
}

export function NoteRow({
  note,
  items,
  showChips,
  justDone,
  segment,
  onOpen,
  onComplete,
}: {
  note: Note;
  items: Map<string, ItemOption>;
  showChips: boolean;
  justDone: boolean;
  segment: "open" | "done";
  onOpen: () => void;
  onComplete: () => void;
}) {
  const done = note.is_resolved;
  const time = hm(new Date(note.created_at));
  const meta =
    segment === "done" && note.resolved_at
      ? `Erledigt von ${note.resolved_by ?? "—"} · ${dateTime(note.resolved_at)}`
      : `${note.author_name} · ${time}${note.vehicle_name ? ` · ${note.vehicle_name}` : ""}`;
  return (
    <div className={`relative flex items-stretch transition-opacity ${done ? "opacity-60" : ""}`}>
      <button
        type="button"
        onClick={onComplete}
        disabled={done}
        aria-label={done ? "Erledigt" : "Als erledigt markieren"}
        className="flex w-12 shrink-0 items-start justify-center pt-3"
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] transition-colors ${
            done || justDone ? "border-zinc-50 bg-zinc-50 text-zinc-950" : "border-zinc-600 text-transparent"
          }`}
        >
          <CheckIcon className="h-3.5 w-3.5" />
        </span>
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 py-3 pr-4 text-left active:bg-surface"
      >
        {showChips && <NoteChips note={note} items={items} done={done} />}
        <p
          className={`line-clamp-3 text-base leading-[22px] break-words whitespace-pre-wrap ${
            done ? "text-zinc-400 line-through decoration-white/25" : ""
          }`}
        >
          {note.value}
        </p>
        <small className="mt-0.5 block truncate text-[13px] leading-[18px] text-text-muted">
          {meta}
        </small>
      </button>
    </div>
  );
}
