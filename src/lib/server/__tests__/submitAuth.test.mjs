import { test } from "node:test";
import assert from "node:assert/strict";
import { authorizeSubmit } from "../submitAuth.mjs";

function mock({ user = { id: "u1" }, authError = null, tables = {} } = {}) {
  return {
    auth: { getUser: async () => ({ data: { user }, error: authError }) },
    from(table) {
      let id;
      const q = {
        select: () => q,
        eq: (_c, v) => ((id = v), q),
        maybeSingle: async () => ({ data: tables[table]?.[id] ?? null }),
      };
      return q;
    },
  };
}

const tables = {
  users: { u1: { id: "u1", team_id: "t1", first_name: "Anna" }, u2: { id: "u2", team_id: null, first_name: "X" } },
  protocols: { p1: { team_id: "t1" }, p2: { team_id: "t2" } },
  vehicles: { v1: { team_id: "t1" }, v2: { team_id: "t2" } },
};
const body = { protocolId: "p1", vehicleId: "v1" };

test("401 without token", async () => {
  const r = await authorizeSubmit(mock({ tables }), "", body);
  assert.deepEqual([r.ok, r.status], [false, 401]);
});

test("401 on invalid token", async () => {
  const r = await authorizeSubmit(mock({ tables, user: null, authError: new Error("bad") }), "x", body);
  assert.deepEqual([r.ok, r.status], [false, 401]);
});

test("403 when caller has no team", async () => {
  const r = await authorizeSubmit(mock({ tables, user: { id: "u2" } }), "t", body);
  assert.equal(r.status, 403);
});

test("403 on protocol team mismatch", async () => {
  const r = await authorizeSubmit(mock({ tables }), "t", { protocolId: "p2", vehicleId: "v1" });
  assert.equal(r.status, 403);
});

test("403 on vehicle team mismatch", async () => {
  const r = await authorizeSubmit(mock({ tables }), "t", { protocolId: "p1", vehicleId: "v2" });
  assert.equal(r.status, 403);
});

test("403 on unknown ids", async () => {
  const r = await authorizeSubmit(mock({ tables }), "t", { protocolId: "nope", vehicleId: "v1" });
  assert.equal(r.status, 403);
});

test("400 on missing ids", async () => {
  const r = await authorizeSubmit(mock({ tables }), "t", {});
  assert.equal(r.status, 400);
});

test("ok returns server-side identity", async () => {
  const r = await authorizeSubmit(mock({ tables }), "t", body);
  assert.deepEqual(r, { ok: true, userId: "u1", teamId: "t1", firstName: "Anna" });
});
