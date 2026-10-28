# Arkham Companion – Architecture

How the app is built today: the key pieces, their boundaries and the ideas behind them.
This page is the overview; each component has its own page in [`architecture/`](architecture/), linked below.
Requirements and plans are in [product.md](product.md).
Details live in the code's doc comments; these pages point at them.

**Keeping it current:**

- A PR that adds or changes a component updates that component's page, briefly: a new concept, boundary or extension point, not every new field or case.
- This overview changes only for a new package, dependency direction or key design decision, or when a component page is added.
- One page per component keeps parallel PRs out of each other's way; when a page grows long, split it by part (as the play screen is).
- Keep paragraphs short and enumerations as lists, one item per line ([coding guidelines](coding-guidelines.md) §8).
- Refer to components by name (architecture "Triggers and card effects").
- Link files, not lines.

## Overview

An offline PWA with no backend.
Players keep their own decks, skill tests and chaos bag; the app runs the scenario side: encounter deck, doom, agenda and act, the map, enemies and forced effects.

```mermaid
flowchart LR
  WEB["apps/web<br/>React screens, Zustand store"]
  SCN["@arkham/scenarios<br/>scenario definitions + card data"]
  ENG["@arkham/engine<br/>pure rules engine"]
  CD["@arkham/carddata<br/>ArkhamDB fetch + normalise"]
  UTIL["@arkham/util<br/>generic helpers"]
  IDB[("IndexedDB<br/>via Dexie")]
  ADB["ArkhamDB API"]
  WEB --> SCN --> ENG --> UTIL
  WEB --> ENG
  WEB --> UTIL
  WEB --> CD
  WEB --> IDB
  CD --> ADB
```

Arrows are package dependencies; [ESLint](../eslint.config.js) enforces the important ones.
The engine depends only on `@arkham/util`: no React, storage, network, clock or `Math.random`.
Only [`IndexedDbStore`](../apps/web/src/storage/IndexedDbStore.ts) imports Dexie.
[`packages/review_digest`](../packages/review_digest/src/) is CI tooling.

- [`packages/engine`](../packages/engine/src/): game state, commands, events, reducer, generic rules, the `GameStore` interface, and the test tools (`GameBuilder`, `PlayTable`, `BoardView`).
- [`packages/scenarios`](../packages/scenarios/src/): scenario and campaign definitions; special rules are card abilities.
- [`packages/carddata`](../packages/carddata/src/): ArkhamDB fetch, validation, normalisation; the investigator catalog.
- [`packages/util`](../packages/util/src/): generic string, array and object helpers.
- [`apps/web`](../apps/web/src/): the React PWA, its app store and the IndexedDB store.

### How one player action flows

1. A component calls an action on the app store's [`GameActions`](../apps/web/src/state/gameActions.ts) (`actions.moveTo(hallway)`).
2. The [`GameSession`](../apps/web/src/state/gameSession.ts) plays it as one step on its `PlayTable`, which sends `Command`s through [`execute`](../packages/engine/src/execute.ts).
3. [`handle`](../packages/engine/src/handle.ts) checks each command and returns every `Event` it causes, forced effects included, or throws `CommandRejected`.
4. [`replay`](../packages/engine/src/reducer.ts) folds the events into the new `GameState`.
5. The session writes the events with [`GameStore.appendEvents`](../packages/engine/src/store.ts) as one undo group; only then does the screen show the new state.

### Key design decisions

- **Pure, deterministic engine.** Same state and command, same events; randomness only from the seeded RNG in the state. Fast tests, reproducible games.
- **Event sourcing.** The event log is the game: undo, refresh recovery, export, bug reports and later sync all come from it.
- **Assistant, not referee.** Where the rules give the players a choice, the engine asks instead of guessing, and `ManualAdjust` can correct any state. A rules bug never blocks a game night.
- **Scenarios as data.** A scenario is setup data plus card data whose abilities carry its rules. What two scenarios need becomes an engine primitive.
- **Card data from ArkhamDB.** Fetched at build or run time; nothing copyrighted is committed or bundled.
- **Strong types.** All identifiers are branded strings ([`ids.ts`](../packages/engine/src/ids.ts)):
  - `CardCode` (printed data, shared by copies),
  - `InstanceId` (one card on the table),
  - `InvestigatorId` (a seat in one game),
  - `InvestigatorCode` (the investigator card),
  - `CardName` (readable, never an identity).

Stack:

- TypeScript strict, Vite + pnpm workspaces
- React 19 with hash routes (static GitHub Pages), Zustand
- i18next (English and German)
- Dexie
- zod for external input only
- vite-plugin-pwa
- Vitest and Playwright

## Components

- [Game state](architecture/game-state.md): `GameState`, zones, maps and invariants.
- [Command handling](architecture/command-handling.md): `handle` and `apply`, the step queue, `COMMAND_SPECS`.
- [Triggers and card effects](architecture/triggers-and-card-effects.md): abilities, templated commands, card actions and modifiers.
- [Decisions](architecture/decisions.md): questions for the players and skill tests.
- [Rounds, phases and turns](architecture/rounds-phases-and-turns.md): automated phase steps and turns.
- [Rule modules](architecture/rule-modules.md): generic rules per subject.
- [Scenarios](architecture/scenarios.md): `ScenarioDefinition`, setup steps, hand-entered scenarios.
- [Campaign](architecture/campaign.md): the campaign log and resolutions.
- [Card data](architecture/card-data.md): `CardDb` and the ArkhamDB pipeline.
- [Persistence](architecture/persistence.md): `GameStore` and `IndexedDbStore`.
- [Web app](architecture/web-app.md): routes, the investigator picker, `OpenGame`.
  - [Play screen](architecture/play-screen.md): layout, status row, symbols and styling.
    - [Encounter piles](architecture/play-screen-encounter.md)
    - [Map and locations](architecture/play-screen-map.md)
    - [Investigators and enemies](architecture/play-screen-investigators.md)
    - [Decisions](architecture/play-screen-decisions.md)
- [Tests and debugging](architecture/tests-and-debugging.md): `newGame()`, `PlayTable`, `BoardView`.
