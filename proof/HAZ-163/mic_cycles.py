#!/usr/bin/env python3
"""HAZ-163: record, clear, record cycles on the NEF notes composer with stubbed media.

Stubs getUserMedia, MediaRecorder, SpeechRecognition, AudioContext and /api/notes/transcribe*.
Nothing is saved: only recording, transcription (stubbed) and clearing the field.

usage: mic_cycles.py BASE_URL --engine webkit|chromium [--cycles 5] [--shot PATH] [--mode normal|ios-autostop]
Login: Playwright storage state (path from env NEF_STORAGE_STATE, default staff.json of HAZ-138).
"""
import argparse, json, os, re, sys, time
T0 = time.time()
from playwright.sync_api import sync_playwright

STUB = r"""
(() => {
  const log = (...a) => console.log('[stub]', Math.round(performance.now()), ...a);
  window.__live = 0; window.__starts = 0; window.__recs = [];
  class Track { constructor(){ this.live = true; this.onended = null; window.__live++; }
    stop(){ if (this.live){ this.live = false; window.__live--; } } }
  class Stream { constructor(){ this.t = [new Track()]; }
    getTracks(){ return this.t; } getAudioTracks(){ return this.t; } }
  const md = navigator.mediaDevices || {};
  const gum = async () => { await new Promise(r => setTimeout(r, 30)); log('getUserMedia, live tracks before', window.__live); return new Stream(); };
  try { Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: gum }, configurable: true }); }
  catch (e) { md.getUserMedia = gum; }
  class MR {
    constructor(stream){ this.stream = stream; this.state = 'inactive'; this.ondataavailable = null; this.onstop = null; this.id = window.__recs.length; window.__recs.push(this); }
    start(){ this.state = 'recording'; window.__starts++; log('MR.start', this.id); }
    _end(){ if (this.state === 'inactive') return; this.state = 'inactive';
      const blob = new Blob([new Uint8Array(4000)], { type: 'audio/webm' });
      setTimeout(() => { this.ondataavailable && this.ondataavailable({ data: blob });
        setTimeout(() => { log('MR.onstop', this.id); this.onstop && this.onstop(); }, 5); }, 5); }
    stop(){ log('MR.stop()', this.id, 'state', this.state); this._end(); }
    static isTypeSupported(){ return true; }
  }
  window.MediaRecorder = MR;
  // iOS case: the active recorder stops on its own when the capture track ends (no stop() call)
  window.__killRecorder = () => { const r = window.__recs.filter(m => m.state === 'recording').pop(); if (r){ log('track ended, recorder stops by itself', r.id); r.stream.getTracks().forEach(t => t.stop()); r._end(); } return !!r; };
  window.__srStarts = 0;
  window.webkitSpeechRecognition = window.SpeechRecognition = class { start(){ window.__srStarts++; log('SR.start'); } stop(){ setTimeout(() => this.onend && this.onend(), 5); } abort(){ } };
  window.AudioContext = class { createAnalyser(){ return { fftSize: 512, getByteTimeDomainData(b){ b.fill(128); } }; }
    createMediaStreamSource(){ return { connect(){} }; } resume(){ return Promise.resolve(); } close(){ return Promise.resolve(); } };
  window.webkitAudioContext = window.AudioContext;
})();
"""

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('base'); ap.add_argument('--engine', default='chromium')
    ap.add_argument('--cycles', type=int, default=5); ap.add_argument('--shot')
    ap.add_argument('--mode', default='normal')
    ap.add_argument('--clear', default='alternate')  # selectall | backspace | alternate
    a = ap.parse_args()
    st = json.load(open(os.environ.get('NEF_STORAGE_STATE', '/workspace/tasks/haz-138/auth/staff.json')))
    for o in st['origins']: o['origin'] = a.base.rstrip('/')
    saved = []
    with sync_playwright() as p:
        if a.engine == 'webkit':
            b = p.webkit.launch(); dev = dict(p.devices['iPhone 13'])
            ctx = b.new_context(storage_state=st, service_workers='block', **dev)  # 390 wide, dpr 3 in profile
            ctx.close(); ctx = b.new_context(storage_state=st, service_workers='block', **{**dev, 'device_scale_factor': 2})
        else:
            b = p.chromium.launch(); ctx = b.new_context(storage_state=st, service_workers='block', viewport={'width': 1440, 'height': 900}, device_scale_factor=2)
        ctx.add_init_script(STUB)
        def route(r):
            req = r.request
            if req.method == 'POST': saved.append(req.url)
            print('   [route]', req.method, 'transcribe')
            if 'transcribe' in req.url: r.fulfill(status=200, content_type='application/json', body=json.dumps({'text': 'Stubbed transcript fuer den Test'}))
            else: r.abort()
        # never let a save reach the backend: abort any write to notes/note_comments/user_protocols
        def guard(r):
            if r.request.method in ('POST', 'PATCH', 'DELETE', 'PUT') and '/rest/v1/' in r.request.url:
                saved.append('BLOCKED ' + r.request.method + ' ' + r.request.url); r.abort()
            else: r.continue_()
        ctx.route('**/rest/v1/**', guard)
        pg = ctx.new_page()
        pg.route(re.compile(r'/api/notes/'), route)
        pg.on('pageerror', lambda e: print('   [pageerror]', str(e)[:200]))
        pg.on('request', lambda r: print('   [req]', round(time.time()-T0,1), r.method, r.url[:90]) if '/api/notes' in r.url else None)
        pg.on('console', lambda m: print('  ', round(time.time()-T0,1), m.text[:160]) if m.text.startswith('[stub]') else None)
        pg.goto(a.base.rstrip('/') + '/app', wait_until='networkidle')
        pg.add_style_tag(content='vercel-live-feedback,[data-vercel-toolbar],#vercel-live-feedback{display:none!important}')
        ta = pg.locator('#composer-input'); mic = pg.locator('#mic'); send = pg.locator('#composer-send')
        ta.wait_for(timeout=20000)
        ok = True
        for i in range(1, a.cycles + 1):
            how = a.clear if a.clear != 'alternate' else ('selectall' if i % 2 else 'backspace')
            line = f'cycle {i} ({a.engine}, clear={how}): '
            try:
                mic.click(timeout=3000)
                pg.wait_for_function('document.querySelector(".comp").dataset.rec === "1"', timeout=3000)
                pg.wait_for_timeout(400)
                if i == a.cycles and a.shot:
                    pg.screenshot(path=a.shot); line += f'shot {a.shot}; '
                if a.mode == 'ios-autostop' and i % 2 == 0:
                    pg.evaluate('window.__killRecorder()')   # recorder ends by itself, user never taps stop
                else:
                    send.click(timeout=3000)             # stop
                pg.wait_for_function('document.querySelector("#composer-input").value.includes("Stubbed")', timeout=6000)
                ta.focus()
                if how == 'selectall':
                    pg.keyboard.press('ControlOrMeta+a'); pg.keyboard.press('Delete')
                else:
                    n = len(ta.input_value())
                    for _ in range(n): pg.keyboard.press('Backspace')
                assert ta.input_value() == '', 'field not empty'
                line += 'cleared; '
                ok_i = True
            except Exception as e:
                line += 'FAIL before/at record: ' + str(e).splitlines()[0]; ok_i = False
                print('   [state]', pg.evaluate('({v: document.querySelector("#composer-input").value, c: document.querySelector(".comp").dataset, strip: (document.querySelector(".strip")||{}).innerText, micDisabled: document.querySelector("#mic").disabled, notice: document.body.innerText.slice(-200)})'))
            live = pg.evaluate('window.__live')
            line += f'live tracks={live}'
            print(line)
            if not ok_i: ok = False; break
        # final: record again after the last clear
        if ok:
            try:
                mic.click(timeout=3000)
                pg.wait_for_function('document.querySelector(".comp").dataset.rec === "1"', timeout=3000)
                print(f'after cycle {a.cycles}: recording again OK')
                if a.shot and not os.path.exists(a.shot): pg.screenshot(path=a.shot)
                if a.shot: pg.wait_for_timeout(300); pg.screenshot(path=a.shot)
            except Exception as e:
                ok = False; print('after last clear: FAIL, mic did not record:', str(e).splitlines()[0])
        print('writes seen:', [s for s in saved if s.startswith('BLOCKED')] or 'none')
        print('RESULT', 'PASS' if ok else 'FAIL', a.engine, a.mode)
        b.close()
    sys.exit(0 if ok else 1)
main()
