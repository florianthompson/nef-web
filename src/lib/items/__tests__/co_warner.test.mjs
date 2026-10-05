import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const items = JSON.parse(readFileSync(new URL("./fixtures/items.json", import.meta.url), "utf8"));

test("HAZ-179: CO-Warner is one item under Fahrzeug, not Ausrüstung", () => {
  const hits = items.filter((i) => i.title === "CO-Warner");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].category, "Fahrzeug");
  assert.ok(!items.some((i) => i.category === "Ausrüstung" && /co.?warner/i.test(i.title)));
});
