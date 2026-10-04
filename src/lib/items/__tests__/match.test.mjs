import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildIndex, hintLines, matchText, resolveNote } from "../match.mjs";

const load = (f) => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8"));
const items = load("items.json");
const aliases = JSON.parse(readFileSync(new URL("../aliases.json", import.meta.url), "utf8"));
const fehlt = load("fehlt_notes.json");
const index = buildIndex(items, aliases);

const id = (title) => {
  const it = items.find((i) => i.title === title);
  assert.ok(it, `item ${title} is in the live list`);
  return it.id;
};
const title = (itemId) => items.find((i) => i.id === itemId)?.title;
const top = (text) => matchText(text, index);

// one confident mention -> that item
function maps(text, expected, confidence = "high") {
  const m = top(text);
  assert.equal(m.length, 1, `${text}: ${JSON.stringify(m)}`);
  assert.equal(title(m[0].itemId), expected, text);
  assert.equal(m[0].confidence, confidence, text);
  assert.equal(m[0].needsConfirm, false);
}
// several items fit -> confirmation with exactly these candidates (best first)
function asks(text, expected) {
  const m = top(text);
  assert.equal(m.length, 1, `${text}: ${JSON.stringify(m)}`);
  assert.equal(m[0].confidence, "low");
  assert.equal(m[0].needsConfirm, true);
  assert.deepEqual(m[0].candidates.map(title), expected, text);
}

test("all 23 real Fehlt notes map to their item", () => {
  assert.equal(fehlt.length, 23);
  for (const n of fehlt) maps(n.text, n.title);
});

test("short names and brand names", () => {
  const cases = [
    ["Rocu ist leer", "Rocuronium"],
    ["Esmeron fehlt", "Rocuronium"],
    ["Ceftri nachbestellen", "Ceftriaxon"],
    ["Rocephin fehlt", "Ceftriaxon"],
    ["ASS fehlt", "Acetylsalicylsäure"],
    ["Aspirin ist leer", "Acetylsalicylsäure"],
    ["Nora nur noch eine", "Noradrenalin"],
    ["Arterenol fehlt", "Noradrenalin"],
    ["Ketanest fehlt", "Esketamin"],
    ["Dormicum fehlt", "Midazolam"],
    ["Mida ist leer", "Midazolam"],
    ["Novalgin leer", "Metamizol"],
    ["Novamin leer", "Metamizol"],
    ["Tavor fehlt", "Lorazepam"],
    ["Partusisten fehlt", "Fenoterol"],
    ["Keppra fehlt", "Levetiracetam"],
    ["Haldol fehlt", "Haloperidol"],
    ["Lasix fehlt", "Furosemid"],
    ["Nitro fehlt", "Glyceroltrinitrat"],
    ["Buscopan fehlt", "Butylscopolamin"],
    ["Akrinor fehlt", "Cafedrin/Theodrenalin"],
    ["Ebrantil fehlt", "Urapidil"],
    ["Cyanokit fehlt", "Hydroxocobalamin"],
    ["Kochsalz 100 ml fehlt", "NaCl 0,9 % - 100 ml"],
    ["NaCl 10 Prozent fehlt", "Natriumchlorid 10 %"],
    ["Adrenalin 1 mg fehlt", "Epinephrin - 1 mg/1 ml"],
    ["Adrenalin 25 mg fehlt", "Epinephrin - 25 mg/25 ml"],
    ["Paracetamol 500 mg fehlt", "Paracetamol - 500 mg"],
    ["Paracetamol 125 Zäpfchen fehlt", "Paracetamol - 125 mg Suppositorium"],
    ["Glucose 10 % fehlt", "Glucose 10 %"],
    ["Naloxon nasal fehlt", "Naloxon nasal"],
    ["Atropinsulfat fehlt", "Atropinsulfat"],
    ["Medumat Hygienefilter", "Medumat"],
  ];
  for (const [t, e] of cases) maps(t, e);
});

test("STT misspellings", () => {
  maps("Rokuronium fehlt", "Rocuronium", "medium");
  maps("Zeftriaxon fehlt", "Ceftriaxon", "medium");
  maps("Metroprolol läuft ab", "Metoprolol", "medium");
  maps("Noradrenalien ist leer", "Noradrenalin", "medium");
  maps("Midazolam fehlt", "Midazolam");
  maps("Furosemit fehlt", "Furosemid", "medium");
});

