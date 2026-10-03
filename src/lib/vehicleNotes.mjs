// Per-vehicle notes: which vehicle a note belongs to, the draft storage per vehicle, and the
// feed loader that never shows (or keeps) another vehicle's notes. Plain module, no React.

/**
 * PM DECISION POINT. Notes saved before vehicles existed have vehicle_id null. They are shown
 * only under this vehicle: the team's default vehicle (isDefault), else the first one.
 * `vehicles` is the team's vehicle list (default first, as loadTeamProtocol returns it).
 */
export function legacyNoteVehicleId(vehicles) {
  const v = vehicles.find((x) => x.isDefault) ?? vehicles[0];
  return v ? v.id : null;
}

/**
 * Does the note show under `vehicleId`? vehicleId null = the team has no vehicles (show all).
 * Notes without vehicle_id (legacy) belong to `legacyId` only.
 */
export function noteBelongsToVehicle(note, vehicleId, legacyId) {
  if (vehicleId == null) return true;
  if (note.vehicle_id) return note.vehicle_id === vehicleId;
  return legacyId != null && vehicleId === legacyId;
}

/* ---------- drafts ---------- */

export const LEGACY_DRAFT_KEY = "nef-notes-draft";
export const draftKey = (vehicleId) => `${LEGACY_DRAFT_KEY}:${vehicleId ?? "none"}`;

const guard = (fn, fallback) => {
  try {
    return fn();
  } catch {
    return fallback; // storage unavailable (private mode, quota)
  }
};

export const readDraft = (storage, vehicleId) => guard(() => storage.getItem(draftKey(vehicleId)) ?? "", "");

export function writeDraft(storage, vehicleId, text) {
  guard(() => (text ? storage.setItem(draftKey(vehicleId), text) : storage.removeItem(draftKey(vehicleId))));
}

/** Adds text to a vehicle's stored draft (for results that arrive after the user switched away). */
export function appendDraft(storage, vehicleId, text) {
  const prev = readDraft(storage, vehicleId);
  writeDraft(storage, vehicleId, prev.trim() ? prev.trimEnd() + " " + text : text);
}

/** Moves the old single draft to the default vehicle, once. Nothing is overwritten. */
export function migrateLegacyDraft(storage, defaultVehicleId) {
  if (!defaultVehicleId) return;
  guard(() => {
    const old = storage.getItem(LEGACY_DRAFT_KEY);
    if (old == null) return;
    if (!storage.getItem(draftKey(defaultVehicleId))) {
      if (old) storage.setItem(draftKey(defaultVehicleId), old);
    } else if (old) {
      return; // the vehicle already has a draft: keep both, leave the old key alone
    }
    storage.removeItem(LEGACY_DRAFT_KEY);
  });
}

/* ---------- feed loader ---------- */

/**
 * @template {{ id: string, vehicle_id: string | null }} N
 * @typedef {{ vehicleId: string | null | undefined, notes: N[], comments: Record<string, any>, loading: boolean, error: string | null }} FeedState
 */

/**
 * Holds the notes of the ONE selected vehicle.
 *  - select(id): clears the list at once (loading) and fetches that vehicle.
 *  - every fetch carries a token; a response is dropped unless it is the newest request AND its
 *    vehicle is still the selected one (A -> B -> A: the slow first A can not overwrite anything).
 *  - refresh(id?) re-fetches; events for another vehicle are ignored.
 * fetchFor(vehicleId) -> { notes, comments, error }. state: { vehicleId, notes, comments, loading, error }.
 */
/**
 * @template {{ id: string, vehicle_id: string | null }} N
 * @param {{
 *   fetchFor: (vehicleId: string | null) => Promise<{ notes: N[], comments: Record<string, any>, error: string | null }>,
 *   legacyId?: () => string | null,
 *   onChange?: (s: FeedState<N>) => void,
 * }} opts
 */
export function createVehicleFeed({ fetchFor, legacyId = () => null, onChange }) {
  /** @type {string | null | undefined} */
  let current;
  let token = 0;
  /** @type {FeedState<N>} */
  let state = { vehicleId: undefined, notes: [], comments: {}, loading: true, error: null };
  const set = (s) => {
    state = s;
    onChange?.(state);
  };

  async function run(vehicleId) {
    const mine = ++token;
    let res;
    try {
      res = await fetchFor(vehicleId);
    } catch (e) {
      res = { notes: [], comments: {}, error: String(e?.message ?? e) };
    }
    if (mine !== token || vehicleId !== current) return false; // stale: newer request or other vehicle
    if (res.error) {
      const same = state.vehicleId === vehicleId; // a failed refresh keeps what is shown
      set({ vehicleId, notes: same ? state.notes : [], comments: same ? state.comments : {}, loading: false, error: res.error });
      return true;
    }
    const notes = res.notes.filter((n) => noteBelongsToVehicle(n, vehicleId, legacyId()));
    set({ vehicleId, notes, comments: res.comments ?? {}, loading: false, error: null });
    return true;
  }

  return {
    getState: () => state,
    /** @param {string | null} vehicleId */
    select(vehicleId) {
      if (vehicleId === current && state.vehicleId === vehicleId) return Promise.resolve(true);
      current = vehicleId;
      set({ vehicleId, notes: [], comments: {}, loading: true, error: null });
      return run(vehicleId);
    },
    /** @param {string | null | undefined} [vehicleId] */
    refresh(vehicleId = current) {
      if (vehicleId !== current) return Promise.resolve(false); // event for another vehicle
      return run(vehicleId);
    },
    /** @param {string} id @param {Partial<N>} p */
    patch(id, p) {
      set({ ...state, notes: state.notes.map((n) => (n.id === id ? { ...n, ...p } : n)) });
    },
  };
}

/** @type {never[]} */
const NONE = [];
/** @type {Record<string, never>} */
const NO_COMMENTS = {};

/**
 * What the screen may show for the selected vehicle: anything loaded for another vehicle (or not
 * loaded yet) counts as empty and loading, so a switch never flashes the previous vehicle's rows.
 */
/**
 * @template {{ id: string, vehicle_id: string | null }} N
 * @param {FeedState<N>} state
 * @param {string | null | undefined} vehicleId
 */
export function visibleFeed(state, vehicleId) {
  const fresh = vehicleId !== undefined && state.vehicleId === vehicleId;
  return {
    notes: fresh ? state.notes : NONE,
    comments: fresh ? state.comments : NO_COMMENTS,
    loading: !fresh || state.loading,
    error: fresh ? state.error : null,
  };
}
