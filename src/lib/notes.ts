import { supabase } from "./supabase";

export const NOTE_CATEGORIES = [
  "Medikamente",
  "BTM",
  "Fahrzeug",
  "Ausrüstung",
  "Sonstiges",
] as const;
export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

export type NoteSource = "text" | "voice" | "raw";

export type Note = {
  id: string;
  team_id: string;
  author_name: string;
  value: string;
  created_at: string;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  vehicle_id: string | null;
  vehicle_name: string | null;
  item_id: string | null;
  category: string | null;
  due_at: string | null;
  due_text: string | null;
  source: NoteSource | null;
};

export type NoteComment = {
  id: string;
  author_name: string;
  value: string;
  created_at: string;
};

export type ItemOption = {
  id: string;
  title: string;
  category: NoteCategory;
  parentTitle: string | null;
};

export type NoteDraft = {
  text: string;
  itemId: string | null;
  category: NoteCategory;
  dueDate: string | null; // YYYY-MM-DD or YYYY-MM-DDTHH:MM (Europe/Berlin wall time)
  dueText: string | null;
};

const BASE_COLUMNS =
  "id, team_id, author_name, value, created_at, is_resolved, resolved_by, resolved_at, vehicle_id";
const EXT_COLUMNS = `${BASE_COLUMNS}, item_id, category, due_at, due_text, source`;

// null = not yet detected in this session
let assignmentSupported: boolean | null = null;

export function isAssignmentSupported(): boolean | null {
  return assignmentSupported;
}

type PgError = { code?: string; message?: string } | null;

function isMissingColumn(error: PgError): boolean {
  if (!error) return false;
  return (
    error.code === "42703" ||
    /column .* does not exist/i.test(error.message ?? "") ||
    /could not find the .* column/i.test(error.message ?? "")
  );
}

type Row = Record<string, unknown>;

function toNote(r: Row, vehicles: Map<string, string>): Note {
  const vehicleId = (r.vehicle_id as string | null) ?? null;
  return {
    id: r.id as string,
    team_id: r.team_id as string,
    author_name: r.author_name as string,
    value: r.value as string,
    created_at: r.created_at as string,
    is_resolved: !!r.is_resolved,
    resolved_by: (r.resolved_by as string | null) ?? null,
    resolved_at: (r.resolved_at as string | null) ?? null,
    vehicle_id: vehicleId,
    vehicle_name: vehicleId ? (vehicles.get(vehicleId) ?? null) : null,
    item_id: (r.item_id as string | null) ?? null,
    category: (r.category as string | null) ?? null,
    due_at: (r.due_at as string | null) ?? null,
    due_text: (r.due_text as string | null) ?? null,
    source: (r.source as NoteSource | null) ?? null,
  };
}

/**
 * Loads the team's notes (not soft-deleted). Detects once per session whether the
 * assignment columns exist; without them it falls back to the base column list.
 */
