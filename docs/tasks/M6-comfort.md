# M6 – Comfort

Goal: quality-of-life features that make the app nicer at the table.

**Why this milestone**

- **Problem:** Once the core loop works, several things still make the app less pleasant or less reliable at the table: no chaos bag, English only, messy maps after many changes, gaps when the network is bad.
- **What the app gains:** An app that is comfortable for German-speaking groups, reliable offline and polished enough to use every week.
- **Why at this point:** None of these blocks playing, so they wait until the core product is complete (M5); each is small and independent.

---

## M6.1 Chaos bag module (S)

**Why:** Many groups prefer the physical bag, but some don't have it at hand, and token values that depend on game state (e.g. the act number) are easy to forget. Off by default because physical draws are part of the fun.

**Benefit:** No bag needed if players want that, and current token values are always shown correctly.

Ref: §8.

- [ ] Optional module (off by default): draw, seal, return; symbol effects with current values (e.g. act number)
- [ ] Bag from campaign log or scenario default

## M6.2 Card and UI languages (S)

**Why:** Groups play with cards in their own language, so the text on screen should match the cards on the table. ArkhamDB offers several languages besides English and German (e.g. French, Spanish, Italian), so the language list should not be hard-coded. Switching mid-game helps mixed-language groups.

**Benefit:** The app is usable for groups in any language ArkhamDB covers, with English as a safe fallback for untranslated cards.

- [ ] Card data for every language ArkhamDB offers (`<lang>.arkhamdb.com`), list of languages in one config; per-card English fallback
- [ ] Complete German UI strings; UI translations as separate files so more languages can be contributed; switch mid-game without reload

## M6.3 Auto-layout (O)

**Why:** Some scenarios add many locations mid-game or have no book layout, and manual placement gets messy.

**Benefit:** A readable map without manual fiddling, while manual positions are still respected.

- [ ] elkjs layout of the connection graph when no book layout exists or after many locations were added
- [ ] Toggle book ↔ auto per map; manual drags stay as overrides

## M6.4 Offline preload (S)

**Why:** Wi-Fi at game tables is often poor, and images load lazily, so a first offline game would show gaps.

**Benefit:** A scenario prepared at home works completely offline.

- [ ] "Prepare scenario offline" downloads all images of the scenario and the selected investigators
- [ ] Offline indicator; text-card fallback when an image is missing

## M6.5 Polish (S)

**Why:** Small things (animations, accessibility, speed) decide whether the app feels good on a mid-range tablet.

**Benefit:** Smoother, more accessible, faster app.

- [ ] Animations for draws and moves (respecting reduced motion)
- [ ] Accessibility pass: labels, contrast, focus order
- [ ] Performance check on a mid-range tablet

## M6.6 ArkhamDB deck import (S) – if decided

**Why:** Groups that build decks on ArkhamDB already have their investigator choice there (open question §15.2).

**Benefit:** Faster game setup for those groups.

- [ ] Paste an ArkhamDB deck link in the wizard to prefill the investigator
