import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendDraft,
  createVehicleFeed,
  draftKey,
  legacyNoteVehicleId,
  LEGACY_DRAFT_KEY,
  migrateLegacyDraft,
  noteBelongsToVehicle,
  readDraft,
  visibleFeed,
  writeDraft,
} from "../vehicleNotes.mjs";

const vehicles = [
  { id: "A", name: "RTW 1", isDefault: true },
  { id: "B", name: "RTW 2", isDefault: false },
];
const note = (id, vehicle_id, is_resolved = false) => ({ id, vehicle_id, is_resolved });
const memStorage = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k), m };
};
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};

test("legacy rule: notes without vehicle_id belong to the default vehicle, else the first", () => {
  assert.equal(legacyNoteVehicleId(vehicles), "A");
  assert.equal(legacyNoteVehicleId([{ id: "X", isDefault: false }, { id: "Y", isDefault: false }]), "X");
  assert.equal(legacyNoteVehicleId([]), null);
  assert.equal(noteBelongsToVehicle(note(1, null), "A", "A"), true);
  assert.equal(noteBelongsToVehicle(note(1, null), "B", "A"), false);
  assert.equal(noteBelongsToVehicle(note(2, "B"), "A", "A"), false);
  assert.equal(noteBelongsToVehicle(note(2, "B"), "B", "A"), true);
  assert.equal(noteBelongsToVehicle(note(3, "B"), null, null), true, "team without vehicles shows everything");
});

// Backend: A has a1 (open), a2 (done) and the legacy note L; B has b1 (open) and b2 (done).
const db = {
  A: [note("a1", "A"), note("a2", "A", true), note("L", null)],
  B: [note("b1", "B"), note("b2", "B", true)],
};

test("A -> B -> A with slow responses: list, filter results and counts always belong to the selected vehicle", async () => {
  const calls = [];
  const fetchFor = (vid) => {
    const d = deferred();
    calls.push({ vid, d });
    return d.promise;
  };
  const seen = []; // everything the screen would render, after every state change and every selection
  let selected;
  const feed = createVehicleFeed({ fetchFor, legacyId: () => "A", onChange: () => snap() });
  function snap() {
    const v = visibleFeed(feed.getState(), selected);
    const open = v.notes.filter((n) => !n.is_resolved);
    const done = v.notes.filter((n) => n.is_resolved);
    seen.push({ selected, loading: v.loading, ids: v.notes.map((n) => n.id), open: open.length, done: done.length });
  }
  const select = (vid) => {
    selected = vid;
    snap(); // the render right after the tap, before any effect ran
    return feed.select(vid);
  };
  const ok = (notes) => ({ notes, comments: {}, error: null });

  const pA1 = select("A");
  const pB = select("B"); // A's first request is still in flight
  const pA2 = select("A"); // back to A: a second A request, B still in flight

  assert.deepEqual(calls.map((c) => c.vid), ["A", "B", "A"]);
  calls[1].d.resolve(ok(db.B)); // B answers first, but A is selected now
  assert.equal(await pB, false, "B response is dropped, A is selected");
  assert.equal(visibleFeed(feed.getState(), "A").loading, true, "A is still loading, B rows are not shown");

  calls[2].d.resolve(ok(db.A)); // the newer A request answers
  assert.equal(await pA2, true);
  assert.deepEqual(visibleFeed(feed.getState(), "A").notes.map((n) => n.id), ["a1", "a2", "L"]);

  // the OLD A request (token 1) arrives late with outdated data: it must not overwrite the newer A
  calls[0].d.resolve(ok([note("stale-A", "A")]));
  assert.equal(await pA1, false);
  assert.deepEqual(visibleFeed(feed.getState(), "A").notes.map((n) => n.id), ["a1", "a2", "L"]);

  // now really go A -> B: B's rows replace A's, no frame shows A's rows under B
  const pB2 = select("B");
  assert.deepEqual(visibleFeed(feed.getState(), "B").notes, [], "list cleared at once");
  assert.equal(visibleFeed(feed.getState(), "B").loading, true);
  calls[3].d.resolve(ok(db.B));
  await pB2;
  assert.deepEqual(visibleFeed(feed.getState(), "B").notes.map((n) => n.id), ["b1", "b2"]);

  // a delayed A response from earlier arrives after B is selected
  const pA3 = select("A");
  const pB3 = select("B");
  calls[4].d.resolve(ok(db.A)); // A answers after B was selected again
  calls[5].d.resolve(ok(db.B));
  assert.equal(await pA3, false);
  await pB3;

  for (const f of seen) {
    const allowed = f.selected === "A" ? ["a1", "a2", "L", "stale-A"] : ["b1", "b2"];
    for (const id of f.ids) assert.ok(allowed.includes(id) && id !== "stale-A", `frame for ${f.selected} showed ${id}`);
  }
  assert.ok(!seen.some((f) => f.ids.includes("stale-A")), "the old A response never reached the screen");
  const settledA = seen.filter((f) => f.selected === "A" && !f.loading);
  assert.ok(settledA.every((f) => f.open === 2 && f.done === 1), "A: 2 open (a1 + legacy), 1 done");
  const settledB = seen.filter((f) => f.selected === "B" && !f.loading);
  assert.ok(settledB.every((f) => f.open === 1 && f.done === 1), "B: 1 open, 1 done");
  assert.ok(seen.filter((f) => f.loading).every((f) => f.ids.length === 0), "while loading nothing is listed");
});

