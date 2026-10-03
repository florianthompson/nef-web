# HAZ-136 timings

Time to a usable protocol page (checklist entry card / checklist loaded), staff test account, Playwright Chromium, DPR 2, 5 runs each, median shown. Login = click Anmelden until usable. Reload = page reload until usable. Requests = Supabase requests in the window (median).

| Width | Build | Login median (s) | Reload median (s) | Login req | Reload req |
|---|---|---|---|---|---|
| 390 | Prod (old /app) | 9.42 | 7.97 | 66 | 96 |
| 390 | PR #10 preview | 2.35 | 1.43 | 29 | 36 |
| 390 | This PR | 1.36 | 0.91 | 11 | 10 |
| 1440 | Prod (old /app) | 9.39 | 8.08 | 66 | 94 |
| 1440 | PR #10 preview | 2.35 | 1.44 | 29 | 36 |
| 1440 | This PR | 1.34 | 0.92 | 11 | 10 |

## Raw runs (s)

- 390 Prod (old /app): login [17.99, 9.42, 9.38, 9.02, 10.4], reload [8.99, 7.97, 8.03, 7.94, 7.94]
- 390 PR #10 preview: login [2.41, 2.34, 2.35, 2.85, 2.35], reload [1.65, 1.39, 1.91, 1.41, 1.43]
- 390 This PR: login [3.37, 1.84, 1.36, 1.34, 1.35], reload [1.08, 0.89, 0.89, 1.38, 0.91]
- 1440 Prod (old /app): login [9.98, 8.87, 9.38, 9.39, 44.81], reload [7.99, 7.97, 8.12, 8.08, 8.5]
- 1440 PR #10 preview: login [2.36, 2.35, 2.35, 2.34, 2.34], reload [1.44, 1.61, 1.42, 1.92, 1.43]
- 1440 This PR: login [1.37, 1.34, 1.35, 1.34, 1.34], reload [0.93, 0.94, 0.91, 0.91, 0.92]

Notes: the first run per session hits cold Vercel/Supabase (3.4 s once at 390, 5.4 s once at 1440 after). Prod used the old page ("Fahrzeug-Übergabecheck" visible); the preview builds use the v19 screen (protocol card visible).

## Findings

- Prod: 52 `items` GETs (one per category and per item) in sequence, 66 requests on login, 94 on reload.
- PR #10 already batched that, but still waterfalled (users, profile, protocol, categories, items, submissions with 30 protocols x ~93 items) and fetched users 5x, vehicles 5x, protocols 3x (profile refetched on each auth event).
- No index on items.category_id, parent_item_id, categories.protocol_id, vehicles.team_id. Tables are tiny (95 items, 4 categories), so no schema change was made.
