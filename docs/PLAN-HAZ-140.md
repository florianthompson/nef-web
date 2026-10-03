# HAZ-140: NEF full end-to-end staff user test

Linear: https://linear.app/hazil/issue/HAZ-140 (PRD lives in the issue; this is a stub so any agent can pick up the branch).
Related: HAZ-138 (notes UI from the v19 mock, nef-web #10), HAZ-136 (slow Protokoll page).

## Scope
Use the app in a real browser (Playwright) at 1440 and 390 the way staff do: login and logout, notes create/edit/delete, comments, done/undo, voice composer UI, protocol fill and submit, Bestand, Admin, error and empty states. Log every bug in the issue's bug log table.

## Phases
1. Baseline on prod (current master, before HAZ-138): test accounts, full run, bug log, cleanup.
2. Fix the bugs outside HAZ-138 scope on this branch (cloud agent, tests, ui proof at 1440 and 390). Bugs in screens HAZ-138 rewrites wait for that rebuild.
3. Re-test after fixes and after HAZ-138 lands; PM review per PR; merge to main (pre-approved by Florian 2026-10-03 14:09).

## Rules
No schema changes or migrations without a Supabase prod backup noted in the issue. Test data is clearly marked and cleaned up; only the test accounts stay.
