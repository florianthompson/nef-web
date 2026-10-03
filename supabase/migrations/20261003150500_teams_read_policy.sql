-- HAZ-140 B12: logged-in users can read their own team (admin Team page shows the team name).
-- Approved by Florian 2026-10-03 14:31. Prod backup taken first (logical export, see HAZ-140 comment).
--
-- Before: RLS on public.teams already had "Users can read own team" (membership via public.users.team_id,
-- same pattern as protocols/vehicles), but the authenticated role had no SELECT grant, so every
-- logged-in read of teams failed. anon already had SELECT plus the open "Anyone can verify team exists"
-- policy (used by signup before login).
--
-- Change:
-- 1. Scope the open "verify team exists" policy to anon only, so granting SELECT to authenticated does not
--    expose other teams to logged-in users. anon behaviour is unchanged.
-- 2. Grant SELECT on teams to authenticated. Logged-in users then see only rows allowed by
--    "Users can read own team".

alter policy "Anyone can verify team exists" on public.teams to anon;

grant select on public.teams to authenticated;
