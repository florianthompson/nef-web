-- Update the Medikamente checklist from the NEF Gmund Medikamentenvergleich
-- (Medikamentensatz, Infusionen, Kinderkoffer, Antidota). Betaeubungsmittel is
-- unchanged (same three items).
--
-- Existing items are renamed IN PLACE (id kept) because item_expiry_events
-- references items(id) ON DELETE CASCADE; only products that no longer exist are
-- deleted, and only if they have no MHD history. Submitted protocols store title
-- copies, so history is unaffected.
-- Prod snapshot at authoring time: 69 sub-items -> 10 deleted, 7 inserted = 66.
-- Run in the Supabase SQL editor.

begin;

do $$
declare
  v_team     uuid;
  v_protocol uuid;
  v_cat      uuid;   -- category "Medikamente" (prod: ef51a54e-3031-427c-bc88-8b92e417839d)
  v_parent   uuid;   -- parent item "Medikamente" (prod: 51af16e3-34cd-4967-af78-e25d2d8906e9)
  r          record;
  n          int;
begin
  select id into v_team from teams where name = 'Notärzte Tegernsee';
  if v_team is null then
    raise exception 'Team "Notärzte Tegernsee" not found';
  end if;

  select id into v_protocol from protocols
   where team_id = v_team and title = 'NEF Protokoll';
  if v_protocol is null then
    raise exception 'Protocol "NEF Protokoll" not found for team';
  end if;

  select id into v_cat from categories
   where protocol_id = v_protocol and title = 'Medikamente';
  if v_cat is null then
    raise exception 'Category "Medikamente" not found';
  end if;

  select id into v_parent from items
   where category_id = v_cat and parent_item_id is null and title = 'Medikamente';
  if v_parent is null then
    raise exception 'Parent item "Medikamente" not found';
  end if;

  -- 1. Rename in place (old title -> new title); each source must exist exactly once
  for r in select * from (values
    ('Aqua ad iniectabilia', 'Aqua ad injectabilia'),
    ('Balancierte Elektrolytlösung (Acetat/Malat)', 'Balancierte Elektrolytlösung'),
    ('Calciumgluconat 10%', 'Calciumgluconat 10 %'),
    ('Calciumgluconat Gel 2,5%', 'Calciumgluconat-Gel 2,5 %'),
    ('4-Dimethylaminophenol', '4-DMAP'),
    ('Epinephrin (Adrenalin) - Ampulle', 'Epinephrin - 1 mg/1 ml'),
    ('Epinephrin (Adrenalin) - Stechampulle', 'Epinephrin - 25 mg/25 ml'),
    ('Gelatinelösung 4%', 'Gelatinelösung 4 %'),
    ('Glucose 5%', 'Glucose 5 %'),
    ('Glucose 40%', 'Glucose 40 %'),
    ('Glycerolnitrat', 'Glyceroltrinitrat'),
    ('Lidocain 2%', 'Lidocain 2 %'),
    ('Lorazepam - Tablette sublingual', 'Lorazepam'),
    ('Magnesiumsulfat 10%', 'Magnesiumsulfat 20 %'),
    ('Midazolam - 15mg / 3ml', 'Midazolam'),
    ('Naloxon - Ampulle', 'Naloxon'),
    ('Natriumchlorid 0,9% - Ampulle', 'NaCl 0,9 % - 10 ml'),
    ('Natriumchlorid 0,9% - Durchstechflasche', 'NaCl 0,9 % - 100 ml'),
    ('Natriumhydrogencarbonat 8,4%', 'Natriumhydrogencarbonat 8,4 %'),
    ('Natriumthiosulfat 10%', 'Natriumthiosulfat 10 %'),
    ('Norepinephrin (Noradrenalin)', 'Noradrenalin'),
    ('Paracetamol', 'Paracetamol - 125 mg Suppositorium'),
    ('Propofol 1%', 'Propofol')
  ) as t(old_title, new_title)
  loop
    select count(*) into n from items
     where parent_item_id = v_parent and title = r.old_title;
    if n <> 1 then
      raise exception 'Rename source "%" found % times (expected 1)', r.old_title, n;
    end if;
    update items set title = r.new_title
     where parent_item_id = v_parent and title = r.old_title;
  end loop;

  -- 2. Delete removed products, guarded by MHD history
  for r in select * from (values
    ('Epinephrin (Adrenalin) - Inhalationslösung'),
    ('Flumazenil'),
    ('Glucose 10%'),
    ('HES 6% (130.000/0,4)'),
    ('Lorazepam - Ampulle'),
    ('Midazolam - 5mg/5ml'),
    ('Naloxon - Nasal'),
    ('Nitrendipin'),
    ('Suxamethonium'),
    ('Thiopental')
  ) as t(title)
  loop
    select count(*) into n from items
     where parent_item_id = v_parent and title = r.title;
    if n <> 1 then
      raise exception 'Delete target "%" found % times (expected 1)', r.title, n;
    end if;
    if exists (
      select 1 from item_expiry_events e
        join items i on i.id = e.item_id
       where i.parent_item_id = v_parent and i.title = r.title
    ) then
      raise exception 'Refusing to delete "%": it has item_expiry_events rows', r.title;
    end if;
    delete from items where parent_item_id = v_parent and title = r.title;
  end loop;

  -- 3. Insert new products (position is set in step 4)
  for r in select * from (values
    ('Captopril'),
    ('Methylthioniniumchlorid'),
    ('Natriumchlorid 10 %'),
    ('Oxymetazolin'),
    ('Paracetamol - 75 mg Suppositorium'),
    ('Paracetamol - 250 mg Suppositorium'),
    ('Xylometazolin')
  ) as t(title)
  loop
    if exists (select 1 from items where parent_item_id = v_parent and title = r.title) then
      raise exception 'Item "%" already exists', r.title;
    end if;
    insert into items
      (category_id, parent_item_id, title, position, type, is_required, can_override, text_value, show_category_title)
    values
      (v_cat, v_parent, r.title, 0, 'select', true, false, '', true);
  end loop;

  -- 4. Final alphabetical positions 0..65
  for r in select * from (values
    ('Acetylsalicylsäure', 0),
    ('Adenosin', 1),
    ('Amiodaron', 2),
    ('Aqua ad injectabilia', 3),
    ('Atropin', 4),
    ('Atropinsulfat', 5),
    ('Balancierte Elektrolytlösung', 6),
    ('Butylscopolamin', 7),
    ('Cafedrin/Theodrenalin', 8),
    ('Calciumgluconat 10 %', 9),
    ('Calciumgluconat-Gel 2,5 %', 10),
    ('Captopril', 11),
    ('Ceftriaxon', 12),
    ('Diazepam', 13),
    ('Dimenhydrinat', 14),
    ('Dimetindenmaleat', 15),
    ('4-DMAP', 16),
    ('Epinephrin - 1 mg/1 ml', 17),
    ('Epinephrin - 25 mg/25 ml', 18),
    ('Esketamin', 19),
    ('Fenoterol', 20),
    ('Furosemid', 21),
    ('Gelatinelösung 4 %', 22),
    ('Glucose 5 %', 23),
    ('Glucose 40 %', 24),
    ('Glyceroltrinitrat', 25),
    ('Haloperidol', 26),
    ('Heparin', 27),
    ('Hydroxocobalamin', 28),
    ('Ipratropiumbromid', 29),
    ('Levetiracetam', 30),
    ('Lidocain 2 %', 31),
    ('Lorazepam', 32),
    ('Magnesiumsulfat 20 %', 33),
    ('Medizinische Kohle', 34),
    ('Metamizol', 35),
    ('Methylthioniniumchlorid', 36),
    ('Metoprolol', 37),
    ('Midazolam', 38),
    ('NaCl 0,9 % - 10 ml', 39),
    ('NaCl 0,9 % - 100 ml', 40),
    ('Naloxon', 41),
    ('Natriumchlorid 10 %', 42),
    ('Natriumhydrogencarbonat 8,4 %', 43),
    ('Natriumthiosulfat 10 %', 44),
    ('Noradrenalin', 45),
    ('Obidoxim', 46),
    ('Ondansetron', 47),
    ('Oxymetazolin', 48),
    ('Oxytocin', 49),
    ('Paracetamol - 75 mg Suppositorium', 50),
    ('Paracetamol - 125 mg Suppositorium', 51),
    ('Paracetamol - 250 mg Suppositorium', 52),
    ('Prednisolon', 53),
    ('Prednison', 54),
    ('Promethazin', 55),
    ('Propofol', 56),
    ('Reproterol', 57),
    ('Rocuronium', 58),
    ('Salbutamol', 59),
    ('Simeticon', 60),
    ('Tenecteplase', 61),
    ('Thiamin', 62),
    ('Tranexamsäure', 63),
    ('Urapidil', 64),
    ('Xylometazolin', 65)
  ) as t(title, pos)
  loop
    update items set position = r.pos
     where parent_item_id = v_parent and title = r.title;
    get diagnostics n = row_count;
    if n <> 1 then
      raise exception 'Position update for "%" affected % rows (expected 1)', r.title, n;
    end if;
  end loop;

  select count(*) into n from items where parent_item_id = v_parent;
  if n <> 66 then
    raise exception 'Expected 66 Medikamente sub-items after update, found %', n;
  end if;
end $$;

commit;

-- Verification (expect 66 rows, positions 0..65, no gaps):
-- select i.position, i.title, i.expiry_date
--   from items i
--   join categories c on c.id = i.category_id
--   join protocols p on p.id = c.protocol_id
--   join teams t on t.id = p.team_id
--  where t.name = 'Notärzte Tegernsee' and c.title = 'Medikamente'
--    and i.parent_item_id is not null
--  order by i.position;
