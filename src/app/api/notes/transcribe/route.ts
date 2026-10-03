import { NextRequest } from "next/server";
import { authorize, json, loadTeamItems, openaiBase } from "@/lib/server/notesApi";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 3 * 1024 * 1024;
const PROMPT_MAX = 2500;
const EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
};

const NEF = [
  "Corpuls", "Corpuls C3", "corpuls3", "LUCAS", "LUCAS 3", "Accuvac", "Absaugpumpe", "Absauger",
  "Perfusor", "Spritzenpumpe", "Medumat", "Medumat Standard²", "Beatmungsgerät", "Pulsoximeter",
  "Ladekabel", "Akku", "EKG-Elektroden", "Defi-Pads", "Larynxtubus", "Laryngoskop",
  "Videolaryngoskop", "C-MAC", "Guedeltubus", "Wendeltubus", "Stifneck", "Vakuummatratze",
  "Spineboard", "Schaufeltrage", "Tragestuhl", "KED-System", "Sauerstoffflasche", "Druckminderer",
  "Notfallrucksack", "Kinder-Notfallrucksack", "BZ-Messgerät", "Thermometer", "Tankkarte",
  "Funkgerät", "Digitalfunk", "Navi", "Tablet",
];

function buildPrompt(itemTitles: string[]): string {
  const head = "Übergabenotiz im Notarztdienst (NEF). Fachbegriffe: ";
  const seen = new Set<string>();
  let s = head;
  for (const n of [...NEF, ...itemTitles]) {
    const name = n.trim();
    const k = name.toLowerCase();
    if (!name || seen.has(k)) continue;
    seen.add(k);
    const add = (s === head ? "" : ", ") + name;
    if (s.length + add.length > PROMPT_MAX) break;
    s += add;
  }
  return s;
}

export async function POST(req: NextRequest) {
  const auth = await authorize(req, MAX_BYTES);
  if ("status" in auth) return auth;

  const key = process.env.OPENAI_API_KEY;
  if (!key) return json(503, { error: "not_configured" });

  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = EXT[type];
  if (!ext) return json(415, { error: "unsupported_type" });

  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length > MAX_BYTES) return json(413, { error: "too_large" });
  if (!buf.length) return json(400, { error: "empty" });

  let titles: string[] = [];
  try {
    titles = (await loadTeamItems(auth.supabase, auth.userId)).map((i) => i.title);
  } catch {
    // prompt bias is optional
  }

  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array(buf)], { type }), `audio.${ext}`);
  fd.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe");
  fd.append("language", "de");
  fd.append("prompt", buildPrompt(titles));

  let up: Response;
  try {
    up = await fetch(`${openaiBase()}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: fd,
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    return json(502, { error: "upstream", status: 0 });
  }
  if (!up.ok) return json(502, { error: "upstream", status: up.status });
  try {
    const j = await up.json();
    return json(200, { text: String(j.text ?? "").trim() });
  } catch {
    return json(502, { error: "upstream", status: up.status });
  }
}