export async function loadNotes(
  teamId: string
): Promise<{ notes: Note[]; error: string | null }> {
  const run = (cols: string) =>
    supabase
      .from("notes")
      .select(cols)
      .eq("team_id", teamId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

  let res = await run(assignmentSupported === false ? BASE_COLUMNS : EXT_COLUMNS);
  if (res.error && assignmentSupported !== false && isMissingColumn(res.error)) {
    assignmentSupported = false;
    res = await run(BASE_COLUMNS);
  } else if (!res.error && assignmentSupported === null) {
    assignmentSupported = true;
  }
  if (res.error) return { notes: [], error: res.error.message };

  const rows = (res.data ?? []) as unknown as Row[];
  const vehicleIds = [
    ...new Set(rows.map((r) => r.vehicle_id as string | null).filter(Boolean)),
  ] as string[];
  const vehicles = new Map<string, string>();
  if (vehicleIds.length) {
    const { data } = await supabase
      .from("vehicles")
      .select("id, name")
      .in("id", vehicleIds);
    (data ?? []).forEach((v: { id: string; name: string }) =>
      vehicles.set(v.id, v.name)
    );
  }
  return { notes: rows.map((r) => toNote(r, vehicles)), error: null };
}

export async function loadComments(noteId: string): Promise<NoteComment[]> {
  const { data } = await supabase
    .from("note_comments")
    .select("id, author_name, value, created_at")
    .eq("note_id", noteId)
    .order("created_at", { ascending: true });
  return (data ?? []) as NoteComment[];
}

/** Replies for the visible notes, keyed by note id. Empty when the table cannot be read. */
export async function loadCommentsFor(
  noteIds: string[]
): Promise<Record<string, NoteComment[]>> {
  if (!noteIds.length) return {};
  const { data, error } = await supabase
    .from("note_comments")
    .select("id, note_id, author_name, value, created_at")
    .in("note_id", noteIds)
    .order("created_at", { ascending: true });
  if (error || !data) return {};
  const map: Record<string, NoteComment[]> = {};
  for (const row of data as {
    id: string;
    note_id: string;
    author_name: string;
    value: string;
    created_at: string;
  }[]) {
    (map[row.note_id] ??= []).push({
      id: row.id,
      author_name: row.author_name,
      value: row.value,
      created_at: row.created_at,
    });
  }
  return map;
}

export async function addComment(
  noteId: string,
  authorName: string,
  value: string
): Promise<boolean> {
  const { error } = await supabase.from("note_comments").insert({
    note_id: noteId,
    author_name: authorName,
    value: value.trim(),
  });
  return !error;
}

export async function updateNoteValue(id: string, value: string): Promise<boolean> {
  const { error } = await supabase.from("notes").update({ value: value.trim() }).eq("id", id);
  return !error;
}

export async function assignNote(
  id: string,
  itemId: string | null,
  category: string
): Promise<boolean> {
  const { error } = await supabase
    .from("notes")
    .update({ item_id: itemId, category })
    .eq("id", id);
  return !error;
}

function categoryOf(title: string): NoteCategory {
  const t = title.toLowerCase();
  if (t.startsWith("betäubung") || t === "btm") return "BTM";
  if (t.startsWith("medikament")) return "Medikamente";
  if (t.startsWith("fahrzeug")) return "Fahrzeug";
  if (t.startsWith("ausrüstung")) return "Ausrüstung";
  return "Sonstiges";
}

/** The team's items (sub-items such as single medications included), for picker and display. */
export async function loadItemOptions(teamId: string): Promise<ItemOption[]> {
  const { data: protocols } = await supabase
    .from("protocols")
    .select("id")
    .eq("team_id", teamId);
  const protocolIds = (protocols ?? []).map((p: { id: string }) => p.id);
  if (!protocolIds.length) return [];
  const { data: cats } = await supabase
    .from("categories")
    .select("id, title, position")
    .in("protocol_id", protocolIds)
    .order("position");
  const catRows = (cats ?? []) as { id: string; title: string }[];
  if (!catRows.length) return [];
  const catById = new Map(catRows.map((c) => [c.id, c.title]));
  const { data: items } = await supabase
    .from("items")
    .select("id, title, category_id, parent_item_id, position")
    .in("category_id", catRows.map((c) => c.id))
    .order("position");
  const itemRows = (items ?? []) as {
    id: string;
    title: string;
    category_id: string;
    parent_item_id: string | null;
  }[];
  const titleById = new Map(itemRows.map((i) => [i.id, i.title]));
  // Container items (with children) are not selectable; their children are the leaf rows.
  const parentIds = new Set(itemRows.map((i) => i.parent_item_id).filter(Boolean));
  return itemRows
    .filter((i) => !parentIds.has(i.id))
    .map((i) => {
      const parent = i.parent_item_id ? (titleById.get(i.parent_item_id) ?? null) : null;
      const cat = catById.get(i.category_id) ?? "";
      return {
        id: i.id,
        title: i.title,
        category: categoryOf(cat),
        // Subtitle only when it adds information (parent differs from the category title).
        parentTitle:
          parent && parent.trim().toLowerCase() !== cat.trim().toLowerCase() ? parent : null,
      };
    });
}

/** 'YYYY-MM-DD[THH:MM]' (Berlin wall time as typed on the device) -> ISO timestamp. */
export function dueToIso(due: string): string | null {
  const d = new Date(due.length === 10 ? `${due}T00:00` : due);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export type InsertContext = {
  teamId: string;
  userId: string;
  authorName: string;
  vehicleId?: string | null;
  source: NoteSource;
};

/**
 * Inserts notes. Without assignment support (or for drafts without assignment) only
 * `value` is stored, i.e. plain text.
 */
export async function insertNotes(
  ctx: InsertContext,
  drafts: NoteDraft[]
): Promise<{ ok: boolean; error: string | null }> {
  const base = (d: NoteDraft) => ({
    team_id: ctx.teamId,
    author_name: ctx.authorName,
    value: d.text.trim(),
    is_resolved: false,
    status: "open",
    ...(ctx.vehicleId ? { vehicle_id: ctx.vehicleId } : {}),
  });
  const ext = (d: NoteDraft) => ({
    ...base(d),
    item_id: d.itemId,
    category: d.category,
    due_at: d.dueDate ? dueToIso(d.dueDate) : null,
    due_text: d.dueDate ? d.dueText : null,
    author_id: ctx.userId,
    source: ctx.source,
  });

  if (assignmentSupported) {
    const { error } = await supabase.from("notes").insert(drafts.map(ext));
    if (!error) return { ok: true, error: null };
    if (!isMissingColumn(error)) return { ok: false, error: error.message };
    assignmentSupported = false;
  }
  const { error } = await supabase.from("notes").insert(drafts.map(base));
  return error ? { ok: false, error: error.message } : { ok: true, error: null };
}

export async function resolveNote(
  id: string,
  resolvedBy: string
): Promise<boolean> {
  const { error } = await supabase
    .from("notes")
    .update({
      is_resolved: true,
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id);
  return !error;
}

export async function reopenNote(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("notes")
    .update({ is_resolved: false, resolved_by: null, resolved_at: null })
    .eq("id", id);
  return !error;
}
