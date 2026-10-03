"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpIcon, MicIcon, XIcon } from "lucide-react";
import {
  insertNotes,
  type ItemOption,
  type NoteCategory,
  type NoteDraft,
  type NoteSource,
} from "@/lib/notes";
import { notesApi, transcribeSegments, transcribeTimeout, type ApiError } from "@/lib/notesClient";
import { bufferAll, bufferDelete, bufferPut, type BufferedAudio } from "@/lib/audioBuffer";
import { ReviewCard, type ReviewPart } from "./ReviewCard";
import { fmtClock, useVoiceRecorder, VoiceWave, type Recording } from "./VoiceRecorder";

const DRAFT_KEY = "nef-notes-draft";
const COMP_MAX = 154;
const T_NOSORT = "Automatische Sortierung nicht verfügbar";

type Job = {
  id: string;
  blobs: Blob[];
  mimeType: string;
  durationMs: number;
  localText: string;
  settled: boolean;
  ctrl?: AbortController;
  timer?: ReturnType<typeof setTimeout>;
};

type ParseResponse = {
  notes: {
    text: string;
    itemId: string | null;
    category: string;
    dueDate: string | null;
    dueText: string | null;
  }[];
};

const CATS: NoteCategory[] = ["Medikamente", "BTM", "Fahrzeug", "Ausrüstung", "Sonstiges"];
let partKey = 0;

