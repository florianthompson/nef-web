"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { XIcon } from "lucide-react";

const REC_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg"];
export const MAX_REC_MS = 300000; // up to 5 minutes
const SEG_MS = 60000; // recorded as independent 60 s segments
const REC_BPS = 32000;
const BARS = 30;

export type Recording = {
  blobs: Blob[];
  type: string;
  durationMs: number;
  localText: string;
};

type LocalAsr = { text: string; interim: string; on: boolean; dead: boolean; sr: SpeechRecognitionLike | null };
// minimal structural type for the (prefixed) Web Speech API
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

type Rec = {
  stream: MediaStream;
  mrs: MediaRecorder[];
  mr: MediaRecorder;
  segs: Blob[];
  stopped: number;
  finishing: boolean;
  segTimer: ReturnType<typeof setTimeout> | undefined;
  autoStop: ReturnType<typeof setTimeout> | undefined;
  ctx: AudioContext | null;
  raf: number;
  type: string;
  mime: string;
  t0: number;
  local: LocalAsr;
  cancelled: boolean;
};

export const fmtClock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const voiceSupported = () =>
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== "undefined";

function startLocalAsr(): LocalAsr {
  const L: LocalAsr = { text: "", interim: "", on: false, dead: false, sr: null };
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!SR) return L;
  try {
    const sr = (L.sr = new SR());
    sr.lang = "de-DE";
    sr.continuous = true;
    sr.interimResults = true;
    sr.onresult = (e) => {
      L.interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.trim();
        if (e.results[i].isFinal) {
          if (t) L.text += (L.text ? " " : "") + t;
        } else if (t) L.interim = t;
      }
    };
    sr.onerror = () => {
      L.dead = true;
    };
    sr.onend = () => {
      if (L.on && !L.dead) {
        try {
          sr.start();
        } catch {
          L.dead = true;
        }
      }
    };
    L.on = true;
    sr.start();
  } catch {
    L.dead = true;
    L.on = false;
  }
  return L;
}

function stopLocalAsr(L: LocalAsr, abort?: boolean) {
  if (!L.sr) return;
  L.on = false;
  try {
    if (abort) L.sr.abort();
    else L.sr.stop();
  } catch {
    // ignore
  }
}

/**
 * Records up to 5 min as independent 60 s MediaRecorder segments. The waveform (AnalyserNode)
 * only runs while recording. In parallel the on-device Web Speech API collects a fallback text.
 */
