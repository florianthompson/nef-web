import { supabase } from "./supabase";
import { clearDraft, loadDraft, saveDraft } from "./protocolDraft";

export type ProtoItem = {
  id: string;
  title: string;
  is_completed: boolean;
  position: number;
  type: string;
  can_override: boolean;
  is_required: boolean;
  text_value: string;
  show_category_title: boolean;
  expiry_date: string | null;
  subItems: ProtoItem[];
};

export type ProtoCategory = {
  id: string;
  title: string;
  position: number;
  type: string;
  is_required: boolean;
  items: ProtoItem[];
};

export type Protocol = {
  id: string;
  title: string;
  version: number;
  categories: ProtoCategory[];
};

export type Vehicle = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type CheckRow = {
  id: string;
  name: string;
  sub: string | null;
  group: string | null;
  done: boolean;
};

export type CheckSection = {
  id: string;
  title: string;
  noAllOk: boolean;
  rows: CheckRow[];
};

export type Submission = {
  id: string;
  createdAt: string;
  vehicleId: string | null;
  vehicleName: string | null;
  author: string;
  checked: number;
  missing: number;
  total: number;
  unchecked: { category: string; title: string }[];
  sections: CheckSection[];
};

/** One shift. After this, the pinned bar leaves the done state and prompts again. */
export const SHIFT_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * The bar is done only while the latest submission is still inside the shift window.
 * The timestamp comes from the submission row. Nothing in the browser stores this.
 */
export function isCurrentShift(submittedAt: string, now = Date.now()): boolean {
  const at = new Date(submittedAt).getTime();
  if (Number.isNaN(at)) return false;
  return now - at >= 0 && now - at < SHIFT_WINDOW_MS;
}

export function isNarcotics(title: string): boolean {
  return title.toLowerCase().includes("betäubungsmittel") || title.toLowerCase() === "btm";
}

export function visibleCategories(protocol: Protocol): ProtoCategory[] {
  return protocol.categories.filter((c) => c.type !== "text");
}

/** Checkable rows: a parent with children counts its children, otherwise itself. */
export function tally(protocol: Protocol): { checked: number; total: number } {
  let checked = 0;
  let total = 0;
  for (const cat of visibleCategories(protocol)) {
    for (const item of cat.items) {
      if (item.subItems.length) {
        total += item.subItems.length;
        checked += item.subItems.filter((s) => s.is_completed).length;
      } else {
        total += 1;
        if (item.is_completed) checked += 1;
      }
    }
  }
  return { checked, total };
}

export function sectionsFromProtocol(protocol: Protocol): CheckSection[] {
  return visibleCategories(protocol).map((cat) => {
    const rows: CheckRow[] = [];
    for (const item of cat.items) {
      if (item.subItems.length) {
        for (const sub of item.subItems) {
          rows.push({
            id: sub.id,
            name: sub.title,
            sub: null,
            group: item.title,
            done: sub.is_completed,
          });
        }
      } else {
        rows.push({
          id: item.id,
          name: item.title,
          sub: null,
          group: null,
          done: item.is_completed,
        });
      }
    }
    return { id: cat.id, title: cat.title, noAllOk: isNarcotics(cat.title), rows };
  });
}

export function uncheckedOf(protocol: Protocol): { category: string; title: string }[] {
  const out: { category: string; title: string }[] = [];
  for (const sec of sectionsFromProtocol(protocol)) {
    for (const row of sec.rows) {
      if (!row.done) out.push({ category: sec.title, title: row.name });
    }
  }
  return out;
}

function mapItem(row: Record<string, unknown>): ProtoItem {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    is_completed: false,
    position: Number(row.position ?? 0),
    type: String(row.type ?? ""),
    can_override: !!row.can_override,
    is_required: !!row.is_required,
    text_value: String(row.text_value ?? ""),
    show_category_title: row.show_category_title !== false,
    expiry_date: (row.expiry_date as string | null) ?? null,
    subItems: [],
  };
}

