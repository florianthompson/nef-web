#!/usr/bin/env python3
"""HAZ-166: open the Protokoll, scroll well down, open a marked item's note, go back (in-app back
button and browser back standing in for the iOS swipe back), check the same item is at the same
spot and the checks are unchanged. Writes nothing to the backend (all REST writes are aborted,
checks are local client state).

usage: back_scroll.py BASE_URL OUTDIR   (login: Playwright storage state, env NEF_STORAGE_STATE)
"""
import json, os, re, sys
from playwright.sync_api import sync_playwright

base, out = sys.argv[1].rstrip('/'), sys.argv[2]
STATE = os.environ.get('NEF_STORAGE_STATE', '/workspace/tasks/haz-166-167/auth/staff.json')
HIDE = 'vercel-live-feedback,[data-vercel-toolbar],#vercel-live-feedback{display:none!important}'
log = []
def say(*a):
    s = ' '.join(str(x) for x in a); print(s); log.append(s)

def measure(pg, item_id):
    return pg.evaluate("""(id) => {
      const sc = document.querySelector('#checklist .nv-b'); if (!sc) return null;
      const el = sc.querySelector('[data-item-id="'+id+'"]');
      const top = el ? Math.round((el.getBoundingClientRect().top - sc.getBoundingClientRect().top)*10)/10 : null;
      return { scrollTop: Math.round(sc.scrollTop*10)/10, itemTop: top,
               checked: sc.querySelectorAll('.it.on').length, open: sc.querySelectorAll('.sec.open').length,
               progress: (document.querySelector('#checklist .ov .mono')||{}).textContent };
    }""", item_id)

def run(p, engine, label):
    b = (p.webkit if engine == 'webkit' else p.chromium).launch()
    blocked = []
    def fresh_ctx():
        st = json.load(open(STATE))
        for o in st['origins']: o['origin'] = base
        if engine == 'webkit':
            dev = dict(p.devices['iPhone 13']); dev['device_scale_factor'] = 2
            ctx = b.new_context(storage_state=st, service_workers='block', **dev)
        else:
            ctx = b.new_context(storage_state=st, service_workers='block', viewport={'width': 1440, 'height': 900}, device_scale_factor=2)
        def guard(r):
            if r.request.method in ('POST', 'PATCH', 'DELETE', 'PUT'):
                blocked.append(r.request.method + ' ' + r.request.url.split('?')[0][-60:]); r.abort()
            else: r.continue_()
        ctx.route('**/rest/v1/**', guard)
        return ctx
    results = {}
    for method in ('inapp', 'browser'):
        ctx = fresh_ctx()  # fresh browser context per method, no leftover local draft
        pg = ctx.new_page()
        pg.goto(base + '/app', wait_until='networkidle'); pg.add_style_tag(content=HIDE)
        pg.get_by_text('Protokoll ausfüllen').click()
        pg.wait_for_selector('#checklist.show .sec-h')
        # open every category, tick a few items (local state only)
        for h in pg.query_selector_all('#checklist .sec-h'): h.click()
        pg.wait_for_timeout(300)
        cbs = pg.query_selector_all('#checklist .it .cb')
        for i in (0, 2, 5, 9): cbs[i].click()
        item_id = pg.evaluate("""() => { const sc = document.querySelector('#checklist .nv-b');
            const all=[...sc.querySelectorAll('.it.has')]; const mid = all[Math.min(1, all.length-1)]; return mid ? mid.dataset.itemId : null }""")
        if not item_id: raise SystemExit('no marked item found')
        # scroll well down so the marked item sits near the middle of the viewport
        pg.evaluate("""(id) => { const sc=document.querySelector('#checklist .nv-b'); const el=sc.querySelector('[data-item-id="'+id+'"]');
            const r=el.getBoundingClientRect(), s=sc.getBoundingClientRect(); sc.scrollTop += (r.top - s.top) - s.height*0.45 }""", item_id)
        pg.wait_for_timeout(500)
        before = measure(pg, item_id)
        if method == 'inapp': pg.screenshot(path=f'{out}/protokoll-scrolled-{label}.png')
        hist0 = pg.evaluate('history.length')
        pg.locator(f'[data-item-id="{item_id}"] .row-m').click()
        pg.wait_for_selector('#item-screen')
        pg.wait_for_timeout(600)
        url_open = pg.url
        hist1 = pg.evaluate('history.length')
        if method == 'inapp': pg.screenshot(path=f'{out}/item-note-open-{label}.png')
        if method == 'inapp': pg.locator('#item-screen .back').click()
        else: pg.go_back()
        pg.wait_for_selector('#item-screen', state='detached', timeout=5000)
        pg.wait_for_timeout(700)
        after = measure(pg, item_id)
        if method == 'inapp': pg.screenshot(path=f'{out}/back-same-spot-{label}.png')
        d_item = abs(after['itemTop'] - before['itemTop']); d_scroll = abs(after['scrollTop'] - before['scrollTop'])
        ok = d_item <= 3 and d_scroll <= 3 and after['checked'] == before['checked'] and after['open'] == before['open'] and pg.url == url_open and pg.locator('#checklist.show').count() == 1
        say(f'[{label}] back={method:7s} item={item_id[:8]} before={before} after={after} '
            f'itemTop delta={d_item:.1f}px scrollTop delta={d_scroll:.1f}px url unchanged={pg.url == url_open} history {hist0}->{hist1} protokoll visible={pg.locator("#checklist.show").count() == 1} -> {"PASS" if ok else "FAIL"}')
        results[method] = ok
        # a second back now would leave the page: prove double back does not break (no extra overlay entry left)
        say(f'[{label}] back={method:7s} history length after close={pg.evaluate("history.length")} (entry stays as forward entry, no overlay open)')
        ctx.close()
    say(f'[{label}] blocked writes: {blocked or "none"}')
    b.close()
    return all(results.values())

with sync_playwright() as p:
    ok = True
    ok &= run(p, 'chromium', 'desktop')
    ok &= run(p, 'webkit', '390')
open(f'{out}/run.txt', 'w').write(f'HAZ-166 back keeps the Protokoll scroll, preview {base}\n' + '\n'.join(log) + f'\nOVERALL {"PASS" if ok else "FAIL"}\n')
sys.exit(0 if ok else 1)
