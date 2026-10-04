import test from "node:test";
import assert from "node:assert/strict";
import { deleteDraft, getDraft, isMissingTable, putDraft, resetWarnedForTests } from "../draftStore.mjs";
import { applySnapshot, checkedIdsOf, emptyDraft } from "../../draftModel.mjs";

const auth = { userId: "u1", teamId: "t1" };
const ids = { vehicleId: "v1", protocolId: "p1" };
const mk = (checked, at) => applySnapshot(emptyDraft(ids), { checkedIds: checked }, at).draft;

// chainable PostgREST stand-in over one row
function sb({ error = null, row = null } = {}) {
  const state = { row, upserts: [], deletes: 0 };
  const q = {
    select: () => q,
    eq: () => q,
    maybeSingle: async () => ({ data: state.row ? { data: state.row } : null, error }),
    upsert: async (r) => {
      state.upserts.push(r);
      if (!error) state.row = r.data;
      return { error };
    },
    delete: () => ({ eq: () => ({ eq: () => ({ eq: async () => ((state.deletes++, { error })) }) }) }),
  };
  return { from: () => q, state };
}

test("isMissingTable recognises 42P01, PGRST205 and 404", () => {
  assert.equal(isMissingTable({ code: "42P01" }), true);
  assert.equal(isMissingTable({ code: "PGRST205" }), true);
  assert.equal(isMissingTable({ status: 404 }), true);
  assert.equal(isMissingTable({ code: "23505", message: "dup" }), false);
  assert.equal(isMissingTable(null), false);
});

test("missing table answers 503 drafts_unavailable and logs once", async () => {
  resetWarnedForTests();
  const logs = [];
  const err = { code: "42P01", message: 'relation "protocol_drafts" does not exist' };
  const log = (m) => logs.push(m);
  const a = await getDraft(sb({ error: err }), auth, ids, { log });
  const b = await putDraft(sb({ error: err }), auth, { ...ids, draft: mk(["a"], 5) }, { log });
  const c = await deleteDraft(sb({ error: err }), auth, ids, { log });
  for (const r of [a, b, c]) assert.deepEqual([r.ok, r.status, r.error], [false, 503, "drafts_unavailable"]);
  assert.equal(logs.length, 1);
});

test("put merges with the stored draft (stale device cannot overwrite newer fields)", async () => {
  const client = sb({ row: mk(["a", "b"], 200) });
  const r = await putDraft(client, auth, { ...ids, draft: mk(["c"], 100) }, { now: 300 });
  assert.equal(r.ok, true);
  assert.deepEqual(checkedIdsOf(r.draft).sort(), ["a", "b", "c"], "a and b kept, c added");
  assert.equal(client.state.upserts[0].user_id, "u1");
  assert.equal(client.state.upserts[0].team_id, "t1");
});

test("put rejects a draft for another vehicle or garbage", async () => {
  const r = await putDraft(sb(), auth, { ...ids, draft: { ...mk(["a"], 1), vehicleId: "v2" } });
  assert.equal(r.status, 400);
  assert.equal((await putDraft(sb(), auth, { ...ids, draft: "x" })).status, 400);
});

test("get returns null for an expired draft, delete issues a scoped delete", async () => {
  const old = mk(["a"], 1);
  assert.equal((await getDraft(sb({ row: old }), auth, ids, { now: 13 * 3600 * 1000 })).draft, null);
  const c = sb();
  assert.equal((await deleteDraft(c, auth, ids)).ok, true);
  assert.equal(c.state.deletes, 1);
});
