# HAZ-70: port notes mock UI/UX into nef-web

Source of truth for the UI: florianthompson/nef-notes-mock (v18 + v19, live at https://nef-notes-mock.vercel.app).

## Scope
- Notes feed (team, open work only) with category chips and an **Offen | Erledigt** segmented control; completing a note shows an "Erledigt · Rückgängig" toast (~5 s) before it leaves Offen. Erledigt is sorted by completion date and shows "Erledigt von X · Datum"; the detail view can reopen.
- Composer with voice: record -> server-side STT (`gpt-4o-mini-transcribe`, German, NEF term prompt) -> text in field (editable) -> send -> server-side parse (`gpt-6-luna`, fallback `gpt-4.1-nano`) -> review card: message on top, extracted notes with category · item chip and date chip, inline edit, picker, per-note remove (2+ notes), primary "Senden", secondary "Ohne Zuordnung senden".
- Offline/slow/API error: verbatim save, device text fallback.
- "Protokoll abschließen?" sheet: green "n/93 abgehakt", orange "n fehlt", neutral "n offene Notizen".

## Data
- Uses the existing `notes` table (team_id, vehicle_id, author_name, value, status, is_resolved, resolved_by, resolved_at, deleted_*) and `items`/`categories` for the item picker. Real data only, no seed data.
- Item / category / due-date assignment needs new nullable columns on `notes` (additive migration in `supabase/migrations/`). It is validated off-prod first and applied to prod only after Florian approves. Until then the UI degrades gracefully (assignment shown in the review card, saved notes stay plain text).

## Security
- `OPENAI_API_KEY` server-side only (Next.js route handlers `/api/notes/transcribe`, `/api/notes/parse`), auth-checked with the user's Supabase JWT; bundle grep proves the key is absent from `.next/static`.

## Overlap
- PR #4 (header avatar) is merged and this branch is based on it.
- Branch `nef-hide-mhd` (unmerged) also edits `src/app/app/page.tsx` and `src/lib/featureFlags.ts`; this port keeps changes to `page.tsx` minimal (notes moved into components) to limit conflicts.
