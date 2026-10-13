# M2 – Game management UI

Goal: everything before and around a game – browse investigators, start a new game, resume or delete saved games, export and import.
Ref: architecture §11 "Game management" and "Investigator picker". Builds on the M0.6 app shell; the play screen itself is M3 (here it can be a placeholder that shows the game state as text).

Model hint: **S** = Sonnet, **O** = Opus. Each task = one session = one PR.
Start from the phone: Code tab → repo → `Do task M2.x from docs/tasks/M2-game-management-ui.md`.

Prerequisite: the cloud environment can reach `arkhamdb.com` (see architecture §15, open question 1). Tests never hit the network.

---

## M2.1 Routing and screen skeleton (S)

- [ ] React Router (hash routing for GitHub Pages): `/` home, `/new` wizard, `/game/:id` play (placeholder), `/settings`
- [ ] Shared layout, tablet-first breakpoints, touch targets ≥ 44 px
- [ ] Basic design tokens (colours, spacing, type) in one CSS file; dark theme by default

## M2.2 Investigator catalog data (S)

- [ ] `carddata`: fetch all player cards (`/api/public/cards/`), keep `type_code = investigator`
- [ ] Normalise to `InvestigatorDef` (code, name, subname, faction, health, sanity, skills, pack, cycle, images, `duplicate_of_code`, parallel flag)
- [ ] Deduplicate reprints, group parallel versions with the original
- [ ] App loads the catalog once, caches it in IndexedDB (`cards` table) and refreshes with `If-Modified-Since`
- [ ] Packs list (`/api/public/packs/`) for cycle/pack filters

## M2.3 Investigator picker component (S)

- [ ] Portrait grid (image with text fallback), lazy-loaded images
- [ ] Filters: class chips, cycle/pack, "my collection"; search by name
- [ ] Detail sheet: front/back, health, sanity, skills
- [ ] Seats: select assigns next seat (max 4), drag to reorder, remove; lead investigator marker
- [ ] Component tests with a fixture catalog

## M2.4 Settings: collection and language (S)

- [ ] Settings screen: owned packs (checkbox list by cycle), card/UI language EN/DE, theme
- [ ] Stored in localStorage via a small `settings` module (try/catch, defaults)

## M2.5 New game wizard (S)

- [ ] Steps: mode (campaign/standalone) → scenario + difficulty → investigators (picker) → summary
- [ ] Scenario list from `packages/scenarios` (sandbox only until M4)
- [ ] Confirm: `compileSetup` → `StartScenario` → `GameStore.createGame` → navigate to `/game/:id`
- [ ] Back/forward keeps choices; wizard state survives refresh (sessionStorage)

## M2.6 Home screen (S)

- [ ] List saved games via `GameStore.listGames`: scenario, investigators (portraits), round/phase, last played
- [ ] Actions: resume, rename, duplicate, delete (with confirm)
- [ ] Empty state with "New game"

## M2.7 Resume, export and import (S)

Ref: §10.

- [ ] Resume = `loadGame` (snapshot + replay) → play route
- [ ] Export game (and later campaign) as JSON file: metadata + events + `stateVersion`
- [ ] Import: zod-validate, create a new game id, append events; reject newer `stateVersion` with a clear message
- [ ] Round-trip test: export → import → identical state

## M2.8 E2E pass (S)

- [ ] Playwright: new game with 2 investigators → reload → resume → delete
- [ ] Runs in CI with a fixture catalog (no network)

Done when: on a tablet you can pick investigators, start the sandbox scenario, close the tab and resume it.
