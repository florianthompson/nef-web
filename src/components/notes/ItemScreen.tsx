"use client";

import { useState } from "react";
import { ArrowUpIcon, CalendarIcon, CheckIcon, ChevronLeftIcon } from "lucide-react";
import { addComment, type ItemOption, type Note, type NoteComment } from "@/lib/notes";
import { closedMeta, dueIsHot, dueLabel, hm, rtime, shortAuthor } from "./format";

export function ItemScreen({
  item,
  notes,
  comments,
  segment,
  onSegment,
  authorName,
  checkedAt,
  onClose,
  onAskDone,
  onReopen,
  onChanged,
}: {
  item: ItemOption;
  notes: Note[];
  comments: Record<string, NoteComment[]>;
  segment: "open" | "done";
  onSegment: (s: "open" | "done") => void;
  authorName: string;
  checkedAt: string | null;
  onClose: () => void;
  onAskDone: (note: Note) => void;
  onReopen: (note: Note) => void;
  onChanged: () => void;
}) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sel, setSel] = useState<string | null>(notes.find((n) => !n.is_resolved)?.id ?? notes[0]?.id ?? null);
  const shown = notes.filter((n) => (segment === "done" ? n.is_resolved : !n.is_resolved));
  const target = notes.find((n) => n.id === sel && !n.is_resolved) ?? notes.find((n) => !n.is_resolved) ?? null;

  async function send() {
    const v = reply.trim();
    if (!v || sending || !target) return;
    setSending(true);
    const ok = await addComment(target.id, authorName || "Unbekannt", v);
    setSending(false);
    if (!ok) return;
    setReply("");
    onChanged();
  }

  return (
    <div className="nd show" id="item-screen" role="dialog">
      <div className="nd-h is-h" id="is-h">
        <button type="button" className="back" aria-label="Zurück" onClick={onClose}>
          <ChevronLeftIcon className="ic" style={{ width: 22, height: 22 }} />
        </button>
        <div className="is-t">
          <b>{item.title}</b>
          {item.parentTitle && <span>{item.parentTitle}</span>}
        </div>
        {checkedAt && (
          <span className="is-st">
            <CheckIcon className="ic" />
            Abgehakt · {hm(new Date(checkedAt))}
          </span>
        )}
      </div>
      <div className="nd-b is-b" id="is-b">
        <div className="segw is">
          <div className="seg" role="group" aria-label="Notizen">
            {(["open", "done"] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={`sg${segment === k ? " on" : ""}`}
                aria-pressed={segment === k}
                onClick={() => onSegment(k)}
              >
                {k === "open" ? "Offen" : "Erledigt"}
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 && (
          <div className="is-empty">
            {segment === "done" ? "Noch keine erledigten Notizen" : "Keine offenen Notizen"}
          </div>
        )}
        {shown.map((n) => {
          const due = n.due_at ? new Date(n.due_at) : null;
          const dueHasTime = !!due && (due.getHours() !== 0 || due.getMinutes() !== 0);
          const rs = comments[n.id] ?? [];
          const selOn = !n.is_resolved && notes.filter((x) => !x.is_resolved).length > 1 && n.id === (target?.id ?? sel);
          if (n.is_resolved) {
            return (
              <div key={n.id} className="th dn">
                <div className="nd-t">{n.value}</div>
                <div className="nd-m">
                  {shortAuthor(n.author_name)} · {rtime(n.created_at)}
                </div>
                {due && (
                  <div className="nd-due">
                    <span className="due">
                      <CalendarIcon className="ic" />
                      {dueLabel(due, dueHasTime)}
                    </span>
                  </div>
                )}
                {rs.length > 0 && (
                  <div className="rps">
                    {rs.map((r) => (
                      <div key={r.id} className="rpl">
                        <div className="a">
                          <b>{r.author_name}</b>
                          <span>{rtime(r.created_at)}</span>
                        </div>
                        <p>{r.value}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="nd-st">
                  <span>
                    <CheckIcon className="ic" />
                    {closedMeta(n.resolved_by, n.resolved_at)}
                  </span>
                  <button type="button" className="nd-re" onClick={() => onReopen(n)}>
                    Wieder öffnen
                  </button>
                </div>
              </div>
            );
          }
          return (
            <div
              key={n.id}
              className={`th${selOn ? " sel" : ""}`}
              onClick={() => setSel(n.id)}
            >
              <div className="nd-t">{n.value}</div>
              <div className="nd-m">
                {shortAuthor(n.author_name)} · {rtime(n.created_at)}
              </div>
              {due && (
                <div className="nd-due">
                  <span className={`due${dueIsHot(due) ? " hot" : ""}`}>
                    <CalendarIcon className="ic" />
                    {dueLabel(due, dueHasTime)}
                  </span>
                </div>
              )}
              {rs.length > 0 && (
                <div className="rps">
                  {rs.map((r) => (
                    <div key={r.id} className="rpl">
                      <div className="a">
                        <b>{r.author_name}</b>
                        <span>{rtime(r.created_at)}</span>
                      </div>
                      <p>{r.value}</p>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="btn btn-s"
                onClick={(e) => {
                  e.stopPropagation();
                  onAskDone(n);
                }}
              >
                Als erledigt markieren
              </button>
            </div>
          );
        })}
      </div>
      <div className="is-c" id="is-c">
        <div className="is-r">
          <textarea
            rows={1}
            aria-label="Notiz"
            placeholder={target ? "Antworten …" : "Notiz hinzufügen …"}
            value={reply}
            disabled={!target}
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
            aria-label="Senden"
            disabled={!reply.trim() || sending || !target}
            onClick={() => void send()}
          >
            <ArrowUpIcon className="ic" />
          </button>
        </div>
      </div>
    </div>
  );
}
