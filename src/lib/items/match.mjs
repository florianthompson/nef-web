// Maps spoken or typed text to real inventory items. Pure module, no I/O, no React.
// The item list is the only source of truth: every returned id comes from the list given to buildIndex.

const UNITS = new Map([
  ["%", "%"],
  ["prozent", "%"],
  ["mg", "mg"],
  ["milligramm", "mg"],
  ["g", "g"],
  ["gramm", "g"],
  ["ug", "ug"],
  ["mcg", "ug"],
  ["mikrogramm", "ug"],
  ["ml", "ml"],
  ["milliliter", "ml"],
  ["l", "l"],
  ["liter", "l"],
  ["ie", "ie"],
  ["mmol", "mmol"],
]);

const FUZZY_MIN_SIM = 0.84;
const FUZZY_MIN_LEN = 6;
const MAX_WINDOW = 4;
const MAX_CANDIDATES = 4;

/** lowercase tokens: letters and numbers (decimal comma as dot), umlauts folded, symbols dropped except % */
export function tokenize(s) {
  const t = String(s ?? "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[µμ]/g, "u")
    .replace(/(\d),(\d)/g, "$1.$2");
  return (t.match(/\d+(?:\.\d+)?|[a-z]+|%/g) ?? []).map((w) => (w === "prozent" ? "%" : w));
}

export const normalize = (s) => tokenize(s).join(" ");

const isNum = (t) => /^\d/.test(t);

/** Damerau-Levenshtein distance (optimal string alignment) */
export function distance(a, b) {
  const n = a.length;
  const m = b.length;
  if (!n) return m;
  if (!m) return n;
  const d = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[n][m];
}

/** sound-alike fold for speech-to-text spellings (Rokuronium = Rocuronium, Zeftriaxon = Ceftriaxon) */
export function fold(compact) {
  return compact
    .replace(/ph/g, "f")
    .replace(/ck/g, "k")
    .replace(/c(?!h)/g, "k")
    .replace(/z/g, "k")
    .replace(/(.)\1+/g, "$1");
}

/** strengths in a token list: [{ v: number, u: unit | "" }] with the index of the number token */
function strengths(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    if (!isNum(tokens[i])) continue;
    const u = UNITS.get(tokens[i + 1] ?? "") ?? "";
    out.push({ v: Number(tokens[i]), u, at: i });
  }
  return out;
}

/** the name part of a title: its words up to the first number (a leading number belongs to the name, e.g. 4-DMAP) */
function nameOf(tokens) {
  const i = tokens.findIndex((t, k) => k > 0 && isNum(t));
  return i < 0 ? tokens : tokens.slice(0, i);
}

const mk = (tokens) => ({ tokens, text: tokens.join(" "), compact: tokens.join("") });

/**
 * items: [{ id, title, category }] (the real list); aliasData: { items: { key: [alias, ...] } }.
 * A key matches an item by its normalized title or by the name part of its title.
 */
export function buildIndex(items, aliasData = { items: {} }) {
  const aliasByKey = new Map();
  for (const [k, v] of Object.entries(aliasData?.items ?? {})) {
    aliasByKey.set(normalize(k), Array.isArray(v) ? v : []);
  }
  const entries = [];
  const byId = new Map();
  items.forEach((it, order) => {
    const tt = tokenize(it.title);
    const nm = nameOf(tt);
    const rec = { id: it.id, title: it.title, category: it.category, order, nums: strengths(tt), name: mk(nm) };
    byId.set(it.id, rec);
    const keys = new Map(); // text -> { key, kind }
    const add = (tokens, kind) => {
      if (!tokens.length) return;
      const key = mk(tokens);
      if (!keys.has(key.text)) keys.set(key.text, { ...key, kind });
    };
    add(tt, "title");
    add(nm, "name");
    for (const k of new Set([normalize(it.title), mk(nm).text])) {
      for (const a of aliasByKey.get(k) ?? []) add(tokenize(a), "alias");
    }
    for (const key of keys.values()) entries.push({ item: rec, ...key });
  });
  return { entries, byId, items: [...byId.values()] };
}

/** all (window, key) hits of a token list */
function findHits(tokens, index) {
  const hits = [];
  for (let i = 0; i < tokens.length; i++) {
    for (let len = 1; len <= MAX_WINDOW && i + len <= tokens.length; len++) {
      const w = tokens.slice(i, i + len);
      if (isNum(w[0]) && len === 1) continue;
      const wc = w.join("");
      const wf = fold(wc);
      for (const e of index.entries) {
        let score = 0;
        if (wc === e.compact) score = 1;
        else if (e.compact.length >= FUZZY_MIN_LEN && Math.abs(wc.length - e.compact.length) <= 3) {
          if (wf === fold(e.compact)) score = 0.93;
          else {
            const sim = 1 - distance(wc, e.compact) / Math.max(wc.length, e.compact.length);
            if (sim >= FUZZY_MIN_SIM) score = Math.min(0.9, sim);
          }
        }
        if (score) hits.push({ item: e.item, key: e, score, start: i, end: i + len });
      }
    }
  }
  return hits;
}

