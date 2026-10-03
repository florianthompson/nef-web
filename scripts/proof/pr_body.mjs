#!/usr/bin/env node
// PR description proof (HAZ-129). Florian, 2026-10-03: every PR body needs
// a desktop screenshot, a 390px screenshot, and a clickable preview link.
// No exceptions. The proof gate and CI (proof.yml.template) both call this.
//
// A screenshot is a markdown image `![alt](url)`, an HTML <img>, or a markdown
// link [text](url). The alt text or the file name (last path segment) must
// contain "desktop" or "390". The URL must be http or https.
//
// The preview link is a different http or https link (markdown link, autolink,
// or bare URL). Screenshot URLs do not count as the preview.
//
// Work with no visual: mark shots of the result (test output, a doc, a terminal)
// desktop and 390, or use one screenshot whose alt text or file name contains
// "output", plus a preview or result link.
//
// Fenced code, inline code, and HTML comments are ignored.
//
//   node pr_body.mjs --body-file <markdown>
//   node pr_body.mjs --github-event "$GITHUB_EVENT_PATH"
//   node pr_body.mjs --body-env PR_BODY
// Exit 0 on pass, 1 on fail, 2 on usage or read errors.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stdin } from 'node:process';

const DESKTOP_MSG = 'missing a desktop screenshot: a markdown image, img tag, or link whose alt text or file name contains "desktop"';
const MOBILE_MSG = 'missing a 390px screenshot: a markdown image, img tag, or link whose alt text or file name contains "390"';
const BOTH_MSG = 'desktop and 390 are both on the same screenshot. Use two shots, or one output shot';
const OUTPUT_HINT = 'For work with no visual, one screenshot whose alt text or file name contains "output" also counts';
const PREVIEW_MSG = 'missing a clickable preview URL: an http or https link that is not one of the screenshots';

function stripPassive(text) {
  return String(text ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

function attr(tag, name) {
  const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const m = tag.match(re);
  return m ? (m[2] ?? m[3] ?? m[4] ?? '') : '';
}

function fileName(url) {
  const seg = url.pathname.split('/').filter(Boolean).pop() ?? '';
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

function classify(text, rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const filename = fileName(url);
  const hay = `${text}\n${filename}`;
  return {
    text,
    url: url.href,
    filename,
    desktop: /desktop/i.test(hay),
    mobile390: /390/.test(hay),
    output: /output/i.test(hay),
  };
}

function pull(src, re, onMatch) {
  return src.replace(re, (...args) => {
    onMatch(args);
    return ' ';
  });
}

/** @returns {{ ok: boolean, errors: string[], desktop: boolean, mobile390: boolean, output: boolean, preview: string|null }} */
export function checkPrBody(body) {
  const errors = [];
  let src = stripPassive(body);
  const items = [];

  src = pull(src, /<img\b[^>]*>/gi, ([full]) => {
    items.push({ kind: 'img', text: attr(full, 'alt'), url: attr(full, 'src') });
  });
  src = pull(src, /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g, ([, alt, url]) => {
    items.push({ kind: 'image', text: alt ?? '', url: url ?? '' });
  });
  src = pull(src, /(?<!!)\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g, ([, text, url]) => {
    items.push({ kind: 'link', text: text ?? '', url: url ?? '' });
  });
  src = pull(src, /<(https?:\/\/[^>\s]+)>/g, ([, url]) => {
    items.push({ kind: 'autolink', text: '', url: url ?? '' });
  });
  src = pull(src, /https?:\/\/[^\s<>)\]]+/g, ([full]) => {
    items.push({ kind: 'bare', text: '', url: full.replace(/[.,;:!?]+$/g, '') });
  });

  const shots = [];
  const previews = [];
  for (const item of items) {
    const info = classify(item.text, item.url);
    if (!info) continue;
    if (info.desktop || info.mobile390 || info.output) shots.push(info);
    else if (item.kind === 'link' || item.kind === 'autolink' || item.kind === 'bare') previews.push(info);
  }

  const shotUrls = new Set(shots.map((s) => s.url));
  const previewLinks = previews.filter((p) => !shotUrls.has(p.url));

  const desktopRefs = shots.filter((s) => s.desktop);
  const mobileRefs = shots.filter((s) => s.mobile390);
  const paired = desktopRefs.some((d) => mobileRefs.some((m) => m !== d));
  const hasOutput = shots.some((s) => s.output);

  if (!paired && !hasOutput) {
    if (desktopRefs.length && mobileRefs.length) errors.push(BOTH_MSG);
    else {
      if (!desktopRefs.length) errors.push(DESKTOP_MSG);
      if (!mobileRefs.length) errors.push(MOBILE_MSG);
    }
    errors.push(OUTPUT_HINT);
  }
  if (!previewLinks.length) errors.push(PREVIEW_MSG);

  return {
    ok: errors.length === 0,
    errors,
    desktop: paired,
    mobile390: paired,
    output: hasOutput,
    preview: previewLinks[0]?.url ?? null,
  };
}

function usage() {
  return [
    'usage: node pr_body.mjs --body-file <markdown>',
    '       node pr_body.mjs --github-event <event.json>',
    '       node pr_body.mjs --body-env <NAME>',
    '       node pr_body.mjs   (markdown on stdin)',
  ].join('\n');
}

function readBody(argv) {
  const opt = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : null;
  };
  const file = opt('--body-file');
  if (file) return readFileSync(file, 'utf8');
  const envName = opt('--body-env');
  if (envName) return process.env[envName] ?? '';
  const eventPath = opt('--github-event');
  if (eventPath) {
    const event = JSON.parse(readFileSync(eventPath, 'utf8'));
    return event.pull_request?.body ?? '';
  }
  if (stdin.isTTY) {
    const err = new Error(usage());
    err.code = 'USAGE';
    throw err;
  }
  return readFileSync(0, 'utf8');
}

export function reportBody(result) {
  const lines = [`PR BODY PROOF: ${result.ok ? 'PASS' : 'FAIL'}`];
  if (result.ok) {
    lines.push(`  desktop: ${result.desktop ? 'yes' : 'no'}`);
    lines.push(`  390px: ${result.mobile390 ? 'yes' : 'no'}`);
    lines.push(`  output: ${result.output ? 'yes' : 'no'}`);
    lines.push(`  preview: ${result.preview ?? 'none'}`);
  } else {
    for (const e of result.errors) lines.push(`  FAIL  ${e}`);
  }
  return lines.join('\n');
}

function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(usage());
    return 0;
  }
  let body;
  try {
    body = readBody(argv);
  } catch (e) {
    console.error(e.code === 'USAGE' ? e.message : `pr_body: ${e.message}`);
    return 2;
  }
  const result = checkPrBody(body);
  console.log(reportBody(result));
  return result.ok ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
