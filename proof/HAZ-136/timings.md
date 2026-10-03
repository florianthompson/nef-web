# HAZ-136 timings

Time to a usable protocol page (protocol card visible), staff test account, Playwright Chromium, DPR 2, 5 runs each, median shown. Head f06efb1 (tour removed), preview https://nef-rbsyadrij-florian-thompsons-projects-c1c41a9c.vercel.app.

The session is restored from a Playwright storage state (no password login), so "First load" is a cold context opening /app with a stored session and "Reload" is a page reload. The earlier password login numbers for older builds are kept below for reference.

| Width | Build | First load median (s) | Reload median (s) |
|---|---|---|---|
| 390 | This PR at f06efb1 | 1.79 | 0.95 |
| 1440 | This PR at f06efb1 | 1.95 | 1.34 |

## Raw runs (s)

- 390: first load [1.92, 1.79, 1.42, 1.45, 1.83], reload [0.93, 0.94, 0.99, 0.95, 0.99]
- 1440: first load [1.9, 1.37, 6.49, 1.95, 2.7], reload [3.05, 2.16, 1.22, 1.34, 1.14]

Notes: 1440 shows cold start outliers (6.49 s first load, 3.05 s reload); medians stay under 2 s. At 390 every run is under 2 s.

## Earlier baseline (password login, previous head 2c6c632)

| Width | Build | Login median (s) | Reload median (s) |
|---|---|---|---|
| 390 | Prod (old /app) | 9.42 | 7.97 |
| 390 | PR #10 preview | 2.35 | 1.43 |
| 390 | This PR (2c6c632) | 1.36 | 0.91 |
| 1440 | Prod (old /app) | 9.39 | 8.08 |
| 1440 | PR #10 preview | 2.35 | 1.44 |
| 1440 | This PR (2c6c632) | 1.34 | 0.92 |

## Findings

- Prod: 52 `items` GETs (one per category and per item) in sequence, 66 requests on login, 94 on reload.
- PR #10 already batched that, but still waterfalled (users, profile, protocol, categories, items, submissions with 30 protocols x ~93 items) and fetched users 5x, vehicles 5x, protocols 3x (profile refetched on each auth event).
- No index on items.category_id, parent_item_id, categories.protocol_id, vehicles.team_id. Tables are tiny (95 items, 4 categories), so no schema change was made.
