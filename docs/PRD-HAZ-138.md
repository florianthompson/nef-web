# HAZ-138: NEF notes UI from the v19 mock

Part of HAZ-138. Full PRD lives in the Linear issue:
https://linear.app/hazil/issue/HAZ-138/nef-notes-ui-from-v19-mock-protocol-notes-on-one-screen-pinned

## Summary

- Match the v19 mock exactly (`docs/mock/v19/index.v19.html`, reference shots in `docs/mock/v19/shots/`).
- No tabs: protocol and notes on one screen (`/app/notizen` layout from the mock, protocol card on top of the feed).
- Pinned Schichtprotokoll bar. It stays visible at the top in both states. Incomplete matches the mock (progress, Protokoll ausfüllen). Complete stays pinned and shows Bereits abgeschlossen with the submission date, time, and author, plus Neues Protokoll. The done state resets 12 hours after the latest submission (`SHIFT_WINDOW_MS` in `src/lib/protocol.ts`), derived from that timestamp.
- Keep the HAZ-70 data wiring (Supabase). No schema change.
- Risk B: public preview, desktop 1440 and 390 shots next to the mock with the banner on and off, PM review, Florian approves before merge.
