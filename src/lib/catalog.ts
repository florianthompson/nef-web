import { supabase } from "./supabase";

type Row = Record<string, unknown>;

export type CatalogCategory = Row & { id: string; items: Row[] };
export type TeamCatalog = {
  protocol: Row & { id: string };
  categories: CatalogCategory[];
};

// The checklist structure changes rarely, and the protocol and the note item picker
// both need it. One shared request per team, reused for a short while.
const TTL_MS = 30_000;
const cache = new Map<string, { at: number; promise: Promise<TeamCatalog | null> }>();

async function fetchCatalog(teamId: string): Promise<TeamCatalog | null> {
  const { data, error } = await supabase
    .from("protocols")
    .select("*, categories(*, items(*))")
    .eq("team_id", teamId)
    .order("position", { referencedTable: "categories" })
    .order("position", { referencedTable: "categories.items" })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { categories, ...protocol } = data as Row & { id: string; categories: CatalogCategory[] };
  return { protocol, categories: categories ?? [] };
}

/** Protocol with its categories and all items (sub-items included) in a single request. */
export function loadTeamCatalog(teamId: string): Promise<TeamCatalog | null> {
  const hit = cache.get(teamId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const promise = fetchCatalog(teamId);
  cache.set(teamId, { at: Date.now(), promise });
  promise.catch(() => cache.delete(teamId));
  return promise;
}

export function clearCatalogCache(): void {
  cache.clear();
}
