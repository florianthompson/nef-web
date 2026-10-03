import { NextRequest } from "next/server";
import { authorize, json, loadTeamItems, mapCategory, openaiBase } from "@/lib/server/notesApi";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_TEXT = 20000;
const MAX_BODY = 96 * 1024;
const CATS = ["Medikamente", "BTM", "Fahrzeug", "Ausrüstung", "Sonstiges"];
const DUE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["notes"],
  properties: {
    notes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "quote", "itemId", "category", "dueDate", "dueText"],
        properties: {
          text: { type: "string" },
          quote: { type: "string" },
          itemId: { type: ["string", "null"] },
          category: { type: "string", enum: CATS },
          dueDate: { type: ["string", "null"] },
          dueText: { type: ["string", "null"] },
        },
      },
    },
  },
};

const SYSTEM = `Du sortierst Notizen aus dem Rettungsdienst (Checkliste eines NEF).
- Behalte NUR betrieblich relevante Punkte: fehlender, verbrauchter oder leerer Bestand von Medikamenten und BTM; Defekte; Fahrzeugprobleme; Ausrüstungsprobleme; Termine oder Datumsangaben; Aufgaben für die nächste Schicht. Verwirf Smalltalk, Begrüßungen, Füllwörter, Wetter, private Bemerkungen und Wiederholungen. Erfinde niemals etwas. Wenn unklar ist, ob etwas relevant ist, behalte es als Sonstiges.
- Jede Notiz hat ein Feld quote: eine kurze Wortfolge, exakt und wörtlich aus dem Text kopiert, die die Notiz belegt (nicht umformuliert, keine Auslassungen).
- Teile die Nachricht in einzelne Notizen auf, eine pro eigenständigem Problem oder Gegenstand.
- Der Text jeder Notiz bleibt nah am Gesagten: nimm die Formulierung aus der Nachricht und mache nur eine leichte Bereinigung (Füllwörter wie "äh", "also", "dann" weg, Grammatik und Satzanfang glätten, keine Datumsangabe im Text).
- Gerätenamen, Markennamen und Medikamentennamen bleiben genau so, wie sie gesagt wurden (z. B. "Corpuls" bleibt "Corpuls", nie "EKG" oder "EKG-Ladekabel"; "Rocu" darf "Rocuronium" werden). Die Zuordnung zur itemId ändert den Text nicht.
- Füge keine Handlungen, Aufforderungen, Bewertungen oder Wörter hinzu, die nicht gesagt wurden (z. B. nicht "und muss nachgefüllt werden", wenn nur "ist leer" gesagt wurde). Gesagte Aufforderungen wie "bitte nachbestellen" bleiben erhalten.
- Ordne jede Notiz genau einer itemId aus der Liste zu, wenn sie eindeutig darauf verweist (Synonyme und Markennamen sind erlaubt, z. B. "Rocu" = Rocuronium, "Ceftri" = Ceftriaxon). Verwende ausschließlich ids aus der Liste. Sonst itemId null und die passendste category, im Zweifel Sonstiges.
- Löse Termine relativ zu "Jetzt" auf (Europe/Berlin). Ein Wochentag bedeutet das nächste Auftreten; derselbe Wochentag wie heute bedeutet nächste Woche. dueDate als 'YYYY-MM-DD' oder mit Uhrzeit 'YYYY-MM-DDTHH:MM', dueText ist die Original-Formulierung (z. B. "Donnerstag um 14 Uhr"). Ohne Termin beides null.`;

function nowBerlin(): string {
  const d = new Date();
  const p = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(d)
    .replace(" ", "T");
  const wd = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long" }).format(d);
  return `${p} (${wd})`;
}

// Traceability: a note survives only if its quote is (fuzzily) found in the transcript.
const norm = (s: string) =>
  String(s)
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function quoteFound(quote: string, textNorm: string, textTokens: string[]): boolean {
  const q = norm(quote);
  if (!q) return false;
  if ((" " + textNorm + " ").includes(" " + q + " ")) return true;
  const qt = q.split(" ");
  const need = Math.ceil(qt.length * 0.85);
  for (const w of new Set([qt.length, qt.length + 1, qt.length + 2])) {
    for (let i = 0; i + Math.min(w, textTokens.length) <= textTokens.length; i++) {
      const pool = new Map<string, number>();
      for (const t of textTokens.slice(i, i + w)) pool.set(t, (pool.get(t) ?? 0) + 1);
      let hit = 0;
      for (const t of qt) {
        const c = pool.get(t) ?? 0;
        if (c) {
          hit++;
          pool.set(t, c - 1);
        }
      }
      if (hit >= need) return true;
    }
  }
  return false;
}

