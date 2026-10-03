/**
 * Auth and ownership checks for /api/submit-protocol. Pure: takes a Supabase
 * client (service role) so it can be unit tested with a mock.
 *
 * Returns { ok: true, userId, teamId, firstName } or { ok: false, status, error }.
 * Identity comes only from the verified token and the caller's users row; the
 * request body is never trusted for user or team.
 */
export async function authorizeSubmit(supabase, token, { protocolId, vehicleId }) {
  if (!token) return { ok: false, status: 401, error: "unauthorized" };

  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth?.user) return { ok: false, status: 401, error: "unauthorized" };

  const { data: profile } = await supabase
    .from("users")
    .select("id, team_id, first_name")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile?.team_id) return { ok: false, status: 403, error: "forbidden" };

  if (typeof protocolId !== "string" || typeof vehicleId !== "string") {
    return { ok: false, status: 400, error: "bad_request" };
  }

  const [{ data: protocol }, { data: vehicle }] = await Promise.all([
    supabase.from("protocols").select("team_id").eq("id", protocolId).maybeSingle(),
    supabase.from("vehicles").select("team_id").eq("id", vehicleId).maybeSingle(),
  ]);
  if (protocol?.team_id !== profile.team_id || vehicle?.team_id !== profile.team_id) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  return {
    ok: true,
    userId: profile.id,
    teamId: profile.team_id,
    firstName: profile.first_name,
  };
}