export function Composer({
  items,
  teamId,
  userId,
  authorName,
  onSaved,
  onNotice,
  onHeight,
}: {
  items: ItemOption[];
  teamId: string;
  userId: string;
  authorName: string;
  onSaved: (message: string) => void;
  onNotice: (message: string) => void;
  onHeight: (h: number) => void;
}) {
  const [text, setText] = useState("");
  const [deviceHint, setDeviceHint] = useState(false);
  const [fromVoice, setFromVoice] = useState(false);
  const [progress, setProgress] = useState<{ kind: "listen" | "sort"; seg: number; total: number } | null>(null);
  const [review, setReview] = useState<{ orig: string; parts: ReviewPart[]; hint: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [bufs, setBufs] = useState<BufferedAudio[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const jobRef = useRef<Job | null>(null);
  const sortRef = useRef<{ ctrl: AbortController; skipped: boolean } | null>(null);
  const drainingRef = useRef(false);
  const busy = !!progress;

  // restore the draft once
  useEffect(() => {
    try {
      const d = localStorage.getItem(DRAFT_KEY);
      if (d) setText(d);
    } catch {
      // ignore
    }
  }, []);
  useEffect(() => {
    try {
      if (text) localStorage.setItem(DRAFT_KEY, text);
      else localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    if (!text.trim()) {
      setDeviceHint(false);
      setFromVoice(false);
    }
  }, [text]);

  // grow the textarea
  useEffect(() => {
    const t = taRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight + 2, COMP_MAX) + "px";
  }, [text, review, progress]);

  // report own height so the feed can place the toast
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => onHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeight]);

  const putText = useCallback((t: string, device = false) => {
    setText((prev) => (prev.trim() ? prev.trimEnd() + " " + t : t));
    setFromVoice(true);
    if (device) setDeviceHint(true);
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
        ta.scrollTop = ta.scrollHeight;
      }
    });
  }, []);

  /* ---------- hidden audio buffer ---------- */
  const refreshBufs = useCallback(async () => setBufs(await bufferAll()), []);
  useEffect(() => {
    void refreshBufs();
  }, [refreshBufs]);

  const drain = useCallback(async () => {
    if (drainingRef.current || !navigator.onLine || jobRef.current || sortRef.current) return;
    const all = await bufferAll();
    if (!all.length) return;
    drainingRef.current = true;
    try {
      for (const b of all) {
        const t = await transcribeSegments(
          b.segments,
          b.mimeType,
          AbortSignal.timeout(20000 + 10000 * b.segments.length)
        );
        if (t) putText(t);
        else onNotice("Nichts verstanden.");
        await bufferDelete(b.id);
        await refreshBufs();
      }
    } catch {
      // stays buffered; retried on the next online event / interval
    } finally {
      drainingRef.current = false;
    }
  }, [putText, onNotice, refreshBufs]);

  useEffect(() => {
    const t0 = setTimeout(() => void drain(), 1500);
    const iv = setInterval(() => void drain(), 30000);
    const on = () => void drain();
    window.addEventListener("online", on);
    return () => {
      clearTimeout(t0);
      clearInterval(iv);
      window.removeEventListener("online", on);
    };
  }, [drain]);

  /* ---------- voice -> text ---------- */
  const settle = useCallback((j: Job) => {
    if (j.settled) return false;
    j.settled = true;
    clearTimeout(j.timer);
    if (jobRef.current === j) jobRef.current = null;
    setProgress(null);
    return true;
  }, []);

  const failJob = useCallback(
    async (j: Job) => {
      if (!settle(j)) return;
      j.ctrl?.abort();
      if (j.localText) {
        putText(j.localText, true);
        return;
      }
      await bufferPut({
        id: j.id,
        segments: j.blobs,
        mimeType: j.mimeType,
        createdAt: Date.now(),
        durationMs: j.durationMs,
      });
      await refreshBufs();
    },
    [putText, refreshBufs, settle]
  );

  const runJob = useCallback(
    async (j: Job) => {
      jobRef.current = j;
      setProgress({ kind: "listen", seg: 1, total: j.blobs.length });
      if (!navigator.onLine) {
        void failJob(j);
        return;
      }
      const ctrl = (j.ctrl = new AbortController());
      j.timer = setTimeout(() => void failJob(j), transcribeTimeout(j.blobs.length));
      try {
        const t = await transcribeSegments(j.blobs, j.mimeType, ctrl.signal, (k) => {
          if (!j.settled && k < j.blobs.length) {
            setProgress({ kind: "listen", seg: k + 1, total: j.blobs.length });
          }
        });
        if (!settle(j)) return;
        const out = t || j.localText;
        if (out) putText(out, !t);
        else onNotice("Nichts verstanden. Bitte nochmal versuchen.");
      } catch {
        void failJob(j);
      }
    },
    [failJob, putText, onNotice, settle]
  );

  const onFinish = useCallback(
    (r: Recording) => {
      if (!r.blobs.length) {
        if (r.localText) putText(r.localText, true);
        else onNotice("Nichts verstanden. Bitte nochmal versuchen.");
        return;
      }
      void runJob({
        id: "b-" + Date.now().toString(36),
        blobs: r.blobs,
        mimeType: r.type,
        durationMs: r.durationMs,
        localText: r.localText,
        settled: false,
      });
    },
    [runJob, putText, onNotice]
  );

  const voice = useVoiceRecorder({ onFinish, onError: onNotice });

  /* ---------- sending ---------- */
  const clearField = () => {
    setText("");
    setReview(null);
  };

  async function save(drafts: NoteDraft[], source: NoteSource, message: string) {
    if (!drafts.length) return;
    setSaving(true);
    const { ok, error } = await insertNotes({ teamId, userId, authorName, source }, drafts);
    setSaving(false);
    if (!ok) {
      console.error("save notes failed:", error);
      onNotice("Speichern nicht möglich. Der Text bleibt erhalten.");
      return;
    }
    clearField();
    onSaved(message);
  }

  const rawDraft = (t: string): NoteDraft => ({
    text: t,
    itemId: null,
    category: "Sonstiges",
    dueDate: null,
    dueText: null,
  });

  async function send() {
    if (voice.recording) {
      voice.stop();
      return;
    }
    const v = text.trim();
    if (!v || busy || saving || review) return;
    taRef.current?.blur();
    if (!navigator.onLine) {
      await save([rawDraft(v)], "raw", "Gespeichert, ohne Auswertung");
      return;
    }
    const ctrl = new AbortController();
    const sd = (sortRef.current = { ctrl, skipped: false });
    const timer = setTimeout(() => ctrl.abort(), transcribeTimeout(1));
    setProgress({ kind: "sort", seg: 1, total: 1 });
    let parts: ReviewPart[] | null = null;
    let failure: "skipped" | "busy" | "error" | null = null;
    try {
      const r = await notesApi<ParseResponse>(
        "/api/notes/parse",
        JSON.stringify({ text: v }),
        "application/json",
        ctrl.signal
      );
      if (!Array.isArray(r.notes) || !r.notes.length) throw { status: 502 } satisfies ApiError;
      parts = r.notes.map((n) => ({
        key: ++partKey,
        text: n.text,
        itemId: n.itemId,
        category: (CATS as string[]).includes(n.category) ? (n.category as NoteCategory) : "Sonstiges",
        dueDate: n.dueDate,
        dueText: n.dueDate ? n.dueText : null,
      }));
    } catch (e) {
      failure = sd.skipped ? "skipped" : (e as ApiError)?.status === 429 ? "busy" : "error";
    }
    clearTimeout(timer);
    sortRef.current = null;
    setProgress(null);
    if (failure === "busy") {
      onNotice("Zu viele Anfragen, bitte kurz warten.");
    } else if (failure === "skipped") {
      await save([rawDraft(v)], "raw", "Gespeichert, ohne Auswertung");
    } else if (failure === "error") {
      await save([rawDraft(v)], "raw", `${T_NOSORT} · als Text gespeichert`);
    } else if (parts) {
      setReview({ orig: v, parts, hint: "" });
    }
  }

  const skipSort = () => {
    if (sortRef.current) {
      sortRef.current.skipped = true;
      sortRef.current.ctrl.abort();
    } else if (jobRef.current) {
      void failJob(jobRef.current);
    }
  };

  const has = !!text.trim();
  const fieldHint = deviceHint && !busy && !review && !voice.recording;
  const bufMs = bufs.reduce((s, b) => s + (b.durationMs || 0), 0);

  return (
    <div
      ref={wrapRef}
      className="shrink-0 bg-bg"
    >
      {review ? (
        <ReviewCard
          orig={review.orig}
          parts={review.parts}
          hint={review.hint}
          items={items}
          sending={saving}
          onParts={(parts) => setReview((r) => (r ? { ...r, parts } : r))}
          onClose={() => {
            setReview(null);
            requestAnimationFrame(() => taRef.current?.focus());
          }}
          onSend={() =>
            void save(
              review.parts
                .filter((p) => p.text.trim())
                .map((p) => ({
                  text: p.text,
                  itemId: p.itemId,
                  category: p.category,
                  dueDate: p.dueDate,
                  dueText: p.dueText,
                })),
              fromVoice ? "voice" : "text",
              review.parts.length > 1 ? "Notizen gespeichert" : "Notiz gespeichert"
            )
          }
          onSendRaw={() => void save([rawDraft(review.orig.trim())], "raw", "Gespeichert")}
        />
      ) : (
        <>
          {progress && (
            <div className="flex flex-wrap items-center gap-x-3 border-t border-border px-4 py-1.5">
              <span className="flex items-center gap-1.5 text-[13px] leading-6 text-zinc-100">
                <i className="block h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-r-transparent" />
                {progress.kind === "listen"
                  ? `Aufnahme gesichert · Text wird erkannt${progress.total > 1 ? ` (${progress.seg}/${progress.total})` : ""}`
                  : "Notizen werden sortiert"}
              </span>
              <button
                type="button"
                onClick={skipSort}
                className="-my-2.5 ml-auto min-h-11 pl-1 text-[13px] font-medium text-zinc-300 underline underline-offset-[3px]"
              >
                {progress.kind === "listen" ? "Nicht warten" : "Ohne Auswertung speichern"}
              </button>
            </div>
          )}
          {fieldHint && (
            <p className="border-t border-border px-5 pt-1.5 text-xs leading-4 text-zinc-500">
              Text vom Gerät erkannt, bitte prüfen
            </p>
          )}
          {bufs.length > 0 && !busy && (
            <div className="flex items-center gap-2 border-t border-border px-4 py-1 text-[13px] text-zinc-500">
              <span className="min-w-0 flex-1 truncate">
                {bufs.length > 1 ? `${bufs.length} Aufnahmen werden` : "Aufnahme wird"} übertragen, sobald
                online · {fmtClock(bufMs)}
              </span>
              <button
                type="button"
                aria-label="Aufnahme verwerfen"
                onClick={async () => {
                  for (const b of bufs) await bufferDelete(b.id);
                  await refreshBufs();
                }}
                className="flex h-11 w-11 shrink-0 items-center justify-center text-zinc-400"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          )}
          <div
            className="flex items-end gap-2 border-t border-border px-4 pt-2"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}
          >
            {voice.recording ? (
              <VoiceWave waveRef={voice.waveRef} elapsed={voice.elapsed} onCancel={voice.cancel} />
            ) : (
              <textarea
                ref={taRef}
                value={text}
                disabled={busy}
                rows={1}
                placeholder="Notiz hinterlassen …"
                aria-label="Notiz"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing &&
                    !window.matchMedia("(pointer:coarse)").matches
                  ) {
                    e.preventDefault();
                    void send();
                  }
                }}
                className="h-11 max-h-[154px] min-w-0 flex-1 resize-none overflow-y-auto rounded-[22px] border border-border bg-surface px-4 py-2.5 text-base leading-[22px] text-text outline-none placeholder:text-zinc-500 focus:border-zinc-600 disabled:opacity-55"
              />
            )}
            {!voice.recording && (
              <button
                type="button"
                onClick={() => void voice.start()}
                disabled={busy}
                aria-label="Sprachaufnahme starten"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-200 active:scale-95 disabled:opacity-35"
              >
                <MicIcon className="h-5 w-5" />
              </button>
            )}
            {(has || voice.recording) && (
              <button
                type="button"
                onClick={() => void send()}
                disabled={busy || saving}
                aria-label={voice.recording ? "Aufnahme beenden" : "Senden"}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 active:scale-95 disabled:opacity-35 ${
                  voice.recording ? "ring-[3px] ring-zinc-100/20" : ""
                }`}
              >
                <ArrowUpIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
