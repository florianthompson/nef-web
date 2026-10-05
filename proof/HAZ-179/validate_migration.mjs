// Validates the HAZ-179 migration on in-process Postgres (pglite) with a stubbed schema seeded from the HAZ-164 items snapshot.
// Run: node validate_migration.mjs <snapshot.json> <migration.sql>   (needs @electric-sql/pglite)
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const [snapPath, sqlPath] = process.argv.slice(2);
const snap = JSON.parse(readFileSync(snapPath, "utf8"));
const sql = readFileSync(sqlPath, "utf8");
const db = new PGlite();
await db.exec(`
create table public.protocols(id uuid primary key default gen_random_uuid(), title text, team_id int);
create table public.categories(id uuid primary key default gen_random_uuid(), protocol_id uuid references public.protocols(id), title text, position int);
create table public.items(id uuid primary key default gen_random_uuid(), category_id uuid references public.categories(id), title text, position int, type text,
  parent_item_id uuid, can_override boolean, is_required boolean, text_value text, show_category_title boolean);
`);
const pid = (await db.query(`insert into public.protocols(title,team_id) values ('NEF Protokoll',1) returning id`)).rows[0].id;
const cats = {};
for (const c of [...new Set(snap.map((x) => x.cat))]) {
  cats[c] = (await db.query(`insert into public.categories(protocol_id,title,position) values ($1,$2,0) returning id`, [pid, c])).rows[0].id;
}
const ids = {};
for (const x of snap.filter((x) => !x.parent)) {
  ids[x.title] = (await db.query(`insert into public.items(category_id,title,position,type,text_value) values ($1,$2,$3,$4,'') returning id`, [cats[x.cat], x.title, x.position, x.type])).rows[0].id;
}
for (const x of snap.filter((x) => x.parent)) {
  await db.query(`insert into public.items(category_id,title,position,type,parent_item_id,text_value) values ($1,$2,$3,$4,$5,'')`, [cats[x.cat], x.title, x.position, x.type, ids[x.parent]]);
}
const count = async () => (await db.query(`select c.title cat, i.position, i.type, i.parent_item_id, i.can_override, i.is_required, i.show_category_title from public.items i join public.categories c on c.id=i.category_id where i.title='CO-Warner'`)).rows;
const out = [];
const check = (name, ok, extra = "") => { out.push(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  ->  " + extra : ""}`); if (!ok) process.exitCode = 1; };
check("CO-Warner absent before", (await count()).length === 0);
await db.exec(sql);
let r = await count();
check("one row after first run", r.length === 1, JSON.stringify(r));
check("row is in Fahrzeug, not Ausrüstung", r[0]?.cat === "Fahrzeug");
check("position is max top-level + 1 (6 for the snapshot)", r[0]?.position === 6);
check("type select, parent null", r[0]?.type === "select" && r[0]?.parent_item_id === null);
await db.exec(sql);
check("second run is a no-op (idempotent)", (await count()).length === 1);
const rb = sql.split("-- Rollback (if needed):")[1].split("\n").map((l) => l.replace(/^-- ?/, "")).join("\n");
await db.exec(rb);
check("rollback removes it", (await count()).length === 0);
const total = (await db.query(`select count(*)::int n from public.items`)).rows[0].n;
check("other items untouched (95 before)", total === snap.length, `n=${total}`);
console.log(out.join("\n"));
console.log(process.exitCode ? "FAILED" : "ALL PASS");
