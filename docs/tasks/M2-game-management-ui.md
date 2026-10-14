# M2 – Game management UI

Goal: everything before and around a game – browse investigators, start a new game, resume or delete saved games, export and import.
Ref: architecture §11 "Game management" and "Investigator picker". Builds on the M0.6 app shell; the play screen itself is M3 (here it can be a placeholder that shows the game state as text).

**Why this milestone**

- **Problem:** Before anyone can play, they need to choose investigators, start a game and find it again later. This is also the first place real ArkhamDB data (the investigator catalog) appears in the app.
- **What the app gains:** The full lifecycle around a game works on a tablet: pick investigators, start, leave, resume, back up and restore.
- **Why at this point:** It only needs the M1 setup (`compileSetup`), not the full play screen. Doing it before M3 means real persisted games exist to build and test the play screen against.

Model hint: **S** = Sonnet, **O** = Opus. Each task = one session = one PR.
Start from the phone: Code tab → repo → `Do task M2.x from docs/tasks/M2-game-management-ui.md`.

Prerequisite: the cloud environment can reach `arkhamdb.com` (see architecture §15, open question 1). Tests never hit the network.

---

## M2.1 Routing and screen skeleton (S)

**Why:** Hash routing works on static GitHub Pages without server rewrites. Design tokens set early keep all later screens visually consistent.

**Benefit:** Browser back and deep links work; every screen shares one look and tablet-friendly touch sizes.

- [x] React Router (hash routing for GitHub Pages): `/` home, `/new` wizard, `/game/:id` play (placeholder), `/settings`
- [x] Shared layout, tablet-first breakpoints, touch targets ≥ 44 px
- [x] Basic design tokens (colours, spacing, type) in one CSS file; dark theme by default

**Done:** `react-router` `HashRouter` with routes `/`, `/new`, `/game/:id`, `/settings` in `apps/web/src/App.tsx` (`AppRoutes` is testable with a `MemoryRouter`); screens live in `apps/web/src/screens/`. Shared layout has a header with navigation; design tokens (dark, spacing scale, `--touch-target` 2.75rem) in `styles/tokens.css`, element defaults in `styles/base.css`. `/new` is a placeholder that can only create an empty game (replaced by the wizard in M2.7); the old `games` sidebar moved to the home screen. E2E smoke test updated for the new routes.
Follow-ups: the manifest colours in `vite.config.ts` are still raw values (could move to tokens); breakpoints below tablet width are not designed yet (the board grid is tablet landscape only).

## M2.2 Investigator catalog data (S)

**Why:** The picker needs every investigator across all products, without reprint duplicates, and it must work offline. Some investigators exist in two versions – the original Chapter One card and a revised Chapter Two card with different stats or abilities. These are different investigators for play and must both be listed, clearly marked.

**Benefit:** Players choose from the real investigator list; after the first load it works without network.

- [x] `carddata`: fetch all player cards (`/api/public/cards/`), keep `type_code = investigator`
- [x] Normalise to `InvestigatorDef` (code, name, subname, faction, health, sanity, skills, pack, cycle, images, `duplicate_of_code`, parallel flag, `chapter: 1 | 2` derived from the pack/cycle)
- [x] Deduplicate only true reprints (same card, same chapter); keep Chapter One and Chapter Two versions as separate entries, linked to each other; group parallel versions with the original
- [x] App loads the catalog once, caches it in IndexedDB (`cards` table) and refreshes with `If-Modified-Since`
- [x] Packs list (`/api/public/packs/`) for cycle/pack filters

**Done:** `packages/carddata` gets `packs.ts` (`PackDef`, `normalisePacks`, chapter from `CHAPTER_TWO_PACK_CODES`), `investigators.ts` (`InvestigatorDef`, `buildInvestigatorCatalog`: drops reprints only within the same chapter, links Chapter One/Two versions via `otherChapterCode` by name+subname, parallels stay separate with `parallelOfCode`) and `catalog.ts` (`fetchCatalog` with injectable fetch, `If-Modified-Since`). The app side is `apps/web/src/catalog/loadCatalog.ts`, caching in a new Dexie `catalog` table (schema v2) via `IndexedDbStore.putCatalog/getCatalog`; offline falls back to the cache.
Follow-ups: `CHAPTER_TWO_PACK_CODES` only lists `core_2026` – verify against real ArkhamDB pack codes once more Chapter Two packs exist; the cycle filter uses `cyclePosition` (no cycle names in the packs API); image URLs stay relative (prefix the ArkhamDB host in the picker, M2.3); the catalog is stored in its own table rather than `cards` because it is one derived document with its own `Last-Modified`; wire `loadCatalog` into the app when M2.3 needs it; the German catalog uses `de.arkhamdb.com` without per-card English fallback yet.

## M2.3 Investigator picker component (S)

**Why:** Choosing investigators and their seat order is the first interaction of every game, and seat order matters (encounter draw order, lead investigator).

**Benefit:** Fast, visual team setup, similar to the Mansions of Madness app.

