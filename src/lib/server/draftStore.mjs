// Server side of the in-progress Protokoll draft (public.protocol_drafts). Pure: takes a Supabase
// client (service role) so it can be tested with a mock. Auth and ownership come from
// authorizeSubmit (token, user, team, vehicle and protocol on the caller's team).
//
// NOT APPLIED: the table needs PM OK. While it is missing every call answers
// { ok: false, status: 503, error: "drafts_unavailable" } and logs once, the client keeps
// working on its local queue.

import { DRAFT_MAX_AGE_MS, isExpired, mergeDrafts, normalizeDraft } from "../draftModel.mjs";

const TABLE = "protocol_drafts";
let warned = false;

/** PostgREST answers PGRST205 (404) and Postgres 42P01 when the table does not exist. */
export function isMissingTable(error) {
  if (!error) return false;
  const code = String(error.code ?? "");
  return code === "42P01" || code === "PGRST205" || code === "PGRST204" || error.status === 404 || /does not exist|schema cache/i.test(error.message ?? "");
}

function unavailable(log) {
  if (!warned) {
    warned = true;
    log("protocol_drafts table is missing, Protokoll drafts stay on the devices (migration not applied)");
  }
  return { ok: false, status: 503, error: "drafts_unavailable" };
}

export function resetWarnedForTests() {
  warned = false;
}

export async function getDraft(sb, auth, { vehicleId, protocolId }, { now = Date.now(), log = console.warn } = {}) {
  const { data, error } = await sb
    .from(TABLE)
    .select("data")
    .eq("user_id", auth.userId)
    .eq("vehicle_id", vehicleId)
    .eq("protocol_id", protocolId)
    .maybeSingle();
  if (isMissingTable(error)) return unavailable(log);
  if (error) return { ok: false, status: 500, error: "read_failed" };
  const draft = data ? normalizeDraft(data.data, { vehicleId, protocolId }) : null;
  return { ok: true, draft: draft && !isExpired(draft, now) ? draft : null };
}

export async function putDraft(sb, auth, { vehicleId, protocolId, draft }, { now = Date.now(), log = console.warn } = {}) {
  const incoming = normalizeDraft(draft, { vehicleId, protocolId });
  if (!incoming) return { ok: false, status: 400, error: "bad_request" };
  const cur = await getDraft(sb, auth, { vehicleId, protocolId }, { now, log });
  if (!cur.ok) return cur;
  // merge with what is stored so a stale device cannot overwrite newer fields of another one
  const merged = mergeDrafts(cur.draft, incoming);
  const { error } = await sb.from(TABLE).upsert(
    {
      user_id: auth.userId,
      team_id: auth.teamId,
      vehicle_id: vehicleId,
      protocol_id: protocolId,
      data: merged,
      updated_at: new Date(now).toISOString(),
    },
    { onConflict: "user_id,vehicle_id,protocol_id" },
  );
  if (isMissingTable(error)) return unavailable(log);
  if (error) return { ok: false, status: 500, error: "write_failed" };
  return { ok: true, draft: merged };
}

export async function deleteDraft(sb, auth, { vehicleId, protocolId }, { log = console.warn } = {}) {
  const { error } = await sb
    .from(TABLE)
    .delete()
    .eq("user_id", auth.userId)
    .eq("vehicle_id", vehicleId)
    .eq("protocol_id", protocolId);
  if (isMissingTable(error)) return unavailable(log);
  if (error) return { ok: false, status: 500, error: "delete_failed" };
  return { ok: true };
}

export { DRAFT_MAX_AGE_MS };
