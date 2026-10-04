// Versioned in-progress Protokoll draft, one per (user, vehicle, protocol). Plain module, no React.
//
// Conflict rule (documented for HAZ-167): last write wins PER FIELD by updatedAt (`at`, ms).
// Checked ids merge per item id (each id carries its own on/off and `at`, an uncheck is a
// tombstone that can win over an older check from another device). A tie goes to the incoming side.

export const DRAFT_VERSION = 1;
/** a previous shift's draft must not resurface */
export const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const MAX_IDS = 2000;
const MAX_TEXT = 20000;

export function emptyDraft({ protocolId, vehicleId }) {
  return {
    v: DRAFT_VERSION,
    protocolId,
    vehicleId,
    checked: {}, // itemId -> { on, at }
    answers: {}, // itemId -> { value, at } (per-item answer or note text)
    shiftNote: null, // { value, at }
    step: null, // { value, at }  "check" while the Protokoll is open
    openCats: null, // { value: string[], at }
    scroll: null, // { value: { anchorId, offset }, at }
  };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Fold the current UI state into the draft. Only fields whose value changed get a new `at`.
 * snap: { checkedIds, shiftNote, step, openCats, scroll, answers? }
 */
export function applySnapshot(draft, snap, now) {
  const next = { ...draft, checked: { ...draft.checked }, answers: { ...draft.answers } };
  let changed = false;

  const on = new Set(snap.checkedIds ?? []);
  for (const id of new Set([...Object.keys(next.checked), ...on])) {
    const want = on.has(id);
    const cur = next.checked[id];
    if (!cur || cur.on !== want) {
      next.checked[id] = { on: want, at: now };
      changed = true;
    }
  }
  for (const [id, value] of Object.entries(snap.answers ?? {})) {
    if (next.answers[id]?.value !== value) {
      next.answers[id] = { value, at: now };
      changed = true;
    }
  }
  for (const f of ["shiftNote", "step", "openCats", "scroll"]) {
    if (!(f in snap)) continue;
    const value = snap[f];
    const cur = next[f];
    // a never-touched field stays null instead of recording an empty value
    if (!cur && (value === "" || value == null || (Array.isArray(value) && value.length === 0))) continue;
    if (!cur || !same(cur.value, value)) {
      next[f] = { value, at: now };
      changed = true;
    }
  }
  return { draft: next, changed };
}

const newer = (a, b) => (!b ? a : !a ? b : b.at >= a.at ? b : a);

/** Merge `incoming` over `base`, last write wins per field, per item id for checks and answers. */
export function mergeDrafts(base, incoming) {
  if (!base) return incoming;
  if (!incoming) return base;
  const out = { ...base, checked: { ...base.checked }, answers: { ...base.answers } };
  for (const [id, c] of Object.entries(incoming.checked)) out.checked[id] = newer(out.checked[id], c);
  for (const [id, a] of Object.entries(incoming.answers)) out.answers[id] = newer(out.answers[id], a);
  for (const f of ["shiftNote", "step", "openCats", "scroll"]) out[f] = newer(base[f], incoming[f]);
  return out;
}

export function checkedIdsOf(draft) {
  return Object.entries(draft.checked)
    .filter(([, c]) => c.on)
    .map(([id]) => id);
}

export function draftUpdatedAt(draft) {
  let at = 0;
  for (const c of Object.values(draft.checked)) at = Math.max(at, c.at);
  for (const a of Object.values(draft.answers)) at = Math.max(at, a.at);
  for (const f of ["shiftNote", "step", "openCats", "scroll"]) if (draft[f]) at = Math.max(at, draft[f].at);
  return at;
}

export function isExpired(draft, now) {
  const at = draftUpdatedAt(draft);
  return at > 0 && now - at > DRAFT_MAX_AGE_MS;
}

/** true when the draft holds nothing worth saving */
export function isBlank(draft) {
  return (
    checkedIdsOf(draft).length === 0 &&
    Object.keys(draft.answers).length === 0 &&
    !draft.shiftNote?.value &&
    !draft.openCats?.value?.length
  );
}

/** The old per-user localStorage draft, migrated into the new shape (all fields stamped savedAt). */
export function fromLegacy(legacy) {
  const at = legacy.savedAt ?? 0;
  const d = emptyDraft({ protocolId: legacy.protocolId, vehicleId: legacy.vehicleId });
  for (const id of legacy.checkedIds ?? []) d.checked[id] = { on: true, at };
  if (legacy.shiftNote) d.shiftNote = { value: legacy.shiftNote, at };
  return d;
}

const isStamp = (x) => x && typeof x === "object" && Number.isFinite(x.at);

/** Validate untrusted JSON (server input, stored queue). Returns a clean draft or null. */
export function normalizeDraft(raw, { protocolId, vehicleId } = {}) {
  if (!raw || typeof raw !== "object" || raw.v !== DRAFT_VERSION) return null;
  if (protocolId && raw.protocolId !== protocolId) return null;
  if (vehicleId && raw.vehicleId !== vehicleId) return null;
  const d = emptyDraft({ protocolId: raw.protocolId, vehicleId: raw.vehicleId });
  const checked = Object.entries(raw.checked ?? {});
  const answers = Object.entries(raw.answers ?? {});
  if (checked.length > MAX_IDS || answers.length > MAX_IDS) return null;
  for (const [id, c] of checked) if (isStamp(c) && typeof c.on === "boolean") d.checked[id] = { on: c.on, at: c.at };
  for (const [id, a] of answers)
    if (isStamp(a) && typeof a.value === "string" && a.value.length <= MAX_TEXT) d.answers[id] = { value: a.value, at: a.at };
  if (isStamp(raw.shiftNote) && typeof raw.shiftNote.value === "string" && raw.shiftNote.value.length <= MAX_TEXT)
    d.shiftNote = { value: raw.shiftNote.value, at: raw.shiftNote.at };
  if (isStamp(raw.step) && (raw.step.value === null || typeof raw.step.value === "string"))
    d.step = { value: raw.step.value, at: raw.step.at };
  if (isStamp(raw.openCats) && Array.isArray(raw.openCats.value) && raw.openCats.value.length <= 200)
    d.openCats = { value: raw.openCats.value.filter((x) => typeof x === "string"), at: raw.openCats.at };
  const sc = raw.scroll;
  if (isStamp(sc) && sc.value && typeof sc.value === "object")
    d.scroll = {
      value: {
        anchorId: typeof sc.value.anchorId === "string" ? sc.value.anchorId : null,
        offset: Number.isFinite(sc.value.offset) ? sc.value.offset : 0,
      },
      at: sc.at,
    };
  return d;
}
