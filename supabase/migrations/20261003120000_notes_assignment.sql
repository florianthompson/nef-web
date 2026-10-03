-- HAZ-70: optional assignment metadata for notes (additive, nullable, no backfill, no policy change).
alter table public.notes
  add column if not exists item_id uuid references public.items(id) on delete set null,
  add column if not exists category text,
  add column if not exists due_at timestamptz,
  add column if not exists due_text text,
  add column if not exists author_id uuid references public.users(id) on delete set null,
  add column if not exists source text check (source in ('text','voice','raw'));

create index if not exists notes_team_resolved_created_idx
  on public.notes (team_id, is_resolved, created_at desc);
