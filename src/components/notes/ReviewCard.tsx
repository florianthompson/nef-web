"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { CalendarIcon, ChevronDownIcon, XIcon } from "lucide-react";
import type { ItemOption, NoteCategory } from "@/lib/notes";
import { BottomSheet } from "./BottomSheet";
import { ItemPicker } from "./ItemPicker";
import { dueLabel, isoDay, parseLocal } from "./format";

export type ReviewPart = {
  key: number;
  text: string;
  itemId: string | null;
  category: NoteCategory;
  dueDate: string | null;
  dueText: string | null;
  manual?: boolean;
};

function AutoTextarea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = t.scrollHeight + "px";
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      aria-label="Text"
      onChange={(e) => onChange(e.target.value)}
      className="-mx-2.5 -mt-2 block w-[calc(100%+20px)] resize-none overflow-hidden rounded-lg bg-transparent px-2.5 py-[11px] text-base leading-[22px] text-text outline-none focus:ring-1 focus:ring-zinc-600"
    />
  );
}

function DueSheet({
  open,
  initial,
  onClose,
  onSet,
}: {
  open: boolean;
  initial: string | null;
  onClose: () => void;
  onSet: (iso: string | null) => void;
}) {
  // mounted per opening (keyed by the parent), so the initial values are enough
  const [date, setDate] = useState(isoDay(initial ? parseLocal(initial) : new Date()));
  const [time, setTime] = useState(initial && initial.length > 10 ? initial.slice(11, 16) : "");
  const field =
    "h-12 w-full min-w-0 rounded-[10px] border border-border bg-surface px-3 text-[17px] text-text [color-scheme:dark]";
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Termin"
      z={3}
      footer={
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="btn btn-p"
            disabled={!date}
            onClick={() => onSet(time ? `${date}T${time}` : date)}
          >
            Übernehmen
          </button>
          {initial && (
            <button type="button" className="btn btn-s" onClick={() => onSet(null)}>
              Termin entfernen
            </button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-3 px-4 pt-1 pb-4">
        <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">
          Datum
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">
          Uhrzeit (optional)
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
        </label>
      </div>
    </BottomSheet>
  );
}

export function ReviewCard({
  orig,
  parts,
  hint,
  items,
  sending,
  onParts,
  onClose,
  onSend,
  onSendRaw,
}: {
  orig: string;
  parts: ReviewPart[];
  hint: string;
  items: ItemOption[];
  sending: boolean;
  onParts: (p: ReviewPart[]) => void;
  onClose: () => void;
  onSend: () => void;
  onSendRaw: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [pickFor, setPickFor] = useState<number | null>(null);
  const [dueFor, setDueFor] = useState<number | null>(null);
  const [undo, setUndo] = useState<{ part: ReviewPart; index: number } | null>(null);
  const origRef = useRef<HTMLParagraphElement>(null);
  const byId = new Map(items.map((i) => [i.id, i]));
  const multi = parts.length > 1;
  const valid = parts.filter((p) => p.text.trim()).length;

  useLayoutEffect(() => {
    const o = origRef.current;
    if (o && !expanded) setOverflows(o.scrollHeight > o.clientHeight + 1);
  }, [orig, expanded]);

  const patch = (key: number, p: Partial<ReviewPart>) =>
    onParts(parts.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const pickPart = parts.find((p) => p.key === pickFor);
  const duePart = parts.find((p) => p.key === dueFor);

  return (
    <section aria-label="Prüfen" className="tray show">
      <div className="flex min-h-[52px] shrink-0 items-center pr-1 pl-4">
        <b className="text-[17px] font-semibold">Prüfen</b>
        <button
          type="button"
          onClick={onClose}
          aria-label="Verwerfen, Text behalten"
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-full text-zinc-400"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2">
        {hint && <p className="pb-2 text-xs text-zinc-500">{hint}</p>}
        <div className="mb-3.5 border-b border-border pt-1 pb-3">
          <div className="mb-1 text-xs font-medium tracking-[0.02em] text-zinc-500">Deine Nachricht</div>
          <p
            ref={origRef}
            className={`text-sm leading-5 break-words whitespace-pre-wrap text-zinc-400 ${
              expanded ? "" : "line-clamp-3"
            }`}
          >
            {orig.trim()}
          </p>
          {(overflows || expanded) && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              aria-expanded={expanded}
              className="-mb-1.5 py-1.5 text-[13px] text-zinc-400 underline underline-offset-4"
            >
              {expanded ? "weniger" : "mehr"}
            </button>
          )}
        </div>

        <div className="mb-1 text-xs font-medium tracking-[0.02em] text-zinc-500">Wird so zugeordnet</div>
        {parts.map((p, i) => {
          const it = p.itemId ? byId.get(p.itemId) : undefined;
          const gen = !it && p.category === "Sonstiges";
          const due = p.dueDate ? parseLocal(p.dueDate) : null;
          return (
            <div key={p.key} className="relative flex items-start gap-1 border-border pt-2.5 pb-3 [&:not(:first-of-type)]:border-t">
              <div className="min-w-0 flex-1">
                <AutoTextarea value={p.text} onChange={(v) => patch(p.key, { text: v })} />
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPickFor(p.key)}
                    className={`inline-flex h-7 max-w-full items-center gap-1 rounded-full px-2.5 text-[13px] font-medium ${
                      gen
                        ? "border border-zinc-700 text-zinc-400"
                        : p.manual
                          ? "bg-zinc-700 text-zinc-50"
                          : "bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    <span className="truncate">
                      {it ? (
                        <>
                          <em className="text-zinc-400 not-italic">{p.category} · </em>
                          {it.title}
                        </>
                      ) : (
                        p.category
                      )}
                    </span>
                    <ChevronDownIcon className="h-3.5 w-3.5 shrink-0" />
                  </button>
                  {due ? (
                    <span className="inline-flex h-7 items-center rounded-full bg-zinc-800 text-[13px] font-medium text-zinc-300">
                      <button
                        type="button"
                        onClick={() => setDueFor(p.key)}
                        aria-label="Termin ändern"
                        className="inline-flex h-full items-center gap-1 pr-0.5 pl-2.5"
                      >
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {dueLabel(due, !!p.dueDate && p.dueDate.length > 10, false)}
                      </button>
                      <button
                        type="button"
                        onClick={() => patch(p.key, { dueDate: null, dueText: null })}
                        aria-label="Termin entfernen"
                        className="flex h-full w-8 items-center justify-center text-zinc-400"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDueFor(p.key)}
                      className="inline-flex h-7 items-center rounded-full border border-zinc-700 px-2.5 text-[13px] font-medium text-zinc-400"
                    >
                      + Datum
                    </button>
                  )}
                </div>
              </div>
              {multi && (
                <button
                  type="button"
                  aria-label="Notiz entfernen"
                  onClick={() => {
                    setUndo({ part: p, index: i });
                    onParts(parts.filter((x) => x.key !== p.key));
                  }}
                  className="-mt-0.5 -mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-400 active:bg-zinc-800"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
        {undo && (
          <div className="flex min-h-11 items-center justify-between gap-3 text-sm text-zinc-400">
            <span>Notiz entfernt</span>
            <button
              type="button"
              onClick={() => {
                const next = [...parts];
                next.splice(Math.min(undo.index, next.length), 0, undo.part);
                onParts(next);
                setUndo(null);
              }}
              className="min-h-11 px-1 font-medium text-zinc-100 underline underline-offset-4"
            >
              Rückgängig
            </button>
          </div>
        )}
      </div>

      <div className="tr-f">
        <button type="button" className="btn btn-p" onClick={onSend} disabled={!valid || sending}>
          {multi ? `Senden (${valid})` : "Senden"}
        </button>
        <button type="button" className="tr-raw" onClick={onSendRaw} disabled={sending}>
          Ohne Zuordnung senden
        </button>
      </div>

      <ItemPicker
        open={!!pickPart}
        items={items}
        current={{ itemId: pickPart?.itemId ?? null, category: pickPart?.category ?? "Sonstiges" }}
        onClose={() => setPickFor(null)}
        onPick={(pk) => {
          if (pickFor != null) patch(pickFor, { itemId: pk.itemId, category: pk.category, manual: true });
          setPickFor(null);
        }}
      />
      {duePart && (
        <DueSheet
          key={duePart.key}
          open
          initial={duePart.dueDate}
          onClose={() => setDueFor(null)}
          onSet={(iso) => {
            patch(duePart.key, { dueDate: iso, dueText: iso ? duePart.dueText : null });
            setDueFor(null);
          }}
        />
      )}
    </section>
  );
}
