import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { createRecorderCore } from "../recorderCore.mjs";

// the 60 s segment, 5 min limit and tick timers never fire here (and must not keep the process alive)
mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
const flush = () => Promise.resolve();

// Fake browser: streams with live tracks, MediaRecorders that end like the real ones
// (dataavailable, then stop), and a way for the platform to end a recorder on its own.
function setup() {
  const w = { liveTracks: 0, recorders: [], finished: [], notices: [], recording: false, asrOn: 0 };
  const deps = {
    supported: () => true,
    getUserMedia: async () => {
      const t = { live: true, stop() { if (this.live) { this.live = false; w.liveTracks--; } } };
      w.liveTracks++;
      return { getTracks: () => [t] };
    },
    pickMime: () => "audio/mp4",
    newMediaRecorder: (stream) => {
      const mr = {
        stream,
        state: "inactive",
        ondataavailable: null,
        onstop: null,
        start() { this.state = "recording"; },
        stop() { this._end(); },
        _end() {
          if (this.state === "inactive") return;
          this.state = "inactive";
          this.ondataavailable?.({ data: new Blob([new Uint8Array(4000)]) });
          this.onstop?.();
        },
      };
      w.recorders.push(mr);
      return mr;
    },
    startAsr: () => { w.asrOn++; return { on: true }; },
    asrText: () => "",
    stopAsr: (l) => { if (l?.on) { l.on = false; w.asrOn--; } },
    startMeter: () => () => {},
  };
  const core = createRecorderCore(deps, () => ({
    onFinish: (r) => w.finished.push(r),
    onError: (m) => w.notices.push(m),
    onRecording: (b) => { w.recording = b; },
    onElapsed: () => {},
  }));
  return { w, core };
}

// the composer: finished recording -> text, then the user clears the field
const composer = (w) => ({ text: "", feed() { for (const r of w.finished.splice(0)) this.text = r.blobs.length ? "transcript" : ""; }, clear() { this.text = ""; } });

test("5 cycles of record, stop, text, clear, record again", async () => {
  const { w, core } = setup();
  const c = composer(w);
  for (let i = 1; i <= 6; i++) {
    await core.start();
    assert.equal(w.recording, true, `cycle ${i}: recording after tapping the mic`);
    assert.equal(w.recorders.length, i, `cycle ${i}: a new MediaRecorder was started`);
    core.stop();
    c.feed();
    assert.equal(c.text, "transcript", `cycle ${i}: text appears`);
    c.clear();
    assert.equal(core.isActive(), false, `cycle ${i}: nothing holds the mic after stop`);
    assert.equal(w.liveTracks, 0, `cycle ${i}: all capture tracks released`);
    assert.equal(w.asrOn, 0);
  }
});

test("recorder that stops on its own (iOS: capture track ends) finishes and releases the mic", async () => {
  const { w, core } = setup();
  const c = composer(w);
  for (let i = 1; i <= 6; i++) {
    await core.start();
    assert.equal(w.recording, true, `cycle ${i}: recording`);
    if (i % 2 === 0) {
      w.recorders.at(-1)._end(); // platform ends the recorder, the user never taps stop
    } else {
      core.stop();
    }
    c.feed();
    assert.equal(c.text, "transcript", `cycle ${i}: the audio recorded so far still becomes text`);
    assert.equal(w.recording, false, `cycle ${i}: recording state ended`);
    assert.equal(core.isActive(), false, `cycle ${i}: slot freed, start() will not return early`);
    assert.equal(w.liveTracks, 0, `cycle ${i}: capture tracks released`);
    c.clear();
  }
});

test("stop tapped after the recorder ended on its own is a no-op and the next start works", async () => {
  const { w, core } = setup();
  await core.start();
  w.recorders.at(-1)._end();
  core.stop(); // late tap on the send button
  assert.equal(w.finished.length, 1, "the recording is delivered once");
  assert.equal(core.isActive(), false);
  await core.start();
  assert.equal(w.recording, true);
  core.cancel();
  assert.equal(w.liveTracks, 0);
});

test("cancel frees the slot and discards the audio", async () => {
  const { w, core } = setup();
  await core.start();
  core.cancel();
  await flush();
  assert.equal(w.finished.length, 0);
  assert.equal(core.isActive(), false);
  await core.start();
  assert.equal(w.recording, true);
  core.stop();
  assert.equal(w.finished.length, 1);
});
