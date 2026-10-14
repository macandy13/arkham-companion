# M1 – Generic engine

Goal: all generic rules from architecture §6 in `packages/engine`, driven only by commands and tested without any UI.
At the end a hand-written **sandbox scenario** (fake card codes, 5–6 locations, a few enemies and treacheries) can be played through a whole game in tests.

**Why this milestone**

- **Problem:** The rules for the scenario side (doom, agenda/act, encounter deck, map, enemies) are what makes the app useful – and what players most often get wrong at the table. They must be correct before anything is drawn on screen.
- **What the app gains:** A complete, deterministic rules core that can play a whole (fake) scenario in tests. The UI milestones (M2/M3) then only present state and send commands; real scenarios (M4+) become mostly data plus a few hooks.
- **Why at this point:** The UI is defined by the commands and state this milestone creates, so it has to exist first. A sandbox scenario with fake cards lets us test every rule quickly and without depending on real card data or copyrighted text while the rules are still changing.

Model hint: **S** = Sonnet is enough, **O** = use Opus (design-heavy). Do tasks in order; each task = one session = one PR.
Start from the phone: Code tab → repo → `Do task M1.x from docs/tasks/M1-engine.md`.

Every task: new commands/events go through `handle` → `apply`, invariants keep passing, tests use fake cards only.

---

## M1.1 Card definitions inside the engine (O)

**Why:** Rules need card numbers (doom threshold, shroud, enemy health), but the engine must stay pure and cannot load files. Passing a `CardDb` in a context object keeps it pure and lets tests use small fakes.

**Benefit:** Every rule module looks up card stats the same way, and per-investigator scaling ("2 per investigator") lives in one place.

Ref: §5, §9. The engine must read card stats (doom threshold, clues, shroud, health, keywords) without depending on `carddata` at runtime.

- [x] `CardDb` interface passed into `handle(ctx, state, command)` (`ctx.cards.get(code)`); reducer stays card-agnostic
- [x] Per-investigator value helper (`ScaledValue` + `resolveValue`, covers `health_per_investigator`/`clues_fixed`)
- [x] Fake `CardDb` fixture shared by all engine tests (`test/fixtures/sandbox-cards.ts`)

Done when: existing tests pass with the new signature; one test reads a threshold through `CardDb`.

