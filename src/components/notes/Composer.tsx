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
import { notesApi, PARSE_TIMEOUT_MS, transcribeSegments, transcribeTimeout, type ApiError } from "@/lib/notesClient";
import { bufferAll, bufferDelete, bufferPut, type BufferedAudio } from "@/lib/audioBuffer";
import {
  appendDraft,
  migrateLegacyDraft,
  readDraft,
  writeDraft,
} from "@/lib/vehicleNotes.mjs";
import { ReviewCard, type ReviewPart } from "./ReviewCard";
import { fmtClock, useVoiceRecorder, VoiceWave, type Recording } from "./VoiceRecorder";

const COMP_MAX = 154;
const T_NOSORT = "Automatische Sortierung nicht verfügbar";

type Job = {
  id: string;
  blobs: Blob[];
  mimeType: string;
  durationMs: number;
  localText: string;
  vehicleId: string | null; // the vehicle the recording was made for; its text goes to that vehicle
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
    confidence?: string;
    candidates?: string[];
    needsConfirm?: boolean;
  }[];
};

const CATS: NoteCategory[] = ["Medikamente", "BTM", "Fahrzeug", "Ausrüstung", "Sonstiges"];
let partKey = 0;

export function Composer({
  items,
  teamId,
  vehicleId,
  legacyVehicleId,
  userId,
  authorName,
  onSaved,
  onNotice,
  onHeight,
}: {
  items: ItemOption[];
  teamId: string;
  /** the selected vehicle (null = the team has no vehicles); drafts and new notes belong to it */
  vehicleId: string | null;
  legacyVehicleId: string | null;
  userId: string;
  authorName: string;
  onSaved: (message: string) => void;
  onNotice: (message: string) => void;
  onHeight: (h: number) => void;
}) {
  // the draft text always belongs to the vehicle in `draft.vid`; another vehicle's text is never shown
  const [draft, setDraft] = useState<{ vid: string | null | undefined; text: string }>({ vid: undefined, text: "" });
  const text = draft.vid === vehicleId ? draft.text : "";
  const vidRef = useRef(vehicleId);
  const recVidRef = useRef(vehicleId);
  const [deviceHint, setDeviceHint] = useState(false);
  const [fromVoice, setFromVoice] = useState(false);
  const [progress, setProgress] = useState<{ kind: "listen" | "sort"; seg: number; total: number } | null>(null);
  const [reviewAny, setReview] = useState<{
    vehicleId: string | null;
    orig: string;
    parts: ReviewPart[];
    hint: string;
  } | null>(null);
  // an open review tray stays with the vehicle it was made for
  const review = reviewAny && reviewAny.vehicleId === vehicleId ? reviewAny : null;
  const [saving, setSaving] = useState(false);
  const [bufs, setBufs] = useState<BufferedAudio[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const jobRef = useRef<Job | null>(null);
  const sortRef = useRef<{ ctrl: AbortController; skipped: boolean } | null>(null);
  const drainingRef = useRef(false);
  const busy = !!progress;

  const setText = useCallback((u: string | ((prev: string) => string)) => {
    setDraft((d) => {
      const v = vidRef.current;
      const prev = d.vid === v ? d.text : "";
      return { vid: v, text: typeof u === "function" ? u(prev) : u };
    });
  }, []);

  // load the selected vehicle's draft (the old single draft moves to the default vehicle once)
  useEffect(() => {
    vidRef.current = vehicleId;
    if (vehicleId === legacyVehicleId) migrateLegacyDraft(localStorage, vehicleId);
    setDraft({ vid: vehicleId, text: readDraft(localStorage, vehicleId) });
    setFromVoice(false);
    setDeviceHint(false);
    if (voiceStopRef.current) voiceStopRef.current(); // a running recording ends and stays with its vehicle
  }, [vehicleId, legacyVehicleId]);
  useEffect(() => {
    if (draft.vid !== vehicleId) return; // not loaded for this vehicle yet
    writeDraft(localStorage, vehicleId, draft.text);
    if (!draft.text.trim()) {
      setDeviceHint(false);
      setFromVoice(false);
    }
  }, [draft, vehicleId]);

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

  const putText = useCallback((t: string, device = false, target?: string | null) => {
    if (target !== undefined && target !== vidRef.current) {
      // the user switched vehicles meanwhile: park the text in that vehicle's draft, not in this field
      appendDraft(localStorage, target, t);
      onNotice("Text liegt im Entwurf des anderen Fahrzeugs.");
      return;
    }
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
  }, [setText, onNotice]);

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
        putText(j.localText, true, j.vehicleId);
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
        if (out) putText(out, !t, j.vehicleId);
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
        if (r.localText) putText(r.localText, true, recVidRef.current);
        else onNotice("Nichts verstanden. Bitte nochmal versuchen.");
        return;
      }
      void runJob({
        id: "b-" + Date.now().toString(36),
        blobs: r.blobs,
        mimeType: r.type,
        durationMs: r.durationMs,
        localText: r.localText,
        vehicleId: recVidRef.current,
        settled: false,
      });
    },
    [runJob, putText, onNotice]
  );

  const voice = useVoiceRecorder({ onFinish, onError: onNotice });
  const voiceStopRef = useRef(voice.stop);
  useEffect(() => {
    voiceStopRef.current = voice.stop;
  }, [voice.stop]);
  const startVoice = () => {
    recVidRef.current = vehicleId;
    void voice.start();
  };

  /* ---------- sending ---------- */
  const clearField = (forVehicle: string | null) => {
    if (forVehicle === vidRef.current) setText("");
    else writeDraft(localStorage, forVehicle, "");
    setReview(null);
  };

  // notes are saved for the vehicle the text was written for, not whichever is selected by now
  async function save(drafts: NoteDraft[], source: NoteSource, message: string, forVehicle: string | null) {
    if (!drafts.length) return;
    setSaving(true);
    const { ok, error } = await insertNotes({ teamId, userId, authorName, source, vehicleId: forVehicle }, drafts);
    setSaving(false);
    if (!ok) {
      console.error("save notes failed:", error);
      onNotice("Speichern nicht möglich. Der Text bleibt erhalten.");
      return;
    }
    clearField(forVehicle);
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
    const sendVid = vehicleId;
    taRef.current?.blur();
    if (!navigator.onLine) {
      await save([rawDraft(v)], "raw", "Gespeichert, ohne Auswertung", sendVid);
      return;
    }
    const ctrl = new AbortController();
    const sd = (sortRef.current = { ctrl, skipped: false });
    const timer = setTimeout(() => ctrl.abort(), PARSE_TIMEOUT_MS);
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
        confidence: n.confidence,
        candidates: Array.isArray(n.candidates) ? n.candidates : [],
        needsConfirm: !!n.needsConfirm && !n.itemId && Array.isArray(n.candidates) && n.candidates.length > 0,
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
      await save([rawDraft(v)], "raw", "Gespeichert, ohne Auswertung", sendVid);
    } else if (failure === "error") {
      await save([rawDraft(v)], "raw", `${T_NOSORT} · als Text gespeichert`, sendVid);
    } else if (parts) {
      setReview({ vehicleId: sendVid, orig: v, parts, hint: "" });
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
    <div ref={wrapRef}>
      {progress && (
        <div className="strip show" aria-live="polite">
          <ol>
            <li className="active">
              <span className="si">
                <i className="spin" />
              </span>
              {progress.kind === "listen"
                ? `Aufnahme gesichert · Text wird erkannt${progress.total > 1 ? ` (${progress.seg}/${progress.total})` : ""}`
                : "Notizen werden sortiert"}
            </li>
          </ol>
          <button type="button" className="sp-skip" onClick={skipSort}>
            {progress.kind === "listen" ? "Nicht warten" : "Ohne Auswertung speichern"}
          </button>
        </div>
      )}
      {review && (
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
              review.parts.length > 1 ? "Notizen gespeichert" : "Notiz gespeichert",
              review.vehicleId
            )
          }
          onSendRaw={() => void save([rawDraft(review.orig.trim())], "raw", "Gespeichert", review.vehicleId)}
        />
      )}
      {bufs.length > 0 && !busy && !review && (
        <div className="bhint" aria-live="polite">
          <span className="bt">
            {bufs.length > 1 ? `${bufs.length} Aufnahmen werden` : "Aufnahme wird"} übertragen, sobald{" "}
            {typeof navigator !== "undefined" && navigator.onLine ? "verfügbar" : "online"} · {fmtClock(bufMs)}
          </span>
          <button
            type="button"
            className="bx"
            aria-label="Aufnahme verwerfen"
            onClick={async () => {
              for (const b of bufs) await bufferDelete(b.id);
              await refreshBufs();
            }}
          >
            <XIcon className="ic" />
          </button>
        </div>
      )}
      <div
        className="comp"
        data-has={has ? "1" : "0"}
        data-rec={voice.recording ? "1" : "0"}
        data-busy={busy ? "1" : "0"}
        data-tray={review ? "1" : "0"}
      >
        <div className="fld">
          <textarea
            ref={taRef}
            id="composer-input"
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
          />
          {voice.recording && (
            <VoiceWave waveRef={voice.waveRef} elapsed={voice.elapsed} onCancel={voice.cancel} />
          )}
        </div>
        <button
          type="button"
          className="rb"
          id="mic"
          onClick={startVoice}
          disabled={busy}
          aria-label="Sprachaufnahme"
        >
          <MicIcon className="ic" />
        </button>
        <button
          type="button"
          className="rb send"
          id="composer-send"
          onClick={() => void send()}
          disabled={busy || saving}
          aria-label={voice.recording ? "Aufnahme beenden" : "Senden"}
        >
          <ArrowUpIcon className="ic" />
        </button>
      </div>
      {fieldHint && (
        <div className="dhint" aria-live="polite">
          Text vom Gerät erkannt, bitte prüfen
        </div>
      )}
    </div>
  );
}
