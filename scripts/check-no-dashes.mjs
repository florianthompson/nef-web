#!/usr/bin/env node
/**
 * Fail when UI source contains an em dash (U+2014) or an en dash (U+2013).
 *
 * Scans src/ (app routes, components, and other UI modules). Comments are
 * removed first so comment-only dashes do not fail the check. String literals
 * are kept, including JavaScript unicode escapes (\u2014, \u2013) and HTML
 * entities that render as those characters.
 *
 * No npm dependencies.
 */

import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_DIRS = ["src"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css"]);

/**
 * file:line entries to ignore when a dash sits on a comment the stripper
 * cannot see. Leave empty when comments are skipped correctly.
 * @type {Set<string>}
 */
const ALLOWLIST = new Set([]);

const DASH_RE =
  /[\u2014\u2013]|\\u2014|\\u2013|\\u\{2014\}|\\u\{2013\}|&mdash;|&ndash;|&#8212;|&#8211;|&#x0*201[34];/i;

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(extname(entry.name))) out.push(full);
  }
  return out;
}

/**
 * Drop comments while keeping newlines, so reported line numbers match the file.
 * Strings and template literals stay, including `${...}` interpolations.
 * @param {string} input
 */
function stripComments(input) {
  let out = "";
  /** @type {string[]} */
  const stack = ["code"];
  /** @type {number[]} */
  const interpDepth = [];
  const state = () => stack[stack.length - 1];

  let i = 0;
  const n = input.length;
  while (i < n) {
    const c = input[i];
    const d = input[i + 1];
    const st = state();

    if (st === "code" || st === "interp") {
      if (c === "/" && d === "/") {
        i += 2;
        while (i < n && input[i] !== "\n") i++;
        continue;
      }
      if (c === "/" && d === "*") {
        i += 2;
        while (i < n && !(input[i] === "*" && input[i + 1] === "/")) {
          if (input[i] === "\n") out += "\n";
          i++;
        }
        i += 2;
        continue;
      }
      if (c === "'") {
        stack.push("sq");
        out += c;
        i++;
        continue;
      }
      if (c === '"') {
        stack.push("dq");
        out += c;
        i++;
        continue;
      }
      if (c === "`") {
        stack.push("tpl");
        out += c;
        i++;
        continue;
      }
      if (st === "interp") {
        if (c === "{") interpDepth[interpDepth.length - 1] += 1;
        else if (c === "}") {
          if (interpDepth[interpDepth.length - 1] === 0) {
            stack.pop();
            interpDepth.pop();
            out += c;
            i++;
            continue;
          }
          interpDepth[interpDepth.length - 1] -= 1;
        }
      }
      out += c;
      i++;
      continue;
    }

    if (c === "\\") {
      out += c;
      i++;
      if (i < n) {
        out += input[i];
        i++;
      }
      continue;
    }
    if (st === "tpl" && c === "$" && d === "{") {
      out += "${";
      i += 2;
      stack.push("interp");
      interpDepth.push(0);
      continue;
    }
    const quote = st === "sq" ? "'" : st === "dq" ? '"' : "`";
    if (c === quote) {
      out += c;
      i++;
      stack.pop();
      continue;
    }
    out += c;
    i++;
  }

  return out;
}

const files = SCAN_DIRS.flatMap((dir) => walk(join(ROOT, dir), []));
/** @type {string[]} */
const findings = [];

for (const file of files) {
  const raw = readFileSync(file, "utf8");
  const stripped = stripComments(raw);
  const rawLines = raw.split("\n");
  const lines = stripped.split("\n");
  const rel = relative(ROOT, file).split(sep).join("/");

  lines.forEach((line, idx) => {
    if (!DASH_RE.test(line)) return;
    const key = `${rel}:${idx + 1}`;
    if (ALLOWLIST.has(key)) return;
    findings.push(`${key}: ${rawLines[idx].trim()}`);
  });
}

if (findings.length > 0) {
  console.error(
    `Found ${findings.length} em dash (U+2014) or en dash (U+2013) in UI source:`,
  );
  for (const finding of findings) console.error(finding);
  process.exit(1);
}

console.log(
  "check:dashes: no em dash (U+2014) or en dash (U+2013) in UI source",
);
