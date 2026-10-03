import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { formatStale, staleFindings } from './stale.mjs';
import { staleErrors } from './validate.mjs';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.alloc(1 + width * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const root = mkdtempSync(join(tmpdir(), 'stale-proof-'));
const proofDir = join(root, 'proof', 'HAZ-9');
mkdirSync(proofDir, { recursive: true });
mkdirSync(join(root, 'src'), { recursive: true });
writeFileSync(join(proofDir, 'desktop.png'), png(1440, 20));
writeFileSync(join(proofDir, 'mobile.png'), png(780, 20));
writeFileSync(join(root, 'src', 'app.js'), 'export const n = 1;\n');

const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
git(['init', '-b', 'main']);
git(['config', 'user.email', 'test@example.com']);
git(['config', 'user.name', 'Test']);

function proofAt(sha) {
  return {
    schemaVersion: 1,
    ticket: 'HAZ-9',
    repo: 'florianthompson/bot-brain',
    kind: 'generic',
    branch: 'main',
    commitSha: sha,
    pr: { url: 'https://github.com/florianthompson/bot-brain/pull/16', number: 16, state: 'OPEN', isDraft: true, merged: false, mergedAt: null },
    urls: { preview: 'https://example.vercel.app', live: null },
    screenshots: [
      { path: 'desktop.png', viewport: 'desktop', width: 1440, height: 20, deviceScaleFactor: 1, route: '/' },
      { path: 'mobile.png', viewport: 'mobile390', width: 780, height: 20, deviceScaleFactor: 2, route: '/' },
    ],
    checks: [{ name: 'unit', command: 'node --test', exitCode: 0, durationMs: 10, summary: 'pass' }],
    console: { errors: [] },
    createdAt: '2026-10-03T12:00:00+00:00',
    createdBy: 'test',
  };
}

writeFileSync(join(proofDir, 'proof.json'), JSON.stringify(proofAt('a'.repeat(40)), null, 2) + '\n');
git(['add', '-A']);
git(['commit', '-m', 'measure']);
const measured = git(['rev-parse', 'HEAD']);

writeFileSync(join(proofDir, 'proof.json'), JSON.stringify(proofAt(measured), null, 2) + '\n');
writeFileSync(join(proofDir, 'note.txt'), 'proof only\n');
git(['add', '-A']);
git(['commit', '-m', 'proof files only']);
const headProofOnly = git(['rev-parse', 'HEAD']);

const script = new URL('./validate.mjs', import.meta.url).pathname;
const proofPath = join(proofDir, 'proof.json');

test('stale check: proof-only diff passes, a file outside fails, the same commit passes', () => {
  const obj = proofAt(measured);
  assert.deepEqual(staleErrors(obj, headProofOnly, proofDir), []);
  const onlyProof = staleFindings({
    proof: obj,
    headSha: headProofOnly,
    changedFiles: ['proof/HAZ-9/proof.json', 'proof/HAZ-9/note.txt'],
  });
  assert.equal(onlyProof.ok, true);
  assert.deepEqual(onlyProof.outside, []);
  assert.equal(formatStale({ proof: obj, headSha: headProofOnly, findings: onlyProof }), null);
  const cliPass = spawnSync(process.execPath, [script, '--head', headProofOnly, proofPath], { encoding: 'utf8' });
  assert.equal(cliPass.status, 0, cliPass.stderr);
  assert.match(cliPass.stdout, /ok/);

  writeFileSync(join(root, 'src', 'other.js'), 'export const n = 2;\n');
  git(['add', '-A']);
  git(['commit', '-m', 'code after proof']);
  const head = git(['rev-parse', 'HEAD']);
  const onDisk = JSON.parse(readFileSync(proofPath, 'utf8'));
  const errors = staleErrors(onDisk, head, proofDir);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /src\/other\.js/);
  assert.match(errors[0], /outside proof\/HAZ-9\//);
  const outside = staleFindings({ proof: onDisk, headSha: head, changedFiles: ['proof/HAZ-9/note.txt', { filename: 'src/other.js' }] });
  assert.equal(outside.ok, false);
  assert.deepEqual(outside.outside, ['src/other.js']);
  const cliFail = spawnSync(process.execPath, [script, proofPath, '--head', head], { encoding: 'utf8' });
  assert.equal(cliFail.status, 1);
  assert.match(cliFail.stderr, /src\/other\.js/);

  const same = proofAt(head);
  assert.deepEqual(staleErrors(same, head, proofDir), []);
  const ignored = staleFindings({ proof: same, headSha: head, changedFiles: ['src/other.js'] });
  assert.equal(ignored.ok, true);
  assert.equal(ignored.outside.length, 0);

  const missing = proofAt('c'.repeat(40));
  const missingErrors = staleErrors(missing, head, proofDir);
  assert.equal(missingErrors.length, 1);
  assert.match(missingErrors[0], /not in local history/);
  writeFileSync(proofPath, JSON.stringify(missing, null, 2) + '\n');
  const cliMissing = spawnSync(process.execPath, [script, '--head', head, proofPath], { encoding: 'utf8' });
  assert.equal(cliMissing.status, 1);
  assert.match(cliMissing.stderr, /not in local history/);
});

test('null commitSha for shopify-theme with repo none is skipped', () => {
  const proof = { kind: 'shopify-theme', repo: 'none', ticket: 'HAZ-9', commitSha: null };
  const findings = staleFindings({ proof, headSha: 'b'.repeat(40), changedFiles: ['src/other.js'] });
  assert.equal(findings.ok, true);
  assert.equal(findings.skipped, true);
  assert.deepEqual(staleErrors(proof, 'b'.repeat(40), proofDir), []);
});

const gateFile = new URL('./proof_gate.mjs', import.meta.url);
test('the gate and CI both call staleFindings', () => {
  const validate = readFileSync(new URL('./validate.mjs', import.meta.url), 'utf8');
  const yml = readFileSync(new URL('../../.github/workflows/proof.yml', import.meta.url), 'utf8');
  if (existsSync(gateFile)) assert.match(readFileSync(gateFile, 'utf8'), /staleFindings\(/);
  assert.match(validate, /staleFindings\(/);
  assert.match(yml, /validate\.mjs --head "\$HEAD_SHA"/);
  assert.match(yml, /fetch-depth: 0/);
});

test.after(() => rmSync(root, { recursive: true, force: true }));
