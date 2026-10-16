# M1 – Generic engine

Goal: all generic rules from architecture "Components" in `packages/engine`, driven only by commands and tested without any UI.
At the end a hand-written **test scenario** – The Gathering from the original Core Set, with real card codes but hand-entered stats and no card text – can be played through a whole game in tests (it replaced the earlier invented sandbox scenario in M1.2).

**Why this milestone**

- **Problem:** The rules for the scenario side (doom, agenda/act, encounter deck, map, enemies) are what makes the app useful – and what players most often get wrong at the table. They must be correct before anything is drawn on screen.
- **What the app gains:** A complete, deterministic rules core that can play a whole (fake) scenario in tests. The UI milestones (M2/M3) then only present state and send commands; real scenarios (M4+) become mostly data plus a few hooks.
- **Why at this point:** The UI is defined by the commands and state this milestone creates, so it has to exist first. A sandbox scenario with fake cards lets us test every rule quickly and without depending on real card data or copyrighted text while the rules are still changing.

Every task: new commands/events go through `handle` → `apply`, invariants keep passing, tests use invented cards or the hand-written Gathering scenario (hand-entered stats, no card text/JSON/images).

---

Finished tasks M1.1–M1.11 (with their Done and Follow-ups notes) are in `docs/tasks/done/M1-engine.md`.

## M1.E Engine end-to-end test: The Gathering (O)

**Why:** M1.9–M1.12 each add an engine feature on top of a growing stack of PRs. Unit tests prove each rule alone, but reviewing that much code is hard without seeing the features play together in a real scenario.

**Benefit:** One readable test that plays The Gathering like a session report. Each following PR extends it with its feature, so the reviewer sees every feature in context, and a broken interaction shows up as a broken round.

