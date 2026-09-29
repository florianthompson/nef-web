"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CameraIcon, CheckIcon, ChevronLeftIcon, MoreHorizontalIcon, SendIcon } from "lucide-react";
import { ME, TEAM, type Note } from "../../_data";
import { dueLabel, firstName, isOpenTask, memberName, timeLabel, vehicleName } from "../../_lib";
import { Avatar, CriticalBadge, DueBadge, ItemChip, PhotoPlaceholder, StatusPill } from "../../_components/NoteBits";
import { useMock } from "../../_components/MockStore";

type Dialog = "dismiss" | "reopen" | "assign" | "due" | "prio" | "edit" | null;

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-bg p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

const chip = (on: boolean) =>
  `rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
    on ? "border-red/40 bg-red/15 text-red" : "border-border bg-surface text-text-muted"
  }`;
const textarea =
  "w-full resize-none rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-red focus:outline-none";

function TextDialog({
  title,
  hint,
  initial = "",
  minLen,
  placeholder,
  confirm,
  onClose,
  onSubmit,
}: {
  title: string;
  hint?: string;
  initial?: string;
  minLen: number;
  placeholder: string;
  confirm: string;
  onClose: () => void;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState(initial);
  const ok = text.trim().length >= minLen;
  return (
    <Modal title={title} onClose={onClose}>
      {hint && <p className="mb-3 text-xs text-text-muted">{hint}</p>}
      <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={placeholder} className={textarea} />
      <div className="mt-4 flex gap-3">
        <button onClick={onClose} className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium">
          Abbrechen
        </button>
        <button
          onClick={() => onSubmit(text.trim())}
          disabled={!ok}
          className="flex-1 rounded-lg bg-red py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {confirm}
        </button>
      </div>
    </Modal>
  );
}

function Detail({ note }: { note: Note }) {
  const { comments, ackedIds, patchNote, addComment, setAck, toast } = useMock();
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [draft, setDraft] = useState("");
  const [draftPhoto, setDraftPhoto] = useState(false);

  const isTask = note.kind === "task";
  const acked = ackedIds.includes(note.id);
  const noteComments = comments.filter((c) => c.noteId === note.id);
  const close = () => setDialog(null);

  // Thread: comments + status lines derived from the note, chronological
  type Line = { at: string; id: string } & ({ type: "status"; text: string } | { type: "comment"; c: (typeof noteComments)[number] });
  const lines: Line[] = [
    { at: note.createdAt, id: "created", type: "status" as const, text: `Erstellt von ${firstName(note.authorId)} · ${timeLabel(note.createdAt)}` },
    ...note.events.map((e): Line => {
      const who = firstName(e.by);
      const t = timeLabel(e.at);
      const text = {
        started: `Übernommen von ${who} · ${t}`,
        completed: `Erledigt von ${who} · ${t}`,
        reopened: `Wieder geöffnet von ${who} · ${t}`,
        dismissed: `Verworfen von ${who} · ${t}${e.text ? `: ${e.text}` : ""}`,
        to_task: `Als Aufgabe markiert von ${who} · ${t}`,
        assigned: `${who} hat ${e.text ?? "niemanden"} zugewiesen · ${t}`,
      }[e.type];
      return { at: e.at, id: e.id, type: "status", text };
    }),
    ...noteComments.map((c): Line => ({ at: c.createdAt, id: c.id, type: "comment", c })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  function send() {
    if (!draft.trim() && !draftPhoto) return;
    addComment(note.id, draft.trim() || "Foto", draftPhoto);
    setDraft("");
    setDraftPhoto(false);
    setTimeout(() => {
      const el = document.getElementById("mock-scroll");
      el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }, 50);
  }

  const btn = "flex-1 rounded-lg py-2.5 text-sm font-semibold transition-opacity";
  const menuItems: { label: string; dialog: Dialog; show: boolean; danger?: boolean }[] = [
    { label: "Zuweisen", dialog: "assign", show: isTask },
    { label: "Fälligkeit", dialog: "due", show: isTask },
    { label: "Priorität", dialog: "prio", show: true },
    { label: "Bearbeiten", dialog: "edit", show: true },
    { label: "Verwerfen", dialog: "dismiss", show: note.status !== "dismissed", danger: true },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-bg/95 px-2 py-2 backdrop-blur-sm">
        <Link href="/mockup/notizen" aria-label="Zurück" className="p-2 text-text-muted">
          <ChevronLeftIcon className="h-5 w-5" />
        </Link>
        <span className="text-sm font-semibold">{isTask ? "Aufgabe" : "Info"}</span>
        <StatusPill note={note} />
        {note.priority === "critical" && <CriticalBadge />}
        <div className="relative ml-auto">
          <button onClick={() => setMenu(!menu)} aria-label="Mehr" className="p-2 text-text-muted">
            <MoreHorizontalIcon className="h-5 w-5" />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
                {menuItems
                  .filter((m) => m.show)
                  .map((m) => (
                    <button
                      key={m.label}
                      onClick={() => {
                        setMenu(false);
                        setDialog(m.dialog);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm hover:bg-surface2 ${m.danger ? "text-red" : ""}`}
                    >
                      {m.label}
                    </button>
                  ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="space-y-4 px-4 pt-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-2 flex items-center gap-2">
            <Avatar id={note.authorId} />
            <div className="text-xs">
              <div className="font-semibold">{memberName(note.authorId)}</div>
              <div className="font-mono text-text-muted">{timeLabel(note.createdAt)}</div>
            </div>
          </div>
          <p className="text-sm leading-relaxed">{note.body}</p>
          {note.photo && <PhotoPlaceholder className="mt-3 h-44 w-full" />}
          {note.items.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {note.items.map((l) => (
                <ItemChip key={l.itemId} link={l} />
              ))}
            </div>
          )}
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-border pt-3 text-xs">
            <dt className="text-text-muted">Fahrzeug</dt>
            <dd>{vehicleName(note.vehicleId)}</dd>
            <dt className="text-text-muted">Priorität</dt>
            <dd className={note.priority === "critical" ? "font-semibold text-red" : ""}>
              {note.priority === "critical" ? "Kritisch" : "Normal"}
            </dd>
            {isTask && (
              <>
                <dt className="text-text-muted">Fällig</dt>
                <dd>{note.dueAt ? <DueBadge note={note} /> : "–"}</dd>
                <dt className="text-text-muted">Zugewiesen</dt>
                <dd>{note.assigneeId ? memberName(note.assigneeId) : "Niemand"}</dd>
              </>
            )}
          </dl>
        </div>

        <div className="flex flex-wrap gap-2">
          {isTask && note.status === "open" && (
            <button
              onClick={() => patchNote(note.id, { status: "in_progress", assigneeId: ME }, { type: "started" })}
              className={`${btn} border border-amber/40 bg-amber/10 text-amber`}
            >
              Übernehmen
            </button>
          )}
          {isTask && isOpenTask(note) && (
            <button
              onClick={() => {
                patchNote(note.id, { status: "done" }, { type: "completed" });
                toast("Aufgabe erledigt");
              }}
              className={`${btn} bg-green text-black`}
            >
              Erledigt
            </button>
          )}
          {isTask && (note.status === "done" || note.status === "dismissed") && (
            <button onClick={() => setDialog("reopen")} className={`${btn} border border-border`}>
              Wieder öffnen
            </button>
          )}
          {!isTask && note.status === "posted" && (
            <button
              onClick={() => patchNote(note.id, { kind: "task", status: "open" }, { type: "to_task" })}
              className={`${btn} border border-border`}
            >
              Als Aufgabe markieren
            </button>
          )}
          {note.priority === "critical" && note.status !== "dismissed" && (
            <button
              onClick={() => setAck(note.id, !acked)}
              className={`${btn} border ${acked ? "border-green/40 bg-green/10 text-green" : "border-red/40 bg-red/10 text-red"}`}
            >
              {acked ? (
                <span className="inline-flex items-center gap-1.5">
                  Bestätigt <CheckIcon className="h-4 w-4" />
                </span>
              ) : (
                "Zur Kenntnis genommen"
              )}
            </button>
          )}
        </div>

        <div className="space-y-2 pb-4 pt-2">
          {lines.map((l) => {
            if (l.type === "status") {
              return (
                <p key={l.id} className="text-center text-[11px] text-text-muted">
                  {l.text}
                </p>
              );
            }
            const own = l.c.authorId === ME;
            return (
              <div key={l.id} className={`flex gap-2 ${own ? "flex-row-reverse" : ""}`}>
                {!own && <Avatar id={l.c.authorId} />}
                <div
                  className={`max-w-[80%] rounded-2xl border px-3.5 py-2.5 ${
                    own ? "rounded-tr-sm border-red/20 bg-red/10" : "rounded-tl-sm border-border bg-surface"
                  }`}
                >
                  <div className="mb-0.5 flex items-center gap-2 text-[11px]">
                    <span className={`font-semibold ${own ? "text-red" : ""}`}>{own ? "Du" : firstName(l.c.authorId)}</span>
                    <span className="font-mono text-text-muted">{timeLabel(l.c.createdAt)}</span>
                  </div>
                  <p className="text-sm leading-snug">{l.c.body}</p>
                  {l.c.photo && <PhotoPlaceholder className="mt-2 h-24 w-40" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1" />
      <div className="sticky bottom-0 z-10 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur-sm">
        {draftPhoto && <PhotoPlaceholder className="mb-2 h-14 w-14" />}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDraftPhoto(!draftPhoto)}
            aria-label="Foto"
            className={`rounded-lg border p-2.5 ${draftPhoto ? "border-red/40 text-red" : "border-border text-text-muted"}`}
          >
            <CameraIcon className="h-4 w-4" />
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Kommentar schreiben…"
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-red focus:outline-none"
          />
          <button
            onClick={send}
            disabled={!draft.trim() && !draftPhoto}
            aria-label="Senden"
            className="rounded-lg bg-red p-2.5 text-white disabled:opacity-40"
          >
            <SendIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {dialog === "dismiss" && (
        <TextDialog
          title="Notiz verwerfen?"
          hint="Verworfene Notizen verschwinden aus dem Feed. Bitte einen Grund angeben (mind. 5 Zeichen)."
          minLen={5}
          placeholder="Grund…"
          confirm="Verwerfen"
          onClose={close}
          onSubmit={(reason) => {
            patchNote(note.id, { status: "dismissed" }, { type: "dismissed", text: reason });
            close();
            toast("Notiz verworfen");
          }}
        />
      )}
      {dialog === "reopen" && (
        <TextDialog
          title="Aufgabe wieder öffnen"
          hint="Bitte kurz begründen, warum die Aufgabe wieder offen ist."
          minLen={1}
          placeholder="Kommentar…"
          confirm="Wieder öffnen"
          onClose={close}
          onSubmit={(text) => {
            patchNote(note.id, { status: "open" }, { type: "reopened" });
            addComment(note.id, text);
            close();
          }}
        />
      )}
      {dialog === "edit" && (
        <TextDialog
          title="Bearbeiten"
          initial={note.body}
          minLen={1}
          placeholder="Text…"
          confirm="Speichern"
          onClose={close}
          onSubmit={(text) => {
            patchNote(note.id, { body: text });
            close();
          }}
        />
      )}
      {dialog === "assign" && (
        <Modal title="Zuweisen" onClose={close}>
          <div className="flex flex-wrap gap-2">
            {[null, ...TEAM.map((m) => m.id)].map((id) => (
              <button
                key={id ?? "none"}
                onClick={() => {
                  patchNote(note.id, { assigneeId: id }, { type: "assigned", text: id ? (id === ME ? "sich" : firstName(id)) : undefined });
                  close();
                }}
                className={chip(note.assigneeId === id)}
              >
                {id === null ? "Niemand" : id === ME ? "Ich" : firstName(id)}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {dialog === "due" && (
        <Modal title="Fälligkeit" onClose={close}>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Heute 18:00", off: 0, h: 18 },
              { label: "Morgen", off: 1, h: 12 },
              { label: "In 3 Tagen", off: 3, h: 12 },
            ].map((o) => (
              <button
                key={o.label}
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + o.off);
                  d.setHours(o.h, 0, 0, 0);
                  patchNote(note.id, { dueAt: d.toISOString() });
                  close();
                }}
                className={chip(!!note.dueAt && dueLabel(note.dueAt, new Date(), false).startsWith(o.label.split(" ")[0]))}
              >
                {o.label}
              </button>
            ))}
            <button
              onClick={() => {
                patchNote(note.id, { dueAt: null });
                close();
              }}
              className={chip(!note.dueAt)}
            >
              Keine
            </button>
          </div>
        </Modal>
      )}
      {dialog === "prio" && (
        <Modal title="Priorität" onClose={close}>
          <div className="flex gap-2">
            {(["normal", "critical"] as const).map((p) => (
              <button
                key={p}
                onClick={() => {
                  patchNote(note.id, { priority: p });
                  close();
                }}
                className={chip(note.priority === p)}
              >
                {p === "normal" ? "Normal" : "Kritisch"}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function NoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { notes } = useMock();
  const note = notes.find((n) => n.id === id);
  if (!note) {
    return (
      <div className="px-6 py-20 text-center">
        <p className="mb-4 text-sm text-text-muted">Notiz nicht gefunden</p>
        <Link href="/mockup/notizen" className="text-sm font-semibold text-red">
          Zurück zu den Notizen
        </Link>
      </div>
    );
  }
  return <Detail key={note.id} note={note} />;
}
