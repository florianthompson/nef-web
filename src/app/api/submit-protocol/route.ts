import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      `Missing Supabase config: URL=${url ? "set" : "MISSING"}, KEY=${key ? "set" : "MISSING"}`
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: "public",
    },
    global: {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json();
    const { protocolId, userId, vehicleId, categories, shiftNote, teamId, authorName } = body;

    // 1. Create user_protocol
    const { data: up, error: upErr } = await supabaseAdmin
      .from("user_protocols")
      .insert({ protocol_id: protocolId, user_id: userId, vehicle_id: vehicleId })
      .select("id")
      .single();

    if (upErr || !up) {
      return NextResponse.json({ error: "user_protocols: " + (upErr?.message ?? "no data") }, { status: 500 });
    }

    // 2. Batch insert categories
    const catRows = categories.map((cat: any) => ({
      user_protocol_id: up.id,
      title: cat.title,
      position: cat.position,
      type: cat.type,
      is_required: cat.is_required,
    }));

    const { data: catsData, error: catsErr } = await supabaseAdmin
      .from("user_protocol_categories")
      .insert(catRows)
      .select("id, position");

    if (catsErr || !catsData) {
      return NextResponse.json({ error: "categories: " + (catsErr?.message ?? "no data") }, { status: 500 });
    }

    const catIdMap = new Map(catsData.map((c: any) => [c.position, c.id]));

    // 3. Batch insert all parent items
    const parentRows: any[] = [];
    const parentMeta: { catPos: number; itemIdx: number }[] = [];

    for (const cat of categories) {
      const catId = catIdMap.get(cat.position);
      if (!catId) continue;
      cat.items.forEach((item: any, itemIdx: number) => {
        parentRows.push({
          user_protocol_category_id: catId,
          title: item.title,
          position: item.position,
          type: item.type,
          is_required: item.is_required,
          is_completed: item.is_completed,
        });
        parentMeta.push({ catPos: cat.position, itemIdx });
      });
    }

    const { data: parentData, error: parentErr } = await supabaseAdmin
      .from("user_protocol_items")
      .insert(parentRows)
      .select("id");

    if (parentErr || !parentData) {
      return NextResponse.json({ error: "items: " + (parentErr?.message ?? "no data") }, { status: 500 });
    }

    // 4. Batch insert all sub-items
    const subRows: any[] = [];
    parentData.forEach((parent: any, i: number) => {
      const { catPos, itemIdx } = parentMeta[i];
      const cat = categories.find((c: any) => c.position === catPos);
      if (!cat) return;
      const item = cat.items[itemIdx];
      const catId = catIdMap.get(catPos);
      for (const sub of item.subItems ?? []) {
        subRows.push({
          user_protocol_category_id: catId,
          parent_item_id: parent.id,
          title: sub.title,
          position: sub.position,
          type: sub.type,
          is_required: sub.is_required,
          is_completed: sub.is_completed,
        });
      }
    });

    if (subRows.length > 0) {
      const { error: subErr } = await supabaseAdmin
        .from("user_protocol_items")
        .insert(subRows);

      if (subErr) {
        return NextResponse.json({ error: "sub_items: " + subErr.message }, { status: 500 });
      }
    }

    // 5. Save shift note
    if (shiftNote?.trim()) {
      await supabaseAdmin.from("notes").insert({
        author_name: authorName,
        value: shiftNote.trim(),
        is_resolved: false,
        team_id: teamId,
        vehicle_id: vehicleId,
      });
    }

    return NextResponse.json({ success: true, id: up.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Unknown error" }, { status: 500 });
  }
}