export async function loadTeamProtocol(
  teamId: string
): Promise<{ protocol: Protocol | null; vehicles: Vehicle[] }> {
  const [{ data: protocolData }, { data: vehiclesData }] = await Promise.all([
    supabase.from("protocols").select("*").eq("team_id", teamId).limit(1).maybeSingle(),
    supabase.from("vehicles").select("*").eq("team_id", teamId),
  ]);

  const vehicles: Vehicle[] = ((vehiclesData ?? []) as Record<string, unknown>[]).map((v) => ({
    id: String(v.id),
    name: String(v.name ?? ""),
    isDefault: !!v.is_default,
  }));
  vehicles.sort((a, b) => (a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1));

  if (!protocolData) return { protocol: null, vehicles };

  const { data: categoriesData } = await supabase
    .from("categories")
    .select("*")
    .eq("protocol_id", protocolData.id)
    .order("position");

  const catRows = (categoriesData ?? []) as Record<string, unknown>[];
  const catIds = catRows.map((c) => String(c.id));
  const { data: itemsData } = catIds.length
    ? await supabase.from("items").select("*").in("category_id", catIds).order("position")
    : { data: [] };

  const itemRows = (itemsData ?? []) as Record<string, unknown>[];
  const subsByParent = new Map<string, ProtoItem[]>();
  for (const row of itemRows) {
    const parent = row.parent_item_id ? String(row.parent_item_id) : "";
    if (!parent) continue;
    const list = subsByParent.get(parent) ?? [];
    list.push(mapItem(row));
    subsByParent.set(parent, list);
  }

  const categories: ProtoCategory[] = catRows.map((cat) => {
    const items = itemRows
      .filter((row) => String(row.category_id) === String(cat.id) && !row.parent_item_id)
      .map((row) => {
        const item = mapItem(row);
        item.subItems = (subsByParent.get(item.id) ?? [])
          .slice()
          .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
        return item;
      });
    return {
      id: String(cat.id),
      title: String(cat.title ?? ""),
      position: Number(cat.position ?? 0),
      type: String(cat.type ?? ""),
      is_required: !!cat.is_required,
      items,
    };
  });

  return {
    protocol: {
      id: String(protocolData.id),
      title: String(protocolData.title ?? ""),
      version: Number(protocolData.version ?? 1),
      categories,
    },
    vehicles,
  };
}

export function applyDraft(protocol: Protocol, userId: string): { shiftNote: string; vehicleId: string | null } {
  const draft = loadDraft(userId, protocol.id);
  if (!draft) return { shiftNote: "", vehicleId: null };
  const checked = new Set(draft.checkedIds);
  for (const cat of protocol.categories) {
    for (const item of cat.items) {
      item.is_completed = checked.has(item.id);
      for (const sub of item.subItems) sub.is_completed = checked.has(sub.id);
    }
  }
  return { shiftNote: draft.shiftNote, vehicleId: draft.vehicleId };
}

export function collectChecked(protocol: Protocol): string[] {
  const ids: string[] = [];
  for (const cat of protocol.categories) {
    for (const item of cat.items) {
      if (item.is_completed) ids.push(item.id);
      for (const sub of item.subItems) if (sub.is_completed) ids.push(sub.id);
    }
  }
  return ids;
}

export function persistDraft(
  userId: string,
  protocol: Protocol,
  vehicleId: string | null,
  shiftNote: string
): void {
  saveDraft(userId, {
    protocolId: protocol.id,
    vehicleId,
    shiftNote,
    checkedIds: collectChecked(protocol),
  });
}

export function resetChecks(protocol: Protocol): Protocol {
  return {
    ...protocol,
    categories: protocol.categories.map((cat) => ({
      ...cat,
      items: cat.items.map((item) => ({
        ...item,
        is_completed: false,
        subItems: item.subItems.map((sub) => ({ ...sub, is_completed: false })),
      })),
    })),
  };
}

export function toggleLeaf(protocol: Protocol, id: string): Protocol {
  return {
    ...protocol,
    categories: protocol.categories.map((cat) => ({
      ...cat,
      items: cat.items.map((item) => {
        if (item.id === id && item.subItems.length === 0) {
          const on = !item.is_completed;
          return { ...item, is_completed: on };
        }
        if (!item.subItems.some((s) => s.id === id)) return item;
        const subItems = item.subItems.map((sub) =>
          sub.id === id ? { ...sub, is_completed: !sub.is_completed } : sub
        );
        return {
          ...item,
          subItems,
          is_completed: subItems.every((s) => s.is_completed),
        };
      }),
    })),
  };
}

