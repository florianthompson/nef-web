#!/usr/bin/env python3
"""HAZ-179: CO-Warner shows under Fahrzeug (not Ausruestung) in the Protokoll, can be marked, and the mark survives a reload.
CATALOG-INJECTED: the seed is NOT applied on prod yet (needs PM OK). The real GET /rest/v1/protocols?... response is
fetched, then one CO-Warner item (same shape as its Fahrzeug siblings) is added to the Fahrzeug category before the page sees it.
Never submits; every REST write (POST/PATCH/PUT/DELETE) is aborted. usage: show.py BASE_URL OUTDIR
"""
import json, os, sys
from playwright.sync_api import sync_playwright
base, out = sys.argv[1].rstrip('/'), sys.argv[2]
STATE = os.environ.get('NEF_STORAGE_STATE', '/workspace/tasks/haz-166-167/auth/staff.json')
HIDE = 'vercel-live-feedback,[data-vercel-toolbar],#vercel-live-feedback{display:none!important}'
CO_ID = '3c7a5d52-179c-4e0a-9b2f-c0c0c0179c0f'
log = []
def say(s): print(s); log.append(s)

def inject(route):
    resp = route.fetch()
    try:
        body = resp.json()
    except Exception:
        return route.fulfill(response=resp)
    rows = body if isinstance(body, list) else [body]
    n = 0
    for proto in rows:
        for cat in (proto or {}).get('categories') or []:
            if cat.get('title') == 'Fahrzeug' and not any(i.get('title') == 'CO-Warner' for i in cat['items']):
                top = [i for i in cat['items'] if not i.get('parent_item_id')]
                tpl = dict(top[-1])
                tpl.update(id=CO_ID, title='CO-Warner', position=max(i['position'] for i in top) + 1, parent_item_id=None, text_value='')
                cat['items'].append(tpl); n += 1
    inject.count += n
    route.fulfill(response=resp, body=json.dumps(body), headers={**resp.headers, 'content-length': str(len(json.dumps(body).encode()))})
inject.count = 0

FIND = """(sc) => [...sc.querySelectorAll('.it')].find(e => ((e.querySelector('.nm')||{}).textContent||'').trim() === 'CO-Warner')"""

def snap(pg):
    return pg.evaluate("""() => { const sc=document.querySelector('#checklist .nv-b'); if(!sc) return null;
      const find = %s;
      const co=find(sc); const sec=co&&co.closest('.sec');
      const secs=[...sc.querySelectorAll('.sec')].map(s=>({title:(s.querySelector('.n')||{}).textContent, open:s.classList.contains('open'), hasCo: !!find(s)}));
      return { present:!!co, on:!!(co&&co.classList.contains('on')), section: sec? (sec.querySelector('.n')||{}).textContent : null, secs,
               progress:(sc.querySelector('.ov .mono')||{}).textContent } }""" % FIND)

