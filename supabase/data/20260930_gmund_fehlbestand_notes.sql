-- One-off data script: open "Fehlt:" / "Entfernen:" notes for RK Gmund 76/1.
--
-- Purpose: record the discrepancies between Soll and Bestand found in the
-- NEF Gmund Medikamentenvergleich (2026-09) as open notes, so they show up in
-- the app for the Gmund vehicle (team 'Notärzte Tegernsee').
-- Source: NEF Gmund Medikamentenvergleich, 2026-09.
--
-- Run once in the Supabase SQL editor. Deliberately NOT in supabase/migrations,
-- so it is not applied automatically. The script is idempotent: a note is
-- skipped if an open, non-deleted note with the same team, vehicle and value
-- already exists.
--
-- Prod ids (for reference only, resolved by name below):
--   team    'Notärzte Tegernsee'  2082d9b9-6e78-47f5-878b-acdc897de1e6
--   vehicle 'RK Gmund 76/1'       18d993db-7117-4a5a-94d8-faffc629b5f3

begin;

do $$
declare
  v_team_id uuid;
  v_vehicle_id uuid;
  v_team_count int;
  v_vehicle_count int;
begin
  select count(*) into v_team_count
  from public.teams
  where name = 'Notärzte Tegernsee';

  select count(*) into v_vehicle_count
  from public.vehicles v
  join public.teams t on t.id = v.team_id
  where t.name = 'Notärzte Tegernsee'
    and v.name = 'RK Gmund 76/1';

  if v_team_count <> 1 then
    raise exception 'Expected exactly one team "Notärzte Tegernsee", found %', v_team_count;
  end if;
  if v_vehicle_count <> 1 then
    raise exception 'Expected exactly one vehicle "RK Gmund 76/1" in team "Notärzte Tegernsee", found %', v_vehicle_count;
  end if;

  select t.id, v.id into v_team_id, v_vehicle_id
  from public.vehicles v
  join public.teams t on t.id = v.team_id
  where t.name = 'Notärzte Tegernsee'
    and v.name = 'RK Gmund 76/1';

  insert into public.notes (team_id, vehicle_id, author_name, value, is_resolved, status)
  select v_team_id, v_vehicle_id, 'Florian Thompson', n.value, false, 'open'
  from (values
    -- group 1: Bestand below Soll (23)
    ('Fehlt: Ceftriaxon 2 g, Soll 1, Bestand 0 (Roter Rucksack)'),
    ('Fehlt: Epinephrin 25 mg/25 ml, Soll 1, Bestand 0 (Roter Rucksack)'),
    ('Fehlt: Fenoterol 25 µg/1 ml, Soll 1, Bestand 0 (Roter Rucksack)'),
    ('Fehlt: Glucose 40 % 4 g/10 ml, Soll 5, Bestand 4 (Roter Rucksack)'),
    ('Fehlt: Haloperidol 5 mg/1 ml, Soll 1, Bestand 0 (Roter Rucksack)'),
    ('Fehlt: Levetiracetam 500 mg/5 ml, Soll 3, Bestand 1 (Roter Rucksack)'),
    ('Fehlt: Lorazepam 1 mg, Soll 2, Bestand 0 (Roter Rucksack)'),
    ('Fehlt: Magnesiumsulfat 20 % 2 g/10 ml, Soll 2, Bestand 1 (Roter Rucksack)'),
    ('Fehlt: Naloxon 0,4 mg/1 ml, Soll 2, Bestand 1 (Roter Rucksack)'),
    ('Fehlt: Noradrenalin 5 mg/5 ml, Soll 2, Bestand 0 (Roter Rucksack)'),
    ('Fehlt: Oxymetazolin 0,05 % Nasenspray, Soll 1, Bestand 0 (Roter Rucksack)'),
    ('Fehlt: Oxytocin 3 IE/1 ml, Soll 3, Bestand 0 (Roter Rucksack)'),
    ('Fehlt: Promethazin 50 mg/2 ml, Soll 1, Bestand 0 (Roter Rucksack)'),
    ('Fehlt: Rocuronium 50 mg/5 ml, Soll 2, Bestand 0 (Roter Rucksack)'),
    ('Fehlt: Salbutamol 1,25 mg/2,5 ml, Soll 2, Bestand 1 (Roter Rucksack)'),
    ('Fehlt: Gelatinelösung 4 % 500 ml, Soll 2, Bestand 0 (Infusionen)'),
    ('Fehlt: Glucose 5 % 250 ml, Soll 1, Bestand 0 (Infusionen)'),
    ('Fehlt: NaCl 0,9 % 100 ml, Soll 2, Bestand 1 (Infusionen)'),
    ('Fehlt: Diazepam 5 mg Rectiole, Soll 2, Bestand 0 (Kinderrucksack)'),
    ('Fehlt: Xylometazolin 0,025 %, Soll 1, Bestand 0 (Kinderrucksack)'),
    ('Fehlt: 4-DMAP 250 mg/5 ml, Soll 1, Bestand 0 (Antidota)'),
    ('Fehlt: Natriumchlorid 10 % 100 ml, Soll 1, Bestand 0 (Antidota)'),
    ('Fehlt: Obidoxim 250 mg/1 ml, Soll 1, Bestand 0 (Antidota)'),
    -- group 2: Soll 0 but in stock (shouldn't be on the vehicle) (4: 3 Entfernen + 1 Umlagern)
    ('Entfernen: Flumazenil 0,5 mg/5 ml, Soll 0, Bestand 1 (Roter Rucksack)'),
    ('Umlagern in Tox-Box: Naloxon nasal 1,8 mg je Gerät, Soll 0 im Roten Rucksack, Bestand 1 (gehört in die Tox-Box)'),
    ('Entfernen: Glucose 10 % 100 ml, Soll 0, Bestand 1 (Infusionen)'),
    ('Entfernen: Paracetamol 500 mg, Soll 0, Bestand 2 (Kinderrucksack)')
  ) as n(value)
  where not exists (
    select 1
    from public.notes e
    where e.team_id = v_team_id
      and e.vehicle_id = v_vehicle_id
      and e.value = n.value
      and e.is_resolved = false
      and e.deleted_at is null
  );
end
$$;

commit;

-- Verification (expected: 27 rows after the first run):
-- select n.created_at, n.value
-- from public.notes n
-- join public.vehicles v on v.id = n.vehicle_id
-- join public.teams t on t.id = n.team_id and t.id = v.team_id
-- where t.name = 'Notärzte Tegernsee'
--   and v.name = 'RK Gmund 76/1'
--   and n.is_resolved = false
--   and n.deleted_at is null
--   and (n.value like 'Fehlt:%' or n.value like 'Entfernen:%' or n.value like 'Umlagern in Tox-Box:%')
-- order by n.value;
