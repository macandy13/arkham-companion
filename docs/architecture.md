# Arkham Companion – Architecture

How the app is built today. What it is for, its requirements and the plan for what comes next are in [product.md](product.md); this document only describes code that exists.

It has two levels. **Overview** shows the whole system on one page. **Components** has one section per part of the code that gets extended. Each section explains how the part works and why, shows a reduced version of its important types, and lists its extension points: what to change, and where, to extend it.

**Keeping it current:** a PR that adds or changes a component updates that component's section in the same PR. That covers a new kind of command, trigger, decision, setup step or store method, a new package and a changed dependency direction. A PR that builds something planned in product.md adds it here. The diff of this file is where a reviewer sees an architecture change. Refer to sections by name (architecture "Triggers and card effects"), not by number. Code links point to files, not lines, so they don't go stale.

## Overview

The app is an offline PWA with no backend. Players keep their own decks, skill tests and chaos bag; the app runs the scenario side: the encounter deck, doom, agenda and act, the map, enemies and forced effects.

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

Arrows are package dependencies; [ESLint](../eslint.config.js) enforces the two that matter most. The engine depends on nothing but `@arkham/util`: no React, storage, network, clock or `Math.random`. Only [`IndexedDbStore`](../apps/web/src/storage/IndexedDbStore.ts) imports Dexie. [`packages/review_digest`](../packages/review_digest/src/) is CI tooling, not part of the app.

| Package | What it holds |
| --- | --- |
| [`packages/engine`](../packages/engine/src/) | Game state, commands, events, the reducer and all generic rules; the `GameStore` interface |
| [`packages/scenarios`](../packages/scenarios/src/) | Scenario definitions: setup data plus card data, whose abilities carry their special rules |
| [`packages/carddata`](../packages/carddata/src/) | ArkhamDB fetch, validation and normalisation; the investigator catalog |
| [`packages/util`](../packages/util/src/) | Generic string, array and object helpers |
| [`apps/web`](../apps/web/src/) | The React PWA: screens, the app store and the IndexedDB store |

### Main pieces and how they interact

Most of the engine is plain data plus pure functions; its few classes are errors (`CommandRejected`) and test tools, and the store class lives in the app. These are the pieces a reader meets first, in the order a command meets them. Each component section below has the details.

```mermaid
flowchart LR
  CMD["Command"] --> EXE["execute / handle"]
  CTX["EngineContext<br/>CardDb, scenario"] --> EXE
  ST["GameState"] --> EXE
  EXE --> EV["Event[]"]
  EV --> RED["reducer / replay"]
  RED --> ST2["new GameState<br/>pending Decisions, queue"]
  EV --> STORE["GameStore<br/>event log"]
```

- **`GameState`** ([`state.ts`](../packages/engine/src/state.ts)): the whole table as one serialisable value, with the cards, investigators, maps, agenda and act, open `Decision`s and the stored `queue` of steps still to run (see "Game state").
- **`Command`** ([`commands.ts`](../packages/engine/src/commands.ts)): what a player or the phase assistant asks for (`MoveInvestigator`, `DrawEncounter`, `ResolveDecision`, `NextPhase`, …).
- **`execute` / `handle`** ([`execute.ts`](../packages/engine/src/execute.ts), [`handle.ts`](../packages/engine/src/handle.ts)): check a command against the state and return the `Event`s it causes, forced effects included, or throw `CommandRejected` (see "Command handling").
- **`EngineContext`** ([`cards.ts`](../packages/engine/src/cards.ts)): what `handle` reads besides the state. That is the `CardDb` with every card's printed stats, and the running `ScenarioDefinition` with its reference card and modifiers. It is code and lookup data, so it is passed in rather than stored (see "Triggers and card effects", "Scenarios").
- **`Event` and the reducer** ([`events.ts`](../packages/engine/src/events.ts), [`reducer.ts`](../packages/engine/src/reducer.ts)): the facts a command produced. `replay` folds them into the next state; the log of events is the game.
- **`Decision`** ([`state.ts`](../packages/engine/src/state.ts)): a question to the players. A command that needs an answer raises one, holds the rest of its sequence in the queue, and `ResolveDecision` carries on (see "Decisions").
- **`GameStore`** ([`store.ts`](../packages/engine/src/store.ts)): the interface the app saves and loads event logs through; `IndexedDbStore` implements it (see "Persistence").
- **For tests and sandboxes:** `GameBuilder` (`newGame()`) describes a table and starts it, `PlayTable` plays it step by step in game language, and `BoardView` reads it back by card name (see "Tests and debugging").

### Cards, investigators and their identifiers

A card has two sides in the code: its printed data, shared by every copy, and the copies on the table. Investigators are kept apart from cards. All identifiers are branded strings defined in [`ids.ts`](../packages/engine/src/ids.ts) (`instanceId('hall')`), so one kind of ID can't be passed for another.

- **`CardCode`**: an ArkhamDB card code, the key of a card's printed data. Several copies share one code.
- **`CardStats`** ([`cards.ts`](../packages/engine/src/cards.ts)): that printed data, as the rules read it (name, type, traits, shroud, clues, enemy stats, doom threshold, keywords, …). The `CardDb` looks it up by code; tests build it with the `blank*` cards ([`blank_cards.ts`](../packages/engine/src/blank_cards.ts)).
- **`InstanceId`** and **`CardInstance`** ([`state.ts`](../packages/engine/src/state.ts) for the instance): one physical card on the table, with its code, its `Zone`, face, exhaustion and tokens. It holds the code only, so the state never copies card data.
- **`InvestigatorId`** and **`Investigator`**: one seat in one game, with its location, health, sanity, clues, resources, actions and status. The investigator card is not a `CardInstance`; cards engaged with or in the threat area of an investigator name the `InvestigatorId` in their zone.
- **`InvestigatorCode`**: the card code of an investigator card. It names the investigator, not the seat, so the campaign log keys its team by it; an `InvestigatorSeat` pairs the two for setup.
- **`CardName`**: a printed name. Views and matchers use it for readability (`byName('Hallway')`), but copies share a name, so it is never an identity.
- **Placing cards:** a scenario's setup names cards by code, and `compileSetup` generates readable instance IDs (`code#copy`). A `StartingCard` carries a code and may carry its own `id`. The test builder takes an instance ID and the card's `CardStats` (`withCard(id, card, zone)`), so the stats sit next to where the card is placed.

### How one player action flows

Every change to a game takes the same path. Take starting a scenario; every later action goes through the app store's `actions` and a `PlayTable` the same way, minus step 2.

1. The new game wizard collects the scenario, difficulty and investigators and calls [`startScenario`](../apps/web/src/state/appStore.ts) on the app store. The app store is a Zustand store that holds the saved game list (`GameSummary[]`) and the open game (`OpenGame`), and it is the only place in the app that sends commands or writes games.
2. The app store hands the setup to [`startGame`](../apps/web/src/state/gameSession.ts), which sets it up on a fresh `PlayTable` (`PlayTable.setUp`): [`scenario.compileSetup`](../packages/engine/src/setup.ts) turns the scenario definition into one `StartScenario` command. The `ScenarioContext` it passes (an `EngineContext` with its `scenario` set) holds the scenario definition and its card data, which the wizard took from the [scenario catalog](../apps/web/src/scenarios/scenarioCatalog.ts), with the chosen investigator cards added (`cardDbWith`). The wizard seats them by code ([`seating.ts`](../apps/web/src/wizard/seating.ts)), and `compileSetup` takes their printed stats from the context. The same context, with the scenario's reference card and modifiers, is the one the game's later commands need.
3. [`execute(ctx, state, command)`](../packages/engine/src/execute.ts) calls [`handle`](../packages/engine/src/handle.ts). `handle` checks the command against the state and returns the `Event`s it causes, including every forced effect it triggered (see "Command handling"). A refused command throws `CommandRejected`, and nothing is stored.
4. [`replay`](../packages/engine/src/reducer.ts) folds the events into the new `GameState`.
5. `startGame` writes the events with [`GameStore.appendEvents`](../packages/engine/src/store.ts) as the game's first undo group, and the app store only then opens the game and shows its state. Opening a game later replays its log from the last snapshot.

### Key design decisions

- **Pure, deterministic engine.** The same state and command always give the same events, and randomness only comes from the seeded RNG kept in the state. Rules are fast to test, and every game can be reproduced from its log.
- **Event sourcing.** The event log is the game. Undo, refresh recovery, export, bug reports and later sync all come from this one mechanism.
- **Assistant, not referee.** Where the rules give the players a choice, the engine asks with a decision instead of guessing, and `ManualAdjust` can correct any state. A rules bug or a house rule never blocks a game night.
- **Scenarios as data.** A scenario is setup data plus card data, whose abilities carry its special rules. What two scenarios need becomes an engine primitive, so each new scenario gets cheaper.
- **Card data from ArkhamDB.** Cards are fetched at build or run time, so errata and translations need no code change and nothing copyrighted is committed.
- **Seams before features.** Card effects, cloud sync and auto-layout get an interface before they get an implementation.

### Technology

| Area | Choice | Why |
| --- | --- | --- |
| Language | TypeScript (strict) | Discriminated unions model commands, events and zones |
| Build | Vite, pnpm workspaces | Fast; the packages enforce the boundaries above |
| UI | React 19, React Router (hash routes) | Existing experience; hash routes work on static GitHub Pages |
| UI state | Zustand | A thin store around the engine keeps the engine framework-free |
| i18n | i18next | UI strings in English and German; card text comes from ArkhamDB per language |
| Persistence | IndexedDB via Dexie behind `GameStore` | localStorage is small and synchronous; a cloud store can be a second implementation |
| Validation | zod | Only for external input: ArkhamDB JSON and imported saves |
| Offline | vite-plugin-pwa (Workbox) | App and card images cached for play without network |
| Tests | Vitest, Playwright | Engine unit and table tests; E2E on the production build |

