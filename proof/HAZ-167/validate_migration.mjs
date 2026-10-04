// Validates supabase/migrations/*_protocol_drafts.sql on a throwaway in-process Postgres (pglite,
// real Postgres in WASM, no network, nothing shared) with a minimal stub of auth/users/teams/
// vehicles/protocols, then exercises the RLS policies. Usage: node validate_migration.mjs <pglite dir>
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.argv[2] + "/");
const { PGlite } = await import(require.resolve("@electric-sql/pglite"));
const db = new PGlite();
const A = (n) => `00000000-0000-0000-0000-00000000000${n}`;
const T1 = "00000000-0000-0000-0000-0000000000a1", T2 = "00000000-0000-0000-0000-0000000000a2";
const V1 = "00000000-0000-0000-0000-0000000000b1", V2 = "00000000-0000-0000-0000-0000000000b2";
const P1 = "00000000-0000-0000-0000-0000000000c1";

await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table public.teams(id uuid primary key default gen_random_uuid());
create table public.users(id uuid primary key, team_id uuid references public.teams(id));
create table public.vehicles(id uuid primary key default gen_random_uuid(), team_id uuid references public.teams(id));
create table public.protocols(id uuid primary key default gen_random_uuid(), team_id uuid references public.teams(id));
grant usage on schema public, auth to anon, authenticated;
grant select on public.users, public.vehicles, public.teams, public.protocols to authenticated;
grant execute on function auth.uid() to anon, authenticated;
insert into teams values ('${T1}'),('${T2}');
insert into users values ('${A(1)}','${T1}'),('${A(2)}','${T1}'),('${A(3)}','${T2}');
insert into vehicles values ('${V1}','${T1}'),('${V2}','${T2}');
insert into protocols values ('${P1}','${T1}');
`);
const file = readdirSync("supabase/migrations").find((f) => f.endsWith("_protocol_drafts.sql"));
await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
console.log(`migration ${file} applied on throwaway Postgres: OK`);

let failures = 0;
async function as(role, uid, label, sql, expect) {
  await db.exec(`reset role; set role ${role}; set request.jwt.claim.sub = '${uid ?? ""}';`);
  let out;
  try {
    const r = await db.query(sql);
    out = r.rows?.length ? `rows=${JSON.stringify(r.rows[0])}` : `affected=${r.affectedRows ?? 0}`;
  } catch (e) {
    out = `error: ${e.message}`;
  }
  const ok = expect.test(out);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  ->  ${out}`);
}
const ins = (u, t, v) => `insert into protocol_drafts(user_id,team_id,vehicle_id,protocol_id,data) values ('${u}','${t}','${v}','${P1}','{"v":1}')`;
await as("authenticated", A(1), "u1 inserts own row for own team vehicle", ins(A(1), T1, V1), /affected=1/);
await as("authenticated", A(1), "u1 inserts for a vehicle of another team is blocked", ins(A(1), T1, V2), /row-level security/);
await as("authenticated", A(1), "u1 inserts with another team id is blocked", ins(A(1), T2, V1), /row-level security/);
await as("authenticated", A(1), "u1 inserts a row for u2 is blocked", ins(A(2), T1, V1), /row-level security/);
await as("authenticated", A(1), "duplicate (user, vehicle, protocol) violates unique", ins(A(1), T1, V1), /unique/);
await as("authenticated", A(1), "u1 sees own row", "select count(*)::int as n from protocol_drafts", /"n":1/);
await as("authenticated", A(1), "u1 updates own row", `update protocol_drafts set data='{"v":1,"x":1}'`, /affected=1/);
await as("authenticated", A(2), "u2 (same team) sees no row", "select count(*)::int as n from protocol_drafts", /"n":0/);
await as("authenticated", A(2), "u2 cannot update u1 row", `update protocol_drafts set data='{"hacked":1}'`, /affected=0/);
await as("authenticated", A(2), "u2 cannot delete u1 row", "delete from protocol_drafts", /affected=0/);
await as("authenticated", A(3), "u3 (other team) sees no row", "select count(*)::int as n from protocol_drafts", /"n":0/);
await as("anon", null, "anon has no access", "select count(*) from protocol_drafts", /permission denied/);
await as("authenticated", A(1), "u1 deletes own row", "delete from protocol_drafts", /affected=1/);
await db.exec("reset role");
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exit(failures ? 1 : 0);
