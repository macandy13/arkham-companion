# M0 – Foundation

Goal: an empty but working monorepo with CI, card import, the core data model and storage. No game logic yet.
Do the tasks in order. Each task = one Claude Code session = one PR.

**Why this milestone**

- **Problem:** Every later milestone needs a home for the code, an automatic safety net, real card data and the core data model. None of that is visible to players, but these are the decisions that are most expensive to change later (event log shape, IDs, storage interface).
- **What the app gains:** A deployed, installable app that can create a game and keep it across a refresh; every PR is typechecked, linted and tested automatically; card data and the engine's state model exist and are tested.
- **Why at this point:** It comes first because everything else builds on it; doing it later would mean rewriting code written without these guardrails.

Model hint: **S** = Sonnet is enough, **O** = use Opus (design-heavy).
To start a task from the phone: Code tab → repo `macandy13/arkham-companion` → prompt: `Do task M0.x from docs/tasks/M0-foundation.md`.

---

## M0.1 Monorepo skeleton (S)

**Why:** Splitting the code into packages (engine, card data, scenarios, web app) makes the boundaries from architecture §2 enforced by the dependency graph instead of by discipline – the engine simply cannot import React.

**Benefit:** Shared commands (`test`, `typecheck`, `lint`) give every later task the same fast feedback loop and a known-good starting point.

- [x] pnpm workspaces: `packages/engine`, `packages/carddata`, `packages/scenarios`, `apps/web`
- [x] Shared `tsconfig.base.json` (strict), ESLint + Prettier
- [x] Vitest configured at the root; one trivial test per package
- [x] Root scripts: `test`, `typecheck`, `lint`, `dev`
- [x] `apps/web`: Vite + React 19 + TypeScript, renders "Arkham Companion"
- [x] `.gitignore` incl. `packages/carddata/.cache/`

Done when: `pnpm install && pnpm typecheck && pnpm test && pnpm lint` pass.

Done: pnpm workspace with `@arkham/{engine,carddata,scenarios,web}`, strict `tsconfig.base.json`, flat ESLint config + Prettier, root Vitest config (one test per package), Vite + React 19 app. Packages are consumed from source (`main: src/index.ts`), no build step. Follow-up: M0.2 may set `VITE_BASE=/arkham-companion/` for the Pages build.

## M0.2 CI (S)

**Why:** Tasks are done in Claude Code sessions, often started from a phone; CI is the only reviewer that actually runs the code before a merge.

**Benefit:** Broken PRs show up red before they reach `main`, and every merge is automatically playable at a public URL on the tablet.

- [x] GitHub Actions workflow on push/PR: install (pnpm cache), typecheck, lint, test
- [x] Deploy `apps/web` to GitHub Pages on push to `main` (base path `/arkham-companion/`)

Done when: workflow is green on the PR.

**Done:** `.github/workflows/ci.yml` and `deploy.yml`. Follow-up: enable Pages (source: GitHub Actions) in repo settings.

## M0.3 Card data import (S)

**Why:** Card stats (doom, clues, health, keywords) come from ArkhamDB instead of being typed by hand. Normalising them once into our own `CardDef` shields the rest of the app from ArkhamDB's format quirks.

**Benefit:** One typed card model everywhere, no copyrighted card text in git, and tests that run offline.

Ref: architecture §9.

- [x] `packages/carddata`: fetch `core_2026` from `https://arkhamdb.com/api/public/cards/core_2026.json?encounter=1` (also support `de.arkhamdb.com`)
- [x] Normalise into a `CardDef` type (zod schema) with the fields listed in §9
- [x] Write to `.cache/<lang>/<pack>.json`; script `pnpm carddata:fetch`
- [x] Unit tests use a small hand-written fixture (3–5 fake cards), never real card text
- [x] Helper: list cards by `encounter_code`, expand by `quantity`

Done when: the script runs and tests pass without network.

Done: `packages/carddata` has the `CardDef` zod schema (`schema.ts`, fields mapped from ArkhamDB since §9 lists none explicitly), `fetch.ts` (`pnpm carddata:fetch [--lang en,de] [pack…]`, default `core_2026`, writes `.cache/<lang>/<pack>.json`), and helpers `cardsByEncounterCode` / `expandByQuantity`. Tests use a fake-card fixture and run offline. Follow-up: per-card EN fallback for `de` (M4).

## M0.4 Core domain types + RNG (O)

**Why:** This is the heart of the architecture (§2 principles 2–3): if state only changes through events and all randomness comes from a seeded RNG, then undo, refresh recovery, export, reproducible bug reports and later multi-device sync all fall out of the same mechanism.

**Benefit:** A small, deterministic, property-tested core that every M1 rule module extends instead of reinventing.

Ref: architecture §5, §6.

- [x] Types: `InstanceId`, `Zone`, `CardInstance`, `Investigator`, `Board`, `GameState`, `Decision`, `CampaignLog` (stub)
- [x] `Command` and `Event` as discriminated unions (start with a minimal set: `StartScenario`, `ManualAdjust`, `CardMoved`, `TokensChanged`)
- [x] `apply(state, event)` reducer and `handle(state, command) -> Event[]`
- [x] Seeded PRNG (xoshiro128**) stored in state; `shuffle` helper
- [x] Property tests: replaying events yields identical state; every card is in exactly one zone

Done when: the engine package has no runtime deps besides zod and tests pass.

