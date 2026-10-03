"use client";

import { useEffect, useState } from "react";
import { ChevronLeftIcon } from "lucide-react";
import { loadComments, type ItemOption, type Note, type NoteComment } from "@/lib/notes";
import { NoteChips } from "./NoteRow";
import { dateTime } from "./format";

export function NoteDetail({
  note,
  items,
  showChips,
  onClose,
  onComplete,
  onReopen,
}: {
  note: Note;
  items: Map<string, ItemOption>;
  showChips: boolean;
  onClose: () => void;
  onComplete: () => void;
  onReopen: () => void;
}) {
  const [comments, setComments] = useState<NoteComment[] | null>(null);

  useEffect(() => {
    let live = true;
    loadComments(note.id).then((c) => live && setComments(c));
    return () => {
      live = false;
    };
  }, [note.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[45] flex justify-center bg-bg">
      <div className="flex h-full w-full max-w-lg flex-col">
        <div
          className="flex shrink-0 items-center gap-1 border-b border-border px-2 pb-2"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 8px)" }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-400"
          >
            <ChevronLeftIcon className="h-[22px] w-[22px]" />
          </button>
          <h1 className="text-base font-semibold">Notiz</h1>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {showChips && <NoteChips note={note} items={items} done={note.is_resolved} />}
          <div className="mt-1.5 mb-1 text-[17px] leading-6 break-words whitespace-pre-wrap">
            {note.value}
          </div>
          <div className="mb-4 text-[13px] text-text-muted">
            {note.author_name} · {dateTime(note.created_at)}
            {note.vehicle_name ? ` · ${note.vehicle_name}` : ""}
          </div>

          {note.is_resolved ? (
            <div className="flex items-center justify-between gap-3 text-[13px] text-zinc-400">
              <span>
                Erledigt von {note.resolved_by ?? "—"}
                {note.resolved_at ? ` · ${dateTime(note.resolved_at)}` : ""}
              </span>
              <button
                type="button"
                onClick={onReopen}
                className="min-h-11 px-1 font-medium text-zinc-100 underline underline-offset-4"
              >
                Wieder öffnen
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onComplete}
              className="flex min-h-11 w-full items-center justify-center rounded-[10px] bg-zinc-100 font-semibold text-zinc-900 active:scale-[0.98]"
            >
              Erledigt
            </button>
          )}

          <div className="mt-5">
            <div className="mb-1 text-[13px] font-medium text-zinc-500">
              {comments?.length ? (comments.length === 1 ? "1 Antwort" : `${comments.length} Antworten`) : "Antworten"}
            </div>
            {comments?.length ? (
              comments.map((c) => (
                <div key={c.id} className="border-t border-border py-3">
                  <div className="flex items-baseline gap-2">
                    <b className="text-[15px] font-semibold">{c.author_name}</b>
                    <span className="text-[13px] text-text-muted">{dateTime(c.created_at)}</span>
                  </div>
                  <p className="mt-0.5 text-[15px] leading-[22px] break-words whitespace-pre-wrap">
                    {c.value}
                  </p>
                </div>
              ))
            ) : (
              <div className="border-t border-border py-3 text-[15px] text-zinc-500">
                {comments === null ? "Lädt …" : "Noch keine Antworten"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
