import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Temporary, token-gated usage-stats endpoint. Not linked anywhere; lives on a
// throwaway branch and is deleted right after the numbers are pulled.
const TOKEN = "28c35f07214c66df2ee8eb9009995f45";

export async function GET(req: NextRequest) {
  if (req.headers.get("x-stats-token") !== TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    return NextResponse.json({
      error: "missing_key",
      hasUrl: !!url,
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasSecretKey: !!process.env.SUPABASE_SECRET_KEY,
    }, { status: 500 });
  }

  const sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Submissions in the last 7 days
  const { data: subs, error: subErr } = await sb
    .from("user_protocols")
    .select("id, created_at, user_id, vehicle_id, protocol_id")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });
  if (subErr) return NextResponse.json({ error: "subs", detail: subErr.message }, { status: 500 });

  const rows = subs ?? [];
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  const vehicleIds = [...new Set(rows.map((r) => r.vehicle_id).filter(Boolean))];
  const protocolIds = [...new Set(rows.map((r) => r.protocol_id).filter(Boolean))];

  const [{ data: users }, { data: vehicles }, { data: protocols }] = await Promise.all([
    userIds.length
      ? sb.from("users").select("id, first_name, last_name, role, team_id").in("id", userIds)
      : Promise.resolve({ data: [] as any[] }),
    vehicleIds.length
      ? sb.from("vehicles").select("id, name").in("id", vehicleIds)
      : Promise.resolve({ data: [] as any[] }),
    protocolIds.length
      ? sb.from("protocols").select("id, name").in("id", protocolIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const uMap = new Map((users ?? []).map((u: any) => [u.id, u]));
  const vMap = new Map((vehicles ?? []).map((v: any) => [v.id, v.name]));
  const pMap = new Map((protocols ?? []).map((p: any) => [p.id, p.name]));

  const name = (id: string) => {
    const u = uMap.get(id);
    return u ? `${u.first_name ?? "?"} ${u.last_name ?? ""}`.trim() : id;
  };

  const tally = (arr: string[]) => {
    const m = new Map<string, number>();
    for (const k of arr) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  const byUser = tally(rows.map((r) => r.user_id)).map(([id, n]) => ({ user: name(id), submissions: n }));
  const byVehicle = tally(rows.map((r) => r.vehicle_id).filter(Boolean))
    .map(([id, n]) => ({ vehicle: vMap.get(id) ?? id, submissions: n }));
  const byProtocol = tally(rows.map((r) => r.protocol_id).filter(Boolean))
    .map(([id, n]) => ({ protocol: pMap.get(id) ?? id, submissions: n }));

  // True sign-ins from Supabase Auth
  let signIns: any[] = [];
  try {
    const { data: authData } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    signIns = (authData?.users ?? [])
      .filter((u) => u.last_sign_in_at && new Date(u.last_sign_in_at) >= new Date(sinceIso))
      .map((u) => ({ email: u.email, last_sign_in_at: u.last_sign_in_at }))
      .sort((a, b) => (a.last_sign_in_at! < b.last_sign_in_at! ? 1 : -1));
  } catch (e) {
    signIns = [{ error: e instanceof Error ? e.message : "auth admin unavailable" }];
  }

  return NextResponse.json({
    window: { since: sinceIso, until: new Date().toISOString() },
    totalSubmissions: rows.length,
    distinctSubmitters: userIds.length,
    signInsLast7d: signIns,
    submissionsByUser: byUser,
    topVehicles: byVehicle,
    topProtocols: byProtocol,
  });
}
