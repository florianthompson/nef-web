# v19 NEF notes mock (reference for HAZ-138)

- Source: `florianthompson/nef-notes-mock`, branch `haz-67-nef-mock-v19` @ add68bd6ee1793061dfb389b045c17619eb618b8, file `index.v19.html` (md5 63f34d9be61e2ef1d52d1a0383aa5ba6). This is the real v19 (HAZ-66 close sheet colours, HAZ-67 review card, HAZ-68 Offen/Erledigt filter).
- Warning: the `index.v19.html` on that repo's `main` (and the box copy at /tmp/audit/nef-notes-mock) is byte-identical to v18. Do not use it.
- `data.json` is the mock's demo data. The app must use real Supabase data, not this file.
- Open locally: `npx serve docs/mock/v19` then `/index.v19.html`. The mock frames itself at max 390px wide on desktop.
- Shots: `shots/mock-v19-desktop-1440.png` (1440x900), `shots/mock-v19-mobile-390.png` (390x844 @2x), `shots/mock-v19-mobile-390-scrolled.png` (feed scrolled 600px: in the mock the Schichtprotokoll card scrolls away). HAZ-138 keeps that bar pinned in both states. The done state shows Bereits abgeschlossen and resets 12 hours after the latest submission.
