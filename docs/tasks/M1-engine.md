# M1 – Generic engine

Goal: all generic rules from architecture §6 in `packages/engine`, driven only by commands and tested without any UI.
At the end a hand-written **sandbox scenario** (fake card codes, 5–6 locations, a few enemies and treacheries) can be played through a whole game in tests.

Model hint: **S** = Sonnet is enough, **O** = use Opus (design-heavy). Do tasks in order; each task = one session = one PR.
Start from the phone: Code tab → repo → `Do task M1.x from docs/tasks/M1-engine.md`.

Every task: new commands/events go through `handle` → `apply`, invariants keep passing, tests use fake cards only.

---

## M1.1 Card definitions inside the engine (O)

Ref: §5, §9. The engine must read card stats (doom threshold, clues, shroud, health, keywords) without depending on `carddata` at runtime.

- [ ] `CardDb` interface passed into `handle(state, command, ctx)` (`ctx.cards.get(code)`); reducer stays card-agnostic
- [ ] Per-investigator value helper (`perInvestigator(n)`, `health_per_investigator`)
- [ ] Fake `CardDb` fixture shared by all engine tests (`test/fixtures/sandbox-cards.ts`)

Done when: existing tests pass with the new signature; one test reads a threshold through `CardDb`.

## M1.2 Setup DSL + sandbox scenario (O)

Ref: §7.

- [ ] `ScenarioDefinition` type and `SetupStep` union (`putIntoPlay`, `setAside`, `buildEncounterDeck`, `placeTokens`, `spawn`, `moveInvestigators`, `addMap`, `addConnection`)
- [ ] `compileSetup(def, options) -> StartScenario` (setup steps become starting cards + follow-up commands)
- [ ] Sandbox scenario in `packages/scenarios/src/sandbox/` using only fake codes
- [ ] Test: sandbox setup produces the expected zones and counts

## M1.3 Board: connection graph (S)

Ref: §5 Map model.

- [ ] `Edge` type (undirected and one-way), `ConnectionChanged` event, `AddConnection`/`RemoveConnection` commands
- [ ] Connections from scenario data (`connections` spec by symbol or code), only active when both locations are in play
- [ ] Reveal location (`CardFlipped`) places clues per investigator
- [ ] Helpers: `neighbours(locationId)`, `shortestPaths(from, to)` (BFS, returns all shortest paths)
- [ ] Multiple maps: locations carry `mapId`; cross-map edges allowed

## M1.4 Investigators (S)

Ref: §5 `Investigator`.

- [ ] `MoveInvestigator`, `AdjustInvestigator` (damage, horror, clues, resources), `DiscoverClues` (location → investigator)
- [ ] Defeat check when damage ≥ health or horror ≥ sanity → `InvestigatorDefeated`, status `defeated`
- [ ] Prey helpers: lowest remaining health/sanity, most clues, etc.

## M1.5 Agenda, act and doom (S)

- [ ] `PlaceDoom` (on agenda or any card), doom total = agenda + cards in play
- [ ] Threshold check emits a `DecisionRequested` "advance agenda?" instead of advancing silently
- [ ] `AdvanceAgenda` / `AdvanceAct`: flip, run reverse-side hook, next card; clue threshold per investigator for act
- [ ] Scenario end hooks when the last agenda/act advances (`ScenarioEnded` with resolution id)

## M1.6 Triggers and hooks (O)

Ref: §6 Triggers, §7 hooks.

- [ ] Trigger bus: after events are produced, hooks (`afterDoomPlaced`, `onAgendaAdvance[code]`, `onActAdvance[code]`, `onRoundEnd`, `onCardEnters`) may append more events
- [ ] Hooks are pure functions `(state, ctx) -> Command[] | Event[]`; loop guard against infinite chains
- [ ] Effects registry keyed by card code (empty except a sandbox card that adds a connection)

## M1.7 Encounter deck and mythos draw (S)

- [ ] `DrawEncounter(investigator)`: top card → revealed; treachery → discard or threat area; enemy → spawn
- [ ] Keyword parser (surge, peril, hunter, aloof, elite, massive, retaliate, alert, patrol, prey, spawn, victory X) from card text → `keywords` on `CardDef` at load time
- [ ] Surge draws again; empty deck reshuffles discard
- [ ] `drawTopmostFromDiscard(name)`, `fromSetAside(codes, to)`, `shuffleInto` primitives

## M1.8 Enemies (S)

- [ ] `SpawnEnemy` (spawn instruction or drawing investigator's location), engagement unless aloof
- [ ] `EngageEnemy`, `DisengageEnemy`, `DefeatEnemy` (to discard or victory display), damage tokens, exhaust/ready
- [ ] Hunter movement in the enemy phase: shortest path toward nearest investigator/prey; ties → `DecisionRequested`
- [ ] Enemy attack list for the enemy phase (engaged, ready enemies)

## M1.9 Decisions (S)

- [ ] `Decision` model (id, prompt key, options, who decides), `ResolveDecision` command
- [ ] While decisions are pending, other commands are rejected except `ManualAdjust`/`ResolveDecision`
- [ ] Tests for hunter tie, spawn choice, agenda advance confirmation

## M1.10 Phase assistant (O)

Ref: §6 Phase assistant.

- [ ] `NextPhase` walks mythos → investigation → enemy → upkeep with round counter
- [ ] Mythos: place doom, threshold check, encounter draw per investigator in player order (skipped in round 1)
- [ ] Enemy: hunters move, list attacks; Upkeep: ready all, +1 resource, reset per-round flags
- [ ] Per-round "turn taken" flag per investigator (not an `InvestigatorStatus`, see M0.4 note)

## M1.11 Undo and replay (S)

- [ ] Event log grouped by command (`commandId`), `Undo` removes the last group and replays from the latest snapshot
- [ ] Property test: random command sequences → undo all → initial state

## M1.12 Sandbox playthrough (S)

- [ ] Golden-replay test: scripted full game of the sandbox scenario to a resolution
- [ ] Property test: random legal commands never break invariants
- [ ] Update §6 of `docs/architecture.md` if anything changed

Done when: the sandbox scenario plays to an end in tests; engine coverage ≥ 90 %.