## Components

### Game state

The whole table is one serialisable value, [`GameState`](../packages/engine/src/state.ts). Every physical card is one `CardInstance` with a unique ID, its card code and exactly one [`Zone`](../packages/engine/src/zone.ts); four copies of a card are four instances. So "where is this card?" always has one answer, moving a card anywhere is the same operation, and every rule can rely on that. Order within a zone (the top of the encounter deck, say) lives in `order`, keyed by [`zoneKey`](../packages/engine/src/zone.ts).

The state stores card codes, not card data: a rule that needs a card's health or shroud looks it up in the `CardDb` (see "Card data"). Numbers printed per investigator are `ScaledValue`s, resolved against `playerCount` when needed, never stored.

Connections between locations form an explicit graph on each [`GameMap`](../packages/engine/src/map.ts) rather than being derived from where tiles sit, because they change during play, can be one-way and can span several maps. An edge is stored on the map named when it was added; movement ignores which map owns it. Each map also keeps its book layout (`GameMap.layout`): the cell of each of its locations on a grid three times finer than a card (`GridCell`, column and row from 0; `GRID_CELLS_PER_CARD`), so a layout can shift a location by a third of a card instead of looking like a strict card grid, which only the screen reads. It is game state rather than scenario data because locations enter play from set-aside cards mid-scenario, and randomised or replaced locations (M4) must record where each card went. A map step gives the cells (`MapLocation.at`, carried on as `MapPlacement.at` by `AddMap`), `StartScenario` rejects a cell for a card that is not one of the map's locations (`layoutNotOnMap`), and both reject one that is not two non-negative integers (`invalidGridCell`), and a location without a cell is left for the screen to place.

[`checkInvariants`](../packages/engine/src/invariants.ts) states what must always hold, and the end-to-end test runs it after every command. Each card is in exactly one zone and listed once in that zone's order, no token count is negative, every connection joins two known cards once, and pending decisions and turns are well formed.

```ts
interface GameState {
  meta: GameMeta;                        // scenario, difficulty, playerCount, seed, rngState, round, phase,
                                         // steps, turn, turnsTaken, leadInvestigator, queue,
                                         // ended, resolution
  campaign?: CampaignLog;                // the campaign this game belongs to (see Campaign)
  investigators: Investigator[];
  cards: Record<InstanceId, CardInstance>;
  order: Record<ZoneKey, InstanceId[]>;  // index 0 is the top of a deck
  board: Board;                          // maps, each with its connections and book layout
  chaosBag: ChaosToken[];
  agenda: { current?: InstanceId };
  act: { current?: InstanceId };
  scenario: unknown;                     // per-scenario state
  pending: Decision[];                   // open questions for the players
}

interface CardInstance {
  id: InstanceId; code: CardCode; zone: Zone;
  faceUp: boolean; exhausted: boolean;
  tokens: Partial<Record<TokenKind, number>>;
  flags: Record<string, unknown>;
}

type Zone =
  | { kind: 'encounterDeck' | 'encounterDiscard' | 'setAside' | 'victoryDisplay' | 'outOfGame'
          | 'resolving' | 'agendaDeck' | 'actDeck' }
  | { kind: 'location'; mapId: MapId }
  | { kind: 'atLocation'; locationId: InstanceId }
  | { kind: 'engaged' | 'threatArea'; investigatorId: InvestigatorId }
  | { kind: 'attachedTo'; hostId: InstanceId };

interface Investigator {
  id: InvestigatorId; code: InvestigatorCode; name: string; seat: number;
  locationId?: InstanceId;
  health: { max: number; damage: number }; sanity: { max: number; horror: number };
  clues: number; resources: number; doomOnPlayerCards: number;
  actionsRemaining: number; status: 'active' | 'resigned' | 'defeated';
}
```

**Extension points**

- **A new field:** add it to the type in [`state.ts`](../packages/engine/src/state.ts) with a doc comment and give it a value in `emptyState()` and in the reducer case that creates it. If it can become inconsistent, add its rule to [`checkInvariants`](../packages/engine/src/invariants.ts).
- **A new kind of place for cards:** add a `Zone` kind in [`zone.ts`](../packages/engine/src/zone.ts) with its key in `zoneKey`, and its reference check in `validateZone` ([`placement.ts`](../packages/engine/src/placement.ts)). If cards there count as in play, add it to `isInPlay` ([`doom.ts`](../packages/engine/src/doom.ts)).
- **A rule that moves cards or tokens:** build its events with the shared builders instead of by hand, so every module moves things the same way: `cardMoved` for a move a command asks for (validated), `moveCardEvent` for one the engine decides, `discardEncounterCard` and `clearTokensEvents` in [`placement.ts`](../packages/engine/src/placement.ts); clues between an investigator and a location with `discoverCluesEvents` and `cluesToLocationEvents` in [`investigators.ts`](../packages/engine/src/investigators.ts).

### Command handling

This is the core of the engine: [`handle`](../packages/engine/src/handle.ts) turns one command into the complete list of events it causes, and [`apply`](../packages/engine/src/reducer.ts) folds an event into the state. A command is a request that may be refused and may need card data or randomness. An event is a fact that always applies the same way. So all logic lives in `handle`, and `apply` never checks anything, generates IDs or draws random numbers. Replaying a log therefore needs neither card data nor the RNG. `DeckShuffled`, for example, carries the new order rather than a seed.

```ts
function handle(ctx: EngineContext, state: GameState, command: Command): Event[];  // throws CommandRejected
function apply(state: GameState, event: Event): GameState;
function replay(events: readonly Event[], initial?: GameState): GameState;          // apply, folded over a log
function execute(ctx: EngineContext, state: GameState, command: Command): { state: GameState; events: Event[] };  // handle + replay
```

The commands are a union in [`commands.ts`](../packages/engine/src/commands.ts), the events one in [`events.ts`](../packages/engine/src/events.ts). The context holds code and static data, never part of the saved state:

```ts
type Command = StartScenario | ManualAdjust | MoveCard | AddMap | MoveInvestigator | PlaceDoom
  | AdvanceAgenda | DrawEncounter | SpawnEnemy | MoveHunters | RequestDecision | ResolveDecision
  | NextPhase | Investigate | Fight | Evade | …;      // ~40 kinds
type Event = ScenarioStarted | DeckShuffled | CardMoved | TokensChanged | CardFlipped
  | ConnectionChanged | InvestigatorChanged | DecisionRequested | AgendaAdvanced | PhaseChanged
  | StepsQueued | …;                                   // ~30 kinds

interface EngineContext {          // cards.ts
  cards: CardDb;
  scenario?: ScenarioDefinition;   // reference card and modifiers of the running scenario
}
type ScenarioContext = EngineContext & { readonly scenario: ScenarioDefinition };  // one game of one scenario
```

`handle` never changes the state. It works out what would happen in a `Resolution`: a working state plus the events so far, which exists only inside one call. The command resolves as a queue of steps (`run`): each step appends its events to the resolution (`emit`) and returns the steps that follow it, which go in front of the rest, so a chain resolves depth first. A queued action that turns out illegal takes its events back (`checkpoint`). The dry run of a provoking action runs in a resolution of its own that is thrown away. A step is plain data ([`QueuedStep`](../packages/engine/src/state.ts)): a command, one effect of a card ability, a held action, or one of the continuations below. What follows a command's step:

1. **The command's own events.** Every command type has one entry in [`COMMAND_SPECS`](../packages/engine/src/command_specs.ts): its handler plus the policies `handle` applies to it (fires no triggers, allowed while a decision is pending or after the end, provokes attacks of opportunity, continues after its effects). The handler lives in one of the `handle_<area>.ts` files ([board](../packages/engine/src/handle_board.ts), [encounter](../packages/engine/src/handle_encounter.ts), [enemy](../packages/engine/src/handle_enemy.ts), [investigator](../packages/engine/src/handle_investigator.ts), [scenario](../packages/engine/src/handle_scenario.ts)) or a rule module. The handler checks the command against the state and returns its events, or throws `CommandRejected` with a [`Rejection`](../packages/engine/src/rejection.ts) code the UI can explain. A scenario command handler (`handle_<area>.ts`) never imports another one (an ESLint rule in [`eslint.config.js`](../eslint.config.js)): what two handlers share, a query such as `activeInvestigator` or `enemiesAt` or an event builder such as `revealEvents`, lives in the module of its entity ([`board.ts`](../packages/engine/src/board.ts), [`enemies.ts`](../packages/engine/src/enemies.ts), [`investigators.ts`](../packages/engine/src/investigators.ts)), where rule modules find it too.
2. **Forced effects.** [`triggeredSteps`](../packages/engine/src/triggers.ts) steps through those events one at a time, applying each to a working copy of the state and asking which card abilities' windows it opens. The matched abilities are evaluated against the state after all of the command's events, so each one sees the command's complete outcome. Each effect of a matched ability becomes a step of its own: it turns into its command only when its turn comes (`resolveEffect`), so it sees what the effects before it did. If the command answered a decision, the chosen option's commands follow the forced effects of the answer's own events, as "after you fail" abilities resolve before a skill test's results (ST.6 before ST.7; no ability reads an answer's events yet).

   This matches the rules as long as a command is one effect: every part of an effect resolves before its "after" triggers (rules.md, "Timing of forced effects"). A command that bundles several steps of a sequence must split them, as surge does (step 3). The cases still open are listed in [M1V.1](tasks/M1V-rules-verification.md).

   A refused follow-up refuses the original command (`triggeredCommandRejected`, naming the follow-up), and a chain of more than `MAX_TRIGGERED_COMMANDS` follow-ups refuses it with `triggerLoop`. Bad card data can therefore neither hang the app nor leave half its effect behind.
3. **Continuations.** A spec's `continueWith` returns the steps that run once the forced effects are done. Advancing an agenda or act happens in two parts: first the card flips and its reverse side (its `advanced` abilities) resolves while it is still current; only then does `finishAdvance` (`completeAdvance`) move it out and make the next card current. On the last card the reverse side names the resolution (`EndScenario`), or raises a decision whose options do. `DrawEncounter` draws one card into the `resolving` zone and turns it face up; its revelation (its `revealed` abilities) resolves, and only then does `placeDrawnCard` spawn, attach or discard it (without a drawer, only an enemy with its own spawn instruction still spawns; anything else is discarded). If it has surge, a `surge` step draws again after the placement's own forced effects. One command makes at most as many surge draws as the deck and discard hold, so a deck of only surge cards ends instead of looping. `NextPhase` goes on with the phase's outstanding steps, one `phaseStep` at a time (see "Rounds, phases and turns").
4. **Waiting for the players.** A step that raises a decision stops the queue. The remaining steps are stored in `GameMeta.queue` (`StepsQueued`), in front of whatever already waits, so the newest resolution finishes first. Decisions already pending when the command came in do not stop it: answering one of two attacks of opportunity resolves that attack at once. Once no decision is pending, the next command (usually the last answer) resolves the stored steps after its own, one `StepResumed` each, until one asks something again. So an agenda or act leaves play only after its reverse side's question is answered, and a drawn card is placed only after its revelation's question. Outstanding phase steps are not stored: the players go on with the next "Next".
5. **Held actions.** If the command is an action that provokes attacks of opportunity (a move, investigate or engage the players took as an action, marked `asAction`; the same command from a card effect leaves it out), `handle` first does a dry run to reject an illegal action. It then returns only one decision per attacking enemy and a `StepsQueued` event that stores the action. Once the last of those decisions is answered, the held action resumes (`StepResumed` and its chain, in a run of its own) or, when it has become illegal or its investigator was defeated, is dropped (`ActionDropped`) with everything it did rolled back.

`ManualAdjust` corrects almost anything, with two guards against an impossible state. It cannot move the current agenda or act (`currentStageCard`), because only advancing changes which card is current. Added doom fires no forced effects, but if it reaches the threshold the engine asks the group whether to advance the agenda (the same `advanceAgenda` decision as the mythos check) instead of staying silent or advancing on its own.

Once `ScenarioEnded` has set `GameMeta.ended`, `handle` refuses every command except `ManualAdjust` (`scenarioEnded`): the game is over, but the players may still correct the final board before the campaign reads it. Undo works on the log, outside `handle`, so it still takes back the command that ended the scenario.

The result is one list of events per player command. The store files them under one `commandId`, so undo ([`undo.ts`](../packages/engine/src/undo.ts)) always removes a whole command with its chain. The RNG state ([`rng.ts`](../packages/engine/src/rng.ts), xoshiro128\*\*) is part of `GameMeta`, so handling the same command again gives the same shuffle.

**Extension points**

- **A new command:** add its type to the `Command` union in [`commands.ts`](../packages/engine/src/commands.ts), its handler in the matching `handle_<area>.ts` and its entry in `COMMAND_SPECS` ([`command_specs.ts`](../packages/engine/src/command_specs.ts)), with tests that call `handle`. The compiler rejects a command without an entry. The entry's optional fields decide whether it fires triggers, may run while a decision is pending or after the end, provokes attacks of opportunity, or continues after its forced effects. A command that can be taken as an action extends `ActionCommand` and uses `provokes: asAction`, so it provokes only when an action was spent on it.
- **A new event:** reuse an existing one if you can. Otherwise add its type in [`events.ts`](../packages/engine/src/events.ts) and its case in `apply` ([`reducer.ts`](../packages/engine/src/reducer.ts)); the case must not validate anything.
- **A new reason to refuse:** add a `RejectionCode` with the fields the UI needs to explain it in [`rejection.ts`](../packages/engine/src/rejection.ts).

### Triggers and card effects

Forced effects are **abilities**: data on a card's `CardStats`, so the same encounter card behaves the same in every scenario and card data holds no code. A scenario's own effects are abilities of its agendas and acts (their reverse sides and objectives), so they need no code either. Abilities resolve to commands rather than events, so `handle` checks their effect and they can use card data and the RNG like any player command. `ManualAdjust` and `StartScenario` fire nothing, because a correction or the setup is not a game event.

An [`Ability`](../packages/engine/src/abilities.ts) is a timing window plus a list of effects. `windowsOpenedBy` is the one matcher that turns an event into the windows it opens, each naming the card whose abilities fire and the investigator it concerns, if any. A card turned face up opens `revealed`: a location being revealed, or a drawn encounter card, for which it is the revelation (its drawer is the investigator; a location names nobody). `TurnEnded` opens `turnEnds` for each card in that investigator's threat area, naming them ("at the end of your turn"); `RoundEnded` (upkeep step 4.6) opens `roundEnds` for every card in play, naming nobody; `AgendaAdvanced` and `ActAdvanced` open `advanced` for the advancing card, naming nobody: its reverse side, written `whenAdvanced(…)`, which resolves while the card is still current. `EnemyDefeated` opens `enemyDefeated` (with the enemy's code) for the current agenda and act, naming nobody: an objective such as "if the Ghoul Priest is defeated, advance", written `whenEnemyDefeated(codes.ghoulPriest, advanceAct())`; windows compare as values (`shallowEqual`), so an ability matches only the window of its own enemy code, and only current cards open it, so a used-up act cannot advance the deck again. `turnEnds` covers threat-area cards only: a card elsewhere ("at the end of your turn, if you are at this location") needs its own window. `abilitySteps` queues the matching abilities' effects in the order they are listed, one step each. An ability may carry a `condition`, checked as its window opens: `duringAct(acts, ability)` fires it only while the current act is one of `acts`, so two abilities with exclusive conditions write a card's "If it is act 1 or 2, … If it is act 3, …" (They're Getting Out!). An effect is a command template: one of the commands card data may use (`AbilityCommand`), with every card or investigator ID replaced by a reference relative to the ability (`{ ref: 'self' }`, `{ ref: 'windowInvestigator' }`, `{ ref: 'windowLocation' }`, `{ ref: 'lead' }` for the lead investigator while still in the scenario), because card data, shared by every copy, can't hold instance IDs. A scenario card names the scenario's unique cards by code: `onlyCopy(code)` (`{ ref: 'onlyCopy', code }`) is the one copy of that code in the game, in any zone, and names nobody while there are none or several. Two references repeat the command instead of naming one ID: `{ ref: 'eachInvestigator' }` (each investigator still in the scenario, in player order) and `{ ref: 'eachEnemyAt', location }` (each enemy at that location, engaged ones included); `resolveEffect` then returns one command per investigator or enemy, and none when there is nobody. The effect applies to all of them at once (`resolveAtOnce`, RR "Priority of Simultaneous Resolution"): every command's own events first, then the forced effects and continuations of all of them; a command that asks something (a test) stops the batch, and the rest follow as steps of their own after the answer, since each investigator's own choices go in player order. An effect holds at most one of them, and a test's outcomes none, since one there would repeat the whole test. A new area is an `AddMap` like any other effect: `putMapIntoPlay(step)` writes a map step, as setup declares one, as an `AddMap` naming each location by `onlyCopy`, then a `RevealLocation` per face-up one. `AddMap` carries each location's layout cell with the location (`MapPlacement`) rather than in a layout keyed by ID, so card data can name its locations by reference. When a step's turn comes, `resolveEffect` fills in the IDs from the state then and drops a command whose reference names nobody, so handlers and the log only ever see plain commands. An investigator who has left the scenario meanwhile is nobody: a revelation that defeats its drawer before `putIntoThreatArea` leaves the card to be discarded, and a test after the defeat is dropped instead of rejecting the draw. A missing `onlyCopy` card is different: not a rule but a data or setup mistake, so the step records `AbilityEffectSkipped` (the card, the command type and the missing codes), a marker the reducer ignores, and the players are told to resolve that effect by hand. Reusing the command types keeps one vocabulary: a new kind of effect is a command added to `AbilityCommand`. Lists inside a command are templated item by item, which is how a test's outcomes work: `TestSkill` raises a skill test about the card for an investigator, and its `onPass` and `onFail` are ability commands too (`AbilityTest`). With `perPointFailed: 'damage' | 'horror'` ("for each point you fail by, take 1 damage"), the tester takes as much damage or horror as the fail answer's `margin` says (1 without one), ahead of `onFail`, and `SkillTestResolved.margin` records it: Grasping Hands is `whenRevealed(skillTest('agility', 3, { perPointFailed: 'damage' }))`. `PlayTable.resolveTest({ failedBy: n })` answers a test by a fail with margin `n`. The margin is the one way to say how much a test failed by; "succeed / fail by N or more" consequences become conditions on it once a card needs one. Factories write the common ones the way the card text reads: `whenRevealed(takeHorror(1))`, `atEndOfTurn(skillTest('willpower', 3, { onPass: [discardSelf()] }))` (Frozen in Fear), `atEndOfRound(discardSelf())` (Dissonant Voices), `whenRevealed(putIntoThreatArea())` (both of them), `placeDoomOnAgenda`, `placeDoomOnSelf`, `moveSelf`, and for a reverse side `revealLocation`, `putSetAsideIntoPlay`, `spawnEnemyAt` (The Barrier: `whenAdvanced(revealLocation(onlyCopy(codes.parlor)), …)`), `putMapIntoPlay`, `discardEachEnemyAt`, `moveEachInvestigatorTo` and `removeFromGame` (Trapped), `shuffleEncounterDiscard` and `leadDrawsDiscardingUntil(match)` (Rise of the Ghouls; a matched `DrawEncounter` that finds nothing draws and discards nothing, which is where the table ends when the discard was just shuffled in), `endScenario(resolution)` and `defeatEachInvestigator` (They're Getting Out!), and `leadDecides(id, prompt, options)` for "the lead investigator must decide" (What Have You Done?): a `RequestDecision` restricted to `AbilityChoice`, a `chooseOption` decision without a subject (one about the advancing card would be dropped as it advances) whose options run ability commands, templated like a test's outcomes and resolved as the decision is raised. A new lead is not part of a departure's events: the lead leaving queues a `newLeadInvestigator` step (`triggeredSteps`, `newLeadInvestigatorEvents`), so an effect that defeats several investigators at once asks for a new lead only among those left afterwards, and not at all when nobody is. `discardSelf` is `DiscardCard`, which discards like a resolved encounter card (tokens off, attachments along, onto the top of the encounter discard), unlike a plain `MoveCard`. A drawn card waits in `resolving` until they have resolved and is placed afterwards, unless they moved it. `triggeredSteps` collects them per event and evaluates them against the state after the whole command.

The engine reads the running scenario from `EngineContext.scenario`: the context carries the whole definition, so its reference card and modifiers cannot be passed separately or forgotten.

```ts
type TimingWindow =                                                      // grows per slice
  | { kind: 'revealed' } | { kind: 'turnEnds' } | { kind: 'roundEnds' } | { kind: 'advanced' }
  | { kind: 'enemyDefeated'; enemy: CardCode };
type AbilityCommand =                                                    // grows per slice
  | Extract<Command, { type: 'AdjustInvestigator' | 'PlaceDoom' | 'MoveCard' | 'DiscardCard'
      | 'RevealLocation' | 'FromSetAside' | 'SpawnEnemy' | 'MoveInvestigator' | 'AddMap' | 'AdvanceAct'
      | 'ShuffleEncounterDiscard' | 'DrawEncounter' | 'DefeatInvestigator' | 'EndScenario' }>
  | AbilityTest;                     // TestSkill whose onPass / onFail are AbilityCommands
type AbilityEffect = Templated<AbilityCommand>;   // IDs replaced by { ref: 'self' | 'windowInvestigator' | 'windowLocation'
                                                  //   | 'lead' | 'onlyCopy' | 'eachInvestigator' | 'eachEnemyAt' }
// "Revelation – Take 1 horror":
// { type: 'AdjustInvestigator', investigatorId: { ref: 'windowInvestigator' }, stat: 'horror', delta: 1 }
type AbilityCondition = { kind: 'currentAct'; acts: readonly CardCode[] };     // grows per slice
interface Ability { window: TimingWindow; condition?: AbilityCondition; effects: readonly AbilityEffect[]; }
                                                                         // CardStats.abilities

```

A drawn card's placement is an ability where the card text says so: a revelation test is `whenRevealed(skillTest('willpower', 4))`, raised while the drawn card waits in `resolving`, and the card is placed once it is answered; "put into play in your threat area" is `whenRevealed(putIntoThreatArea())` (carddata still parses it as `CardDef.entersThreatArea`, for a future card-data mapper); "attach to your location" is `whenRevealed(attachToLocation())`, which moves the card onto `{ ref: 'windowLocation' }`, the drawer's location, or does nothing when the drawer has none or `LocationAttachment.onePerLocation` finds a card of the same title attached there, so the card is discarded. What remains of `CardStats.locationAttachment` is not forced: `locationShroud` (board.ts) adds its `shroud` to the location's printed shroud for `Investigate` (a constant ability, P3), and `discardWhenInvestigated` makes a passed `Investigate` there discard it after the clues (Obscuring Fog; an "after a successful investigation" window, P2).

Some events change nothing in the state and exist only to mark a moment for the log and for trigger points: `EncounterCardDrawn` (a card was revealed from the encounter deck), `CluesDiscovered` (after the clue tokens moved) and `SkillTestResolved` (a test's outcome, `pass` or `fail` with an optional `margin`, right after its answer and before the answer's commands apply the results). The reducer ignores them. They give a trigger point a named moment to match ("after you discover clues", "after you fail a test") instead of token deltas or option ids; no window opens on the last two yet. "If this test succeeds" effects are results and stay in the answer's commands. An ability on `SkillTestResolved` would today run after those commands, because `handle` queues an answer's commands before triggered ones, while the rules resolve "after you succeed / fail" abilities before the results; the timing windows will order them first.

**Extension points**

- **A new timing window:** add a case to `TimingWindow` in [`abilities.ts`](../packages/engine/src/abilities.ts) and to `windowsOpenedBy`, naming the event that opens it. Test it in [`triggers.test.ts`](../packages/engine/src/triggers.test.ts).
- **A new kind of condition:** add a case to `AbilityCondition` and to `conditionHolds`.
- **A new kind of effect:** add its command to `AbilityCommand`, and a factory when cards will use it often. A new relative target is a new reference (`RelativeCard`, `RelativeInvestigator`) and a case in `resolveRefs`.
- **A card with a forced ability:** list it in the card's `abilities`; no code.

### Decisions

Where the rules give the players a choice, or the engine needs an answer it cannot know, the engine puts a [`Decision`](../packages/engine/src/state.ts) into `pending` instead of guessing. Examples are a hunter tie, a spawn location, "advance the agenda?" and the result of a skill test the players resolve with their own cards. Every option carries the commands it triggers, so the mapping from answer to consequence is data. The skill test of a basic action is the exception: its decision names the action instead (`testKind`: the location investigated, or the enemy attacked or evaded), and `testedActionCommands` computes the consequences of the answer from the state when it arrives, so a correction made while the test is open (clues taken off, an enemy moved) counts. Counts the players confirm or adjust are part of the answer: the plain `amount` (clues discovered, damage dealt by an action's test), which `testedActionCommands` reads, and the named `amounts` `damage` and `horror`. An option's command takes a named count by writing `{ answer: 'horror' }` where the number goes (`AnsweredAmount`): answering fills in the confirmed count, or the option's default, so a forced attack's `attack` option is a plain `DealEnemyAttack` whose damage and horror the players may lower for soak. Each count is checked against the option's range for it. Any handler, card ability or phase step can therefore ask by returning a `RequestDecision` command, and the UI needs only one dialog for all of them.

`ResolveDecision` runs the chosen option's commands like trigger follow-ups, in the same undo group. Answering a skill test first records its outcome (`SkillTestResolved`). An answer may name who gives it (`answeredBy`, for one device per player); it is then refused unless the `decider` allows that investigator (`notTheDecider`). Without it, a shared device answers for anyone. If one is refused, the answer is refused and the decision stays. While a decision is pending, every player command except `ManualAdjust` and `ResolveDecision` is refused (`allowedWhilePending` in [`command_specs.ts`](../packages/engine/src/command_specs.ts)). Skill tests ([`skill_tests.ts`](../packages/engine/src/skill_tests.ts)) and the enemy attacks the rules force outside the enemy phase are built on this mechanism: attacks of opportunity ([`attacks_of_opportunity.ts`](../packages/engine/src/attacks_of_opportunity.ts)), retaliate after a failed fight and alert after a failed evade. All three ask the same `forcedAttackDecision` ([`forced_attacks.ts`](../packages/engine/src/forced_attacks.ts)): `attack` with the printed damage and horror, which the players may lower for soak, or `skip` for a card that prevents or cancels it. A retaliate or alert decision is the last fail command of its test, so it comes after the test's other results.

A skill test decision raised for one investigator also carries a suggestion ([`skillTestSuggestion`](../packages/engine/src/skill_modifiers.ts)): the printed skill, plus one modifier the players enter for everything the engine does not track (committed icons, cards, lasting effects), plus the revealed chaos tokens valued from the scenario reference card, against the printed difficulty, with a trace of each step for the UI. The engine deliberately models no card effects here: the players play their own cards, and one number is enough. Following the skill test timing, the players enter the modifier before drawing the token and may still change it until they answer, because abilities triggered by the reveal or the result can change the value. The answer stays pass or fail. The suggestion also carries the `margin`, how much the test succeeds or fails by (all of the difficulty after an auto-fail), which the UI pre-fills: an answer may give one (`ResolveDecision.margin`, a whole number of 0 or more, only for a skill test), which a per-point fail deals and `SkillTestResolved` records for "succeed by 2 or more".

```ts
interface Decision {
  id: DecisionId;          // derived from kind and subject, so a repeated check doesn't ask twice
  kind: 'confirm' | 'chooseInvestigator' | 'chooseLocation' | 'chooseCard' | 'chooseOption' | 'skillTestResult';
  subject?: InstanceId;    // dropped when this card advances
  prompt: string;          // i18n key
  decider: Decider;        // lead, one investigator or the group
  skillTest?: SkillTest;
  testKind?: SkillTestKind; // investigate / fight / evade: consequences computed on the answer
  options: DecisionOption[];
}
interface DecisionOption {
  id: string; label: string; target?: InstanceId | InvestigatorId;
  commands: AnswerableCommand[];  // any count may be { answer: 'damage' | 'horror' }
  amount?: AmountRange; amounts?: Partial<Record<NamedAmount, AmountRange>>;
}
```

**Extension points**

- **Ask the players something:** return a `RequestDecision` whose options carry their commands. A count they may adjust is an `AnsweredAmount` in the command with a range in the option's `amounts`; a new name for one goes into `NAMED_AMOUNTS`. Use `confirmOptions` or `skillTestDecision` ([`decisions.ts`](../packages/engine/src/decisions.ts)) for the common shapes.
- **A symbol token whose value depends on the board** (a "-X"): add a `tokenValues` entry to the scenario's `modifiers` ([`scenario.ts`](../packages/engine/src/scenario.ts)); the printed reference card values need no code.
- **A new skill-tested action:** add a `SkillTestKind` case in [`state.ts`](../packages/engine/src/state.ts) and its resolver in `testedActionCommands` ([`skill_tests.ts`](../packages/engine/src/skill_tests.ts)).
- **A new kind of question:** add a `DecisionKind` in [`state.ts`](../packages/engine/src/state.ts). A new engine-raised prompt also gets its debug sentence in [`describe_decision.ts`](../packages/engine/src/describe_decision.ts).

### Rounds, phases and turns

The phase assistant runs the parts of a round the app can do by itself. `GameMeta.steps` lists the outstanding steps of the current phase ([`phases.ts`](../packages/engine/src/phases.ts)). `NextPhase` runs them in order, or moves to the next phase and runs its steps:

- mythos places doom, checks the doom threshold and draws one encounter card per investigator;
- enemy moves hunters ([`hunters.ts`](../packages/engine/src/hunters.ts)) and then resolves the attacks of engaged enemies ([`enemies.ts`](../packages/engine/src/enemies.ts));
- upkeep resets actions, readies enemies, gives each investigator a resource and ends the round, discarding the cards that last until the end of the round.

Each step removes itself first (`PhaseStepsChanged`) and then runs its commands through `handle`. The loop stops as soon as a decision is pending, so the next `NextPhase` after the answer resumes with the following step. Steps as data make the assistant resumable after any answer, and let the UI show what is left in a phase. Turns in the investigation phase ([`turns.ts`](../packages/engine/src/turns.ts)) only record who is acting and how many actions they have left. The first round starts in the investigation phase.

```ts
type PhaseStepId = 'placeDoom' | 'checkDoomThreshold' | 'drawEncounterCard'   // mythos
  | 'huntersMove' | 'enemiesAttack'                                          // enemy
  | 'resetActions' | 'readyExhausted' | 'gainResources' | 'endRound';        // upkeep; titles in PHASE_STEP_TITLES
```

**Extension points**

- **A new automated step:** add a `PhaseStepId` with its title in `PHASE_STEP_TITLES`, put it into its phase's step list in [`phases.ts`](../packages/engine/src/phases.ts) and give it the commands it runs.

### Rule modules

The generic rules are small modules, one per subject, called by the handlers. Queries that several modules share live with the subject they are about. The rules each one implements are summarised in [rules.md](rules.md).

| Subject | Files |
| --- | --- |
| Board: connections, reveal, maps, placement | [`board.ts`](../packages/engine/src/board.ts), [`handle_board.ts`](../packages/engine/src/handle_board.ts), [`placement.ts`](../packages/engine/src/placement.ts), [`map.ts`](../packages/engine/src/map.ts) |
| Doom, agenda and act | [`doom.ts`](../packages/engine/src/doom.ts), [`handle_scenario.ts`](../packages/engine/src/handle_scenario.ts) |
| Encounter deck: draws, surge, peril, revelation tests | [`handle_encounter.ts`](../packages/engine/src/handle_encounter.ts) |
| Enemies: spawn, engagement, prey, hunters, moves by card effects (`MoveEnemy`), attacks, retaliate and alert | [`spawn.ts`](../packages/engine/src/spawn.ts), [`engagement.ts`](../packages/engine/src/engagement.ts), [`hunters.ts`](../packages/engine/src/hunters.ts), [`enemies.ts`](../packages/engine/src/enemies.ts), [`forced_attacks.ts`](../packages/engine/src/forced_attacks.ts), [`handle_enemy.ts`](../packages/engine/src/handle_enemy.ts) |
| Investigators: health, sanity, defeat, movement | [`investigators.ts`](../packages/engine/src/investigators.ts), [`handle_investigator.ts`](../packages/engine/src/handle_investigator.ts) |
| Elimination: defeat and resign clean-up, freed enemies engaging whoever is left at the location, new lead, no investigator left | [`elimination.ts`](../packages/engine/src/elimination.ts) |
| Keywords the rules react to | [`keywords.ts`](../packages/engine/src/keywords.ts) (parsed from card text by `@arkham/carddata`) |
| Skill test suggestions: modifier, chaos tokens, trace | [`skill_modifiers.ts`](../packages/engine/src/skill_modifiers.ts) |
| Card lookups by ID and name | [`lookup.ts`](../packages/engine/src/lookup.ts), [`cards.ts`](../packages/engine/src/cards.ts) |

**Extension points**

- **A new rule:** put it in the module of its subject and call it from the handler of the command it belongs to. Add a step to the end-to-end test where it shows at the table (see "Tests and debugging").

### Scenarios

A scenario is mostly data, a [`ScenarioDefinition`](../packages/engine/src/scenario.ts): agenda and act decks, chaos bag per difficulty, reference card, setup steps, and skill modifiers for the few rules that need code (a token's "-X"). Data is easy to check, review and later generate from imports. [`compileSetup`](../packages/engine/src/setup.ts) turns the definition plus the players' choices into one `StartScenario` command, resolving per-investigator values and building the encounter deck. The players' choices name each seat by an `InvestigatorSeat` (the game's `InvestigatorId` and the card's `InvestigatorCode`), and `compileSetup` fills in name, health, sanity and skills from the investigator cards in the context's `CardDb`, so the setup cannot disagree with the card. `StartScenario` itself still carries complete investigators, so its event replays without the context and tests can start from any board. Mid-scenario board changes reuse the same steps: `putMapIntoPlay` turns an `addMap` step into an `AddMap` effect for card data. Callers reach the scenario functions through the `scenario` namespace export (`scenario.compileSetup`, `scenario.pickReferenceSide`), like the campaign ones; the scenario types are exported flat. The game's own functions (`execute`, `replay`, `handle`) stay flat.

```ts
function compileSetup(ctx: ScenarioContext, options: SetupOptions): StartScenario;  // sets up ctx.scenario
```

Card abilities resolve to commands that go through the normal `handle` path. Game commands such as `MoveCard` and `AddMap` exist for them: unlike a `ManualAdjust` correction, they are game events and fire further abilities.

The only scenario so far is the hand-entered test scenario [`the_gathering/`](../packages/scenarios/src/the_gathering/). It has real card codes and names but no card text, and stands in for real scenario data. Every reverse side but agenda 1's (`whenAdvanced`, agenda 3 with a `duringAct` condition per branch) and act 3's objective (`whenEnemyDefeated`) are abilities on their card data; act 3's reverse side lets the lead investigator choose the resolution with `leadDecides`, whose options end the scenario. Agenda 1's choice is left to the players. The app lists playable scenarios in its [scenario catalog](../apps/web/src/scenarios/scenarioCatalog.ts).

```ts
interface ScenarioDefinition {
  id: ScenarioId;
  chaosBag: Record<Difficulty, readonly ChaosToken[]>;
  reference: ScenarioReference;          // symbol token effects per reference card side
  agendaDeck: readonly CardCode[]; actDeck: readonly CardCode[];
  setup: readonly SetupStep[];
  modifiers?: SkillModifierRegistry;     // token values computed from the board ("-X")
}
type SetupStep = AddMapStep | SetAsideStep | BuildEncounterDeckStep | PlaceTokensStep | SpawnStep | MoveInvestigatorsStep;

```

**Extension points**

- **A new scenario:** add a folder in [`packages/scenarios/src/`](../packages/scenarios/src/) with its definition, card list (special rules as card abilities) and an end-to-end test, export it from the package index, and add an entry to the app's [scenario catalog](../apps/web/src/scenarios/scenarioCatalog.ts).
- **A new setup instruction:** add a `SetupStep` kind and its compilation in [`setup.ts`](../packages/engine/src/setup.ts). Do this only when two scenarios need it; a one-off belongs in that scenario's card abilities.

### Campaign

A campaign spans several games and outlives each of them, so it is its own aggregate in [`campaign/`](../packages/engine/src/campaign/), event-sourced like a game but with its own commands ([`handle_campaign.ts`](../packages/engine/src/campaign/handle_campaign.ts)), events and reducer ([`campaign_reducer.ts`](../packages/engine/src/campaign/campaign_reducer.ts)). The same reasons apply: undo, recovery after a crash and export come for free, and later scenarios read earlier outcomes from the log rather than from the players' memory. The two aggregates do not share a command union, so a game command can never change the campaign by accident. [`CampaignLog`](../packages/engine/src/campaign/campaign_log.ts) holds the team with trauma, XP and fate, keyed by `InvestigatorCode` (the investigator card's code, unique within a campaign; a game's `InvestigatorId` names one seat in one game instead), replaced investigators, typed story records, the chaos bag and the scenario order. [`campaign.checkInvariants`](../packages/engine/src/campaign/campaign_invariants.ts) states what must always hold (team of 1–4, no overspent XP, trauma consistent with fate). Commands name investigators by code only. The handlers look up their printed name, health and sanity in the `CampaignContext`'s `CardDb` ([`investigatorCard`](../packages/engine/src/investigator_cards.ts)), as game handlers look up cards in the `EngineContext`, so the caller cannot send stats that disagree with the card. The events still carry the full log entry, so a replay needs no context. A game's `GameState.campaign` holds a copy of the log at scenario start. Callers reach the campaign functions through the `campaign` namespace export (`campaign.handleCommand`, `campaign.compileStart`), so their names are verb + noun without repeating "campaign"; the campaign types are exported flat.

```ts
interface CampaignContext { cards: CardDb; }   // holds the investigator cards
function campaign.handleCommand(ctx: CampaignContext, log: CampaignLog, command: CampaignCommand): CampaignEvent[];  // throws CampaignCommandRejected
function campaign.applyEvent(log: CampaignLog, event: CampaignEvent): CampaignLog;
function campaign.executeCommand(ctx: CampaignContext, log: CampaignLog, command: CampaignCommand): { log: CampaignLog; events: CampaignEvent[] };
function campaign.compileStart(def: CampaignDefinition, options: CampaignOptions): StartCampaign;

type StoryValue = { kind: 'flag'; value: boolean } | { kind: 'count'; value: number }
  | { kind: 'list'; entries: string[] } | { kind: 'crossableList'; entries: CrossableEntry[] };
interface CampaignDefinition { id: CampaignDefinitionId; scenarios: readonly ScenarioId[]; chaosBag: Record<Difficulty, readonly ChaosToken[]>; }
```

The only campaign so far is Night of the Zealot ([`night_of_the_zealot/campaign.ts`](../packages/scenarios/src/night_of_the_zealot/campaign.ts)); its second and third scenarios are ids only until their data arrives.

**Extension points**

- **A new campaign:** add a `CampaignDefinition` next to its scenarios in [`packages/scenarios/src/`](../packages/scenarios/src/) and export it from the package index.
- **A new correction:** add a `CampaignAdjustment` kind and its case in [`handle_campaign_adjustment.ts`](../packages/engine/src/campaign/handle_campaign_adjustment.ts); it produces the regular event, and the result is checked against `campaign.checkInvariants`.
- **A new campaign command:** add it to [`campaign_commands.ts`](../packages/engine/src/campaign/campaign_commands.ts), handle it in `campaign.handleCommand` with a `CampaignRejection` for each way it can be refused, and produce existing events where they fit.
- **A new campaign record:** add its field to `CampaignLog`, the `CampaignEvent` that changes it in [`campaign_events.ts`](../packages/engine/src/campaign/campaign_events.ts) and its case in `campaign.applyEvent`. If it can become inconsistent, add the rule to `campaign.checkInvariants`.

### Card data

The engine reads card numbers only through a [`CardDb`](../packages/engine/src/cards.ts) in its context (`ctx.cards.get(code)` returns `CardStats`), so it never loads data itself and tests pass a small fake one. Inside the engine and the scenarios, card codes are a branded `CardCode` (card stats, card instances, setup steps, decks), so a code can't be mixed up with an instance ID or a name; an `InvestigatorCode` is a `CardCode` with one more tag. Encounter set codes (`EncounterSetCode`), scenario IDs (`ScenarioId`) and campaign definition IDs (`CampaignDefinitionId`) are branded the same way, as are the IDs the store and the caller create: `GameId` (a UUID from the store) and `CampaignId`. `@arkham/carddata` doesn't depend on the engine, so its `CardDef.code` stays a plain string until it is mapped to `CardStats`. [`@arkham/carddata`](../packages/carddata/src/) fetches ArkhamDB packs ([`fetch.ts`](../packages/carddata/src/fetch.ts)), validates the raw JSON with zod (`RawCardSchema`) and normalises it to `CardDef` ([`schema.ts`](../packages/carddata/src/schema.ts)). It also builds the investigator catalog ([`catalog.ts`](../packages/carddata/src/catalog.ts)). Investigator cards are in the same `CardDb`, so there is one place for all cards; [`investigatorCard(cards, code)`](../packages/engine/src/investigator_cards.ts) reads one as an `InvestigatorCard` (name, health, sanity, skills), and `investigatorCardStats` turns one back into `CardStats`. ArkhamDB is the community reference with a public API, CORS and translations, so cards arrive accurate and in the players' language. Fetched JSON and images are never committed: they go to `packages/carddata/.cache/` or IndexedDB. The app refreshes its copy with `If-Modified-Since` ([`loadCatalog.ts`](../apps/web/src/catalog/loadCatalog.ts)) and keeps working offline from it.

```ts
interface CardDb {
  get(code: CardCode): CardStats | undefined;
  encounterSet(encounterCode: EncounterSetCode): CardStats[];
}
interface CardStats {
  code: CardCode; name: string; typeCode: CardType; traits: readonly Trait[];
  shroud?: number; clues?: ScaledValue; fight?: number; evade?: number; health?: ScaledValue;
  damage?: number; horror?: number; doom?: ScaledValue; victory?: number;
  encounterCode?: EncounterSetCode; quantity?: number; keywords?: readonly Keyword[];
  abilities?: readonly Ability[];
  locationAttachment?: { onePerLocation?: boolean; shroud?: number; discardWhenInvestigated?: boolean };
  sanity?: number; skills?: SkillValues;   // investigators
  imageSrc?: CardImagePath; backImageSrc?: CardImagePath;   // pictures, for the views only
}
```

**Extension points**

- **A new card field:** read it in `RawCardSchema`, normalise it in `normaliseCard` ([`schema.ts`](../packages/carddata/src/schema.ts)) and, only if a rule or a view needs it, add it to `CardStats` ([`cards.ts`](../packages/engine/src/cards.ts)). The card pictures are the one view-only field: the board views pass them on, so the screen shows the side in play.
- **A new language:** add its ArkhamDB host in [`fetch.ts`](../packages/carddata/src/fetch.ts) and [`loadCatalog.ts`](../apps/web/src/catalog/loadCatalog.ts), and its UI strings in [`i18n`](../apps/web/src/i18n/).

### Persistence

[`GameStore`](../packages/engine/src/store.ts) is the only way to save or load a game. It stores each game's event log and a snapshot, replays a game on load, groups undo by `commandId`, and rejects a write whose `expectedSeq` doesn't match, so two tabs can't overwrite each other. Every command is written before the UI updates: a tablet at the table gets refreshed and runs out of battery, and with the log written first nothing is lost. The log doubles as the export format ([`gameExport.ts`](../apps/web/src/storage/gameExport.ts)) and is the basis for later sync. That is also why game IDs are UUIDs and never tied to a device. [`IndexedDbStore`](../apps/web/src/storage/IndexedDbStore.ts) implements the interface with Dexie (tables `games`, `events`, `snapshots`, `campaigns`, `cards`, `catalog`). localStorage only holds per-device settings ([`settings.ts`](../apps/web/src/settings/settings.ts)).

```ts
interface GameStore {
  createGame(init?: NewGame): Promise<GameId>;
  appendEvents(gameId: GameId, events: readonly Event[], expectedSeq?: number, commandId?: string): Promise<StoredEvent[]>;
  undoLast(gameId: GameId, expectedSeq?: number): Promise<LoadedGame | undefined>;
  loadGame(gameId: GameId): Promise<LoadedGame | undefined>;   // last snapshot + replay
  listGames(): Promise<GameSummary[]>;
  loadEvents(gameId: GameId, afterSeq?: number): Promise<StoredEvent[]>;
  importGame(game: ImportedGame): Promise<GameId>;
  renameGame(…); duplicateGame(…); deleteGame(…);
}
interface StoredEvent { gameId: GameId; seq: number; timestamp: number; commandId: string; event: Event; }
```

**Extension points**

- **A new store operation:** add a method to `GameStore` in [`store.ts`](../packages/engine/src/store.ts), with its doc comment as the contract, and implement and test it in [`IndexedDbStore`](../apps/web/src/storage/IndexedDbStore.ts).
- **A schema change:** bump the Dexie `version()` with an `upgrade`. A change of the state shape bumps `STATE_VERSION`, so older exports can be migrated or refused.

### Web app

The React PWA is a thin layer over the engine, which keeps UI problems and rules problems apart. [`App.tsx`](../apps/web/src/App.tsx) defines the hash routes; the screens are in [`screens/`](../apps/web/src/screens/): home with the saved games, the new game wizard ([`wizard/`](../apps/web/src/wizard/)) with the investigator picker ([`picker/`](../apps/web/src/picker/)), the game screen and settings, which also carries the notice that the app is an unofficial fan project, with Fantasy Flight Games' copyright credit (the condition the fan content policy sets for using the game's names; card art is never bundled, only fetched from ArkhamDB on the device). Components read state from the [app store](../apps/web/src/state/appStore.ts) and call its methods; they never change game state or touch storage themselves. The app store is a factory around a `GameStore` and a scenario lookup, so tests inject an in-memory store and their own scenarios. Markup is structure only and all presentation is in CSS built on [`tokens.css`](../apps/web/src/styles/tokens.css). The look follows the playmat (M3.12): a night-green palette with brass lines and bone text, panels that let the table show through, our own drawing of the playmat behind every screen ([`playmat.svg`](../apps/web/src/styles/playmat.svg), drawn for this app: a night sky, a brass zodiac ring and tentacles), the playmat's fonts (IM Fell English SC for headings and names, Alegreya Sans for the rest, self-hosted through `@fontsource` and precached with the playmat drawings so the PWA looks the same offline), and one brass-framed shell for every dialog. The light theme is the same playmat by day: parchment, dark brass and ink, with its own drawing ([`playmat_light.svg`](../apps/web/src/styles/playmat_light.svg)). UI strings are in [`i18n`](../apps/web/src/i18n/).

The open game (`OpenGame`) is the play screen's single source of truth. Components change it through the store's [`GameActions`](../apps/web/src/state/gameActions.ts) (`actions.moveTo(hallway)`, `actions.investigate()`, `actions.answer('pass')`), in the players' words; they never see commands or the `PlayTable`. The actions mirror the table's verbs with the screen's defaults. An action is taken by the investigator whose turn it is, since the rules allow actions only during one's own turn (refused with `noTurnInProgress` between turns). The decision dialog shows the first pending decision, so `answer` picks an option of that one (`noPendingDecision` when none is open). A skill test is never assumed passed, so an action leaves it open, and the players answer it like any decision. Taking ids out of the actions means a stale tap (a second tap on "pass") would act on whatever is open next, so the screen disables its buttons while `OpenGame.busy` says a step is queued or running. The screen reads derived values (names, doom against the agenda's threshold, the act's clues) from `OpenGame.board`, a `BoardView` the session builds after every step, instead of from raw state. Each action hands one step to a [`GameSession`](../apps/web/src/state/gameSession.ts), the buffer between the pure engine and the screen. The session holds a `PlayTable` resumed from the game's stored log (`PlayTable.resume`), so the UI shares the verbs, the atomic multi-command steps and the invariant checks of the end-to-end tests. It plays the step as one `PlayTable.step` (a step of several verbs is one undo group, kept whole or not at all), writes the events it added with `appendEvents` under the step's undo group (passing the last `seq`, so a second tab cannot interleave), and only then does the app store show the new state. A refused step writes nothing and leaves its `Rejection` on the open game for the screen to explain. If a write fails (another tab wrote first), the session rolls the table back, reloads the stored game, and the step is lost rather than shown. Steps and undos run one after another in the order they were sent, so two quick taps never both build on the same state. `undo()` takes back the last step in the table and the store alike, never the scenario start. The table is mutable, so it lives in the store's closure and only its state is published. Opening a saved game rebuilds its `ScenarioContext` from the [scenario catalog](../apps/web/src/scenarios/scenarioCatalog.ts) entry for `meta.scenarioId`, so its reference card and modifiers apply again; the investigator cards are not needed, since after setup the engine reads the investigators from the state. A game whose scenario the catalog lacks has no session and cannot be played (`playable: false`).

The [game screen](../apps/web/src/screens/GameScreen.tsx) lays the board out as product.md "UI concept" draws it. Its [header](../apps/web/src/screens/GameHeader.tsx) lays the scenario's cards out like the table: the encounter deck as a placeholder card back and a small outline for its discard pile (both empty until the encounter phase draws), the current agenda and act as landscape cards in HTML and the scenario as an upright card, as on the table, laid out like the map's location tiles (`data-card`: a frame in the card type's colour around a hatched art area, the name along the top, a plate at the foot with the count and the card's small buttons, which keeps the header compact): the agenda with all doom in play against its threshold (`BoardView.doomInPlay`, the sum the threshold check compares) and steppers for the doom on the agenda (`placeDoom`, `removeDoom`), the current act with the clue tokens on it (`ActView.clues`) against the clues it needs (`ActView.threshold`), steppers for them (`adjustActClues`, a `ManualAdjust` correction that leaves the investigators alone, until a dialog lets the players move clues there from chosen investigators) and an "Advance" once there are enough, which pays with the clues on the act (`AdvanceAct` counts them towards the requirement, so the investigators pay nothing), and the scenario card with the scenario's name (`OpenGame.scenarioNameKey`, from its catalog entry) as the screen's `h1`; then the round and phase, "Next" (`nextPhase`) and undo, which `OpenGame.canUndo` turns off while only the scenario start is left. "Next", the doom and clue steppers, "Advance" and undo are off while `busy`. The app title stays only in the title bar, which also holds the open game's [export](../apps/web/src/screens/GameExportButton.tsx) next to Settings, on the game route once its game is open; the export stays on while `busy`, since it reads the stored game and changes nothing. The screen checks once that a game is open and has a board (`OpenGame.board`, playable games only): until the game is loaded it says no game is open, and a game it cannot play gets a warning instead of the board, so the header and the map always have a board to read. Home and the title bar export through one helper (`downloadGameExport`), so a game gets the same file name from both. The [map](../apps/web/src/map/MapBoard.tsx) draws each visible map that has locations from the whole `BoardView`, since the pieces on its tiles come from all over the board (`BoardView.maps`; hidden maps are areas the players cannot see yet, and a map whose locations all left play has nothing to show) as an SVG: a tile per location at its book layout cell, drawn as a card face in layers ([`LocationTile`](../apps/web/src/map/LocationTile.tsx)): a frame in the location colour, an art area filled with a pattern for the side the location shows (revealed or unrevealed), a name band with the edit button, then what the game tracks on top, laid out like the printed card: its attachments peeking out at the right edge as small cards (named "Attached: Obscuring Fog"), once revealed the shroud (with what attachments add) at mid height on the left and the clue token on the right, each faded when it shows none, and a doom token under the clues when it has any (round, coloured like the game's tokens, each named for screen readers, "Doom 1"), then a pawn per investigator there and a round token per enemy at it (`MapView.enemies`, engaged ones at their investigator's location, ringed in the doom colour), in rows of four along the bottom edge, and a line per connection between two of its locations, with an arrowhead for a one-way one. Cards on the map stay dark in both themes, like printed cards (`--color-card-face`), and the drawing leaves room past the last column for attachments. A connection to another map's location is left out, since one drawing cannot show it. A location without a cell goes in a row below the laid-out ones ([`mapLayout.ts`](../apps/web/src/map/mapLayout.ts)), so a scenario without a layout still shows every location. Every card is one size (`CARD`, 5 : 7, within 1 % of a real card and half an ArkhamDB scan), and a tile is a portrait card, so card art can fill it. When the card data names a picture for the side in play (`image`), the tiles and the header's agenda and act load it from ArkhamDB on the player's device ([`useCardPicture`](../apps/web/src/catalog/cardImages.ts); art is never bundled) and lay it over the whole face once it has loaded (`data-picture`). The stylesheet then makes the name band and the shroud token transparent, since the picture prints them (they stay readable to screen readers), while the tokens, pieces, edit button and the header cards' plates stay on top, since they are live. Until a picture loads, and for good when it fails (offline before it was cached, the host down), the face keeps its pattern, so it never shows a broken image. The service worker caches the pictures cache-first ([`cardImageCaching`](../apps/web/src/pwa/cardImageCaching.ts)), so a started game keeps its art offline. They load as plain images without CORS, so the cache holds opaque responses, which browsers count at a padded size against the quota; the cache is capped and is the first thing dropped when the quota runs out. The SVG's user units are CSS pixels at most, so a small map keeps its tiles card-sized and a large one shrinks to fit, and the maps sit centred in the map area. The players pan the shown map with a drag and zoom it with the wheel, a pinch or its "Zoom in", "Zoom out" and "Fit map" buttons ([react-zoom-pan-pinch](https://github.com/BetterTyped/react-zoom-pan-pinch), so pinch and inertia need no gesture code of ours); the drawing starts fitted to the area and never zooms out below that. Pieces are dragged to play what the players do on the table: a copy follows the pointer ([`usePieceDrag`](../apps/web/src/map/usePieceDrag.ts)), and when it is let go `MapDrawing` reads the point (in drawing coordinates through the SVG's screen matrix, so it works at any zoom). The pawn of the investigator whose turn it is, dropped on another location's tile (`tileAt`), plays a move action (`GameActions.moveTo`). An enemy dropped on that pawn (`onPawn`, at the pawn's place in its tile's row, `pawnOffset`) plays an engage action (`GameActions.engage`); dropped on another location's tile, it moves there as a card instruction says (`GameActions.moveEnemy`, a forced `MoveEnemy`, since the players drag an enemy only when a card tells them to, and they follow it whatever the engagement, so an engaged enemy disengages and moves). The map acts on an enemy by its instance id, so `MapView.enemies` lists `MapEnemyView`s, an `EnemyView` with its id. A drop anywhere else, or a step the game refuses, leaves the piece where the game has it, and the refusal's toast says why. Draggable pieces are marked `data-drag`, and `panning.excluded` lists them (and the edit buttons) as `g[data-drag]`, so dragging one does not pan the map; the library joins each entry to its wrapper class both as is and with a leading dot, so an entry must stay a valid selector either way, and a bare attribute selector would stop every pan; the other pawns stay put, since only that investigator acts, and so do all pieces while a step is queued (`OpenGame.busy`), since the turn may have ended by the time the step plays. Each tile's edit button (a pencil at the right end of its name band, an SVG `role="button"` that also answers Enter and Space) opens its [menu](../apps/web/src/map/LocationMenu.tsx), a native modal `<dialog>`. There the players reveal the location (`GameActions.revealLocation`) and step its clues and doom (`adjustLocation`: added doom is a `PlaceDoom`, so effects that count placed doom see it; the rest are `ManualAdjust` corrections). The menu stays open across taps and reads the location fresh from the board, so its counts follow each step. Several visible maps get a tab each and show one at a time (the first until the players choose another, and again once the chosen one leaves play), since each map is drawn to fill the map area; a single map shows without tabs. The board fills the screen without scrolling the page, so a tall map is scaled down to fit its area. Tiles and connections carry accessible names (the location, "Study – Hallway"), so the map reads out and tests find pieces by role. A refusal shows as a [toast](../apps/web/src/screens/RejectionToast.tsx) over the board until the players dismiss it or the next step succeeds. Its text comes from the `rejections.<code>` UI string, falling back to `toast.fallback` for codes a tap cannot cause, so a new engine rejection never shows a raw key. A step whose card effect was skipped because a card it names is not in the game exactly once (`AbilityEffectSkipped`) shows a [notice](../apps/web/src/screens/SkippedEffectsNotice.tsx) the same way: the session names the card, the effect and the missing cards (`GameSession.skippedEffects`, as `OpenGame.skippedEffects`), and the players resolve it by hand. It stays until they dismiss it or the next step succeeds, so a refused tap meanwhile shows its toast next to it. The effect's text is `skipped.effects.<command type>`, falling back to `skipped.anEffect`.

```ts
interface AppState {
  games: GameSummary[];
  current?: OpenGame;
  startScenario(start: ScenarioStart): Promise<GameId>;
  openGame(gameId: GameId): Promise<void>;
  actions: GameActions;                    // play, store, then show; a refusal sets current.rejection
  dismissRejection(): void;
  dismissSkippedEffects(): void;
  refresh(); newGame(); renameGame(…); duplicateGame(…); deleteGame(…); exportGame(…); importGame(…);
}
interface OpenGame {
  gameId: GameId;
  state: GameState;              // always the replay of its stored log
  playable: boolean;             // the catalog has its scenario
  board?: BoardView;             // selectors: the state by card name, with thresholds; playable only
  scenarioNameKey?: string;      // i18n key of the scenario's name (catalog entry); playable only
  busy: boolean;                 // an action or undo is queued or running
  canUndo: boolean;              // a step to take back; never the scenario start
  rejection?: Rejection;         // why the last step was refused
  skippedEffects?: readonly SkippedEffect[];   // card effects the last step skipped, to do by hand
}
interface GameActions {         // gameActions.ts; one stored step each
  nextPhase(); startTurn(i);
  endTurn(); resign(); adjustActions(delta); moveTo(location);   // on the turn in progress
  investigate(); fight(enemy); evade(enemy); engage(enemy);
  answer(option, counts?);                                       // the first pending decision
  resolveEnemyAttacks(); advanceAct(spend); adjust(i, 'resources' | 'damage' | 'horror', delta);
  placeDoom(n); removeDoom(n); undo();
}
type PlayStep = (table: PlayTable) => void;   // internal to state/: only GameActions writes steps
function startGame(store: GameStore, title: string, ctx: ScenarioContext, options: SetupOptions): Promise<GameId>;
class GameSession {             // gameSession.ts
  static open(store: GameStore, gameId: GameId, ctx: ScenarioContext): Promise<GameSession>;
  readonly state: GameState;
  readonly canUndo: boolean;
  readonly skippedEffects: readonly SkippedEffect[];   // of the last step; { card, effect, missing } by name
  play(step: PlayStep): Promise<Rejection | undefined>;
  undo(): Promise<void>;
}
function createAppStore(gameStore: GameStore, scenarios?: ScenarioLookup): StoreApi<AppState>;
```

**Extension points**

- **A new screen:** add a route in [`App.tsx`](../apps/web/src/App.tsx) and a component in [`screens/`](../apps/web/src/screens/), add or extend the E2E flow that shows it ([`apps/web/e2e/`](../apps/web/e2e/)) and tag only that flow `@flow` (or, for a look rather than a journey, add a screenshot test in [`e2e/shots/`](../apps/web/e2e/shots/) tagged `@shot`), and add its strings in English and German.
- **A new refusal the players can cause:** add its text as `rejections.<code>` in English and German ([`i18n`](../apps/web/src/i18n/index.ts)); until then the toast shows the general text.
- **A new ability command the scenarios name cards for:** add its text as `skipped.effects.<type>` in English and German; until then the notice says "an effect".
- **A new game action:** add it to `GameActions` ([`gameActions.ts`](../apps/web/src/state/gameActions.ts)) as one `PlayTable` verb with the screen's defaults; a verb the table lacks is added to `PlayTable` first (architecture "Tests and debugging"), so tests gain it too. Components call the action; they never build commands or touch the table or the `GameStore`. Only an action outside the open game (like `startScenario`) gets its own `AppState` method in [`appStore.ts`](../apps/web/src/state/appStore.ts).

### Tests and debugging

Each engine module has unit tests, and invariants are covered by table tests. On top of that, one end-to-end test per scenario ([`end_to_end.test.ts`](../packages/scenarios/src/the_gathering/end_to_end.test.ts)) plays several rounds through a [`PlayTable`](../packages/engine/src/play_table.ts), a driver that speaks the game's language (below). It runs `checkInvariants` after every command and replays the whole log at the end. [`formatBoard(ctx, state)`](../packages/engine/src/format_board.ts) renders the board as stable plain text, used in inline snapshots and failure messages.

Unit tests build their table with [`newGame()`](../packages/engine/src/game_builder.ts): an immutable builder that takes locations, maps and their connections, investigators and cards in their zones, each card with its definition, plus the start options (difficulty, seed, a shuffled encounter deck), and starts them through `StartScenario`, so the table is validated like any setup and the stats sit next to where the card is placed. `withReferenceCard` and `withSkillModifiers` add a scenario with only the rules a test is about (the setup parts of a scenario don't apply, since the builder places the table). `withTurnOf` starts the table into round 1's investigation phase with one investigator's turn begun, through `NextPhase` and `StartTurn` after the `StartScenario`, for tests of what happens during a turn. The definitions are usually [blank cards](../packages/engine/src/blank_cards.ts) (`blankLocation`, `blankEnemy`, …: zeros, named after their code) with only the stats the test is about. Both live in the engine's source rather than in the test helpers, so a sandbox board or a scenario under construction can build a table the same way.

Tests read the board back through a [`BoardView`](../packages/engine/src/board_view.ts) (`boardView(ctx, state)`), and the play screen reads it as its selectors (`OpenGame.board`): structured views of the investigators, enemies, locations (with shroud once revealed, which `LocationView.revealed` narrows to, doom, and the picture of the side they show when the card data has one, `image`), maps (`MapView`: a map's locations with their layout cells, its connections between them and the enemies at each location, with their ids, since the map acts on them), agenda (with its doom threshold for the player count, compared with `doomInPlay`), act (with its clue requirement, compared with `cluesHeld`; both with the picture of their front, `image`), open decisions and due enemy attacks, each derived from the state when read (getters, so a reader pays only for what it reads and nothing is copied that could fall out of date), with empty fields left out so an expectation lists only what is there (`expect(board.investigator(alice)).toMatchObject({ clues: 1 })`). Its read-backs `perInvestigator(field)` (one field of every investigator by id, in seat order: `{ roland: 1, daisy: 3 }`) and `locationsOn(map)` (location names on a map, in map order) let one `toEqual` check the whole table; `EnemyView` has no instance id so views compare whole. Its finders (`investigator`, `location`, `enemy`) take a matcher or the bare id (`CardRef` = `CardMatcher | InstanceId`, `InvestigatorRef` = `InvestigatorMatcher | InvestigatorId`; `cardMatcher` / `investigatorMatcher` normalise a bare id to `byId(id)`) from [`card_matchers.ts`](../packages/engine/src/card_matchers.ts) (`byName('Hallway')`, `byId(instanceId)`, `byCode(code)`, `byAny('hall')`: id, code or name, whole values only) and throw a `TableError` with the board (`formatBoard`) appended when nothing or several cards match, so a test never acts on the wrong copy of a card. The matching itself is the pure `matchingCards(ctx, cards, matcher)` (`matchingInvestigators` for seats), not part of `BoardView`, so command handlers can resolve a player's reference the same way; `describeMatcher` words a matcher for errors. Investigators are seats, not card instances: `byId` is overloaded so an `InvestigatorId` yields an `InvestigatorMatcher`, while name, code and any-identifier matchers serve both. Views show printed names as the branded `CardName` (`at`, `threatArea`, `cards`, `attachments`, `about`), never instance ids, which stay reachable through `location(...).id`. An enemy also takes `enemyMatching(card, { engagedWith, at })`, an `EnemyMatcher` that narrows by engaged investigator and location with the same refs, or its bare id (`EnemyRef` = `EnemyMatcher | InstanceId`, normalised by `enemyMatcher`). Only `BoardView.enemy` applies the narrowing, since it needs zones; `matchingCards` takes the plain `CardMatcher` variants.

A [`PlayTable`](../packages/engine/src/play_table.ts) plays a built table in game language: `PlayTable.start(newGame()…)` (which also begins the turn of `withTurnOf`; `PlayTable.from(ctx, startCommand)` for any start command, `PlayTable.setUp(ctx, { investigators, seed, difficulty? })` for a scenario's compiled setup) keeps the live state and the event log, so `replay(table.events)` equals `table.state`. Its methods are the players' steps (`nextPhase()`, `startTurn(alice)`, `moveTo(byName('Roland Banks'), byName('Hallway'))`, `investigate`, `fight`, `evade`, `answer(byName('Crypt Chill'), 'fail')`, `resolveTest`, `placeDoom` and `removeDoom`, the latter a `ManualAdjust` since no rule removes doom yet). Every investigator parameter takes an `InvestigatorRef`, every card a `CardRef` and every enemy an `EnemyRef` (a matcher or the bare id, e.g. `answer(instanceId('ghoul_b'), 'attack')`), resolved through `table.board`. `table.board` reads the result back as a fresh `BoardView`. The action methods pass their skill test by default; `result: 'fail'`, `{ failedBy: n }` or `'open'` (answered later with `resolveTest`) say otherwise. Each step is one undo group (all commands of `investigate` share one `commandId`), so `undo()` takes back the whole step (`canUndo` says whether more than the start is left); `step(() => …)` plays several verbs as one such step, and `PlayTable.resume(ctx, entries)` goes on from a stored log with its groups (`entries` exposes the log with the ids). Each step runs through `execute` and `checkInvariants`: a refused command is a `TableRejected` (the engine's `rejection`, plus the board in the message), a wrong name or decision a `TableError`, and a failed step leaves state and log as they were, even one of several commands (`investigate`, `fight`, `evade`, `resolveEnemyAttacks`), which run atomically. The scenario's end-to-end test is such a script: it starts with `PlayTable.setUp`, asserts each "Next" through the returned `PhaseStop`, and reads the rest from `table.board`, with `table.formatted()` snapshots only at setup and at the end of round 7.

**Extension points**

- **A new kind of table piece:** add a `with*` method to `GameBuilder` that turns it into starting cards, investigators or maps of the `StartScenario`; never set state directly.
- **A new way to find a card:** add a variant to `CardMatcher` in `card_matchers.ts` with its builder and its case in `matchingCards`, `matchingInvestigators` and `describeMatcher`; `BoardView` and the test table pick it up.
- **A rule change:** add a step to the end-to-end test where the rule shows at the table, so reviewers see it in context.
- **A new player step:** add a method to `PlayTable` that issues the command (or decision answer) for it, taking investigators as `InvestigatorRef`, cards as `CardRef` and enemies as `EnemyRef`.
- **A new kind of read-back:** add a field to the matching view in [`board_view.ts`](../packages/engine/src/board_view.ts), or a new view and finder, so tests read the board in game terms instead of from raw state.