/** strength fit of an item for a mention: the number right after the mention counts most, then every number with a matching unit */
function strengthScore(item, tokens, end) {
  if (!item.nums.length) return 0;
  const text = strengths(tokens);
  const next = tokens[end] !== undefined && isNum(tokens[end]) ? text.find((s) => s.at === end) : undefined;
  let s = 0;
  const first = item.nums[0];
  if (next && next.v === first.v && (!next.u || next.u === first.u)) s += 10;
  for (const n of item.nums) {
    if (text.some((t) => t.v === n.v && t.u && t.u === n.u)) s += 1;
  }
  return s;
}

/**
 * Mentions of real items in a text, in reading order. Each mention:
 * { text, itemId, confidence: "high" | "medium" | "low", candidates: [id], needsConfirm }
 * high = exact title or alias and one item; medium = spelling-tolerant match and one item;
 * low = several items fit (confirm). Nothing is returned for words that match no item.
 */
export function matchText(text, index) {
  const tokens = tokenize(text);
  const hits = findHits(tokens, index).sort(
    (a, b) => b.score - a.score || b.end - b.start - (a.end - a.start) || a.start - b.start
  );
  const taken = [];
  const mentions = [];
  for (const h of hits) {
    if (taken.some((t) => h.start < t.end && h.end > t.start)) continue;
    taken.push({ start: h.start, end: h.end });
    const same = hits.filter((x) => x.start === h.start && x.end === h.end && x.score >= h.score - 0.05);
    const ids = new Map(); // item id -> best score
    for (const x of same) ids.set(x.item.id, Math.max(ids.get(x.item.id) ?? 0, x.score));
    let cands = [...ids.keys()].map((id) => index.byId.get(id));
    // a bare "Naloxon" or "Atropin" may also be the longer-named sibling ("Naloxon nasal", "Atropinsulfat")
    const top = h.key;
    const numberFollows = tokens[h.end] !== undefined && isNum(tokens[h.end]);
    if (h.score === 1 && top.kind !== "alias" && !numberFollows) {
      for (const it of index.items) {
        if (it.name.compact.length > top.compact.length && it.name.compact.startsWith(top.compact) && !ids.has(it.id)) {
          cands.push(it);
          ids.set(it.id, 0.8);
        }
      }
    }
    if (cands.length > 1) {
      const sc = cands.map((c) => strengthScore(c, tokens, h.end));
      const best = Math.max(...sc);
      if (best > 0) cands = cands.filter((_, i) => sc[i] === best);
    }
    cands.sort((a, b) => (ids.get(b.id) ?? 0) - (ids.get(a.id) ?? 0) || a.order - b.order);
    cands = cands.slice(0, MAX_CANDIDATES);
    const confidence = cands.length > 1 ? "low" : h.score === 1 ? "high" : "medium";
    mentions.push({
      start: h.start,
      text: tokens.slice(h.start, h.end).join(" "),
      itemId: cands[0].id,
      confidence,
      candidates: cands.map((c) => c.id),
      needsConfirm: confidence === "low",
    });
  }
  return mentions
    .sort((a, b) => a.start - b.start)
    .map((m) => {
      delete m.start;
      return m;
    });
}

const RANK = { high: 3, medium: 2, low: 1 };

/**
 * Final decision for one parsed note. `modelItemId` is the model's pick (validated here against the list).
 * Returns { itemId, confidence: "high" | "medium" | "low" | "none", candidates: [id], needsConfirm }.
 * When confirmation is needed itemId is null; candidates are ordered best first.
 */
export function resolveNote({ text, quote }, modelItemId, index) {
  const pick = modelItemId && index.byId.has(modelItemId) ? modelItemId : null;
  let mentions = matchText(text, index);
  if (!mentions.length && quote) mentions = matchText(quote, index);
  if (!mentions.length) {
    // the model alone is never enough to save an item silently
    return pick
      ? { itemId: null, confidence: "low", candidates: [pick], needsConfirm: true }
      : { itemId: null, confidence: "none", candidates: [], needsConfirm: false };
  }
  const m =
    mentions.find((x) => pick && x.candidates.includes(pick)) ??
    [...mentions].sort((a, b) => RANK[b.confidence] - RANK[a.confidence])[0];
  if (m.confidence === "low") {
    const cands = pick && m.candidates.includes(pick) ? [pick, ...m.candidates.filter((c) => c !== pick)] : m.candidates;
    return { itemId: null, confidence: "low", candidates: cands, needsConfirm: true };
  }
  if (m.confidence === "medium" && pick && pick !== m.itemId) {
    return { itemId: null, confidence: "low", candidates: [m.itemId, pick], needsConfirm: true };
  }
  return { itemId: m.itemId, confidence: m.confidence, candidates: m.candidates, needsConfirm: false };
}

/** compact hint lines for the model prompt: what the matcher found in the transcript */
export function hintLines(text, index) {
  return matchText(text, index).map((m) => {
    const names = m.candidates.map((id) => index.byId.get(id).title).join(" | ");
    return `"${m.text}" -> ${names} (${m.confidence === "low" ? "unklar, mehrere passen" : m.confidence === "medium" ? "ähnlich" : "sicher"})`;
  });
}
