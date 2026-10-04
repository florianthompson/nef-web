import test from "node:test";
import assert from "node:assert/strict";
import { createDraftSync, draftKey } from "../draftSync.mjs";
import { applySnapshot, checkedIdsOf, emptyDraft, fromLegacy, mergeDrafts, normalizeDraft } from "../draftModel.mjs";
import { createHttpTransport } from "../draftTransport.mjs";

const U = "u1";
const P = "p1";
const ctx = (vehicleId = "v1") => ({ userId: U, vehicleId, protocolId: P });

function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
    m,
  };
}

// manual clock and timers
function clock() {
  let t = 1_000_000;
  const timers = new Map();
  let id = 0;
  return {
    now: () => t,
    setTimer: (fn, ms) => {
      timers.set(++id, { fn, at: t + ms });
      return id;
    },
    clearTimer: (i) => void timers.delete(i),
    advance(ms) {
      const end = t + ms;
      for (;;) {
        const next = [...timers.entries()].filter(([, x]) => x.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        t = Math.max(t, next[1].at);
        timers.delete(next[0]);
        next[1].fn();
      }
      t = end;
    },
    pending: () => timers.size,
  };
}

// in-memory server shared by "devices"
function fakeServer({ missing = false } = {}) {
  const rows = new Map();
  const s = {
    rows,
    online: true,
    puts: [],
    gets: 0,
    dels: 0,
    transport: {
      async get(c) {
        s.gets++;
        if (missing) return { status: "missing" };
        if (!s.online) return { status: "error" };
        return { status: "ok", draft: rows.get(`${c.userId}:${c.vehicleId}:${c.protocolId}`) ?? null };
      },
      async put(c, draft, opts) {
        s.puts.push({ c, draft, keepalive: !!opts?.keepalive });
        if (missing) return { status: "missing" };
        if (!s.online) return { status: "error" };
        const k = `${c.userId}:${c.vehicleId}:${c.protocolId}`;
        rows.set(k, mergeDrafts(rows.get(k), draft));
        return { status: "ok" };
      },
      async del(c) {
        s.dels++;
        if (!s.online) return { status: "error" };
        rows.delete(`${c.userId}:${c.vehicleId}:${c.protocolId}`);
        return { status: "ok" };
      },
    },
  };
  return s;
}

function setup(opts = {}) {
  const storage = opts.storage ?? memStorage();
  const server = opts.server ?? fakeServer();
  const clk = opts.clock ?? clock();
  const logs = [];
  const sync = createDraftSync({ storage, transport: server.transport, now: clk.now, setTimer: clk.setTimer, clearTimer: clk.clearTimer, log: (m) => logs.push(m) });
  return { storage, server, clk, sync, logs };
}
const snap = (checkedIds, extra = {}) => ({ checkedIds, shiftNote: "", step: null, openCats: [], scroll: null, ...extra });
const tick = () => new Promise((r) => setImmediate(r));

test("autosave is debounced: many changes inside 800 ms make one PUT", async () => {
  const { sync, server, clk } = setup();
  sync.update(ctx(), snap(["a"]));
  clk.advance(500);
  sync.update(ctx(), snap(["a", "b"]));
  clk.advance(500);
  assert.equal(server.puts.length, 0, "debounce restarted by the second change");
  sync.update(ctx(), snap(["a", "b", "c"]));
  clk.advance(800);
  await tick();
  assert.equal(server.puts.length, 1);
  assert.deepEqual(checkedIdsOf(server.puts[0].draft).sort(), ["a", "b", "c"]);
});

test("max wait: a steady stream of changes still syncs within 5 s", async () => {
  const { sync, server, clk } = setup();
  for (let i = 0; i < 12; i++) {
    sync.update(ctx(), snap(Array.from({ length: i + 1 }, (_, n) => `i${n}`)));
    clk.advance(500); // never 800 ms of quiet
  }
  await tick();
  assert.ok(server.puts.length >= 1, "synced despite no quiet period");
  assert.ok(server.puts.length <= 2);
});

test("the local queue is written at once, before any network", () => {
  const { sync, storage, server } = setup();
  sync.update(ctx(), snap(["a"]));
  const rec = JSON.parse(storage.getItem(draftKey(U, "v1", P)));
  assert.equal(rec.dirty, true);
  assert.equal(rec.draft.checked.a.on, true);
  assert.equal(server.puts.length, 0);
});

test("pagehide and visibilitychange hidden flush with keepalive, visible does not", async () => {
  for (const kind of ["pagehide", "visibilitychange"]) {
    const { sync, server } = setup();
    const win = new EventTarget();
    const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
    const detach = sync.attachLifecycle(win, doc, U);
    sync.update(ctx(), snap(["a"]));
    if (kind === "visibilitychange") {
      doc.dispatchEvent(new Event("visibilitychange"));
      assert.equal(server.puts.length, 0, "visible: nothing flushed");
      doc.visibilityState = "hidden";
      doc.dispatchEvent(new Event("visibilitychange"));
    } else win.dispatchEvent(new Event("pagehide"));
    assert.equal(server.puts.length, 1, `${kind} sent synchronously`);
    assert.equal(server.puts[0].keepalive, true);
    detach();
    sync.update(ctx(), snap(["a", "b"]));
    win.dispatchEvent(new Event("pagehide"));
    assert.equal(server.puts.length, 1, "detached listeners do nothing");
  }
});

test("offline: changes queue locally, nothing is dropped, sync on online", async () => {
  const { sync, server, clk, storage } = setup();
  server.online = false;
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  sync.attachLifecycle(win, doc, U);
  sync.update(ctx(), snap(["a"]));
  clk.advance(800);
  await tick();
  assert.equal(server.rows.size, 0);
  assert.equal(sync.isDirty(ctx()), true, "still dirty after a failed PUT");
  assert.equal(JSON.parse(storage.getItem(draftKey(U, "v1", P))).dirty, true);
  sync.update(ctx(), snap(["a", "b"]));
  clk.advance(800);
  await tick();
  server.online = true;
  win.dispatchEvent(new Event("online"));
  await tick();
  assert.deepEqual(checkedIdsOf(server.rows.get("u1:v1:p1")).sort(), ["a", "b"]);
  assert.equal(sync.isDirty(ctx()), false, "confirmed by the server");
});

test("a change made while a PUT is in flight is not marked clean by the older PUT", async () => {
  const { sync, server, clk } = setup();
  sync.update(ctx(), snap(["a"]));
  clk.advance(800);
  sync.update(ctx(), snap(["a", "b"])); // before the first PUT resolves
  await tick();
  assert.equal(sync.isDirty(ctx()), true);
  clk.advance(800);
  await tick();
  assert.deepEqual(checkedIdsOf(server.rows.get("u1:v1:p1")).sort(), ["a", "b"]);
  assert.equal(sync.isDirty(ctx()), false);
});

test("reload resume: a fresh sync instance restores from the local queue even offline", async () => {
  const storage = memStorage();
  const server = fakeServer();
  server.online = false;
  const a = setup({ storage, server });
  a.sync.update(ctx(), snap(["a", "b"], { shiftNote: "Notiz", step: "check", openCats: ["c1"], scroll: { anchorId: "b", offset: 40 } }));
  const b = setup({ storage, server }); // page reloaded, same storage
  const d = await b.sync.resume(ctx());
  assert.deepEqual(checkedIdsOf(d).sort(), ["a", "b"]);
  assert.equal(d.shiftNote.value, "Notiz");
  assert.equal(d.step.value, "check");
  assert.deepEqual(d.openCats.value, ["c1"]);
  assert.deepEqual(d.scroll.value, { anchorId: "b", offset: 40 });
  assert.equal(b.sync.isDirty(ctx()), true, "unsynced offline work is still queued");
});

test("another device resumes the server draft (cross session)", async () => {
  const server = fakeServer();
  const a = setup({ server });
  a.sync.update(ctx(), snap(["a", "b"], { shiftNote: "von A" }));
  a.clk.advance(800);
  await tick();
  const b = setup({ server }); // new device: empty storage
  const d = await b.sync.resume(ctx());
  assert.deepEqual(checkedIdsOf(d).sort(), ["a", "b"]);
  assert.equal(d.shiftNote.value, "von A");
  assert.equal(b.sync.isDirty(ctx()), false, "nothing to upload, server has it all");
});

test("merge: last write wins per field, checked ids merge per item", () => {
  const base = emptyDraft({ protocolId: P, vehicleId: "v1" });
  const A = applySnapshot(base, snap(["a", "b"], { shiftNote: "alt" }), 100).draft;
  const B1 = applySnapshot(A, snap(["a"], { shiftNote: "alt" }), 200).draft; // unchecks b at 200
  const C = applySnapshot(base, snap(["c"], { shiftNote: "neu" }), 150).draft; // other device
  const m = mergeDrafts(B1, C);
  assert.deepEqual(checkedIdsOf(m).sort(), ["a", "c"], "b uncheck (200) beats b check (100), c survives");
  assert.equal(m.shiftNote.value, "neu", "shift note 150 beats 100");
  // an older uncheck loses against a newer check
  const old = applySnapshot(A, snap(["a"]), 120).draft;
  const newer = applySnapshot(old, snap(["a", "b"], { shiftNote: "alt" }), 300).draft; // b rechecked at 300
  assert.deepEqual(checkedIdsOf(mergeDrafts(newer, old)).sort(), ["a", "b"]);
  assert.deepEqual(checkedIdsOf(mergeDrafts(old, newer)).sort(), ["a", "b"]);
});

test("unchanged snapshots do not create writes", () => {
  const { sync, server } = setup();
  assert.equal(sync.update(ctx(), snap([])), false);
  assert.equal(sync.update(ctx(), snap(["a"])), true);
  assert.equal(sync.update(ctx(), snap(["a"])), false);
  assert.equal(server.puts.length, 0);
});

test("per-vehicle isolation: queues, server rows and clear never cross vehicles", async () => {
  const { sync, server, clk, storage } = setup();
  sync.update(ctx("v1"), snap(["a"]));
  sync.update(ctx("v2"), snap(["z"]));
  clk.advance(800);
  await tick();
  assert.deepEqual(checkedIdsOf(server.rows.get("u1:v1:p1")), ["a"]);
  assert.deepEqual(checkedIdsOf(server.rows.get("u1:v2:p1")), ["z"]);
  assert.deepEqual(checkedIdsOf(await sync.resume(ctx("v2"))), ["z"]);
  await sync.clear(ctx("v1"));
  assert.equal(storage.getItem(draftKey(U, "v1", P)), null);
  assert.notEqual(storage.getItem(draftKey(U, "v2", P)), null);
  assert.equal(server.rows.has("u1:v1:p1"), false);
  assert.equal(server.rows.has("u1:v2:p1"), true);
});

test("clear on successful submit removes server draft and local queue, no later flush", async () => {
  const { sync, server, clk, storage } = setup();
  sync.update(ctx(), snap(["a"]));
  await sync.clear(ctx());
  clk.advance(5000);
  await tick();
  assert.equal(server.dels, 1);
  assert.equal(server.puts.length, 0, "pending timer was cancelled");
  assert.equal(storage.length, 0);
  assert.equal(server.rows.size, 0);
});

test("failed submit keeps the draft: the caller does not call clear, queue and server stay", async () => {
  const { sync, server, clk, storage } = setup();
  sync.update(ctx(), snap(["a"]));
  clk.advance(800);
  await tick();
  // submit fails -> NotesScreen never calls clear()
  assert.equal(server.rows.size, 1);
  assert.equal(storage.length, 1);
  assert.deepEqual(checkedIdsOf(await setup({ server }).sync.resume(ctx())), ["a"]);
});

test("missing table: falls back to the local queue, logs once, no request spam", async () => {
  const server = fakeServer({ missing: true });
  const { sync, clk, logs, storage } = setup({ server });
  sync.update(ctx(), snap(["a"]));
  clk.advance(800);
  await tick();
  assert.equal(sync.serverMissing, true);
  assert.equal(logs.length, 1);
  sync.update(ctx(), snap(["a", "b"]));
  clk.advance(5000);
  await tick();
  const d = await sync.resume(ctx());
  assert.equal(logs.length, 1, "logged once");
  assert.equal(server.puts.length, 1, "no PUTs after the table was found missing");
  assert.deepEqual(checkedIdsOf(d).sort(), ["a", "b"]);
  assert.notEqual(storage.getItem(draftKey(U, "v1", P)), null);
});

test("legacy localStorage draft is migrated into the queue and synced", async () => {
  const { sync, server, clk } = setup();
  const used = sync.migrateLegacy(ctx(), { protocolId: P, vehicleId: "v1", shiftNote: "alt", checkedIds: ["x", "y"], savedAt: 5 });
  assert.equal(used, true);
  assert.equal(sync.migrateLegacy(ctx("v2"), { protocolId: P, vehicleId: "v1", shiftNote: "", checkedIds: ["q"], savedAt: 5 }), false, "other vehicle's legacy draft is not taken");
  clk.advance(800);
  await tick();
  assert.deepEqual(checkedIdsOf(server.rows.get("u1:v1:p1")).sort(), ["x", "y"]);
  assert.equal(fromLegacy({ protocolId: P, vehicleId: "v1", shiftNote: "n", checkedIds: [], savedAt: 7 }).shiftNote.at, 7);
});

test("expired drafts (older than 12 h) do not resurface", async () => {
  const server = fakeServer();
  const old = applySnapshot(emptyDraft({ protocolId: P, vehicleId: "v1" }), snap(["a"]), 1).draft;
  server.rows.set("u1:v1:p1", old);
  const { sync, clk } = setup({ server });
  clk.advance(13 * 3600 * 1000);
  assert.deepEqual(checkedIdsOf(await sync.resume(ctx())), []);
});

test("normalizeDraft rejects other vehicles, bad versions and junk", () => {
  const d = applySnapshot(emptyDraft({ protocolId: P, vehicleId: "v1" }), snap(["a"]), 9).draft;
  assert.ok(normalizeDraft(d, { protocolId: P, vehicleId: "v1" }));
  assert.equal(normalizeDraft(d, { protocolId: P, vehicleId: "v2" }), null);
  assert.equal(normalizeDraft({ ...d, v: 2 }), null);
  assert.equal(normalizeDraft(null), null);
  assert.equal(normalizeDraft({ ...d, checked: { a: { on: "yes", at: 1 } } }).checked.a, undefined);
});

test("http transport: bearer token, keepalive PUT, 503 drafts_unavailable means missing", async () => {
  const calls = [];
  const responses = [
    { ok: true, status: 200, json: async () => ({ draft: null }) },
    { ok: true, status: 200, json: async () => ({}) },
    { ok: false, status: 503, json: async () => ({ error: "drafts_unavailable" }) },
    { ok: false, status: 401, json: async () => ({ error: "unauthorized" }) },
  ];
  const t = createHttpTransport({ fetchImpl: async (u, i) => (calls.push([u, i]), responses.shift()), getToken: () => "tok" });
  assert.deepEqual(await t.get(ctx()), { status: "ok", draft: null });
  assert.equal(calls[0][1].headers.Authorization, "Bearer tok");
  assert.match(calls[0][0], /vehicleId=v1&protocolId=p1/);
  assert.equal((await t.put(ctx(), { v: 1 }, { keepalive: true })).status, "ok");
  assert.equal(calls[1][1].keepalive, true);
  assert.equal((await t.put(ctx(), { v: 1 })).status, "missing");
  assert.equal((await t.del(ctx())).status, "error");
  const down = createHttpTransport({ fetchImpl: async () => { throw new Error("offline"); }, getToken: () => "t" });
  assert.equal((await down.put(ctx(), {})).status, "error");
});
