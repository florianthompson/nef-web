// Recording lifecycle without React or browser globals (injected through `deps`), so it can be
// tested with fakes. Records up to 5 min as independent 60 s MediaRecorder segments.
export const MAX_REC_MS = 300000; // up to 5 minutes
export const SEG_MS = 60000; // recorded as independent 60 s segments
export const MIN_SEG_BYTES = 200;

/**
 * deps: supported(), getUserMedia(), pickMime(), newMediaRecorder(stream, mime), startAsr(), asrText(local),
 *       stopAsr(local, abort?), startMeter(stream) -> stop fn
 * getCbs(): { onFinish(rec), onError(msg), onRecording(bool), onElapsed(ms) } (read on every call, may change)
 */
export function createRecorderCore(deps, getCbs) {
  let rec = null;
  let seq = 0;
  let tick;

  function release(r) {
    clearTimeout(r.segTimer);
    clearTimeout(r.autoStop);
    clearInterval(tick);
    if (rec === r) rec = null;
    deps.stopAsr(r.local, true); // abort, not stop: a lingering recognizer keeps the iOS audio session busy
    r.stream.getTracks().forEach((t) => t.stop());
    r.stopMeter?.();
    getCbs().onRecording(false);
  }

  function finalize(r) {
    const blobs = r.segs.filter((b) => b && b.size >= MIN_SEG_BYTES);
    const localText = deps.asrText(r.local);
    const durationMs = Date.now() - r.t0;
    release(r);
    if (!r.cancelled) getCbs().onFinish({ blobs, type: r.type, durationMs, localText });
  }

  function segmentStopped(r, mr, i, chunks) {
    r.segs[i] = new Blob(chunks, { type: r.type });
    r.stopped++;
    // HAZ-163: the live recorder ended without stop() (iOS ends it when the capture track ends,
    // e.g. audio interruption). Treat it as the end of the recording, else the slot is never freed.
    if (!r.finishing && mr === r.mr) r.finishing = true;
    if (r.finishing && r.stopped === r.mrs.length) finalize(r);
  }

  function newSegment(r) {
    const i = r.mrs.length;
    const chunks = [];
    const mr = deps.newMediaRecorder(r.stream, r.mime);
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    mr.onstop = () => segmentStopped(r, mr, i, chunks);
    r.mrs.push(mr);
    r.mr = mr;
    return mr;
  }

  function rotate(r) {
    if (rec !== r || r.finishing) return;
    const old = r.mr;
    try {
      newSegment(r).start(); // next recorder first so no audio falls into the gap
    } catch {
      return;
    }
    r.segTimer = setTimeout(() => rotate(r), SEG_MS);
    if (old.state !== "inactive") old.stop();
  }

  function stop() {
    const r = rec;
    if (!r || r.finishing) return;
    clearTimeout(r.segTimer);
    clearTimeout(r.autoStop);
    r.finishing = true;
    if (r.mr.state !== "inactive") r.mr.stop();
  }

  function cancel() {
    seq++;
    const r = rec;
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
    release(r);
  }

  async function start() {
    if (rec) return;
    if (!deps.supported()) {
      getCbs().onError("Sprachaufnahme wird von diesem Browser nicht unterstützt.");
      return;
    }
    const mySeq = ++seq;
    let stream;
    try {
      stream = await deps.getUserMedia();
    } catch {
      getCbs().onError("Kein Mikrofonzugriff. Bitte in den Einstellungen erlauben.");
      return;
    }
    if (mySeq !== seq) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    const mime = deps.pickMime();
    const r = {
      stream,
      mrs: [],
      segs: [],
      stopped: 0,
      finishing: false,
      segTimer: undefined,
      autoStop: undefined,
      stopMeter: undefined,
      type: (mime || "audio/webm").split(";")[0],
      mime,
      t0: Date.now(),
      local: null,
      cancelled: false,
    };
    try {
      newSegment(r);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      getCbs().onError("Sprachaufnahme wird von diesem Browser nicht unterstützt.");
      return;
    }
    rec = r;
    getCbs().onElapsed(0);
    getCbs().onRecording(true);
    tick = setInterval(() => getCbs().onElapsed(Date.now() - r.t0), 200);
    r.autoStop = setTimeout(stop, MAX_REC_MS);
    r.stopMeter = deps.startMeter(stream);
    r.local = deps.startAsr();
    r.mr.start();
    r.segTimer = setTimeout(() => rotate(r), SEG_MS);
  }

  return { start, stop, cancel, isActive: () => rec !== null };
}