**Convention:** every later M1 PR extends `packages/scenarios/src/the_gathering/end_to_end.test.ts` with its feature: M1.9 answers the decisions the script now steps around (whom the rats engage, the threshold question; done, agenda 1's reverse-side choice and `hunterOrder` remain until a hook or a second hunter exists) with `ResolveDecision`; M1.10 replaces the manual phase commands (`placeMythosDoom`, `drawEncounterCard`, `moveHunters`, `resolveEnemyAttacks`, `upkeep`) with `NextPhase`, plays each turn with `StartTurn`/`EndTurn`, answers skill and revelation tests and asserts the round counter (done, see the M1.10 Done note); M1.11 undoes a step (e.g. a mis-tapped move) and shows the replayed state (done, see the M1.11 Done note); M1.12 plays on toward a resolution (done, see the M1.12 Done note).

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

## M1.12 End-to-end test continued toward a resolution (S)

**Why:** Unit tests prove each module alone; the one end-to-end test proves they work together. Instead of a separate golden playthrough with its own investigators, M1.12 continues the existing Gathering story, so there is one narrative to read and keep green.

**Benefit:** Confidence to build the UI on top of the engine; later changes show up as a broken round of the same session report.

- [x] End-to-end test continued toward a resolution (rounds 6 and 7 added to `end_to_end.test.ts`)
- [x] Small readable table over 1-3 investigators (invariants and replay), written with `TestTable`
- [x] Update the engine sections of `docs/architecture.md` if anything changed (it describes neither a golden playthrough nor the sandbox; no change)
- [ ] Play to a resolution (`ScenarioEnded`): blocked on the hooks below

Done when: The Gathering plays through its implemented rules in tests; engine coverage >= 90 %.

Done: `end_to_end.test.ts` goes on from the round 5 upkeep. Round 6: Rotting Remains is passed, three Swarms of Rats spawn engaged (so `TestTable.fight`/`evade` now find the enemy by the investigator it is engaged with, not by a unique name), everybody defeats the rats and Roland clears the Cellar's clues, the Ravenous Ghoul attacks Daisy. Round 7 mythos shows undo of a whole trigger chain: the `NextPhase` that raises doom and draws Grasping Hands with its revelation test is undone and run again, and the second run's events equal the first's. Then Daisy evades the Ghoul and takes the resource action (`gainResources`), Roland enters the Attic (the Flesh-Eater engages him, no action), the group holds the 9 clues act 2 needs, and the Flesh-Eater attacks; a board snapshot closes round 7 and the replay check covers the whole log. Every `nextPhase()` asserts the phase it lands on (M1.10 review). A second `describe` plays one round plus the start of round 2 with one, two and three investigators (`it.each`, the real investigators) and checks invariants, replay and a second table producing identical events. The old sandbox/golden playthrough (`playthrough.test.ts`, golden file, 4-seed random table) is deleted: its act 1 advance, agenda 1 advance, hunter move and engage, attacks, fight/evade and undo are all in the end-to-end test already. The random multi-seed table was reduced to the readable 1-3 investigator table (only three real investigators exist; a fourth would need an invented one). Agenda 1 to 2 and the hunter (round 4-5) were already covered; agenda 2 to 3 needs doom 7 (round 9 at the earliest), so the script stops at doom 5. To check against the rules: the engine keeps clues of a defeated investigator (not reached here); Dissonant Voices and Frozen in Fear have no modelled effects.

Done (review): attacks of opportunity are an engine primitive (`attacks_of_opportunity.ts`). When the investigator whose turn is in progress moves (`MoveInvestigator` without `ignoreConnections`), investigates or engages (`EngageEnemy`; the enemy being engaged does not attack) while ready enemies are engaged with them (ready massive enemies at their location included), `handle` raises one `confirm` decision `attackOfOpportunity:<enemy>` per enemy for that investigator, ahead of the action's own events (so ahead of the investigate test). Its `attack` option runs the new `DealEnemyAttack` (damage and horror with one defeat check, no exhaust) at the printed values, which the players lower through the new named amounts (`DecisionOption.amounts`, `ResolveDecision.amounts`); `skip` is the way out for cards that do not provoke. Fight, evade, hook follow-ups, decision answers and commands outside the investigator's turn never provoke; `AdjustActions` does not either, because the players also count off the actions the engine saw, so a -1 would ask twice. In the end-to-end test Roland's search in the Attic provokes the Flesh-Eater, and his Beat Cop soaks the horror; Daisy no longer searches the empty Cellar in round 6, which would have provoked the Ravenous Ghoul. **Timing (rules check on #33):** the action no longer resolves before its attacks. `handle` validates it, raises the decisions and holds it (`ActionHeld`, `GameMeta.heldAction`); once no decision is pending the command that cleared the last one appends `ActionResumed` plus the action's events, or `ActionDropped` with the reason (the investigator was defeated, or the action became illegal). So a lethal attack on a move leaves the investigator defeated where they stood, and the investigate test is asked only after the attack. The answers may come in any order (the UI may list them together). The `EngageEnemy` target filter is gone: a massive enemy cannot be engaged (`massiveNotEngageable`), so the enemy being engaged is never among the attackers. **Review #33:** phase steps have readable ids (`placeDoom`, `checkDoomThreshold`, `drawEncounterCard`, `huntersMove`, `enemiesAttack`, `resetActions`, `readyExhausted`, `gainResources`, `endRound`), the Rules Reference numbers stay in comments and in `PHASE_STEP_TITLES`; `TestTable.decisions()` names the investigator a decision is `for`; in round 6 Daisy fights the Ravenous Ghoul twice and misses instead of stopping.

Done (review, test structure): `TestTable.nextPhase()` returns where the phase assistant stopped, `{ round, phase, step? }` with the engine's step ids: the step whose decision is pending (the step removed itself from the cursor before it ran, so the table reads it from the events) or 3.3 while attacks are due; no `step` once the phase has run all its steps. The end-to-end test reads the board as structured data instead of text: `enemies()`/`enemy(selector)` (`EnemyView`: name, location, engagement, damage, exhausted), `decisions()` (`DecisionView`: prompt key, kind, subject, test, option names, default counts) and `attacksDue()` (enemy and investigator); the act 1 and agenda-question `formatBoard` snapshots are replaced by structured asserts, the setup and final snapshots stay as milestone overviews. Enemy lookups take an `EnemySelector` (a name, or `{ name, engagedWith?, at? }`) and fail with the board attached when several enemies match, as with the three Swarms of Rats in round 6; `answer` fails when several open decisions are about cards of the same name.

Follow-ups: hooks for act 2 ("The Barrier") and act 3, agenda 2 and 3 reverse sides, the Ghoul Priest and Lita Chantler, and `ScenarioEnded`; once they exist, advance act 2 in round 7 (the clues are in hand) and play on to a resolution. Attacks of opportunity for actions the engine cannot see (resource, draw, play, activate): needs an action command or an action flag on `AdjustActions` so a counted action is not asked about twice. Once `MoveInvestigator` engages ready enemies on entry (M1.8 follow-up), an explicit `EngageEnemy` is always the engage action and the `skip` for rule engagements goes away. Parley and resign are not modelled; when they are, they must not provoke either.

## M1.13 Skill test modifiers (O)

**Why:** A skill test's outcome depends on more than the printed skill and difficulty: the scenario reference card (per difficulty), the location ("while investigating the Cellar…"), cards in play and lasting effects all change it (review #31). Today the players add those up in their heads, and the engine only states skill and difficulty, so a forgotten modifier goes unnoticed.

**Benefit:** One generic pipeline computes the modified skill and difficulty for every test the engine raises (investigate, fight, evade, revelation and card tests), and the UI can show where each number comes from.

Ref: architecture "Rounds, phases and turns"; M1.10 skill test hand-off.

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

- [x] On defeat or resign: clues to the investigator's location, engaged enemies stay at that location unengaged, threat-area treacheries to the encounter discard
- [x] `Resign` command (an action, in the investigator's turn), status `resigned`, same clean-up as defeat
- [x] A defeated or resigned lead investigator: the group picks a new lead (`chooseInvestigator` decision)
- [x] All investigators defeated or resigned ends the scenario (`ScenarioEnded`, no resolution given → the scenario's "no resolution" hook)
- [x] Rules to check: a defeated drawer mid-mythos, doom on defeated investigators' cards
- [x] End-to-end test: an investigator resigns or is defeated in a later round

Done: `elimination.ts` holds `investigatorLeavesEvents(state, investigator, left)`, the one place every way out of the scenario goes through (`AdjustInvestigator` and `ResolveEnemyAttack` on a defeat, `Resign`). Events, in order: the departure (`InvestigatorDefeated` or the new `InvestigatorResigned`; the reducer sets the status and ends a turn in progress), then the clean-up as ordinary events (clues: `InvestigatorChanged` -n plus `TokensChanged` on the location, skipped for an investigator without a location; `EnemyDisengaged` for each engaged enemy, which keeps damage and exhaustion; `TokensChanged` removing the tokens of each threat-area card, then `CardMoved` to the top of the encounter discard, so doom does not return if the discard is reshuffled), then the succession. **Lead:** `GameMeta.leadInvestigator` was already stored; new event `LeadInvestigatorChanged` and command `SetLeadInvestigator {investigatorId}` (active investigators only, `alreadyLeadInvestigator` if unchanged; also usable for card effects). When the lead leaves and several investigators remain, a `chooseInvestigator` decision `newLeadInvestigator` (decider: group, no subject) has one `SetLeadInvestigator` option per remaining investigator; with a single one left they become lead directly. `playerOrder` keeps rotating from the old lead's seat until the new lead is set. **No one left:** `ScenarioEnded` without `resolution` (it is now optional); the engine has no scenario "no resolution" hook, so `GameMeta.resolution` stays absent and "ended" is not visible in the state (see follow-ups). **`Resign {investigatorId}`:** only in the investigation phase (`wrongPhase`), for an active investigator (`unknownInvestigator`, `investigatorNotActive`) whose turn is in progress (`turnNotInProgress`, shared with `EndTurn` via `requireTurnOf`); no new rejection code. The last turn of the investigation phase no longer waits for departed investigators (`playerOrder` only lists active ones). Tests: `elimination.test.ts` (`describe.each` over defeat by damage, by horror and resign: clues, enemy zone/tokens/exhaustion, threat area and doom, turn, invariants; lead decision and answer, single successor, non-lead leaving; last investigator; `Resign` and `SetLeadInvestigator` rejections; an enemy-attack defeat drops the other attacks of that investigator from step 3.3). The Gathering end-to-end test: in round 6 Wendy resigns with Frozen in Fear and a Swarm of Rats on her (`TestTable.resign`). Existing defeat tests in `investigators.test.ts` and `phases.test.ts` now also see the clean-up events. **Rules check (#45):** all interpretations hold; two loose ends fixed: an investigator without a location has nowhere to leave their engaged enemies, so those are discarded (an unengaged enemy must be at a location), and cards attached to a discarded threat-area card go to the encounter discard with it, tokens removed (`discardEvents`).
Follow-ups: `ScenarioEnded` without a resolution leaves no trace in `GameMeta` (and commands after the end are still not blocked, M1.4 follow-up): add an `ended` marker when the end is enforced, and a scenario "no resolution" hook (The Gathering's guide names what follows when every investigator resigned or was defeated); the lead decision is not about a card, so it has no `subject` and `TestTable.answer` (which looks up by subject name) cannot answer it, scripts use `ResolveDecision` with `newLeadInvestigator`; rules to check: (1) a drawer defeated mid-mythos: their own encounter card stays in the `resolving` zone until its test is answered (the tests that defeat them are the card's own), and the remaining 1.4 draws skip them (`canDraw`), a surge draw of the defeated drawer is not special-cased; (2) doom on a defeated investigator's cards: treachery doom is removed with the discard, `doomOnPlayerCards` stays on the defeated investigator but no longer counts (`doomInPlay` counts active investigators only) and is not cleared; (3) clues of an investigator without a location stay with them; (4) a defeated lead during a phase step: the decision blocks further commands until answered, so `NextPhase` stops there like at any other decision; (5) player cards are not modelled, so the discarding of the investigator's own cards, weaknesses and the "remove from game" of story assets are left to the players.

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
