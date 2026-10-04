#!/usr/bin/env python3
"""HAZ-167: half-done Protokoll survives a reload (local queue path against the real preview, the
protocol_drafts table does not exist on prod so the real route answers 503 drafts_unavailable), and a
second fresh browser context (new device) resumes it through a STUBBED /api/protocol-draft backed by
an in-memory store shared by both contexts (the real server path is blocked on the migration OK).
Never submits, all REST writes are aborted. usage: resume.py BASE_URL OUTDIR
"""
import json, os, sys
from playwright.sync_api import sync_playwright
base, out = sys.argv[1].rstrip('/'), sys.argv[2]
STATE = os.environ.get('NEF_STORAGE_STATE', '/workspace/tasks/haz-166-167/auth/staff.json')
HIDE = 'vercel-live-feedback,[data-vercel-toolbar],#vercel-live-feedback{display:none!important}'
log = []
def say(s): print(s); log.append(s)

def snap(pg):
    return pg.evaluate("""() => { const sc=document.querySelector('#checklist .nv-b'); if(!sc) return null;
      const top=sc.getBoundingClientRect().top; let a=null;
      for (const el of sc.querySelectorAll('[data-item-id]')) { const r=el.getBoundingClientRect(); if (r.bottom>top+1) { a={id:el.dataset.itemId, top:Math.round(r.top-top)}; break } }
      return { checked:[...sc.querySelectorAll('.it.on')].map(e=>e.dataset.itemId).sort(), open:[...sc.querySelectorAll('.sec.open .n')].map(e=>e.textContent),
               progress:(sc.querySelector('.ov .mono')||{}).textContent, scrollTop:Math.round(sc.scrollTop), anchor:a } }""")

def mk(p, engine):
    b = (p.webkit if engine == 'webkit' else p.chromium).launch()
    def ctx():
        st = json.load(open(STATE))
        for o in st['origins']: o['origin'] = base
        if engine == 'webkit':
            dev = dict(p.devices['iPhone 13']); dev['device_scale_factor'] = 2
            c = b.new_context(storage_state=st, service_workers='block', **dev)
        else:
            c = b.new_context(storage_state=st, service_workers='block', viewport={'width': 1440, 'height': 900}, device_scale_factor=2)
        blocked = []
        def guard(r):
            if r.request.method in ('POST', 'PATCH', 'DELETE', 'PUT'): blocked.append(r.request.method); r.abort()
            else: r.continue_()
        c.route('**/rest/v1/**', guard)
        c.blocked = blocked
        return c
    return b, ctx

def half_done(pg, label, shot=None):
    pg.goto(base + '/app', wait_until='networkidle'); pg.add_style_tag(content=HIDE)
    pg.get_by_text('Protokoll ausfüllen').click(); pg.wait_for_selector('#checklist.show .sec-h')
    heads = pg.query_selector_all('#checklist .sec-h')
    for h in heads[:2]: h.click()   # open two categories
    heads[-1].scroll_into_view_if_needed()
    pg.wait_for_timeout(300)
    cbs = pg.query_selector_all('#checklist .it .cb')
    for i in (0, 1, 3, 4, 8, 12, 15): cbs[i].click()
    pg.evaluate("""() => { const sc=document.querySelector('#checklist .nv-b'); sc.scrollTop = Math.min(sc.scrollHeight, 700) }""")
    pg.wait_for_timeout(1500)   # autosave debounce
    if shot: pg.screenshot(path=shot)
    return snap(pg)

def reappear(pg, wait=2500):
    pg.wait_for_selector('#checklist.show .sec-h', timeout=15000); pg.wait_for_timeout(wait); pg.add_style_tag(content=HIDE)

def run(p, engine, label):
    b, ctx = mk(p, engine)
    # 1) local queue path, real preview, real route (503 expected)
    c1 = ctx(); pg = c1.new_page(); statuses = []
    pg.on('response', lambda r: statuses.append((r.request.method, r.status)) if '/api/protocol-draft' in r.url else None)
    before = half_done(pg, label, f'{out}/half-done-before-reload-{label}.png')
    pg.reload(wait_until='networkidle'); reappear(pg)
    after = snap(pg); pg.screenshot(path=f'{out}/after-reload-{label}.png')
    okA = after and after['checked'] == before['checked'] and after['open'] == before['open'] and abs(after['scrollTop'] - before['scrollTop']) <= 3
    say(f'[{label}] LOCAL QUEUE (real route): before={before["progress"]} {len(before["checked"])} checked open={before["open"]} scrollTop={before["scrollTop"]} | after reload={after["progress"]} {len(after["checked"])} checked open={after["open"]} scrollTop={after["scrollTop"]} -> {"PASS" if okA else "FAIL"}')
    say(f'[{label}]   /api/protocol-draft responses on the real preview: {sorted(set(statuses))} (503 = table missing, fell back to the local queue; writes blocked: {c1.blocked or "none"})')
    c1.close()
    # 2) cross session through a stubbed server shared by two contexts
    store = {}; calls = []
    def stub(route):
        r = route.request; key = 'draft'
        calls.append(r.method)
        if r.method == 'GET': route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True, 'draft': store.get(key)}))
        elif r.method == 'PUT':
            store[key] = json.loads(r.post_data)['draft']; route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True}))
        else: store.pop(key, None); route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True}))
    ca = ctx(); ca.route('**/api/protocol-draft**', stub); pa = ca.new_page()
    a = half_done(pa, label)
    pa.evaluate("window.dispatchEvent(new Event('pagehide'))"); pa.wait_for_timeout(500)
    say(f'[{label}] CROSS SESSION (stubbed server): device A {a["progress"]} PUTs={calls.count("PUT")} stored checked={len([k for k,v in store["draft"]["checked"].items() if v["on"]])}')
    ca.close()
    cb = ctx(); cb.route('**/api/protocol-draft**', stub); pb = cb.new_page()   # new device: empty localStorage
    pb.goto(base + '/app', wait_until='networkidle'); pb.add_style_tag(content=HIDE)
    reappear(pb)
    r = snap(pb); pb.screenshot(path=f'{out}/new-session-resumed-{label}.png')
    okB = r and r['checked'] == a['checked'] and r['open'] == a['open'] and abs(r['scrollTop'] - a['scrollTop']) <= 3
    say(f'[{label}]   device B (fresh browser context, so empty storage by construction): {r["progress"]} {len(r["checked"])} checked open={r["open"]} scrollTop={r["scrollTop"]} GET calls={calls.count("GET")} -> {"PASS" if okB else "FAIL"}; writes blocked: {cb.blocked or "none"}')
    cb.close(); b.close()
    return bool(okA and okB)

with sync_playwright() as p:
    ok = run(p, 'chromium', 'desktop')
    ok &= run(p, 'webkit', '390')
open(f'{out}/run.txt', 'w').write(
    f'HAZ-167 resume proof, preview {base}\n'
    'NOTE: public.protocol_drafts is NOT on prod (migration needs PM OK). Part 1 uses the real route (503, local queue).\n'
    'Part 2 STUBS /api/protocol-draft with an in-memory store shared by two contexts; the real server path is blocked on the migration OK.\n'
    + '\n'.join(log) + f'\nOVERALL {"PASS" if ok else "FAIL"}\n')
sys.exit(0 if ok else 1)
