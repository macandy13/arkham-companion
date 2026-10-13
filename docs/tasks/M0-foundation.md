# M0 – Foundation

Goal: an empty but working monorepo with CI, card import, the core data model and storage. No game logic yet.
Do the tasks in order. Each task = one Claude Code session = one PR.

Model hint: **S** = Sonnet is enough, **O** = use Opus (design-heavy).
To start a task from the phone: Code tab → repo `macandy13/arkham-companion` → prompt: `Do task M0.x from docs/tasks/M0-foundation.md`.

---

## M0.1 Monorepo skeleton (S)

- [x] pnpm workspaces: `packages/engine`, `packages/carddata`, `packages/scenarios`, `apps/web`
- [x] Shared `tsconfig.base.json` (strict), ESLint + Prettier
- [x] Vitest configured at the root; one trivial test per package
- [x] Root scripts: `test`, `typecheck`, `lint`, `dev`
- [x] `apps/web`: Vite + React 19 + TypeScript, renders "Arkham Companion"
- [x] `.gitignore` incl. `packages/carddata/.cache/`

Done when: `pnpm install && pnpm typecheck && pnpm test && pnpm lint` pass.

Done: pnpm workspace with `@arkham/{engine,carddata,scenarios,web}`, strict `tsconfig.base.json`, flat ESLint config + Prettier, root Vitest config (one test per package), Vite + React 19 app. Packages are consumed from source (`main: src/index.ts`), no build step. Follow-up: M0.2 may set `VITE_BASE=/arkham-companion/` for the Pages build.

## M0.2 CI (S)

- [ ] GitHub Actions workflow on push/PR: install (pnpm cache), typecheck, lint, test
- [ ] Deploy `apps/web` to GitHub Pages on push to `main` (base path `/arkham-companion/`)

Done when: workflow is green on the PR.

## M0.3 Card data import (S)

Ref: architecture §9.

- [ ] `packages/carddata`: fetch `core_2026` from `https://arkhamdb.com/api/public/cards/core_2026.json?encounter=1` (also support `de.arkhamdb.com`)
- [ ] Normalise into a `CardDef` type (zod schema) with the fields listed in §9
- [ ] Write to `.cache/<lang>/<pack>.json`; script `pnpm carddata:fetch`
- [ ] Unit tests use a small hand-written fixture (3–5 fake cards), never real card text
- [ ] Helper: list cards by `encounter_code`, expand by `quantity`

Done when: the script runs and tests pass without network.

## M0.4 Core domain types + RNG (O)

Ref: architecture §5, §6.

- [ ] Types: `InstanceId`, `Zone`, `CardInstance`, `Investigator`, `Board`, `GameState`, `Decision`, `CampaignLog` (stub)
- [ ] `Command` and `Event` as discriminated unions (start with a minimal set: `StartScenario`, `ManualAdjust`, `CardMoved`, `TokensChanged`)
- [ ] `apply(state, event)` reducer and `handle(state, command) -> Event[]`
- [ ] Seeded PRNG (xoshiro128**) stored in state; `shuffle` helper
- [ ] Property tests: replaying events yields identical state; every card is in exactly one zone

Done when: the engine package has no runtime deps besides zod and tests pass.

## M0.5 GameStore on IndexedDB (S)

Ref: architecture §10.

- [ ] `GameStore` interface in `packages/engine` (types only): `createGame`, `appendEvents`, `loadGame` (snapshot + replay), `listGames`, `saveSnapshot`
- [ ] `IndexedDbStore` in `apps/web` with Dexie: tables `campaigns`, `games`, `events`, `snapshots`, `cards`
- [ ] `gameId` = UUID, events carry sequence number + timestamp
- [ ] Tests with `fake-indexeddb`

## M0.6 Empty app shell (S)

Ref: architecture §11.

- [ ] Layout regions: header, map, investigator bar, encounter panel (placeholders)
- [ ] Zustand store wrapping engine + `GameStore`; a "New game" button creates a game and survives refresh
- [ ] PWA manifest + vite-plugin-pwa
- [ ] i18next set up with `en` and `de` UI strings

Done when: open app → New game → refresh → game still listed.
