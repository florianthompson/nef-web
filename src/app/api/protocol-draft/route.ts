import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { authorizeSubmit } from "@/lib/server/submitAuth.mjs";
import { deleteDraft, getDraft, putDraft } from "@/lib/server/draftStore.mjs";

// In-progress Protokoll draft per (user, vehicle, protocol). Same bearer token pattern as
// /api/submit-protocol; identity comes from the verified token, never from the request.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing Supabase config");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function handle(req: NextRequest, ids: { vehicleId?: unknown; protocolId?: unknown }, run: (sb: ReturnType<typeof admin>, auth: { userId: string; teamId: string }, ids: { vehicleId: string; protocolId: string }) => Promise<{ ok: boolean; status?: number; error?: string } & Record<string, unknown>>) {
  try {
    const sb = admin();
    const header = req.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    const auth = await authorizeSubmit(sb, token, { protocolId: ids.protocolId, vehicleId: ids.vehicleId });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const out = await run(sb, auth, { vehicleId: ids.vehicleId as string, protocolId: ids.protocolId as string });
    if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status ?? 500 });
    return NextResponse.json(out);
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  return handle(req, { vehicleId: q.get("vehicleId"), protocolId: q.get("protocolId") }, (sb, auth, ids) => getDraft(sb, auth, ids));
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return handle(req, body, (sb, auth, ids) => putDraft(sb, auth, { ...ids, draft: body.draft }));
}

export async function DELETE(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  return handle(req, { vehicleId: q.get("vehicleId"), protocolId: q.get("protocolId") }, (sb, auth, ids) => deleteDraft(sb, auth, ids));
}