type RawNote = {
  text?: unknown;
  quote?: unknown;
  itemId?: unknown;
  category?: unknown;
  dueDate?: unknown;
  dueText?: unknown;
};

function clean(
  raw: { notes?: RawNote[] } | null,
  transcript: string,
  itemsById: Map<string, { id: string; category: string }>
) {
  const textNorm = norm(transcript);
  const textTokens = textNorm ? textNorm.split(" ") : [];
  let dropped = 0;
  const out: {
    text: string;
    itemId: string | null;
    category: string;
    dueDate: string | null;
    dueText: string | null;
  }[] = [];
  for (const n of raw && Array.isArray(raw.notes) ? raw.notes : []) {
    if (out.length >= 30) break;
    const text = typeof n.text === "string" ? n.text.trim().slice(0, 300) : "";
    if (!text) continue;
    const quote = typeof n.quote === "string" ? n.quote.trim().slice(0, 240) : "";
    if (!quoteFound(quote, textNorm, textTokens)) {
      dropped++;
      continue;
    }
    const item = typeof n.itemId === "string" ? itemsById.get(n.itemId) : undefined;
    const category = item
      ? mapCategory(item.category)
      : typeof n.category === "string" && CATS.includes(n.category)
        ? n.category
        : "Sonstiges";
    const dueDate = typeof n.dueDate === "string" && DUE_RE.test(n.dueDate) ? n.dueDate : null;
    const dueText =
      dueDate && typeof n.dueText === "string" && n.dueText.trim()
        ? n.dueText.trim().slice(0, 80)
        : null;
    out.push({ text, itemId: item ? item.id : null, category, dueDate, dueText });
  }
  return { notes: out, dropped };
}

const primaryModel = () => process.env.OPENAI_PARSE_MODEL || "gpt-6-luna";
const fallbackModel = () => process.env.OPENAI_PARSE_FALLBACK_MODEL || "gpt-4.1-nano";

type Params = Record<string, unknown>;

async function callUpstream(
  key: string,
  model: string,
  params: Params,
  messages: unknown[]
): Promise<{ up: Response; err: string }> {
  const body = {
    model,
    ...params,
    messages,
    response_format: {
      type: "json_schema",
      json_schema: { name: "notes", strict: true, schema: SCHEMA },
    },
  };
  const up = await fetch(`${openaiBase()}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(25000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { up, err: up.ok ? "" : await up.text().catch(() => "") };
}

export async function POST(req: NextRequest) {
  const auth = await authorize(req, MAX_BODY);
  if ("status" in auth) return auth;

  const key = process.env.OPENAI_API_KEY;
  if (!key) return json(503, { error: "not_configured" });

  let text: unknown;
  try {
    text = (await req.json()).text;
  } catch {
    text = null;
  }
  if (typeof text !== "string" || !text.trim()) return json(400, { error: "bad_request" });
  if (text.length > MAX_TEXT) return json(413, { error: "too_large" });

  let items: Awaited<ReturnType<typeof loadTeamItems>> = [];
  try {
    items = await loadTeamItems(auth.supabase, auth.userId);
  } catch {
    // parse still works without a catalogue (all notes become unassigned)
  }
  const itemsById = new Map(items.map((i) => [i.id, i]));
  const itemLines = items.map((i) => `${i.id}|${i.title}|${mapCategory(i.category)}`).join("\n");

  const messages = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Jetzt: ${nowBerlin()}\n\nItems (id|name|category):\n${itemLines}\n\nText:\n${text.trim()}`,
    },
  ];

  let model = primaryModel();
  let r: { up: Response; err: string };
  try {
    const params: Params = { temperature: 0, reasoning_effort: "none" };
    r = await callUpstream(key, model, params, messages);
    // a model that rejects temperature (or reasoning_effort): retry once without the offending parameter
    if (r.up.status === 400) {
      for (const k of ["temperature", "reasoning_effort"]) {
        if (k in params && r.err.includes(k)) {
          delete params[k];
          r = await callUpstream(key, model, params, messages);
          break;
        }
      }
    }
    // model not found / unsupported: retry once with the fallback model (older models reject reasoning_effort)
    if ((r.up.status === 400 || r.up.status === 404) && fallbackModel() !== model) {
      model = fallbackModel();
      r = await callUpstream(key, model, { temperature: 0 }, messages);
    }
  } catch {
    return json(502, { error: "upstream", status: 0 });
  }
  if (!r.up.ok) return json(502, { error: "upstream", status: r.up.status });

  try {
    const j = await r.up.json();
    const out = clean(JSON.parse(j.choices[0].message.content), text, itemsById);
    return json(200, { notes: out.notes, dropped: out.dropped, model });
  } catch {
    return json(502, { error: "upstream", status: r.up.status });
  }
}
