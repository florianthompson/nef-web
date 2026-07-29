-- Bestand / MHD tracking: one expiry date per medication per vehicle,
-- append-only so the change history (who + when) is preserved.
-- Run in the Supabase SQL editor.

create table if not exists item_expiry_events (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references items(id) on delete cascade,
  vehicle_id      uuid not null references vehicles(id) on delete cascade,
  expiry_date     date not null,
  reason          text,
  changed_by      uuid references users(id) on delete set null,
  changed_by_name text not null,
  changed_at      timestamptz not null default now()
);

create index if not exists item_expiry_events_lookup_idx
  on item_expiry_events (item_id, vehicle_id, changed_at desc);

alter table item_expiry_events enable row level security;

-- A user reads/writes only expiry events for vehicles on their own team.
create policy "team reads expiry" on item_expiry_events for select
  using (vehicle_id in (
    select v.id from vehicles v
    join users u on u.team_id = v.team_id
    where u.id = auth.uid()
  ));

create policy "team writes expiry" on item_expiry_events for insert
  with check (vehicle_id in (
    select v.id from vehicles v
    join users u on u.team_id = v.team_id
    where u.id = auth.uid()
  ));
-- No update/delete policy: corrections are new rows.

-- Seed the 10 existing dates onto Gmund only. Hausham has never submitted a
-- protocol, so its stock is unverified and deliberately starts empty.
insert into item_expiry_events (item_id, vehicle_id, expiry_date, changed_by_name)
select i.id, v.id, i.expiry_date, 'Import'
from items i
cross join vehicles v
where i.expiry_date is not null
  and v.name = 'RK Gmund 76/1';
