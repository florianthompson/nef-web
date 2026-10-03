import { supabase } from "./supabase";

export type ApiError = { status: number }; // 0 = network / timeout / offline

/** POST to a notes API route with the user's Supabase access token. */
export async function notesApi<T>(
  path: "/api/notes/transcribe" | "/api/notes/parse",
  body: BodyInit,
  contentType: string,
  signal?: AbortSignal
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw { status: 401 } satisfies ApiError;
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        Authorization: `Bearer ${session.access_token}`,
      },
      body,
      signal,
    });
  } catch {
    throw { status: 0 } satisfies ApiError;
  }
  if (!res.ok) throw { status: res.status } satisfies ApiError;
  try {
    return (await res.json()) as T;
  } catch {
    throw { status: 502 } satisfies ApiError;
  }
}

/** Segments are uploaded one after another; transcripts are joined in recording order. */
export async function transcribeSegments(
  segs: Blob[],
  type: string,
  signal: AbortSignal,
  onSeg?: (done: number) => void
): Promise<string> {
  const texts: string[] = [];
  for (const b of segs) {
    const r = await notesApi<{ text?: string }>("/api/notes/transcribe", b, type, signal);
    texts.push(String(r.text ?? "").trim());
    onSeg?.(texts.length);
  }
  return texts.filter(Boolean).join(" ");
}

export const transcribeTimeout = (segments: number) =>
  6000 + 3000 * Math.max(0, segments - 1);