export function useVoiceRecorder({
  onFinish,
  onError,
}: {
  onFinish: (r: Recording) => void;
  onError: (msg: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const waveRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<Rec | null>(null);
  const seqRef = useRef(0);
  const rotateRef = useRef<(r: Rec) => void>(() => {});
  const tickRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const cbs = useRef({ onFinish, onError });
  useEffect(() => {
    cbs.current = { onFinish, onError };
  });

  const release = useCallback((r: Rec) => {
    clearTimeout(r.segTimer);
    clearTimeout(r.autoStop);
    clearInterval(tickRef.current);
    if (recRef.current === r) recRef.current = null;
    stopLocalAsr(r.local);
    cancelAnimationFrame(r.raf);
    r.stream.getTracks().forEach((t) => t.stop());
    r.ctx?.close().catch(() => {});
    setRecording(false);
  }, []);

  const newSegment = useCallback((r: Rec) => {
    const i = r.mrs.length;
    const chunks: Blob[] = [];
    let mr: MediaRecorder;
    try {
      mr = new MediaRecorder(r.stream, {
        ...(r.mime ? { mimeType: r.mime } : {}),
        audioBitsPerSecond: REC_BPS,
      });
    } catch {
      mr = new MediaRecorder(r.stream, r.mime ? { mimeType: r.mime } : {});
    }
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    mr.onstop = () => {
      r.segs[i] = new Blob(chunks, { type: r.type });
      r.stopped++;
      if (r.finishing && r.stopped === r.mrs.length) {
        const blobs = r.segs.filter((b) => b && b.size >= 200);
        const L = r.local;
        const localText = [L.text, L.interim].filter(Boolean).join(" ").trim();
        const durationMs = Date.now() - r.t0;
        release(r);
        if (!r.cancelled) cbs.current.onFinish({ blobs, type: r.type, durationMs, localText });
      }
    };
    r.mrs.push(mr);
    r.mr = mr;
    return mr;
  }, [release]);

  const rotate = useCallback(
    (r: Rec) => {
      if (recRef.current !== r || r.finishing) return;
      const old = r.mr;
      try {
        newSegment(r).start(); // next recorder first so no audio falls into the gap
      } catch {
        return;
      }
      r.segTimer = setTimeout(() => rotateRef.current(r), SEG_MS);
      if (old.state !== "inactive") old.stop();
    },
    [newSegment]
  );
  useEffect(() => {
    rotateRef.current = rotate;
  }, [rotate]);

  const stop = useCallback(() => {
    const r = recRef.current;
    if (!r || r.finishing) return;
    clearTimeout(r.segTimer);
    clearTimeout(r.autoStop);
    r.finishing = true;
    if (r.mr.state !== "inactive") r.mr.stop();
  }, []);

  const cancel = useCallback(() => {
    seqRef.current++;
    const r = recRef.current;
    if (!r) return;
    r.cancelled = true;
    r.mrs.forEach((m) => {
      m.onstop = null;
      if (m.state !== "inactive") {
        try {
          m.stop();
        } catch {
          // ignore
        }
      }
    });
    stopLocalAsr(r.local, true);
    release(r);
  }, [release]);

  const start = useCallback(async () => {
    if (recRef.current) return;
    if (!voiceSupported()) {
      cbs.current.onError("Sprachaufnahme wird von diesem Browser nicht unterstützt.");
      return;
    }
    const seq = ++seqRef.current;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      cbs.current.onError("Kein Mikrofonzugriff. Bitte in den Einstellungen erlauben.");
      return;
    }
    if (seq !== seqRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    const mime = REC_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const r = {
      stream,
      mrs: [],
      segs: [],
      stopped: 0,
      finishing: false,
      segTimer: undefined,
      autoStop: undefined,
      ctx: null,
      raf: 0,
      type: (mime || "audio/webm").split(";")[0],
      mime,
      t0: Date.now(),
      local: { text: "", interim: "", on: false, dead: false, sr: null },
      cancelled: false,
    } as unknown as Rec;
    try {
      newSegment(r);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      cbs.current.onError("Sprachaufnahme wird von diesem Browser nicht unterstützt.");
      return;
    }
    recRef.current = r;
    setElapsed(0);
    setRecording(true);
    tickRef.current = setInterval(() => setElapsed(Date.now() - r.t0), 200);
    r.autoStop = setTimeout(stop, MAX_REC_MS);

    try {
      // live level meter: rolling history of RMS levels; silence = flat bars
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = (r.ctx = new AC());
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(an);
      void ctx.resume?.();
      const buf = new Uint8Array(an.fftSize);
      const lv: number[] = Array.from({ length: BARS }, () => 0.06);
      let last = 0;
      const draw = (t: number) => {
        r.raf = requestAnimationFrame(draw);
        if (t - last < 60) return;
        last = t;
        an.getByteTimeDomainData(buf);
        let sq = 0;
        for (const v of buf) sq += (v - 128) * (v - 128);
        lv.shift();
        lv.push(Math.min(1, 0.06 + (Math.sqrt(sq / buf.length) / 128) * 2.5));
        const bars = waveRef.current?.children;
        if (bars) {
          for (let i = 0; i < bars.length; i++) {
            (bars[i] as HTMLElement).style.transform = `scaleY(${lv[i].toFixed(2)})`;
          }
        }
      };
      r.raf = requestAnimationFrame(draw);
    } catch {
      // no Web Audio: bars stay flat
    }
    r.local = startLocalAsr();
    r.mr.start();
    r.segTimer = setTimeout(() => rotate(r), SEG_MS);
  }, [newSegment, rotate, stop]);

  useEffect(() => cancel, [cancel]);

  return { recording, elapsed, start, stop, cancel, waveRef };
}

export function VoiceWave({
  waveRef,
  elapsed,
  onCancel,
}: {
  waveRef: RefObject<HTMLDivElement | null>;
  elapsed: number;
  onCancel: () => void;
}) {
  return (
    <div className="rwave">
      <button type="button" className="rx" onClick={onCancel} aria-label="Aufnahme verwerfen">
        <XIcon className="ic" />
      </button>
      <div ref={waveRef} className="rbars" aria-hidden>
        {Array.from({ length: BARS }, (_, i) => (
          <i key={i} style={{ transform: "scaleY(0.06)" }} />
        ))}
      </div>
      <span className="rtm">
        {fmtClock(elapsed)}
        {elapsed >= MAX_REC_MS - 60000 ? ` / ${fmtClock(MAX_REC_MS)}` : ""}
      </span>
    </div>
  );
}
