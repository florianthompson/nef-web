import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkPrBody } from './pr_body.mjs';

const dir = new URL('./fixtures/pr-body/', import.meta.url);
const script = new URL('./pr_body.mjs', import.meta.url).pathname;
const read = (name) => readFileSync(new URL(name, dir), 'utf8');

const needles = {
  'fail-no-desktop.md': ['desktop screenshot'],
  'fail-no-390.md': ['390px screenshot'],
  'fail-no-preview.md': ['preview URL'],
  'fail-empty.md': ['desktop screenshot', '390px screenshot', 'preview URL'],
  'fail-placeholders.md': ['desktop screenshot', '390px screenshot', 'preview URL'],
  'fail-one-image-both.md': ['same screenshot'],
  'fail-output-no-link.md': ['preview URL'],
  'fail-query-only.md': ['desktop screenshot', '390px screenshot'],
  'fail-code-fence.md': ['desktop screenshot', '390px screenshot', 'preview URL'],
  'fail-comment.md': ['desktop screenshot', '390px screenshot', 'preview URL'],
  'fail-label-steals-preview.md': ['preview URL'],
};

const files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();

for (const file of files) {
  test(file, () => {
    const result = checkPrBody(read(file));
    if (file.startsWith('pass-')) {
      assert.equal(result.ok, true, result.errors.join('\n'));
      assert.ok(result.preview, 'pass fixture found no preview link');
      return;
    }
    assert.equal(result.ok, false, 'expected the gate to fail');
    const need = needles[file];
    assert.ok(need, `add expected error text for ${file}`);
    for (const n of need) {
      assert.ok(result.errors.some((e) => e.includes(n)), `no error containing "${n}" in:\n${result.errors.join('\n')}`);
    }
  });
}

test('visual fixture keeps the preview url separate from the shots', () => {
  const result = checkPrBody(read('pass-visual.md'));
  assert.equal(result.ok, true);
  assert.equal(result.desktop, true);
  assert.equal(result.mobile390, true);
  assert.equal(result.preview, 'https://shop.example.com/preview');
});

test('one output shot does not also demand desktop and 390', () => {
  const result = checkPrBody(read('fail-output-no-link.md'));
  assert.equal(result.ok, false);
  assert.equal(result.output, true);
  assert.equal(result.desktop, false);
  assert.ok(!result.errors.some((e) => e.includes('desktop screenshot') || e.includes('390px screenshot')));
});

test('query string markers do not count', () => {
  const result = checkPrBody(read('fail-query-only.md'));
  assert.equal(result.preview, 'https://preview.example.com/home');
  assert.equal(result.desktop, false);
});

test('cli pass fixture exits 0', () => {
  const r = spawnSync(process.execPath, [script, '--body-file', new URL('pass-visual.md', dir).pathname], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /PR BODY PROOF: PASS/);
  assert.match(r.stdout, /preview: https:\/\/shop\.example\.com\/preview/);
});

test('cli fail fixture exits 1', () => {
  const r = spawnSync(process.execPath, [script, '--body-file', new URL('fail-empty.md', dir).pathname], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /PR BODY PROOF: FAIL/);
  assert.match(r.stdout, /desktop screenshot/);
  assert.match(r.stdout, /390px screenshot/);
  assert.match(r.stdout, /preview URL/);
});

test('cli --github-event reads pull_request.body', () => {
  const event = join(tmpdir(), `pr-body-event-${process.pid}.json`);
  writeFileSync(event, JSON.stringify({ pull_request: { body: read('fail-no-preview.md') } }));
  const r = spawnSync(process.execPath, [script, '--github-event', event], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /preview URL/);
  assert.doesNotMatch(r.stdout, /desktop screenshot/);
});

test('CLI reads a slow stdin pipe (gh pr view ... | node pr_body.mjs)', () => {
  const file = new URL('pass-visual.md', dir).pathname;
  const r = spawnSync('sh', ['-c', `(sleep 0.3; cat "${file}") | "${process.execPath}" "${script}"`], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /PR BODY PROOF: PASS/);
});

// Repo copies in scripts/proof/ carry no proof_gate.mjs, so this test only runs in bot-brain.
const gateFile = new URL('./proof_gate.mjs', import.meta.url);
test('proof_gate checks the PR body', { skip: existsSync(gateFile) ? false : 'no proof_gate.mjs in this copy' }, () => {
  const src = readFileSync(gateFile, 'utf8');
  assert.match(src, /checkPrBody\(live\.body/);
});
