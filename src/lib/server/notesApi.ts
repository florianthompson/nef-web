import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Best-effort abuse guard: in-memory per function instance (one voice note = up to 5 transcribe calls + 1 parse).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQ = 60;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.length || now - v[v.length - 1] > WINDOW_MS) hits.delete(k);
    }
  }
  const arr = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_REQ) {
    hits.set(key, arr);
    return true;
  }
  arr.push(now);
  hits.set(key, arr);
  return false;
}

export const json = (status: number, body: unknown) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const openaiBase = () =>
  (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");

export type Authed = { supabase: SupabaseClient; userId: string };

/**
 * Verifies `Authorization: Bearer <supabase access token>`. Returns the user-scoped
 * client (RLS applies) or an error response (401 / 413 / 429).
 */
export async function authorize(
  req: NextRequest,
  maxBytes: number
): Promise<Authed | NextResponse> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return json(401, { error: "unauthorized" });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return json(503, { error: "not_configured" });

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return json(401, { error: "unauthorized" });

  const len = parseInt(req.headers.get("content-length") ?? "0", 10);
  if (len > maxBytes) return json(413, { error: "too_large" });
  if (rateLimited(data.user.id)) return json(429, { error: "rate_limited" });

  return { supabase, userId: data.user.id };
}

/** Loads the signed-in user's team items (id, title, category title), sub-items included. RLS-scoped. */
export async function loadTeamItems(
  supabase: SupabaseClient,
  userId: string
): Promise<{ id: string; title: string; category: string }[]> {
  const { data: u } = await supabase
    .from("users")
    .select("team_id")
    .eq("id", userId)
    .single();
  if (!u?.team_id) return [];
  const { data: protocols } = await supabase
    .from("protocols")
    .select("id")
    .eq("team_id", u.team_id);
  const pids = (protocols ?? []).map((p: { id: string }) => p.id);
  if (!pids.length) return [];
  const { data: cats } = await supabase
    .from("categories")
    .select("id, title")
    .in("protocol_id", pids);
  const catRows = (cats ?? []) as { id: string; title: string }[];
  if (!catRows.length) return [];
  const catTitle = new Map(catRows.map((c) => [c.id, c.title]));
  const { data: items } = await supabase
    .from("items")
    .select("id, title, category_id, parent_item_id")
    .in("category_id", catRows.map((c) => c.id));
  const rows = (items ?? []) as {
    id: string;
    title: string;
    category_id: string;
    parent_item_id: string | null;
  }[];
  // Container items (with children) are not assignable; only leaf items are listed.
  const parentIds = new Set(rows.map((i) => i.parent_item_id).filter(Boolean));
  return rows
    .filter((i) => !parentIds.has(i.id))
    .map((i) => ({ id: i.id, title: i.title, category: catTitle.get(i.category_id) ?? "" }));
}

export function mapCategory(title: string): string {
  const t = title.toLowerCase();
  if (t.startsWith("betäubung") || t === "btm") return "BTM";
  if (t.startsWith("medikament")) return "Medikamente";
  if (t.startsWith("fahrzeug")) return "Fahrzeug";
  if (t.startsWith("ausrüstung")) return "Ausrüstung";
  return "Sonstiges";
}

export type { SupabaseClient };
