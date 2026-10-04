import test from "node:test";
import assert from "node:assert/strict";
import { createOverlayNav, makeOrigin, restoreTop, OVERLAY_STATE_KEY } from "../overlayHistory.mjs";

// minimal history stub: back() fires popstate asynchronously like a browser
function fakeHistory() {
  const h = {
    stack: [null],
    idx: 0,
    listener: null,
    get state() {
      return h.stack[h.idx];
    },
    pushState(s) {
      h.stack = h.stack.slice(0, h.idx + 1);
      h.stack.push(s);
      h.idx++;
    },
    replaceState(s) {
      h.stack[h.idx] = s;
    },
    back() {
      if (h.idx === 0) {
        h.leftPage = true;
        return;
      }
      h.idx--;
      queueMicrotask(() => h.listener?.());
    },
  };
  return h;
}

const origin = makeOrigin({ view: "check", scrollTop: 900, anchorId: "i1", anchorOffset: 120 });

test("open pushes one marked entry and remembers the origin", () => {
  const h = fakeHistory();
  const nav = createOverlayNav(h);
  assert.equal(nav.open(origin), true);
  assert.equal(h.stack.length, 2);
  assert.equal(h.state[OVERLAY_STATE_KEY], true);
  assert.equal(nav.isOpen, true);
  assert.equal(nav.open(origin), false, "second open is a no-op");
  assert.equal(h.stack.length, 2);
});

test("in-app back goes through history.back and popstate closes with the origin", async () => {
  const h = fakeHistory();
  const nav = createOverlayNav(h);
  let closed = null;
  h.listener = () => {
    closed = nav.handlePopState();
  };
  nav.open(origin);
  assert.equal(nav.requestClose(), true);
  assert.equal(nav.isOpen, true, "still open until popstate");
  await Promise.resolve();
  assert.deepEqual(closed, origin);
  assert.equal(nav.isOpen, false);
  assert.equal(h.leftPage, undefined);
});

test("browser back (popstate only) closes the same way", () => {
  const h = fakeHistory();
  const nav = createOverlayNav(h);
  nav.open(origin);
  h.idx--;
  assert.deepEqual(nav.handlePopState(), origin);
  assert.equal(nav.isOpen, false);
});

test("double back never leaves the page", async () => {
  const h = fakeHistory();
  const nav = createOverlayNav(h);
  h.listener = () => nav.handlePopState();
  nav.open(origin);
  assert.equal(nav.requestClose(), true);
  assert.equal(nav.requestClose(), false, "second tap before popstate is ignored");
  await Promise.resolve();
  assert.equal(nav.requestClose(), false, "nothing open, nothing to do");
  assert.equal(h.leftPage, undefined);
  assert.equal(nav.handlePopState(), null, "stray popstate is ignored");
});

test("can reopen after closing", async () => {
  const h = fakeHistory();
  const nav = createOverlayNav(h);
  h.listener = () => nav.handlePopState();
  nav.open(origin);
  nav.requestClose();
  await Promise.resolve();
  assert.equal(nav.open(origin), true);
  assert.equal(h.stack.length, 2);
});

test("sanitize drops a stale overlay marker after reload", () => {
  const h = fakeHistory();
  h.pushState({ [OVERLAY_STATE_KEY]: true });
  const nav = createOverlayNav(h);
  assert.equal(nav.sanitize(), true);
  assert.equal(h.state, null);
  assert.equal(nav.sanitize(), false);
});

test("restoreTop uses the anchor, falls back to the raw offset", () => {
  assert.equal(restoreTop(origin, 900, 150), 930, "anchor moved 30px down, scroll 30 more");
  assert.equal(restoreTop(origin, 900, 120), 900);
  assert.equal(restoreTop(origin, 0, null), 900, "anchor gone");
  assert.equal(restoreTop(makeOrigin({ view: "check", scrollTop: 40 }), 10, 5), 40, "no anchor id");
  assert.equal(restoreTop(origin, 10, -500), 0, "never negative");
});
