// Shallow history entry for overlays opened from the Protokoll (item or note
// screens). Opening pushes one entry (no route change), in-app back and the
// browser or iOS swipe back both end in the same popstate handler, so there is
// one close path. The origin (view, scroll offset, anchor item) is kept so the
// Protokoll can be restored exactly.

export const OVERLAY_STATE_KEY = "nefOverlay";

/**
 * Where the overlay was opened from.
 * @param {{view: string, scrollTop?: number, anchorId?: string | null, anchorOffset?: number}} o
 */
export function makeOrigin({ view, scrollTop = 0, anchorId = null, anchorOffset = 0 }) {
  return { view, scrollTop, anchorId, anchorOffset };
}

/**
 * Scroll offset that puts the anchor item back where it was. anchorTop is the
 * anchor's current distance from the top of the scroll container's viewport
 * (null when the anchor is gone); falls back to the raw offset.
 */
export function restoreTop(origin, currentScrollTop, anchorTop) {
  if (origin.anchorId && typeof anchorTop === "number") {
    return Math.max(0, currentScrollTop + (anchorTop - origin.anchorOffset));
  }
  return origin.scrollTop;
}

export function createOverlayNav(history) {
  let origin = null;
  let closing = false;

  return {
    get isOpen() {
      return origin !== null;
    },
    /** Push the shallow entry. No-op when an overlay is already open. */
    open(from) {
      if (origin) return false;
      origin = from;
      closing = false;
      history.pushState({ [OVERLAY_STATE_KEY]: true }, "");
      return true;
    },
    /** In-app back: only asks the browser to go back, popstate closes. */
    requestClose() {
      if (!origin || closing) return false;
      closing = true;
      history.back();
      return true;
    },
    /** Returns the origin to restore when this popstate closes the overlay, else null. */
    handlePopState() {
      if (!origin) return null;
      const from = origin;
      origin = null;
      closing = false;
      return from;
    },
    /** Reload or deep link landing on a stale overlay entry: drop the marker so back works. */
    sanitize() {
      if (history.state && history.state[OVERLAY_STATE_KEY]) {
        history.replaceState(null, "");
        return true;
      }
      return false;
    },
  };
}
