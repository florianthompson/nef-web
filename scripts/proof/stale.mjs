// Shared stale-proof check (HAZ-133). proof_gate.mjs passes the GitHub compare
// file list. CI and `validate.mjs --head` pass paths from local `git diff`.
import { execFileSync } from 'node:child_process';

function nameOf(file) {
  if (typeof file === 'string') return file;
  return file?.filename ?? '';
}

/**
 * Files outside proof/<ticket>/ between the measured commit and the head.
 * Same commit passes. A null commitSha is skipped only for shopify-theme with repo "none".
 * @returns {{ ok: boolean, skipped: boolean, outside: string[], error: string|null }}
 */
export function staleFindings({ proof, headSha, changedFiles }) {
  if (!proof || typeof proof !== 'object') {
    return { ok: false, skipped: false, outside: [], error: 'stale proof: proof is missing' };
  }
  if (proof.commitSha == null) {
    if (proof.kind === 'shopify-theme' && proof.repo === 'none') {
      return { ok: true, skipped: true, outside: [], error: null };
    }
    return { ok: false, skipped: false, outside: [], error: 'stale proof: commitSha is null' };
  }
  if (headSha && proof.commitSha === headSha) {
    return { ok: true, skipped: false, outside: [], error: null };
  }
  const prefix = `proof/${proof.ticket}/`;
  const outside = (changedFiles ?? []).map(nameOf).filter((name) => name && !name.startsWith(prefix));
  return { ok: outside.length === 0, skipped: false, outside, error: null };
}

export function formatStale({ proof, headSha, findings }) {
  if (!findings || findings.ok || findings.skipped) return null;
  if (findings.error) return findings.error;
  const prefix = `proof/${proof.ticket}/`;
  const shown = findings.outside.slice(0, 5).join(', ');
  const measured = String(proof.commitSha).slice(0, 7);
  const head = String(headSha ?? '').slice(0, 7);
  return `stale proof: measured ${measured} but head is ${head}, and ${findings.outside.length} changed file(s) are outside ${prefix}: ${shown}`;
}

function commitExists(sha, cwd) {
  try {
    execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

/** Local `git diff --name-only <commitSha> <headSha>`. Fails clearly when a sha is not in history. */
export function changedFilesBetween(commitSha, headSha, cwd) {
  if (!commitExists(commitSha, cwd)) {
    return { error: `stale proof: commit ${String(commitSha).slice(0, 7)} is not in local history` };
  }
  if (!commitExists(headSha, cwd)) {
    return { error: `stale proof: head ${String(headSha).slice(0, 7)} is not in local history` };
  }
  const out = execFileSync('git', ['diff', '--name-only', commitSha, headSha], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { files: out.split('\n').map((s) => s.trim()).filter(Boolean) };
}
