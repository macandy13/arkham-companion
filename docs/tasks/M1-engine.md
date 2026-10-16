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

Finished tasks M1.1–M1.11 (with their Done and Follow-ups notes) are in `docs/tasks/done/M1-engine.md`.

## M1.E Engine end-to-end test: The Gathering (O)

**Why:** M1.9–M1.12 each add an engine feature on top of a growing stack of PRs. Unit tests prove each rule alone, but reviewing that much code is hard without seeing the features play together in a real scenario.

**Benefit:** One readable test that plays The Gathering like a session report. Each following PR extends it with its feature, so the reviewer sees every feature in context, and a broken interaction shows up as a broken round.

**Convention:** every later M1 PR extends `packages/scenarios/src/the_gathering/end_to_end.test.ts` with its feature: M1.9 answers the decisions the script now steps around (whom the rats engage, the threshold question; done, agenda 1's reverse-side choice and `hunterOrder` remain until a hook or a second hunter exists) with `ResolveDecision`; M1.10 replaces the manual phase commands (`placeMythosDoom`, `drawEncounterCard`, `moveHunters`, `resolveEnemyAttacks`, `upkeep`) with `NextPhase`, plays each turn with `StartTurn`/`EndTurn`, answers skill and revelation tests and asserts the round counter (done, see the M1.10 Done note); M1.11 undoes a step (e.g. a mis-tapped move) and shows the replayed state (done, see the M1.11 Done note); M1.12 plays on to a resolution.

- [x] Test in `packages/scenarios/src/the_gathering/end_to_end.test.ts` on the real `theGathering`/`theGatheringCards`, three real core investigators (Roland Banks, Daisy Walker, Wendy Adams), fixed seed
- [x] About five rounds driven by commands that exist on main, as one narrative `it` from setup to round 5 with phase/turn comment headers; each investigator's turn takes at most 3 actions; every action names the acting investigator; encounter cards are drawn per investigator
- [x] Game-language helpers (`TestTable` in `test_table.ts`); invariants checked after every command; the full event log replays to the live state
- [x] `formatBoard(ctx, state)` debugging printer in the engine, used in the test's inline snapshots and failure messages
- [x] M1.9 extension: threshold and engagement decisions answered with `ResolveDecision`, `decisionPending` shown (see the M1.9 Done note)

Done: `end_to_end.test.ts` plays seed 24 (the setup step pins the encounter deck's first twelve cards): round 1 takes the Study's 6 clues and advances act 1 (hook 01108: house map, everyone to the Hallway, Study out of the game); round 2 spawns the Icy Ghoul in the Cellar by its spawn instruction, applies Crypt Chill and Ancient Evils by hand, reveals the Attic and Cellar, Wendy engages the ghoul and is attacked; round 3 reaches agenda 1's threshold (a `confirm` decision, answered with `ResolveDecision` since M1.9), advances to Rise of the Ghouls, a Swarm of Rats engages Roland alone in the Attic, Roland evades it and walks to the Cellar, Daisy defeats the Ghoul Minion to the discard, Wendy wounds the Icy Ghoul and is attacked again; round 4 spawns the Flesh-Eater in the Attic, Roland takes over the Icy Ghoul and defeats it into the victory display, Daisy defeats the second Ghoul Minion and the hunting rats move to the Hallway; round 5 puts Frozen in Fear into Wendy's threat area, the rats reach the Cellar and raise a `chooseInvestigator` engagement decision (answered with `ResolveDecision` since M1.9), and both engaged enemies attack. `TestTable` (`packages/scenarios/src/the_gathering/test_table.ts`) wraps `execute` in game language (`moveTo`, `investigate`, `spendCluesToAdvanceAct`, `placeMythosDoom`, `placeDoom`, `answer`, `drawEncounterCard`, `engage`, `evade`, `fight`, `takeDamage`, `takeHorror`, `moveHunters`, `resolveEnemyAttacks` via `enemyAttackList`, `upkeep`) and reads the table back (`investigatorLocations`, `enemyLines`, `agenda`, `act`, `cluesOn`, `namesIn`, `wounds`, `pendingDecisions`); it throws with the board attached when a command breaks an invariant. `formatBoard` (`packages/engine/src/format_board.ts`, exported) renders round/phase, agenda (doom in play/threshold), act (clue requirement), each map's locations (revealed, clues, investigators, enemies with damage/exhaustion/engagement, attachments, connections), investigators (location, damage/health, horror/sanity, clues, resources, threat area), encounter deck/discard counts and top, set-aside count, victory display and pending decisions; tested with inline snapshots in `format_board.test.ts`. The engine index now also exports `cardsNamed` and `locationsNamed` so the test driver reuses them.
Skipped, because The Gathering's first rounds cannot show them: surge and peril (no Gathering encounter card has them), the empty-deck reshuffle (26 cards, 3 draws a round), the `hunterOrder` decision (only one hunter, the Swarm of Rats, is ever in play; the Ghoul Priest stays set aside), investigator defeat, cross-map and one-way connections, `FromSetAside`/`ShuffleInto`/matched draws (Rise of the Ghouls' reverse side is not reached).
Gaps the script steps around: agenda 1's reverse side (lead investigator's choice) is applied as 2 horror on Roland; treachery effects (Crypt Chill, Grasping Hands, Rotting Remains, Ancient Evils) are applied by hand since no effects registry covers them; `MoveInvestigator` does not engage enemies at the destination, so the script engages explicitly; round and phase stay at 0/`setup` without `NextPhase`. The script stops before act 2 (The Barrier) and agenda 2 advance, whose reverse sides (Parlor, Ghoul Priest, Lita Chantler) and agenda 3/act 3 have no hooks yet.
Review (#42): the investigators are Roland Banks (01001: health 9, sanity 5), Daisy Walker (01002: health 5, sanity 9) and Wendy Adams (01005: health 7, sanity 7), all 5 starting resources, hand-entered in `packages/scenarios/src/investigators.ts` (checked against ArkhamDB's `pack/core/core.json`; the Core Set 2016 codes match The Gathering's 01xxx cards, core_2026 is not in arkhamdb-json-data yet). Skills are not modelled; the comments that resolve skill tests by hand name them. The test is one narrative `it` with `// Round N – <phase>` and `// Round N – investigation: <name>'s turn` headers (turn order chosen by the group: Wendy goes before Daisy in round 2), ending with the replay check; `drawEncounterCard(investigator)` replaces the batch draw, `investigate(investigator)` (1 clue) replaces `discoverClues`, `fight(investigator, enemy)` deals the basic 1 damage and `evade(investigator, enemy)` checks the enemy is engaged with them; the table's read-backs are keyed by investigator id. `docs/coding-guidelines.md` allows the long narrative form for end-to-end scenario tests.
Follow-ups: treacheries with a revelation test (Crypt Chill, Grasping Hands, Rotting Remains in this script) should raise a `skillTestResult` decision for the drawing investigator when drawn (M1.10); the script resolves them in comments and applies the failure by hand. `formatBoard` should show actions taken/allowance for the active investigator once M1.10 tracks turns.


## M1.12 Sandbox playthrough (S)

**Why:** Unit tests prove each module alone; this proves they work together. The scripted game becomes a regression test for every later change.

**Benefit:** Confidence to build the UI on top of the engine, and an architecture doc that matches the code.

- [ ] Golden-replay test: scripted full game of the sandbox scenario to a resolution
- [ ] Property test: random legal commands never break invariants
- [ ] Update §6 of `docs/architecture.md` if anything changed

End-to-end test (M1.E): continue `end_to_end.test.ts` to a resolution instead of starting a separate playthrough.

Done when: the sandbox scenario plays to an end in tests; engine coverage ≥ 90 %.

## M1.13 Skill test modifiers (O)

**Why:** A skill test's outcome depends on more than the printed skill and difficulty: the scenario reference card (per difficulty), the location ("while investigating the Cellar…"), cards in play and lasting effects all change it (review #31). Today the players add those up in their heads, and the engine only states skill and difficulty, so a forgotten modifier goes unnoticed.

**Benefit:** One generic pipeline computes the modified skill and difficulty for every test the engine raises (investigate, fight, evade, revelation and card tests), and the UI can show where each number comes from.

Ref: §6 Phase assistant; M1.10 skill test hand-off.

- [ ] Generic modifier pipeline: base skill + committed icons + chaos token modifier vs. difficulty
- [ ] Modifier sources: the scenario reference card (per difficulty: token values for skull, cultist, tablet, elder thing), locations, cards in play and lasting effects ("until the end of the round")
- [ ] An explanation trace (each step: source, change, running total) for the UI
- [ ] Decisions keep entering pass/fail; the computed values are a suggestion the players can override

## M1.14 Readable unit test infrastructure (O)

**Why:** The engine's non-flow unit tests (one rule, one rejection or one state field each) build boards with low-level helpers and assert on raw state, so a reader has to decode IDs, zones and command objects to see which rule a test checks (review #31). The end-to-end test reads well because `TestTable` speaks game language; the unit tests do not have an equivalent.

**Benefit:** Each engine unit test reads like the rule it checks: set-up, action and expectation in game terms, short enough to review at a glance, which makes gaps and wrong rules easier to spot and new tests cheaper to write.

Ref: `docs/coding-guidelines.md` (tests); M1.E `TestTable`.

- [ ] Review the engine test helpers in `packages/engine/test/utils` (board builders such as `startBoard` and the per-file `startedWith` variants, `stateAfter`/`rejectionFrom`, `makeInvestigator`, card factories such as `makeCard`) and list what makes tests hard to read
- [ ] Design a clearer, game-language way to set up and assert non-flow tests (who stands where, which enemies and tokens are in play; "Alice investigates", "rejected because …"), keeping the values an assertion depends on visible in the test
- [ ] Consider extracting the scenario-independent part of `TestTable` (`packages/scenarios/src/the_gathering/test_table.ts`) into `packages/engine/test/utils` so unit and flow tests share one vocabulary
- [ ] Migrate the engine test files incrementally, one file or module per step, with no behaviour change (same cases, coverage floors hold)
- [ ] Document the conventions in `docs/coding-guidelines.md`

## M1.15 Investigator defeat and resign (S)

**Why:** Defeat only sets a status today. The rules also put the investigator's clues on their location, disengage their enemies, remove their threat-area cards and pass the lead on (M1.4 follow-up); `resigned` has no command. A defeat in the middle of a game leaves the board wrong.

**Benefit:** A defeated or resigned investigator leaves the table the way the rules say, so the rest of the group can keep playing on a correct board.

Ref: RR "Investigator Elimination"; M1.4, M1.8 follow-ups.

- [ ] On defeat or resign: clues to the investigator's location, engaged enemies stay at that location unengaged, threat-area treacheries to the encounter discard
- [ ] `Resign` command (an action, in the investigator's turn), status `resigned`, same clean-up as defeat
- [ ] A defeated or resigned lead investigator: the group picks a new lead (`chooseInvestigator` decision)
- [ ] All investigators defeated or resigned ends the scenario (`ScenarioEnded`, no resolution given → the scenario's "no resolution" hook)
- [ ] Rules to check: a defeated drawer mid-mythos, doom on defeated investigators' cards
- [ ] End-to-end test: an investigator resigns or is defeated in a later round

## M1.16 Enemy keywords and engagement on move (O)

**Why:** Several forced enemy rules are still left to memory: retaliate on a failed fight, alert on a failed evade, and a ready enemy engaging an investigator who moves into its location (M1.8, M1.10 follow-ups). Attacks of opportunity arrive in M1.12; these belong to the same family.

**Benefit:** The app reminds the players of every enemy attack the rules trigger, with the values pre-filled and adjustable, like the enemy phase and attacks of opportunity.

Ref: RR "Retaliate", "Alert", "Engagement", "Patrol"; M1.8, M1.10 follow-ups.

- [ ] `MoveInvestigator` engages ready, unengaged, non-aloof enemies at the destination (prey/decision as in `engageEvents`)
- [ ] Retaliate: a failed `Fight` against a ready retaliate enemy raises an attack decision (same shape as attacks of opportunity)
- [ ] Alert: a failed `Evade` against an alert enemy raises an attack decision
- [ ] Patrol (if a Core scenario needs it): moves in the enemy phase toward the named location
- [ ] Fight effects that engage an aloof enemy as part of the attack (Spectral Razor): a card-effect path
- [ ] rules-checker review; end-to-end test covers a move into an enemy's location and one retaliate

## M1.17 The Gathering to a resolution (S)

**Why:** The end-to-end test stops before act 2 because act 2/3 and agenda 2/3 have no reverse-side hooks, and the Ghoul Priest and Lita Chantler set-aside cards are not wired (M1.6, M1.12 follow-ups). M1's goal is a whole game in tests.

**Benefit:** The Gathering plays from setup to a resolution in tests, which proves the engine can run a complete scenario before the UI is built on it.

Ref: M1.6 hooks; M1.12; scenario guide of The Gathering (hand-entered, no card text).

- [ ] Hooks for act 2 and act 3 reverse sides (Ghoul Priest spawn, Lita Chantler, resolutions via `EndScenario`)
- [ ] Hooks for agenda 2 and agenda 3 reverse sides (Rise of the Ghouls: shuffle the encounter discard into the deck; agenda 3 → resolution)
- [ ] A command to shuffle the encounter discard into the deck (M1.7 follow-up)
- [ ] Commands after `ScenarioEnded` are rejected, except undo and `ManualAdjust` (M1.5, M1.10 follow-ups)
- [ ] End-to-end test continued to a resolution

## M1.18 Timing gaps (S)

**Why:** A few rule timings are still approximated (M1.5, M1.6, M1.9, M1.10 follow-ups): no end-of-turn hook (Frozen in Fear), simultaneous forced effects run in a fixed order, a doom `ManualAdjust` never re-checks the threshold, and `ManualAdjust` can move the current agenda/act out of its deck.

**Benefit:** Fewer cases where the players must remember a forced effect the app silently skipped, and manual corrections can't put the game into an impossible state.

Ref: M1.5, M1.6, M1.9, M1.10 follow-ups.

- [ ] `onTurnEnd` hook fired by `EndTurn`; Frozen in Fear raises its willpower test there
- [ ] Simultaneous forced effects: the lead investigator picks the order (`chooseOption` decision) when more than one applies
- [ ] After a doom `ManualAdjust`, offer `CheckDoomThreshold` (a `confirm` decision), never advance silently
- [ ] `ManualAdjust` cannot move the current agenda or act out of its deck (rejection)
- [ ] `decider` is checked against who answers a decision, if the command carries the answering investigator