def run(p, engine, label):
    b = (p.webkit if engine == 'webkit' else p.chromium).launch()
    st = json.load(open(STATE))
    for o in st['origins']: o['origin'] = base
    if engine == 'webkit':
        dev = dict(p.devices['iPhone 13']); dev['device_scale_factor'] = 2; dev['viewport'] = {'width': 390, 'height': 900}  # taller than the default so the Fahrzeug header and CO-Warner fit in one shot
        c = b.new_context(storage_state=st, service_workers='block', **dev)
    else:
        c = b.new_context(storage_state=st, service_workers='block', viewport={'width': 1440, 'height': 900}, device_scale_factor=2)
    blocked = []
    def guard(r):
        if r.request.method in ('POST', 'PATCH', 'DELETE', 'PUT'): blocked.append(r.request.method); r.abort()
        else: r.continue_()
    c.route('**/rest/v1/**', guard)
    c.route('**/rest/v1/protocols*', lambda r: inject(r) if r.request.method == 'GET' else guard(r))
    pg = c.new_page()
    def show():
        pg.add_style_tag(content=HIDE)
        pg.wait_for_selector('#checklist.show .sec-h', timeout=20000); pg.wait_for_timeout(600)
        heads = pg.query_selector_all('#checklist .sec-h')
        for h in heads:
            t = h.inner_text()
            if ('Ausrüstung' in t or 'Fahrzeug' in t) and not h.evaluate("e=>e.closest('.sec').classList.contains('open')"): h.click()
        pg.wait_for_timeout(400)
        full = snap(pg)  # Ausruestung and Fahrzeug both open here, so the "not under Ausruestung" check is real
        for h in pg.query_selector_all('#checklist .sec-h'):
            if 'Ausrüstung' in h.inner_text() and h.evaluate("e=>e.closest('.sec').classList.contains('open')"): h.click()
        pg.wait_for_timeout(400)
        pg.evaluate("""() => { const sc=document.querySelector('#checklist .nv-b'); const h=[...sc.querySelectorAll('.sec')].find(s=>(s.querySelector('.n')||{}).textContent==='Fahrzeug'); if(h){ const r=h.getBoundingClientRect(), t=sc.getBoundingClientRect(); sc.scrollTop += r.top - t.top - 70 } }""")
        pg.wait_for_timeout(400)
        return full
    pg.goto(base + '/app', wait_until='networkidle'); pg.add_style_tag(content=HIDE)
    pg.get_by_text('Protokoll ausfüllen').click()
    s0 = show()
    pg.screenshot(path=f'{out}/protokoll-co-warner-{label}.png')
    say(f'[{label}] injected into {inject.count} catalog response(s); CO-Warner present={s0["present"]} in section={s0["section"]!r}; sections with it: {[x["title"] for x in s0["secs"] if x["hasCo"]]} (Ausruestung has it: {any(x["hasCo"] for x in s0["secs"] if x["title"] and "Ausr" in x["title"])}); marked before click={s0["on"]}; progress={s0["progress"]}')
    pg.locator('#checklist .it', has=pg.locator('.nm', has_text='CO-Warner')).locator('.cb').click(); pg.wait_for_timeout(1800)  # autosave debounce
    s1 = snap(pg); pg.screenshot(path=f'{out}/protokoll-co-warner-marked-{label}.png')
    say(f'[{label}] after click: marked={s1["on"]} progress={s1["progress"]}')
    pg.reload(wait_until='networkidle'); pg.add_style_tag(content=HIDE)
    # a reload lands on the app home; reopen the Protokoll the way a user does
    pg.get_by_text('Protokoll ausfüllen').click()
    s2 = show()
    pg.screenshot(path=f'{out}/protokoll-co-warner-after-reload-{label}.png')
    say(f'[{label}] after reload: present={s2["present"]} section={s2["section"]!r} marked={s2["on"]} progress={s2["progress"]}; blocked writes: {sorted(set(blocked)) or "none"}')
    ok = s0['present'] and s0['section'] == 'Fahrzeug' and not s0['on'] and s1['on'] and s2['on'] and s2['section'] == 'Fahrzeug' \
         and not any(x['hasCo'] for x in s2['secs'] if x['title'] and 'Ausr' in x['title'])
    c.close(); b.close(); inject.count = 0
    return bool(ok)

with sync_playwright() as p:
    ok = run(p, 'chromium', 'desktop')
    ok &= run(p, 'webkit', '390')
open(f'{out}/run.txt', 'w').write(
    f'HAZ-179 CO-Warner proof, preview {base}\n'
    'NOTE: CATALOG-INJECTED. The CO-Warner seed (supabase/migrations/20261005120000_haz_179_co_warner.sql) is NOT applied on prod (needs PM OK).\n'
    'The page loads the real catalog via GET /rest/v1/protocols?select=*,categories(*,items(*)); Playwright page.route fetches that real response and adds one\n'
    f'item {CO_ID} "CO-Warner" (cloned from the last Fahrzeug leaf, position = max+1) to the Fahrzeug category. Nothing else is stubbed.\n'
    'Mark = click the checkbox of that row; the existing local draft path (autosave debounce 1.8s) stores it; reload = page.reload in the same context.\n'
    'No submit; every REST POST/PATCH/PUT/DELETE is aborted. Test login: staff storage state, not printed.\n'
    + '\n'.join(log) + f'\nOVERALL {"PASS" if ok else "FAIL"}\n')
sys.exit(0 if ok else 1)
