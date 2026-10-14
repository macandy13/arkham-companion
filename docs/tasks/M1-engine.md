# M1 – Generic engine

Goal: all generic rules from architecture §6 in `packages/engine`, driven only by commands and tested without any UI.
At the end a hand-written **test scenario** – The Gathering from the original Core Set, with real card codes but hand-entered stats and no card text – can be played through a whole game in tests (it replaced the earlier invented sandbox scenario in M1.2).

**Why this milestone**

- **Problem:** The rules for the scenario side (doom, agenda/act, encounter deck, map, enemies) are what makes the app useful – and what players most often get wrong at the table. They must be correct before anything is drawn on screen.
- **What the app gains:** A complete, deterministic rules core that can play a whole (fake) scenario in tests. The UI milestones (M2/M3) then only present state and send commands; real scenarios (M4+) become mostly data plus a few hooks.
- **Why at this point:** The UI is defined by the commands and state this milestone creates, so it has to exist first. A sandbox scenario with fake cards lets us test every rule quickly and without depending on real card data or copyrighted text while the rules are still changing.

Model hint: **S** = Sonnet is enough, **O** = use Opus (design-heavy). Do tasks in order; each task = one session = one PR.
Start from the phone: Code tab → repo → `Do task M1.x from docs/tasks/M1-engine.md`.

Every task: new commands/events go through `handle` → `apply`, invariants keep passing, tests use invented cards or the hand-written Gathering scenario (hand-entered stats, no card text/JSON/images).

---

## M1.1 Card definitions inside the engine (O)

**Why:** Rules need card numbers (doom threshold, shroud, enemy health), but the engine must stay pure and cannot load files. Passing a `CardDb` in a context object keeps it pure and lets tests use small fakes.

**Benefit:** Every rule module looks up card stats the same way, and per-investigator scaling ("2 per investigator") lives in one place.

Ref: §5, §9. The engine must read card stats (doom threshold, clues, shroud, health, keywords) without depending on `carddata` at runtime.

- [x] `CardDb` interface passed into `handle(ctx, state, command)` (`ctx.cards.get(code)`); reducer stays card-agnostic
- [x] Per-investigator value helper (`ScaledValue` + `resolveValue`, covers `health_per_investigator`/`clues_fixed`)
- [x] Fake `CardDb` fixture shared by all engine tests (now `test/utils/cards.ts`)

Done when: existing tests pass with the new signature; one test reads a threshold through `CardDb`.

