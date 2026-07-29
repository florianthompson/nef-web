-- The table created in 20260723120000 did not inherit the default public-schema
-- role grants, so PostgREST roles get "permission denied" (42501) even with RLS
-- policies in place. Grant the table privileges explicitly. RLS still applies on
-- top of these grants; authenticated only needs select + insert (no update/delete
-- policy exists — corrections are new rows).
grant select, insert on public.item_expiry_events to authenticated;
grant all on public.item_expiry_events to service_role;
