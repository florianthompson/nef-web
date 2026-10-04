-- NOT APPLIED: needs PM OK
-- HAZ-167: in-progress Protokoll saved on the server, one draft per (user, vehicle, protocol).
-- Additive: one new table, no change to existing tables. Until this is applied the app keeps the
-- draft in the per-vehicle local queue (the API route answers 503 drafts_unavailable and logs once).
-- Do not run on prod before the PM OK. Rollback: drop table public.protocol_drafts;

create table if not exists public.protocol_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  protocol_id uuid not null references public.protocols(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  unique (user_id, vehicle_id, protocol_id)
);

alter table public.protocol_drafts enable row level security;

-- own rows only, and only for a vehicle (and team) of the caller's own team
create policy "protocol_drafts select own" on public.protocol_drafts
  for select to authenticated
  using (user_id = auth.uid());

create policy "protocol_drafts insert own" on public.protocol_drafts
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and team_id = (select u.team_id from public.users u where u.id = auth.uid())
    and exists (select 1 from public.vehicles v where v.id = protocol_drafts.vehicle_id and v.team_id = protocol_drafts.team_id)
  );

create policy "protocol_drafts update own" on public.protocol_drafts
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and team_id = (select u.team_id from public.users u where u.id = auth.uid())
    and exists (select 1 from public.vehicles v where v.id = protocol_drafts.vehicle_id and v.team_id = protocol_drafts.team_id)
  );

create policy "protocol_drafts delete own" on public.protocol_drafts
  for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.protocol_drafts from anon, authenticated;
grant select, insert, update, delete on public.protocol_drafts to authenticated;
