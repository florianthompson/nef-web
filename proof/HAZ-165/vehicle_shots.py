#!/usr/bin/env python3
"""HAZ-165: vehicle A -> B -> A on the NEF notes screen. Uses FIXTURE data: the vehicles and notes
REST responses are intercepted (page.route), nothing is created or written. The A response on the
way back is delayed to show that B's notes never appear under A.
usage: vehicle_shots.py BASE_URL OUTDIR"""
import json, os, re, sys, urllib.parse
from playwright.sync_api import sync_playwright
BASE, OUT = sys.argv[1].rstrip('/'), sys.argv[2]
st = json.load(open(os.environ.get('NEF_STORAGE_STATE', '/workspace/tasks/haz-138/auth/staff.json')))
for o in st['origins']: o['origin'] = BASE
A, B = 'fixture-vehicle-a', 'fixture-vehicle-b'
def n(i, vid, text, resolved=False, day=1):
    return dict(id=f'fixture-{i}', team_id='t', author_name='Fixture Autor', value=text, created_at=f'2026-09-{30-day:02d}T10:0{i%10}:00Z',
                is_resolved=resolved, resolved_by='Fixture Autor' if resolved else None, resolved_at='2026-10-01T08:00:00Z' if resolved else None,
                vehicle_id=vid, item_id=None, category='Sonstiges', due_at=None, due_text=None, source='text', vehicles={'name': 'RTW A' if vid == A else 'RTW B'})
NOTES = {
  A: [n(1, A, 'FIXTURE A: Funkgeraet Akku laden'), n(2, A, 'FIXTURE A: Verbandstasche auffuellen'), n(3, A, 'FIXTURE A: Blaulicht links pruefen', day=2), n(4, A, 'FIXTURE A: erledigt Beispiel', True)],
  B: [n(5, B, 'FIXTURE B: Reifendruck kontrollieren'), n(6, B, 'FIXTURE B: Tragestuhl klemmt', day=2)],
}
VEH = [dict(id=A, name='RTW A', is_default=True, team_id='t'), dict(id=B, name='RTW B', is_default=False, team_id='t')]
delay_a = {'on': False}
def which(url):
    q = urllib.parse.unquote(url)
    return A if A in q else B if B in q else None
def rest(r):
    req = r.request; url = req.url
    if req.method != 'GET': print('BLOCKED', req.method, url[:80]); return r.abort()
    path = urllib.parse.urlparse(url).path
    j = lambda body: r.fulfill(status=200, content_type='application/json', body=json.dumps(body))
    if path.endswith('/vehicles'): return j(VEH)
    if path.endswith('/note_comments'): return j([])
    if path.endswith('/notes'):
        sel = urllib.parse.unquote(url)
        if 'select=item_id' in sel: return j([])
        v = which(url)
        if v is None: return j([])
        if v == A and delay_a['on']: import time; time.sleep(2.5)
        return j(NOTES[v])
    r.continue_()
def run(engine, viewport_name):
    with sync_playwright() as p:
        if engine == 'webkit':
            b = p.webkit.launch(); dev = dict(p.devices['iPhone 13']); dev['device_scale_factor'] = 2
            ctx = b.new_context(storage_state=st, service_workers='block', **dev)
        else:
            b = p.chromium.launch(); ctx = b.new_context(storage_state=st, service_workers='block', viewport={'width': 1440, 'height': 900}, device_scale_factor=2)
        pg = ctx.new_page()
        pg.route(re.compile(r'/rest/v1/(vehicles|notes|note_comments)'), rest)
        pg.goto(BASE + '/app', wait_until='networkidle')
        pg.add_style_tag(content='vercel-live-feedback,[data-vercel-toolbar]{display:none!important}')
        def rows(): return pg.locator('.feed').inner_text()
        def has(txt): return txt in rows()
        pg.wait_for_function('document.body.innerText.includes("FIXTURE A")', timeout=15000)
        assert not has('FIXTURE B') and has('Funkgeraet') , 'A shows only A'
        pg.screenshot(path=f'{OUT}/vehicle-a-{viewport_name}.png')
        pg.click('.veh'); pg.click('.veh-pop button:has-text("RTW B")')
        assert not has('FIXTURE A'), 'no flash of A under B'
        pg.wait_for_function('document.body.innerText.includes("FIXTURE B")', timeout=15000)
        assert not has('FIXTURE A')
        pg.screenshot(path=f'{OUT}/vehicle-b-{viewport_name}.png')
        delay_a['on'] = True   # A answers 2.5 s late on the way back
        pg.click('.veh'); pg.click('.veh-pop button:has-text("RTW A")')
        pg.wait_for_timeout(500)
        assert not has('FIXTURE B') and not has('FIXTURE A'), 'while A loads nothing of B is shown'
        pg.wait_for_function('document.body.innerText.includes("FIXTURE A")', timeout=15000)
        assert not has('FIXTURE B')
        pg.screenshot(path=f'{OUT}/vehicle-a-again-{viewport_name}.png')
        print(engine, viewport_name, 'OK: A only, B only, A only after delayed A response')
        b.close()
os.makedirs(OUT, exist_ok=True)
run('chromium', 'desktop'); run('webkit', '390')