test("rows of another vehicle in a response (legacy null rows under B) are filtered out", async () => {
  const feed = createVehicleFeed({
    fetchFor: async () => ({ notes: [note("b1", "B"), note("L", null), note("a1", "A")], comments: {}, error: null }),
    legacyId: () => "A",
  });
  await feed.select("B");
  assert.deepEqual(feed.getState().notes.map((n) => n.id), ["b1"]);
});

test("refresh and events for another vehicle are ignored; a refresh for the current one updates", async () => {
  let n = 0;
  const feed = createVehicleFeed({
    fetchFor: async (vid) => ({ notes: [note(`${vid}${++n}`, vid)], comments: {}, error: null }),
  });
  await feed.select("A");
  assert.equal(await feed.refresh("B"), false);
  assert.equal(n, 1, "no request for B");
  assert.equal(await feed.refresh("A"), true);
  assert.deepEqual(feed.getState().notes.map((x) => x.id), ["A2"]);
  assert.deepEqual(visibleFeed(feed.getState(), "B").notes, []);
});

test("a failed refresh keeps the rows, a failed switch shows an error without the old rows", async () => {
  let fail = false;
  const feed = createVehicleFeed({
    fetchFor: async (vid) => (fail ? { notes: [], comments: {}, error: "boom" } : { notes: [note(vid + "1", vid)], comments: {}, error: null }),
  });
  await feed.select("A");
  fail = true;
  await feed.refresh();
  assert.equal(feed.getState().error, "boom");
  assert.equal(feed.getState().notes.length, 1);
  await feed.select("B");
  assert.deepEqual(visibleFeed(feed.getState(), "B").notes, []);
  assert.equal(visibleFeed(feed.getState(), "B").error, "boom");
});

test("drafts are stored per vehicle and never cross", () => {
  const st = memStorage();
  writeDraft(st, "A", "text for A");
  writeDraft(st, "B", "text for B");
  assert.equal(readDraft(st, "A"), "text for A");
  assert.equal(readDraft(st, "B"), "text for B");
  assert.equal(draftKey("A"), "nef-notes-draft:A");
  writeDraft(st, "A", "");
  assert.equal(readDraft(st, "A"), "");
  assert.equal(readDraft(st, "B"), "text for B");
  // a transcription that finishes after the user switched lands in the vehicle it started on
  appendDraft(st, "B", "late transcript");
  assert.equal(readDraft(st, "B"), "text for B late transcript");
  assert.equal(readDraft(st, "A"), "");
});

test("the old global draft moves to the default vehicle once", () => {
  const st = memStorage({ [LEGACY_DRAFT_KEY]: "old draft" });
  migrateLegacyDraft(st, "A");
  assert.equal(readDraft(st, "A"), "old draft");
  assert.equal(st.getItem(LEGACY_DRAFT_KEY), null);
  writeDraft(st, "A", "newer");
  migrateLegacyDraft(st, "A"); // second run: nothing left to move, nothing overwritten
  assert.equal(readDraft(st, "A"), "newer");
  // existing draft on the target is never overwritten
  const st2 = memStorage({ [LEGACY_DRAFT_KEY]: "old", [draftKey("A")]: "keep" });
  migrateLegacyDraft(st2, "A");
  assert.equal(readDraft(st2, "A"), "keep");
  assert.equal(st2.getItem(LEGACY_DRAFT_KEY), "old", "nothing is lost");
  // broken storage does not throw
  assert.doesNotThrow(() => migrateLegacyDraft({ getItem() { throw new Error("x"); } }, "A"));
});
