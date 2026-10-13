# M6 – Comfort

Goal: quality-of-life features that make the app nicer at the table.

Model hint: **S** = Sonnet, **O** = Opus. Each task = one session = one PR.
Start from the phone: Code tab → repo → `Do task M6.x from docs/tasks/M6-comfort.md`.

---

## M6.1 Chaos bag module (S)

Ref: §12.
- [ ] Optional module (off by default): draw, seal, return; symbol effects with current values (e.g. act number)
- [ ] Bag from campaign log or scenario default

## M6.2 Language switch EN/DE (S)

- [ ] German card data from `de.arkhamdb.com` with per-card English fallback
- [ ] Complete German UI strings; switch mid-game without reload

## M6.3 Auto-layout (O)

- [ ] elkjs layout of the connection graph when no book layout exists or after many locations were added
- [ ] Toggle book ↔ auto per map; manual drags stay as overrides

## M6.4 Offline preload (S)

- [ ] "Prepare scenario offline" downloads all images of the scenario and the selected investigators
- [ ] Offline indicator; text-card fallback when an image is missing

## M6.5 Polish (S)

- [ ] Animations for draws and moves (respecting reduced motion)
- [ ] Accessibility pass: labels, contrast, focus order
- [ ] Performance check on a mid-range tablet

## M6.6 ArkhamDB deck import (S) – if decided

- [ ] Paste an ArkhamDB deck link in the wizard to prefill the investigator
