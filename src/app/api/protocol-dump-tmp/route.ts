import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Temporary, token-gated read-only protocol dump. Throwaway; deleted after use.
const TOKEN = "28c35f07214c66df2ee8eb9009995f45";

export async function GET(req: NextRequest) {
  if (req.headers.get("x-stats-token") !== TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "missing_key" }, { status: 500 });
  }

  const sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // All protocols (usually one per team)
  const { data: protocols, error: pErr } = await sb
    .from("protocols")
    .select("id, title, version, team_id");
  if (pErr) return NextResponse.json({ error: "protocols", detail: pErr.message }, { status: 500 });

  const out: any[] = [];
  for (const p of protocols ?? []) {
    const { data: cats } = await sb
      .from("categories")
      .select("id, title, position, type")
      .eq("protocol_id", p.id)
      .order("position");

    const categories: any[] = [];
    for (const c of cats ?? []) {
      const { data: items } = await sb
        .from("items")
        .select("id, title, position, type, parent_item_id")
        .eq("category_id", c.id)
        .order("position");
      categories.push({
        category: c.title,
        type: c.type,
        position: c.position,
        items: (items ?? []).map((i: any) => ({
          title: i.title,
          position: i.position,
          type: i.type,
          isSub: !!i.parent_item_id,
        })),
      });
    }
    out.push({ protocol: p.title, version: p.version, protocolId: p.id, teamId: p.team_id, categories });
  }

  return NextResponse.json({ protocolCount: out.length, protocols: out });
}