Done: `packages/engine/src/cards.ts` adds `CardStats` (the engine's own card type, so it has no runtime dependency on `carddata`), `CardDb`, `EngineContext`, `cardDbFrom` and `cardStats` (throws `unknownCardCode`). `CardStats` is typed: `typeCode: CardType` (union of ArkhamDB type codes, `CARD_TYPES`), `traits: Trait[]` (branded, built with `trait`), `stage: CardStage` (`{ number, variant? }`, so alternative cards like 2a/b vs 2c/d share a number and differ by variant), and `clues`/`health`/`doom` are `ScaledValue`s (`{ fixed, perInvestigator }`) resolved with `resolveValue(value, playerCount)`. Game-state terms like "+1 per act" are left to the rules that read them. `handle(ctx, state, command)` and `execute(ctx, state, command)` take the context first; `StartScenario` rejects card codes missing from `ctx.cards`. Shared fixture: `packages/engine/test/fixtures/sandbox-cards.ts` (`sandboxContext`, `sandboxCodes`).
Follow-ups: map carddata's `CardDef` to `CardStats` (`health`/`health_per_investigator`, `clues`/`clues_fixed` → `ScaledValue`, `stage` → `CardStage`, `type_code` → `CardType`) when the web app gets a `CardDb` backed by the cached carddata (M2); the stage variant letter is not in ArkhamDB and has to come from scenario data; `keywords` gets added to `CardStats` with the keyword parser (M1.7).

## M1.2 Setup DSL + sandbox scenario (O)

**Why:** Setup is where scenarios differ most. A declarative setup language makes a scenario mostly data instead of code, and the same steps also cover mid-scenario changes (§7). The sandbox gives us a scenario we fully control for all later M1 tests.

**Benefit:** Adding a scenario later means filling in a definition rather than writing engine code; setup results are testable.

Ref: §7.

- [ ] `ScenarioDefinition` type and `SetupStep` union (`putIntoPlay`, `setAside`, `buildEncounterDeck`, `placeTokens`, `spawn`, `moveInvestigators`, `addMap`, `addConnection`)
- [ ] `compileSetup(def, options) -> StartScenario` (setup steps become starting cards + follow-up commands)
- [ ] Sandbox scenario in `packages/scenarios/src/sandbox/` using only fake codes
- [ ] Test: sandbox setup produces the expected zones and counts

## M1.3 Board: connection graph (S)

**Why:** Investigator movement, hunter enemies and many card effects depend on which locations connect. An explicit graph (not positions on screen) handles one-way edges, several maps and connections that change during play.

**Benefit:** Correct movement and pathing; the map UI in M3 only has to draw the graph.

Ref: §5 Map model.

- [ ] `Edge` type (undirected and one-way), `ConnectionChanged` event, `AddConnection`/`RemoveConnection` commands
- [ ] Connections from scenario data (`connections` spec by symbol or code), only active when both locations are in play
- [ ] Reveal location (`CardFlipped`) places clues per investigator
- [ ] Helpers: `neighbours(locationId)`, `shortestPaths(from, to)` (BFS, returns all shortest paths)
- [ ] Multiple maps: locations carry `mapId`; cross-map edges allowed

## M1.4 Investigators (S)

**Why:** The app replaces health/sanity dials and clue/resource piles, and enemy rules (prey) need to compare investigators.

**Benefit:** Fewer physical tokens, automatic defeat detection, and prey choices the engine can compute.

Ref: §5 `Investigator`.

- [ ] `MoveInvestigator`, `AdjustInvestigator` (damage, horror, clues, resources), `DiscoverClues` (location → investigator)
- [ ] Defeat check when damage ≥ health or horror ≥ sanity → `InvestigatorDefeated`, status `defeated`
- [ ] Prey helpers: lowest remaining health/sanity, most clues, etc.

## M1.5 Agenda, act and doom (S)

**Why:** Doom and the agenda/act decks are the clock of every scenario. Summing doom by hand is easy to get wrong once doom sits on several cards (agenda, enemies, locations, player cards), so the app keeps the running total. Doom on player cards matters too, but the app does not model player cards – so each investigator gets a plain doom counter that counts toward the total. The engine asks before advancing instead of advancing silently ("assistant, not referee", §2).

**Benefit:** The app tells players when the agenda or act should advance and what happens next; a scenario ends with a resolution the campaign can record.

- [ ] `PlaceDoom` (on agenda or any card), doom total = agenda + cards in play + each investigator's player-card doom counter
- [ ] Per-investigator doom counter for doom on player cards the app does not track (`Investigator.doomOnPlayerCards`, adjusted via `AdjustInvestigator`)
- [ ] Threshold check emits a `DecisionRequested` "advance agenda?" instead of advancing silently
- [ ] `AdvanceAgenda` / `AdvanceAct`: flip, run reverse-side hook, next card; clue threshold per investigator for act
- [ ] Scenario end hooks when the last agenda/act advances (`ScenarioEnded` with resolution id)

## M1.6 Triggers and hooks (O)

**Why:** Forced effects ("after doom is placed…", "when this agenda advances…") are how scenarios bend the rules. A generic trigger bus lets scenarios plug in without changing engine code.

**Benefit:** Scenario-specific mechanics stay in scenario files; the loop guard prevents a bad hook from hanging the app.

Ref: §6 Triggers, §7 hooks.

- [ ] Trigger bus: after events are produced, hooks (`afterDoomPlaced`, `onAgendaAdvance[code]`, `onActAdvance[code]`, `onRoundEnd`, `onCardEnters`) may return follow-up commands
- [ ] Hooks are pure functions `(state, ctx) -> Command[]`; the bus runs each returned command through `handle` like a player command, so hook effects are validated and can use card data and the RNG the same way (returning raw events would bypass both). Loop guard against infinite chains
- [ ] Effects registry keyed by card code (empty except a sandbox card that adds a connection)

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