test("ambiguous mentions ask for confirmation", () => {
  asks("Adrenalin fehlt", ["Epinephrin - 1 mg/1 ml", "Epinephrin - 25 mg/25 ml"]);
  asks("Glucose ist leer", ["Glucose 5 %", "Glucose 10 %", "Glucose 40 %"]);
  asks("Paracetamol fehlt", [
    "Paracetamol - 75 mg Suppositorium",
    "Paracetamol - 125 mg Suppositorium",
    "Paracetamol - 250 mg Suppositorium",
    "Paracetamol - 500 mg",
  ]);
  asks("Kochsalz fehlt", ["NaCl 0,9 % - 10 ml", "NaCl 0,9 % - 100 ml"]);
  asks("Naloxon fehlt", ["Naloxon", "Naloxon nasal"]);
  asks("Atropin fehlt", ["Atropin", "Atropinsulfat"]);
  asks("Corpuls geht nicht", ["EKG", "Ladekabel"]);
  // a strength that fits no item does not pick one
  asks("Glucose 20 % fehlt", ["Glucose 5 %", "Glucose 10 %", "Glucose 40 %"]);
});

test("the CorPuls / Metoprolol note: Corpuls asks, Metoprolol is sure", () => {
  const text =
    "CorPuls hatte nicht geladen, war vermutlich nicht ein gerastet. Jetzt am Strom lädt es.\nMetoprolol läuft 8/26 ab, werde ich mit dem RTW tauschen.";
  const m = top(text);
  assert.equal(m.length, 2);
  assert.equal(m[0].confidence, "low");
  assert.deepEqual(m[0].candidates.map(title), ["EKG", "Ladekabel"]);
  assert.equal(m[1].confidence, "high");
  assert.equal(title(m[1].itemId), "Metoprolol");
});

test("never invent items", () => {
  const text = "Feuerlöscher Prüfung abgelaufen (gemeldet), Druckbegrenzung Ventil und Beatmungsfilter Kind Verfall (wird bestellt)";
  assert.deepEqual(top(text), []);
  assert.deepEqual(top("Schaut guad aus :-) Test, Wetter ist schön"), []);
  assert.deepEqual(top("Feuerlöscher fehlt"), []);
  assert.deepEqual(top(""), []);
  // every returned id is on the list
  const ids = new Set(items.map((i) => i.id));
  for (const t of ["Adrenalin fehlt", "Corpuls", "Glucose", "Rocu"]) {
    for (const m of top(t)) for (const c of m.candidates) assert.ok(ids.has(c));
  }
  // an alias for a title that is not in the list is ignored
  const small = buildIndex([{ id: "x", title: "Medumat", category: "Ausrüstung" }], aliases);
  assert.deepEqual(matchText("Rocu fehlt", small), []);
});

test("resolveNote: the model never overrides a sure match and never saves an item alone", () => {
  const rocu = id("Rocuronium");
  const nora = id("Noradrenalin");
  const r = (text, pick, quote = text) => resolveNote({ text, quote }, pick, index);
  assert.deepEqual(r("Rocu fehlt", rocu), { itemId: rocu, confidence: "high", candidates: [rocu], needsConfirm: false });
  // model picks a wrong item for a sure alias: the matcher wins
  assert.equal(r("Rocu fehlt", nora).itemId, rocu);
  // ambiguous: confirmation, model pick listed first, no item chosen yet
  const amb = r("Adrenalin fehlt", id("Epinephrin - 25 mg/25 ml"));
  assert.equal(amb.itemId, null);
  assert.equal(amb.needsConfirm, true);
  assert.equal(title(amb.candidates[0]), "Epinephrin - 25 mg/25 ml");
  // fuzzy match the model contradicts: ask with both
  const dis = r("Rokuronium fehlt", nora);
  assert.equal(dis.needsConfirm, true);
  assert.deepEqual(dis.candidates, [rocu, nora]);
  // no lexical support: a model pick must be confirmed; unknown ids are dropped
  const only = r("Blutdruckmittel fehlt", id("Urapidil"));
  assert.equal(only.needsConfirm, true);
  assert.equal(only.itemId, null);
  assert.deepEqual(r("Feuerlöscher abgelaufen", "made-up-id"), {
    itemId: null,
    confidence: "none",
    candidates: [],
    needsConfirm: false,
  });
  // no mention in the cleaned text: the quote is used
  assert.equal(r("Ist leer", rocu, "Rocu ist leer").itemId, rocu);
});

test("hintLines for the model prompt", () => {
  const h = hintLines("Rocu fehlt und Adrenalin auch", index);
  assert.equal(h.length, 2);
  assert.match(h[0], /Rocuronium \(sicher\)/);
  assert.match(h[1], /unklar/);
});