export function markCategoryOk(protocol: Protocol, categoryId: string): Protocol {
  return {
    ...protocol,
    categories: protocol.categories.map((cat) => {
      if (cat.id !== categoryId) return cat;
      return {
        ...cat,
        items: cat.items.map((item) => ({
          ...item,
          is_completed: true,
          subItems: item.subItems.map((sub) => ({ ...sub, is_completed: true })),
        })),
      };
    }),
  };
}

export { clearDraft };

type UpRow = {
  id: string;
  created_at: string;
  vehicle_id: string | null;
  user_id: string;
};

export async function loadMySubmissions(userId: string): Promise<Submission[]> {
  const { data: ups } = await supabase
    .from("user_protocols")
    .select("id, created_at, vehicle_id, user_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  const rows = (ups ?? []) as UpRow[];
  if (!rows.length) return [];

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const vehicleIds = [...new Set(rows.map((r) => r.vehicle_id).filter(Boolean))] as string[];
  const [{ data: users }, { data: vehicles }] = await Promise.all([
    supabase.from("users").select("id, first_name, last_name").in("id", userIds),
    vehicleIds.length
      ? supabase.from("vehicles").select("id, name").in("id", vehicleIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const names = new Map<string, string>();
  for (const u of (users ?? []) as { id: string; first_name: string; last_name: string }[]) {
    const last = (u.last_name ?? "").trim();
    names.set(u.id, last ? `${u.first_name} ${last[0]}.` : u.first_name);
  }
  const vehicleNames = new Map<string, string>();
  for (const v of (vehicles ?? []) as { id: string; name: string }[]) vehicleNames.set(v.id, v.name);

  const upIds = rows.map((r) => r.id);
  const { data: cats } = await supabase
    .from("user_protocol_categories")
    .select("id, user_protocol_id, title, position, type")
    .in("user_protocol_id", upIds)
    .order("position");
  const catRows = (cats ?? []) as {
    id: string;
    user_protocol_id: string;
    title: string;
    position: number;
    type: string;
  }[];
  const catIds = catRows.map((c) => c.id);
  const { data: items } = catIds.length
    ? await supabase
        .from("user_protocol_items")
        .select("id, user_protocol_category_id, title, is_completed, parent_item_id, position")
        .in("user_protocol_category_id", catIds)
        .order("position")
    : { data: [] };
  const itemRows = (items ?? []) as {
    id: string;
    user_protocol_category_id: string;
    title: string;
    is_completed: boolean;
    parent_item_id: string | null;
    position: number;
  }[];

  return rows.map((up) => {
    const myCats = catRows.filter((c) => c.user_protocol_id === up.id && c.type !== "text");
    const sections: CheckSection[] = myCats.map((cat) => {
      const mine = itemRows.filter((i) => i.user_protocol_category_id === cat.id);
      const parentIds = new Set(mine.map((i) => i.parent_item_id).filter(Boolean) as string[]);
      const leaves = mine.filter((i) => i.parent_item_id || !parentIds.has(i.id));
      const titleOf = new Map(mine.map((i) => [i.id, i.title]));
      const rowsOut: CheckRow[] = leaves.map((leaf) => ({
        id: leaf.id,
        name: leaf.title,
        sub: null,
        group: leaf.parent_item_id ? (titleOf.get(leaf.parent_item_id) ?? null) : null,
        done: !!leaf.is_completed,
      }));
      return {
        id: cat.id,
        title: cat.title,
        noAllOk: isNarcotics(cat.title),
        rows: rowsOut,
      };
    });
    const all = sections.flatMap((s) => s.rows);
    const unchecked = sections.flatMap((s) =>
      s.rows.filter((r) => !r.done).map((r) => ({ category: s.title, title: r.name }))
    );
    return {
      id: up.id,
      createdAt: up.created_at,
      vehicleId: up.vehicle_id,
      vehicleName: up.vehicle_id ? (vehicleNames.get(up.vehicle_id) ?? null) : null,
      author: names.get(up.user_id) ?? "",
      checked: all.filter((r) => r.done).length,
      missing: unchecked.length,
      total: all.length,
      unchecked,
      sections,
    };
  });
}