- [x] Portrait grid (image with text fallback), lazy-loaded images
- [x] Filters: class chips, cycle/pack, chapter (1/2), "my collection"; search by name
- [x] Chapter badge ("Ch. 1" / "Ch. 2") on every portrait and in the detail sheet; the detail sheet links to the other chapter's version
- [x] Detail sheet: front/back, health, sanity, skills
- [x] Seats: select assigns next seat (max 4), drag to reorder, remove; lead investigator marker
- [x] Component tests with a fixture catalog

Done: `apps/web/src/picker/` holds the controlled `InvestigatorPicker` (props: `catalog`, `seats` as investigator codes, `onSeatsChange`, optional `ownedPacks`, `maxSeats`, `imageHost`), its filter bar, detail sheet and seat list, the pure filter/reorder helpers in `pickerLogic.ts`, `picker.css` and tests with a hand-written fixture catalog. Seats can be reordered by drag and drop and by move up/down buttons; the first seat is marked as lead investigator.
Follow-ups: the picker is not mounted anywhere yet and `loadCatalog` is still unwired (M2.7 wizard); pass the owned packs from settings as `ownedPacks` (M2.4) – without them the "my collection" checkbox is hidden; the detail sheet shows no ability text (it is not in `InvestigatorDef`); drag and drop is mouse-only (HTML5 drag events do not fire on touch), so touch users rely on the move buttons until a pointer-based drag is added; the image host is a prop defaulting to `https://arkhamdb.com`; the cycle filter shows "Cycle N" because the packs API has no cycle names.

## M2.4 Settings: collection and language (S)

**Why:** Filtering by owned packs avoids scrolling through hundreds of investigators. These are per-device preferences, so localStorage is enough (§10).

**Benefit:** A picker tailored to the group's collection, and a language choice that persists.

- [x] Settings screen: owned packs (checkbox list by cycle), card language (any language ArkhamDB offers), UI language (EN/DE first), theme
- [x] Stored in localStorage via a small `settings` module (try/catch, defaults)

Done: `apps/web/src/settings/` holds the `settings` module (`loadSettings`/`saveSettings` over localStorage with per-field defaults, try/catch for throwing storage and corrupt JSON) and `applySettings` (theme via `data-theme`, UI language via i18next); `main.tsx` applies them at boot. `SettingsScreen` offers owned packs grouped by cycle (from a `packs` prop), card language (all ArkhamDB languages), UI language (EN/DE) and theme (dark default, light via token overrides in `tokens.css`), saved on every change.
Follow-ups: `SettingsScreen` gets no `packs` yet (shows a hint) because `loadCatalog` is still unwired – pass `catalog.packs` and `settings.ownedPacks` into the picker (M2.7); `loadCatalog` only knows the `en`/`de` hosts, so the card language is stored but not yet used for fetching; the cycle groups show "Cycle N" (no cycle names in the packs API); new UI languages need translation strings and an entry in `UI_LANGUAGES`.

## M2.5 New game wizard (S)

**Why:** A guided path from "nothing" to "board is set up" replaces most of the physical setup work. Starting a campaign and playing a single scenario are different intents, so they are two separate entry points rather than a mode step.

**Benefit:** A game is set up in about a minute, and an accidental refresh does not lose the wizard's choices.

- [ ] Two entry points on the home screen:
  - **New campaign:** campaign + difficulty → investigators (picker) → summary; starts the campaign's first scenario (campaign log itself arrives in M5)
  - **Quick game:** any single scenario + difficulty → investigators → summary; standalone chaos bag, no campaign log
- [ ] Scenario list from `packages/scenarios` (sandbox only until M4)
- [ ] Confirm: `compileSetup` → `StartScenario` → `GameStore.createGame` → navigate to `/game/:id`
- [ ] Back/forward keeps choices; wizard state survives refresh (sessionStorage)

## M2.6 Home screen (S)

**Why:** Groups often run several games or campaigns at once and need to find the right one.

**Benefit:** Pick up exactly where you left off; keep the list tidy.

- [ ] List saved games via `GameStore.listGames`: scenario, investigators (portraits), round/phase, last played
- [ ] Actions: resume, rename, duplicate, delete (with confirm)
- [ ] Empty state with "New campaign" and "Quick game"

## M2.7 Resume, export and import (S)

**Why:** Browser storage can be wiped, and until M8 there is no cloud copy. An exported game is also a perfect bug report: replaying its events reproduces the problem exactly.

**Benefit:** Backups, moving a game between devices before M8, and reproducible bug reports.

Ref: §10.

- [ ] Resume = `loadGame` (snapshot + replay) → play route
- [ ] Export game (and later campaign) as JSON file: metadata + events + `stateVersion`
- [ ] Import: zod-validate, create a new game id, append events; reject newer `stateVersion` with a clear message
- [ ] Round-trip test: export → import → identical state

## M2.8 E2E pass (S)

**Why:** Unit tests do not catch broken wiring between screens, router and storage.

**Benefit:** CI protects the core game lifecycle against regressions.

- [ ] Playwright: new game with 2 investigators → reload → resume → delete
- [ ] Runs in CI with a fixture catalog (no network)

Done when: on a tablet you can pick investigators, start the sandbox scenario, close the tab and resume it.