Done: `packages/engine/src` has branded IDs (`ids.ts`), `Zone` + `zoneKey` (`zone.ts`), the §5 state types (`state.ts`), `Command`/`Event` unions (`commands.ts`, `events.ts`), `apply`/`replay` (`reducer.ts`), `handle` with `CommandRejected` validation (`handle.ts`), xoshiro128** + `shuffle` (`rng.ts`) and `checkInvariants`. Events are self-contained facts (IDs and shuffle results/RNG state are computed in `handle`), so the reducer never validates or draws randomness. Added a `DeckShuffled` event (StartScenario shuffles the encounter deck). `GameState.order` holds every non-empty zone, top first. The engine has no runtime deps (zod not needed yet); fast-check is a dev dep. Follow-ups: moving a host card does not yet move/discard its attachments or enemies at it; `Investigator.locationId` is not validated on card moves. Per-round "turn taken" tracking for investigators belongs with the phase assistant as a separate flag reset each round, not as an `InvestigatorStatus` (review on PR #4).

## M0.5 GameStore on IndexedDB (S)

**Why:** A game at the table must survive a refresh, a sleeping tablet or a crashed tab. localStorage is too small and synchronous; IndexedDB is not. Hiding it behind the `GameStore` interface keeps the cloud backend (M8) a drop-in second implementation.

**Benefit:** Auto-save with no save button, fast restore via snapshot + replay, and no storage code leaking into the UI.

Ref: architecture §10.

- [x] `GameStore` interface in `packages/engine` (types only): `createGame`, `appendEvents`, `loadGame` (snapshot + replay), `listGames`, `saveSnapshot`
- [x] `IndexedDbStore` in `apps/web` with Dexie: tables `campaigns`, `games`, `events`, `snapshots`, `cards`
- [x] `gameId` = UUID, events carry sequence number + timestamp
- [x] Tests with `fake-indexeddb`

Done: `packages/engine/src/store.ts` defines `GameStore` (+ `StoredEvent`, `Snapshot`, `GameSummary`, `STATE_VERSION`); `appendEvents` takes an optional `expectedSeq` for optimistic concurrency. `apps/web/src/storage/IndexedDbStore.ts` implements it with Dexie (tables `campaigns`, `games`, `events` keyed `[gameId+seq]`, `snapshots`, `cards`), stamps `seq`/`timestamp`, auto-snapshots on load when ≥50 events lie past the last snapshot, and ignores snapshots with another `stateVersion`. Extras on the class: `loadEvents`, `putCards`/`getCards`. Follow-ups: state migrations, JSON export/import, `BroadcastChannel` (§10); nothing writes to `campaigns` yet.

## M0.6 Empty app shell (S)

**Why:** Prove the whole chain UI → store → engine → IndexedDB works end to end before building real screens. PWA installability and translatable strings are cheap to set up now and painful to retrofit.

**Benefit:** The app can be installed on the tablet's home screen, games persist across reloads, and every UI string is translatable from day one.

Ref: architecture §11.

- [x] Layout regions: header, map, investigator bar, encounter panel (placeholders)
- [x] Zustand store wrapping engine + `GameStore`; a "New game" button creates a game and survives refresh
- [x] PWA manifest + vite-plugin-pwa
- [x] i18next set up with `en` and `de` UI strings

Done when: open app → New game → refresh → game still listed.

Done: `apps/web/src/App.tsx` renders the placeholder layout (header, games list, map, investigator bar, encounter panel; CSS grid in `app.css`). `state/appStore.ts` is a Zustand store factory around any `GameStore` (`refresh`, `newGame`, `openGame`); `main.tsx` wires it to `IndexedDbStore`. `vite-plugin-pwa` is configured with a manifest and an SVG icon (`public/icon.svg`; PNG icons for installability on some browsers are a follow-up). `i18n/index.ts` sets up i18next with `en`/`de` UI strings (browser language, `en` fallback) and a test that both have identical keys. A store test covers create → "refresh" → still listed. Follow-ups: language switcher (M4), real components per region, no component/E2E test of the button yet (Playwright, §12).

## M0.7 PR screencasts (S)

**Why:** Reviewing a UI change from a diff means imagining the screen; on a phone, opening the preview and clicking through is slow. A recording of the changed flow in the PR description makes the visual check a glance.

**Benefit:** Every PR that touches `apps/web` shows GIFs of the user journeys, recorded from the same E2E specs that guard them, so the screencasts can't drift from what is tested.

Ref: `docs/automation.md` (Screencasts), `docs/coding-guidelines.md` §3.

- [x] Playwright project `screencast`: only `@flow` specs, video on with pointer, click highlights and step captions, `slowMo` 250 ms (`pnpm e2e:screencast`)
- [x] `apps/web/scripts/screencast/`: pick passing videos from the JSON report, convert to GIF at 4 fps, render and splice the PR description section (unit tested)
- [x] `preview.yml`: record when `apps/web` changes, publish next to the preview, update the description after deploy
- [x] PR template markers, rules for flow specs, first `@flow` spec (the smoke flow)

Done: `screencasts.ts` holds the pure parts (`flowVideos`, `gifArgs`, `renderSection`, `replaceSection`), `cli.ts` the ffmpeg/file side. GIFs are 4 fps (one frame per `slowMo` step), 800 px wide, the last frame held 2 s; the smoke flow is ~100 KB. Image URLs carry `?v=<sha>` because GitHub's image proxy caches by URL. Fix: the PWA service worker answered every navigation in its scope with the app shell, so the "Full-quality video" links (and, from the root deployment, the PR previews) opened the app; `src/pwa/appShellNavigation.ts` now limits the fallback to the base path, which is all hash routing needs. Follow-ups: a way to start a flow from a seeded game once the wizard exists (M2.5/M2.8); typecheck `apps/web/e2e/` (not covered by any tsconfig yet).
