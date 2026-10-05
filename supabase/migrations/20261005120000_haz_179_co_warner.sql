-- HAZ-179: Add CO-Warner to the NEF Protokoll under Fahrzeug (not Ausrüstung).
-- NOT APPLIED: needs PM OK before running on production.
-- Idempotent: skips if a top-level item titled CO-Warner already exists in that category.

-- Apply (prod, after PM OK):
insert into public.items (
  id,
  category_id,
  title,
  position,
  type,
  parent_item_id,
  can_override,
  is_required,
  text_value,
  show_category_title
)
select
  gen_random_uuid(),
  c.id,
  'CO-Warner',
  coalesce(
    (
      select max(i.position)
      from public.items i
      where i.category_id = c.id
        and i.parent_item_id is null
    ),
    -1
  ) + 1,
  'select',
  null,
  false,
  false,
  '',
  true
from public.categories c
join public.protocols p on p.id = c.protocol_id
where c.title = 'Fahrzeug'
  and p.title = 'NEF Protokoll'
  and not exists (
    select 1
    from public.items i
    where i.category_id = c.id
      and i.title = 'CO-Warner'
      and i.parent_item_id is null
  );

-- Rollback (if needed):
-- delete from public.items
-- where title = 'CO-Warner'
--   and parent_item_id is null
--   and category_id in (
--     select c.id from public.categories c
--     join public.protocols p on p.id = c.protocol_id
--     where c.title = 'Fahrzeug' and p.title = 'NEF Protokoll'
--   );
