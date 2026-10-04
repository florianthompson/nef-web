// Autosave of the in-progress Protokoll: local queue first (per user, vehicle and protocol),
// debounced sync to the server, flush on pagehide and visibilitychange hidden, resume by merging
// server and local. Plain module, everything (storage, transport, timers, clock) is injected.
//
// Nothing is dropped until the server confirms: a local record stays `dirty` until a PUT of the
// same revision succeeded. If the server has no protocol_drafts table yet (missing), the queue
// keeps working locally and the problem is logged once.

import {
  applySnapshot,
  emptyDraft,
  fromLegacy,
  isBlank,
  isExpired,
  mergeDrafts,
  normalizeDraft,
} from "./draftModel.mjs";

const PREFIX = "nef:draft-queue:";

export const draftKey = (userId, vehicleId, protocolId) => `${PREFIX}${userId}:${vehicleId}:${protocolId}`;

export function createDraftSync({
  storage,
  transport,
  now = Date.now,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (t) => clearTimeout(t),
  debounceMs = 800,
  maxWaitMs = 5000,
  log = (m) => console.warn(m),
}) {
  const entries = new Map(); // key -> { ctx, draft, dirty, rev, timer, firstDirtyAt, sending }
  let serverMissing = false;
  let warned = false;

  function markMissing() {
    serverMissing = true;
    if (!warned) {
      warned = true;
      log("protocol_drafts table is missing on the server, keeping the Protokoll draft on this device only");
    }
  }

  function persist(key, e) {
    try {
      storage.setItem(key, JSON.stringify({ ctx: e.ctx, draft: e.draft, dirty: e.dirty }));
    } catch {
      // storage full or unavailable: the in-memory entry and the server copy still work
    }
  }

  function readLocal(key, ctx) {
    try {
      const raw = storage.getItem(key);
      if (!raw) return null;
      const rec = JSON.parse(raw);
      const draft = normalizeDraft(rec.draft, ctx);
      return draft ? { draft, dirty: rec.dirty !== false } : null;
    } catch {
      return null;
    }
  }

  function entryFor(ctx) {
    const key = draftKey(ctx.userId, ctx.vehicleId, ctx.protocolId);
    let e = entries.get(key);
    if (!e) {
      const local = readLocal(key, ctx);
      e = {
        ctx,
        draft: local?.draft ?? emptyDraft(ctx),
        dirty: local?.dirty ?? false,
        rev: 0,
        timer: null,
        firstDirtyAt: null,
        sending: false,
      };
      entries.set(key, e);
    }
    return [key, e];
  }

  function schedule(key, e) {
    if (serverMissing) return;
    const t = now();
    if (e.firstDirtyAt === null) e.firstDirtyAt = t;
    if (e.timer !== null) clearTimer(e.timer);
    const delay = Math.max(0, Math.min(debounceMs, e.firstDirtyAt + maxWaitMs - t));
    e.timer = setTimer(() => {
      e.timer = null;
      void flush(key);
    }, delay);
  }

  /** Send the draft now. Starts the request synchronously (no await before it) so a pagehide flush works. */
  function flush(key, { keepalive = false } = {}) {
    const e = entries.get(key);
    if (!e || !e.dirty || serverMissing) return Promise.resolve();
    if (e.timer !== null) {
      clearTimer(e.timer);
      e.timer = null;
    }
    if (e.sending && !keepalive) return Promise.resolve();
    const sentRev = e.rev;
    e.sending = true;
    return Promise.resolve(transport.put(e.ctx, e.draft, { keepalive }))
      .then((res) => {
        e.sending = false;
        if (res.status === "ok") {
          if (e.rev === sentRev) {
            e.dirty = false;
            e.firstDirtyAt = null;
            persist(key, e);
          } else schedule(key, e);
        } else if (res.status === "missing") markMissing();
        // "error": stay dirty, the next change, online or focus event retries
      })
      .catch(() => {
        e.sending = false;
      });
  }

  function dirtyKeys() {
    const keys = new Set();
    for (const [k, e] of entries) if (e.dirty) keys.add(k);
    return keys;
  }

  /** Dirty records of other vehicles or an earlier page load live only in storage. */
  function loadPendingFromStorage(userId) {
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key || !key.startsWith(`${PREFIX}${userId}:`) || entries.has(key)) continue;
        const rec = JSON.parse(storage.getItem(key) ?? "null");
        if (!rec?.dirty || !rec.ctx) continue;
        entryFor(rec.ctx);
      }
    } catch {
      // ignore
    }
  }

  return {
    /** Fold the current UI state into the local queue (written at once) and schedule a sync. */
    update(ctx, snapshot) {
      const [key, e] = entryFor(ctx);
      const { draft, changed } = applySnapshot(e.draft, snapshot, now());
      if (!changed) return false;
      e.draft = draft;
      e.dirty = true;
      e.rev++;
      persist(key, e);
      schedule(key, e);
      return true;
    },

    /** Put the pre-HAZ-167 per-user localStorage draft into the queue. Returns true when it was used. */
    migrateLegacy(ctx, legacy) {
      if (!legacy || legacy.protocolId !== ctx.protocolId || (legacy.vehicleId && legacy.vehicleId !== ctx.vehicleId)) return false;
      const [key, e] = entryFor(ctx);
      e.draft = mergeDrafts(fromLegacy({ ...legacy, vehicleId: ctx.vehicleId }), e.draft);
      e.dirty = true;
      e.rev++;
      persist(key, e);
      schedule(key, e);
      return true;
    },

    /** Open or switch vehicle: merge server draft and local queue, last write wins per field. */
    async resume(ctx) {
      const [key, e] = entryFor(ctx);
      let server = null;
      if (!serverMissing) {
        const res = await transport.get(ctx).catch(() => ({ status: "error" }));
        if (res.status === "ok") server = normalizeDraft(res.draft, ctx);
        else if (res.status === "missing") markMissing();
      }
      if (server && isExpired(server, now())) server = null;
      const local = isExpired(e.draft, now()) ? emptyDraft(ctx) : e.draft;
      const merged = mergeDrafts(server, local) ?? local;
      const serverHasAll = server && JSON.stringify(mergeDrafts(server, merged)) === JSON.stringify(server);
      e.draft = merged;
      // anything the server does not have yet (offline edits, a newer local field) goes up with the next debounce
      e.dirty = !isBlank(merged) && (serverMissing || !serverHasAll);
      if (e.dirty) {
        e.rev++;
        persist(key, e);
        schedule(key, e);
      } else persist(key, e);
      return merged;
    },

    flush,

    /** pagehide, visibilitychange hidden: send every dirty draft with keepalive. */
    flushAll({ keepalive = true } = {}) {
      for (const k of dirtyKeys()) void flush(k, { keepalive });
    },

    /** online, focus: retry everything that is still waiting, including other vehicles. */
    syncAll(userId) {
      if (userId) loadPendingFromStorage(userId);
      for (const k of dirtyKeys()) void flush(k);
    },

    /** Successful submit: drop the server draft and the local queue for this vehicle only. */
    async clear(ctx) {
      const key = draftKey(ctx.userId, ctx.vehicleId, ctx.protocolId);
      const e = entries.get(key);
      if (e?.timer != null) clearTimer(e.timer);
      entries.delete(key);
      try {
        storage.removeItem(key);
      } catch {
        // ignore
      }
      if (!serverMissing) await Promise.resolve(transport.del(ctx)).catch(() => undefined);
    },

    /** Wire the browser lifecycle. win and doc are window and document (or stand-ins in tests). */
    attachLifecycle(win, doc, userId) {
      const hide = () => this.flushAll({ keepalive: true });
      const onVis = () => {
        if (doc.visibilityState === "hidden") hide();
      };
      const sync = () => this.syncAll(userId);
      doc.addEventListener("visibilitychange", onVis);
      win.addEventListener("pagehide", hide);
      win.addEventListener("online", sync);
      win.addEventListener("focus", sync);
      return () => {
        doc.removeEventListener("visibilitychange", onVis);
        win.removeEventListener("pagehide", hide);
        win.removeEventListener("online", sync);
        win.removeEventListener("focus", sync);
      };
    },

    get serverMissing() {
      return serverMissing;
    },
    peek(ctx) {
      return entries.get(draftKey(ctx.userId, ctx.vehicleId, ctx.protocolId))?.draft ?? null;
    },
    isDirty(ctx) {
      return !!entries.get(draftKey(ctx.userId, ctx.vehicleId, ctx.protocolId))?.dirty;
    },
  };
}
