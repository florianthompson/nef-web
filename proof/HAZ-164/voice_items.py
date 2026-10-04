#!/usr/bin/env python3
"""HAZ-164: a typed note (stands in for dictation) goes through the real /api/notes/parse, the review sheet
shows the matched items and a "Bitte bestätigen" prompt, a candidate is picked, and (desktop run only,
--save) exactly one test note is saved. Reload shows the saved note with its item chip.

usage: voice_items.py BASE_URL --engine chromium|webkit --outdir DIR [--save] [--text TEXT]
Login: Playwright storage state from env NEF_STORAGE_STATE (outside git). Writes are blocked unless --save,
and with --save only a single insert into notes is let through.
"""
import argparse, json, os, re, sys
from playwright.sync_api import sync_playwright

MARK = "TEST HAZ-164 bitte ignorieren:"
TEXT = MARK + " Rocu fehlt, Nora nur noch eine, Adrenalin nachfüllen"
HIDE = "vercel-live-feedback,[data-vercel-toolbar],#vercel-live-feedback{display:none!important}"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base"); ap.add_argument("--engine", default="chromium")
    ap.add_argument("--outdir", required=True); ap.add_argument("--save", action="store_true")
    ap.add_argument("--text", default=TEXT)
    ap.add_argument("--parse-via", help="run the same build of /api/notes/parse here (the preview has no OPENAI_API_KEY)")
    a = ap.parse_args()
    tag = "desktop" if a.engine == "chromium" else "390"
    st = json.load(open(os.environ["NEF_STORAGE_STATE"]))
    for o in st["origins"]: o["origin"] = a.base.rstrip("/")
    writes = {"allowed": 0, "blocked": []}
    parsed = {}
    with sync_playwright() as p:
        if a.engine == "webkit":
            b = p.webkit.launch(); dev = dict(p.devices["iPhone 13"]); dev["device_scale_factor"] = 2
            ctx = b.new_context(storage_state=st, service_workers="block", **dev)
        else:
            b = p.chromium.launch()
            ctx = b.new_context(storage_state=st, service_workers="block", viewport={"width": 1440, "height": 900}, device_scale_factor=2)

        def guard(r):
            req = r.request
            if req.method in ("POST", "PATCH", "DELETE", "PUT"):
                if a.save and req.method == "POST" and "/rest/v1/notes" in req.url and writes["allowed"] == 0:
                    writes["allowed"] += 1; r.continue_(); return
                writes["blocked"].append(f"{req.method} {req.url.split('/rest/v1/')[-1][:40]}"); r.abort(); return
            r.continue_()
        ctx.route("**/rest/v1/**", guard)
        pg = ctx.new_page()
        if a.parse_via:
            # same code, same Supabase auth check, real model: only the host differs (the key is not set on Vercel previews)
            pg.route("**/api/notes/parse", lambda r: r.fulfill(response=r.fetch(url=a.parse_via + "/api/notes/parse")))
        pg.on("pageerror", lambda e: print("   [pageerror]", str(e)[:200]))
        def on_resp(r):
            if r.url.endswith("/api/notes/parse"):
                try: parsed.update(r.json())
                except Exception: pass
        pg.on("response", on_resp)
        pg.on("response", lambda r: print(f"   [resp] {r.status} {r.url[:100]}") if "/api/" in r.url or r.status in (401, 403) else None)
        pg.goto(a.base.rstrip("/") + "/app", wait_until="networkidle")
        pg.add_style_tag(content=HIDE)
        ta = pg.locator("#composer-input"); ta.wait_for(timeout=20000)
        items = {}
        ta.fill(a.text)
        pg.locator("#composer-send").click()
        tray = pg.locator('section[aria-label="Prüfen"]'); 
        try: tray.wait_for(timeout=40000)
        except Exception:
            pg.screenshot(path=f"{a.outdir}/_fail-{tag}.png"); print("   url", pg.url, pg.inner_text("body")[:300]); raise
        pg.wait_for_timeout(800)
        print(f"[{tag}] typed: {a.text}")
        for n in parsed.get("notes", []):
            print(f"[{tag}] parsed note: {n['text']!r} itemId={n['itemId']} confidence={n.get('confidence')} needsConfirm={n.get('needsConfirm')} candidates={len(n.get('candidates', []))}")
        print(f"[{tag}] model={parsed.get('model')} dropped={parsed.get('dropped')}")
        confirm = tray.locator('[aria-label="Bitte bestätigen"]')
        assert confirm.count() >= 1, "no confirm prompt"
        print(f"[{tag}] confirm prompts: {confirm.count()}")
        confirm.first.evaluate("e => e.scrollIntoView({ block: 'center' })"); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{a.outdir}/review-mapped-{tag}.png")
        chip = confirm.first.get_by_role("button", name=re.compile(r"Epinephrin - 1 mg"))
        chip.click(); pg.wait_for_timeout(500)
        print(f"[{tag}] picked: Epinephrin - 1 mg/1 ml")
        tray.locator("textarea").nth(0 if tag == "desktop" else 1).evaluate("e => e.scrollIntoView({ block: 'start' })"); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{a.outdir}/confirm-pick-{tag}.png")
        if a.save:
            # one test note only: keep the Adrenalin part, remove the others, make sure it starts with the TEST marker
            while tray.get_by_role("button", name="Notiz entfernen").count() > 1:
                for i in range(tray.locator("textarea").count()):
                    if "drenalin" not in tray.locator("textarea").nth(i).input_value():
                        tray.get_by_role("button", name="Notiz entfernen").nth(i).click(); break
                pg.wait_for_timeout(200)
            t = tray.locator("textarea").first
            v = t.input_value()
            if not v.startswith(MARK): t.fill(MARK + " " + v)
            print(f"[{tag}] saving one note: {t.input_value()!r}")
            with pg.expect_response(lambda r: "/rest/v1/notes" in r.url and r.request.method == "POST", timeout=20000) as ri:
                tray.get_by_role("button", name=re.compile(r"^Senden")).click()
            body = ri.value.text()
            print(f"[{tag}] insert status {ri.value.status}")
        pg.wait_for_timeout(1200)
        if not a.save:
            tray.get_by_role("button", name="Verwerfen, Text behalten").click(); ta.fill(""); pg.wait_for_timeout(400)
        pg.reload(wait_until="networkidle"); pg.add_style_tag(content=HIDE)
        row = pg.get_by_text("TEST HAZ-164 bitte ignorieren: Adrenalin", exact=False).first
        try:
            row.wait_for(timeout=20000); row.scroll_into_view_if_needed(); pg.wait_for_timeout(600)
            print(f"[{tag}] saved note visible after reload: {row.inner_text()[:120]!r}")
        except Exception:
            print(f"[{tag}] no saved test note in the feed (yet)")
        pg.screenshot(path=f"{a.outdir}/saved-after-reload-{tag}.png")
        print(f"[{tag}] writes let through: {writes['allowed']}, blocked: {writes['blocked'] or 'none'}")
        b.close()

main()
