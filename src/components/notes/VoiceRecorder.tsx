"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { XIcon } from "lucide-react";
import { createRecorderCore, MAX_REC_MS } from "./recorderCore.mjs";

export { MAX_REC_MS };

const REC_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg"];
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

const asrText = (L: LocalAsr) => [L.text, L.interim].filter(Boolean).join(" ").trim();

/** Live level meter: rolling history of RMS levels; silence = flat bars. Returns its stop function. */
function startMeter(stream: MediaStream, bars: () => HTMLElement | null) {
  let raf = 0;
  let ctx: AudioContext | null = null;
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const c = (ctx = new AC());
    const an = c.createAnalyser();
    an.fftSize = 512;
    c.createMediaStreamSource(stream).connect(an);
    void c.resume?.();
    const buf = new Uint8Array(an.fftSize);
    const lv: number[] = Array.from({ length: BARS }, () => 0.06);
    let last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 60) return;
      last = t;
      an.getByteTimeDomainData(buf);
      let sq = 0;
      for (const v of buf) sq += (v - 128) * (v - 128);
      lv.shift();
      lv.push(Math.min(1, 0.06 + (Math.sqrt(sq / buf.length) / 128) * 2.5));
      const kids = bars()?.children;
      if (kids) {
        for (let i = 0; i < kids.length; i++) {
          (kids[i] as HTMLElement).style.transform = `scaleY(${lv[i].toFixed(2)})`;
        }
      }
    };
    raf = requestAnimationFrame(draw);
  } catch {
    // no Web Audio: bars stay flat
  }
  return () => {
    cancelAnimationFrame(raf);
    ctx?.close().catch(() => {});
  };
}

/**
 * Records up to 5 min as independent 60 s MediaRecorder segments (lifecycle in recorderCore.mjs).
 * The waveform (AnalyserNode) only runs while recording. In parallel the on-device Web Speech API
 * collects a fallback text.
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
  const cbs = useRef({ onFinish, onError });
  useEffect(() => {
    cbs.current = { onFinish, onError };
  });

  const coreRef = useRef<ReturnType<typeof createRecorderCore> | null>(null);
  useEffect(() => {
    const core = createRecorderCore(
      {
        supported: voiceSupported,
        getUserMedia: () =>
          navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }),
        pickMime: () => REC_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "",
        newMediaRecorder: (stream: MediaStream, mime: string) => {
          try {
            return new MediaRecorder(stream, {
              ...(mime ? { mimeType: mime } : {}),
              audioBitsPerSecond: REC_BPS,
            });
          } catch {
            return new MediaRecorder(stream, mime ? { mimeType: mime } : {});
          }
        },
        startAsr: startLocalAsr,
        asrText,
        stopAsr: stopLocalAsr,
        startMeter: (stream: MediaStream) => startMeter(stream, () => waveRef.current),
      },
      () => ({
        onFinish: (r: Recording) => cbs.current.onFinish(r),
        onError: (m: string) => cbs.current.onError(m),
        onRecording: setRecording,
        onElapsed: setElapsed,
      })
    );
    coreRef.current = core;
    return () => {
      core.cancel();
      coreRef.current = null;
    };
  }, []);
  const start = useCallback(() => coreRef.current?.start() ?? Promise.resolve(), []);
  const stop = useCallback(() => coreRef.current?.stop(), []);
  const cancel = useCallback(() => coreRef.current?.cancel(), []);

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