Done: `packages/engine/src/cards.ts` adds `CardStats` (the engine's own card type, so it has no runtime dependency on `carddata`), `CardDb`, `EngineContext`, `cardDbFrom` and `cardStats` (throws `unknownCardCode`). `CardStats` is typed: `typeCode: CardType` (union of ArkhamDB type codes, `CARD_TYPES`), `traits: Trait[]` (branded, built with `trait`), `stage: CardStage` (`{ number, variant? }`, so alternative cards like 2a/b vs 2c/d share a number and differ by variant), and `clues`/`health`/`doom` are `ScaledValue`s (`{ fixed, perInvestigator }`) resolved with `resolveValue(value, playerCount)`. Game-state terms like "+1 per act" are left to the rules that read them. `handle(ctx, state, command)` and `execute(ctx, state, command)` take the context first; `StartScenario` rejects card codes missing from `ctx.cards`. Shared fixture: moved in M1.2 to `packages/engine/test/utils/cards.ts` (`testContext`, `testCardDefs`).
Follow-ups: map carddata's `CardDef` to `CardStats` (`health`/`health_per_investigator`, `clues`/`clues_fixed` → `ScaledValue`, `stage` → `CardStage`, `type_code` → `CardType`) when the web app gets a `CardDb` backed by the cached carddata (M2); the stage variant letter is not in ArkhamDB and has to come from scenario data; `keywords` gets added to `CardStats` with the keyword parser (M1.7).

## M1.2 Setup DSL + test scenario (O)

**Why:** Setup is where scenarios differ most. A declarative setup language makes a scenario mostly data instead of code, and the same steps also cover mid-scenario changes (§7). The sandbox gives us a scenario we fully control for all later M1 tests.

**Benefit:** Adding a scenario later means filling in a definition rather than writing engine code; setup results are testable.

Ref: §7.

- [x] `ScenarioDefinition` type and `SetupStep` union (`addMap` with its locations and connections, `setAside`, `buildEncounterDeck`, `placeTokens`, `spawn`, `moveInvestigators`)
- [x] `compileSetup(ctx, def, options) -> StartScenario` (setup steps become starting cards + follow-up commands)
- [x] Test scenario in `packages/scenarios/src/the-gathering/` (The Gathering, hand-entered stats; replaced the invented sandbox after review)
- [x] Test: its setup produces the expected zones and counts

Done: `packages/engine/src/setup.ts` adds `SetupStep` (a union of one named type per step: `AddMapStep`, `SetAsideStep`, `BuildEncounterDeckStep`, `PlaceTokensStep`, `SpawnStep`, `MoveInvestigatorsStep`), `TokenAmount`, `SetupOptions` and `compileSetup(ctx, def, options)`, which runs the steps in order and returns one `StartScenario` (no follow-up commands are needed yet). `packages/engine/src/scenario.ts` holds `ScenarioDefinition` with its scenario reference card: `reference: Record<'easyStandard' | 'hardExpert', Partial<Record<SymbolToken, { modifier?, effectKey }>>>` (data only, `referenceSide(difficulty)` picks the side; resolving tokens comes later) next to the per-difficulty `chaosBag`.
Map model (review on PR #18): `packages/engine/src/map.ts` adds `GameMap` (`{ name, visible, connections: Edge[] }`, plain data with pure functions – `createMap`, `mapLocations` – instead of a class, so the event-sourced state stays JSON) and moves `Edge` there. A map owns its connections; its locations are the cards in zone `{ kind: 'location', mapId }`. `Board.connections` is gone: `StartScenario.maps` takes `MapSpec`s with their connections, `ScenarioStarted.maps` carries `GameMap`s, and the reducer writes `board.maps` as one unit. `handle` rejects an edge whose end is not a location (`notALocation`) or on another map (`locationOnOtherMap`). The `addMap` step declares the map's locations (`{ code, faceUp? }`) and connections (by code, resolved among its own locations) together; `putIntoPlay` and `addConnection` are gone. Spawning goes through `spawnZone(locationId)` (`spawn.ts`), the seed of M1.8's spawn rules.
Steps refer to cards by code; instance IDs are `<code>#<copy>`. `buildEncounterDeck` takes "the remainder" of its sets: every enemy/treachery copy not used by another step (counted over all steps), minus `exclude`. Locations that start revealed (including the one `moveInvestigators` reveals) get their clues. `CardStats` gained `encounterCode`/`quantity`, `CardDb` gained `encounterSet(code)`.
Test scenario: `packages/scenarios/src/the-gathering/` (`theGathering`, `theGatheringCards`, `theGatheringCardDefs`, `GATHERING_CODES`, `GATHERING_SETS`, and `theGatheringHouse` – the map act 1 reveals), exported from `@arkham/scenarios`; real core-set codes (`011xx`), hand-entered stats, no card text. Card builders take options objects. Web usage: `execute(ctx, emptyState(), compileSetup(ctx, theGathering, options))` with `ctx = { cards: theGatheringCards }`.
Tests: shared helpers in `packages/engine/test/utils/` (`standardInvestigators`/`investigators(n)`, `makeInvestigator`, `makeCard`, `contextWith`, `testContext`, `makeDefinition`, `makeSetupOptions`, `startScenario`, `run`, `codesIn`, `rejectionOf`; `@arkham/engine/test/utils` from other packages). fast-check is gone: property tests became `it.each` tables (`replay.test.ts`, `rng.test.ts`, the Gathering setup per player count).
Follow-ups: `spawn` at setup does not engage investigators at that location (M1.8 – extend `spawnZone`, then compile it to a follow-up `SpawnEnemy`); mid-scenario use of the same steps (compile against a running state into `AddConnection`/`SpawnEnemy`/… commands, and apply `theGatheringHouse` when act 1 advances, taking its locations from the set-aside zone) once those commands exist (M1.3, M1.5, M1.7, M1.8); `Investigator` has no skill values, so the standard test investigators have none yet; `keywords` (Hunter, Retaliate, Spawn …) for the Gathering cards once `CardStats` has them (M1.7); remaining §7 steps (`putIntoPlay` for single locations, `replaceLocation`, `removeLocation`, `randomLocations`, `removeConnection`, `fromSetAside`, `shuffleInto`, `removeFromGame`) and layout slots (M3) when a scenario needs them; the later tasks below still say "sandbox" and mean the Gathering test scenario.

## M1.3 Board: connection graph (S)

**Why:** Investigator movement, hunter enemies and many card effects depend on which locations connect. An explicit graph (not positions on screen) handles one-way edges, several maps and connections that change during play.

**Benefit:** Correct movement and pathing; the map UI in M3 only has to draw the graph.

Ref: §5 Map model.

- [x] `Edge` type (undirected and one-way), `ConnectionChanged` event, `AddConnection`/`RemoveConnection` commands
- [x] Connections from scenario data (`connections` spec by symbol or code), only active when both locations are in play
- [x] Reveal location (`CardFlipped`) places clues per investigator
- [x] Helpers: `neighbours(locationId)`, `shortestPaths(from, to)` (BFS, returns all shortest paths)
- [x] Multiple maps: locations carry `mapId`; cross-map edges allowed

Done: events `ConnectionChanged` (`added`/`removed`, with the owning `mapId` and the stored edge) and `CardFlipped`; commands `AddConnection` (names the owning `mapId`), `RemoveConnection` (finds the owner itself) and `RevealLocation` (`CardFlipped` + a `TokensChanged` for the clues, resolved with `resolveValue` like setup does). Edges live on `GameMap.connections`; the reducer updates the owning map. Cross-map edges are allowed and stored on exactly one map, the one named by the command (setup: the map whose `addMap` step declares it); ends may be on any map and movement ignores the owner, so `locationOnOtherMap` is gone. Undirected edges match either direction, one-way edges exactly; duplicates (also across maps), self-loops and unknown edges are rejected. Ends only have to be location cards by type, wherever they currently are, so set-aside locations can be connected. `board.ts`: `neighbours`, `shortestPaths` (BFS, all shortest paths) and `allConnections`; they only follow edges whose ends are both in a `location` zone (`isLocationInPlay`). `checkInvariants` checks edges name known cards and are unique. Tests: `board.test.ts` (`it.each` tables) with `startBoard`/`edge`/`runFrom` in `test/utils/board.ts`.
Follow-ups: `MoveInvestigator` (M1.4) should reveal an unrevealed destination via `RevealLocation`; `moveInvestigators` at setup could emit `RevealLocation` instead of flipping at compile time once setup can produce follow-up commands; the `connections` spec by symbol is still by code (symbol data comes with the M2 pipeline); removing or replacing a location card does not yet drop its edges (decide with the `replaceLocation`/`removeLocation` setup steps).

## M1.4 Investigators (S)

**Why:** The app replaces health/sanity dials and clue/resource piles, and enemy rules (prey) need to compare investigators.

**Benefit:** Fewer physical tokens, automatic defeat detection, and prey choices the engine can compute.

Ref: §5 `Investigator`.

- [x] `MoveInvestigator`, `AdjustInvestigator` (damage, horror, clues, resources), `DiscoverClues` (location → investigator)
- [x] Defeat check when damage ≥ health or horror ≥ sanity → `InvestigatorDefeated`, status `defeated`
- [x] Prey helpers: lowest remaining health/sanity, most clues, etc.

Done: Investigators already carry `health.max`/`sanity.max` in state (from the definition at `StartScenario`), so no new fields. Commands `MoveInvestigator`, `AdjustInvestigator`, `DiscoverClues`; events `InvestigatorMoved`, `InvestigatorChanged` (`stat` + `delta`), `InvestigatorDefeated` (`cause`). Movement needs a `neighbours` connection; `ignoreConnections` (for "move to any location" card effects) skips only that check, the destination must still be a location in play. An investigator without a location can be placed anywhere. An unrevealed destination is revealed by reusing `handleRevealLocation` (`CardFlipped` + the printed clues resolved with `resolveValue`). `AdjustInvestigator` emits `InvestigatorDefeated` in the same step when damage ≥ health or horror ≥ sanity; non-active investigators reject all three commands (`investigatorNotActive`), counters cannot go below zero. `DiscoverClues` requires the investigator to be at the location. `checkInvariants` checks non-negative counters, known location and "active implies health and sanity left". Prey helpers in `investigators.ts` (`lowestRemainingHealth`, `lowestRemainingSanity`, `mostClues`, `mostResources`) return all tied active investigators. `GameMeta.playerCount` is documented as the starting count, never decremented on defeat/resign. Tests: `investigators.test.ts` (example and `it.each` table tests; built on `startBoard`, `makeInvestigator`, `investigatorOf` from `test/utils`, and `startBoard` takes an `investigators` option for custom ones).
Follow-ups: on defeat the rules also discard the investigator's cards, put their clues on their location and replace a defeated lead investigator – not done yet (needs decks/threat area, M1.5+ and a lead-change command); `resigned` status has no command yet; highest-skill prey needs the investigator's `CardStats` (skills) – add with the hunter/prey decision in M1.8/M1.9; the generic min/max tie helper could move to `@arkham/util` once that package exists.

## M1.5 Agenda, act and doom (S)

**Why:** Doom and the agenda/act decks are the clock of every scenario. Summing doom by hand is easy to get wrong once doom sits on several cards (agenda, enemies, locations, player cards), so the app keeps the running total. Doom on player cards matters too, but the app does not model player cards – so each investigator gets a plain doom counter that counts toward the total. The engine asks before advancing instead of advancing silently ("assistant, not referee", §2).

**Benefit:** The app tells players when the agenda or act should advance and what happens next; a scenario ends with a resolution the campaign can record.

- [x] `PlaceDoom` (on agenda or any card), doom total = agenda + cards in play + each investigator's player-card doom counter
- [x] Per-investigator doom counter for doom on player cards the app does not track (`Investigator.doomOnPlayerCards`, adjusted via `AdjustInvestigator`)
- [x] Threshold check emits a `DecisionRequested` "advance agenda?" instead of advancing silently
- [x] `AdvanceAgenda` / `AdvanceAct`: flip, run reverse-side hook, next card; clue threshold per investigator for act
- [x] Scenario end hooks when the last agenda/act advances (`ScenarioEnded` with resolution id)

Done: `Investigator.doomOnPlayerCards` (new required field) is an `InvestigatorStat`, so `AdjustInvestigator` adjusts it. `doom.ts`: `isInPlay` (any card, by zone; not to be confused with the private location-only `isLocationInPlay` in `board.ts`; of the agenda/act decks only the current card is in play), `doomInPlay` (cards in play incl. agenda + counters of active investigators only), `agendaThresholdDecision`/`withAgendaCheck`. New commands `PlaceDoom` (current agenda by default; positive amount; card must be in play), `AdvanceAgenda`, `AdvanceAct` (`spend` lists who pays; total must equal the act's printed clues resolved with `resolveValue` for the starting player count); events `DecisionRequested`, `AgendaAdvanced`, `ActAdvanced`, `ScenarioEnded` (`GameMeta.resolution`). `ScenarioStarted` now sets `agenda.current`/`act.current` to the top of each deck. After `PlaceDoom` or a `doomOnPlayerCards` adjustment that reaches the threshold, a `DecisionRequested` of kind `advanceAgenda` is added to `pending` (id `advanceAgenda:<agendaId>`, not repeated while open); `Decision` gained an optional `subject`, and advancing drops decisions about the old card. Advancing flips the card, moves it to `outOfGame`, makes the next card current; `AdvanceAgenda` also removes all doom in play. The last card of a deck needs `resolution` and then emits `ScenarioEnded`. The reverse-side hook is the no-op `reverseSideEvents` in `handle-scenario.ts`. The agenda threshold is a `ScaledValue` resolved with `resolveValue` like the act's clues. Tests: `doom.test.ts` (example tests on `testContext` plus an `it.each` table for the doom-total invariant: agenda + cards in play + investigators' counters).
Follow-ups: M1.9 `ResolveDecision` must turn "yes" into `AdvanceAgenda` and clear the decision (declining currently leaves it pending; no re-ask until it is cleared); M1.6 plugs the reverse-side hook into `reverseSideEvents` and uses it to apply `theGatheringHouse` when act 1 advances (needs mid-scenario setup steps, taking the locations from the set-aside zone); the threshold check runs after every doom placement, not only in the mythos phase - M1.10 should gate it; `ManualAdjust` doom changes do not run the check; the resolution id comes from the caller until agenda/act reverse sides are data; commands after `ScenarioEnded` are not blocked yet; `ManualAdjust` can still move the current agenda/act out of its deck; rules to double-check: removing all doom on every agenda advance (also card-effect advances) and ignoring defeated investigators' doom counters.

## M1.6 Triggers and hooks (O)

**Why:** Forced effects ("after doom is placed…", "when this agenda advances…") are how scenarios bend the rules. A generic trigger bus lets scenarios plug in without changing engine code.

**Benefit:** Scenario-specific mechanics stay in scenario files; the loop guard prevents a bad hook from hanging the app.

Ref: §6 Triggers, §7 hooks.

- [x] Trigger bus: after events are produced, hooks (`afterDoomPlaced`, `onAgendaAdvance[code]`, `onActAdvance[code]`, `onRoundEnd`, `onCardEnters`) may return follow-up commands
- [x] Hooks are pure functions `(ctx, state, event) -> Command[]`; the bus runs each returned command through `handle` like a player command, so hook effects are validated and can use card data and the RNG the same way (returning raw events would bypass both). Loop guard against infinite chains
- [x] Effects registry keyed by card code (empty except a sandbox card that adds a connection)

Done: `packages/engine/src/triggers.ts` adds `TriggerHook<E>` (`(ctx, state, event) -> Command[]`; the triggering event is passed so a hook knows which card/amount fired it), `ScenarioHooks` (`afterDoomPlaced` on every positive doom `TokensChanged`, `onAgendaAdvance[code]`/`onActAdvance[code]` on `AgendaAdvanced`/`ActAdvanced`, `onCardEnters` on a `CardMoved` from outside play into play, `onRoundEnd` declared only), `CardEffect` (`onReveal` on `CardFlipped` face up), `EffectsRegistry` and `MAX_TRIGGERED_COMMANDS` (50). Hooks and effects reach the engine through `EngineContext.hooks`/`effects` (code, so not in the serialisable state); `ScenarioDefinition.hooks` holds a scenario's hooks for the app to pass in. The bus lives in `handle`: after a command's events, `triggeredCommands` collects the matching hooks (matched per event, evaluated on the state after all of the command's events; order = event order, scenario hooks before card effects) and each follow-up is handled like a player command, depth first, its events appended to the same list. **Grouping:** one player command returns one event list including its whole forced-effect chain, so M1.11 can undo it as one group. `ManualAdjust` and `StartScenario` fire no triggers (corrections and setup are not game events). A rejected follow-up rejects the originating command with `triggeredCommandRejected` (innermost command type + reason); more than 50 follow-ups in one chain reject it with `triggerLoop`; `execute` stays atomic, so the state is unchanged either way. The M1.5 no-op `reverseSideEvents` is gone; the reverse side is now the `onAgendaAdvance`/`onActAdvance` hook. Sandbox: `sandboxEffects` (`packages/scenarios/src/sandbox/effects.ts`) – revealing the Library (`SB-L2`) connects it to the set-aside Hidden Crypt (`SB-L6`). Tests: `triggers.test.ts`, `triggers.property.test.ts` (random chain length/fan-out/invalid step: finishes within the guard or rejects with the state unchanged), `sandbox/effects.test.ts`.
Follow-ups: `onRoundEnd` fires once M1.10 emits a round-end event; `onCardEnters` has no producer yet (only `ManualAdjust`/setup move cards into play) – `DrawEncounter`/`fromSetAside`/`SpawnEnemy` (M1.7/M1.8) will feed it; simultaneous forced effects run in a fixed order instead of letting the lead investigator choose (M1.9 `chooseOption` decision if a scenario needs it); forced effects that need confirmation ("apply a forced effect?", M1.9 `confirm`) are applied directly; hook chains after the last agenda/act now run after `ScenarioEnded` (M1.5 put the reverse side before it) – revisit when commands after the end are blocked; sibling follow-ups are computed from the same snapshot, so a hook should not return several commands that depend on each other's effect; a skipped "resolve as much as possible" (rules) is up to the hook, the bus rejects instead of partially applying.

## M1.7 Encounter deck and mythos draw (S)

**Why:** The encounter deck is the main thing the app takes off the players' hands. Parsing keywords once at load time lets every rule module react to them consistently.

**Benefit:** No manual shuffling or drawing of the encounter deck; surge, peril and empty-deck reshuffles are never forgotten.

- [ ] `DrawEncounter(investigator)`: top card → revealed; treachery → discard or threat area; enemy → spawn
- [ ] Keyword parser (surge, peril, hunter, aloof, elite, massive, retaliate, alert, patrol, prey, spawn, victory X) from card text → `keywords` on `CardDef` at load time
- [ ] Surge draws again; empty deck reshuffles discard
- [ ] `drawTopmostFromDiscard(name)`, `fromSetAside(codes, to)`, `shuffleInto` primitives

## M1.8 Enemies (S)

**Why:** The enemy rules are not hard, but tracking every enemy's location, engagement, exhaustion and damage, and moving each hunter every round, is tedious bookkeeping. This is a quality-of-life feature: the app does the routine part so players only confirm it.

**Benefit:** The app shows where hunters move and which enemies attack whom; real ties are handed to the players as decisions.

- [ ] `SpawnEnemy` (spawn instruction or drawing investigator's location), engagement unless aloof
- [ ] `EngageEnemy`, `DisengageEnemy`, `DefeatEnemy` (to discard or victory display), damage tokens, exhaust/ready
- [ ] Hunter movement in the enemy phase: shortest path toward nearest investigator/prey; ties → `DecisionRequested`
- [ ] Enemy attack list for the enemy phase (engaged, ready enemies)

## M1.9 Decisions (S)

**Why:** The rules often leave choices to the players. One generic decision mechanism means the engine never guesses, and the UI needs only one dialog for all of them. Blocking other commands while a decision is open keeps the state consistent.

**Benefit:** Predictable flow, and a single reusable decision dialog in M3.

- [ ] `Decision` model (id, prompt key, kind, options, who decides: lead investigator, a specific investigator, or the group), `ResolveDecision` command
- [ ] Decision kinds (one UI component each in M3.7):
  - `confirm` – yes/no before the engine does something it could do automatically (advance agenda/act, apply a forced effect)
  - `chooseInvestigator` – "an investigator of your choice", prey ties, who an enemy engages
  - `chooseLocation` – spawn location or hunter destination ties, "a location of your choice"
  - `chooseCard` – which enemy/card an effect targets, which copy to take
  - `chooseOption` – card text with alternatives ("choose one: take 2 damage or discard 2 cards")
  - `skillTestResult` – the outcome of a skill test the players resolve at the table (see below)
- [ ] Rule of thumb: a **decision** is any choice the engine needs answered before it can continue (including choices the rules give to players). Things players do on their own initiative (move, investigate, fight, adjust tokens) are **commands**, not decisions.
- [ ] While decisions are pending, other commands are rejected except `ManualAdjust`/`ResolveDecision`
- [ ] Tests for hunter tie, spawn choice, agenda advance confirmation, skill test pass/fail

## M1.10 Phase assistant (O)

**Why:** Players think in rounds and phases, not in individual rules. The phase assistant ties all modules into that structure. Skill tests stay with the players (§1), but many game steps depend on their outcome, so the engine needs a small, explicit hand-off: it states the test (skill, difficulty incl. shroud or enemy value), the players resolve it with their cards and chaos bag, and they enter pass/fail; the engine then applies the consequence.

**Benefit:** One "Next" button drives the whole round; the mythos phase runs automatically.

Ref: §6 Phase assistant.

- [ ] `NextPhase` walks mythos → investigation → enemy → upkeep with round counter
- [ ] Mythos: place doom, threshold check, encounter draw per investigator in player order (skipped in round 1)
- [ ] Enemy: hunters move, list attacks; Upkeep: ready all, +1 resource, reset per-round flags
- [ ] Per-round "turn taken" flag per investigator (not an `InvestigatorStatus`, see M0.4 note)
- [ ] Skill test hand-off: investigation-phase quick actions `Investigate`, `Fight`, `Evade` and card-driven tests ("test Willpower (3); if you fail…") raise a `skillTestResult` decision with skill and difficulty; the answer (pass/fail, optionally "failed by N") triggers the consequence (discover clue, damage the enemy, exhaust and disengage it, or the card's fail effect). Players can skip the test and adjust manually instead.

## M1.11 Undo and replay (S)

**Why:** Mis-taps happen constantly at the table, so undo is essential. With event sourcing it is just "drop the last command's events and replay".

**Benefit:** Any action can be undone safely, and because the RNG state is restored too, undo cannot be used to re-roll a shuffle.

- [ ] Event log grouped by command (`commandId`), `Undo` removes the last group and replays from the latest snapshot
- [ ] Property test: random command sequences → undo all → initial state

## M1.12 Sandbox playthrough (S)

**Why:** Unit tests prove each module alone; this proves they work together. The scripted game becomes a regression test for every later change.

**Benefit:** Confidence to build the UI on top of the engine, and an architecture doc that matches the code.

- [ ] Golden-replay test: scripted full game of the sandbox scenario to a resolution
- [ ] Property test: random legal commands never break invariants
- [ ] Update §6 of `docs/architecture.md` if anything changed

Done when: the sandbox scenario plays to an end in tests; engine coverage ≥ 90 %.
