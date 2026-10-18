# M1V – Rules verification

Goal: check the engine's timing decisions against the Rules Reference and cover the edge cases with tests, before the screens and real scenarios build on them.
Ref: architecture "Command handling", "Triggers and card effects"; [rules.md](../rules.md).

**Why this milestone**

- **Problem:** the engine made some timing choices for simplicity, for example that forced effects run only after all events of a command. A wrong choice here would show up as subtle rule bugs in every scenario.
- **What the app gains:** confidence that the core resolution order matches the rules, and tests that pin the edge cases down.
- **Why at this point:** M2 and M3 only display engine state, and M4 adds real scenarios with more forced effects. Fixing the order now is cheap; later every scenario would depend on it.

---

## M1V.1 Trigger timing (O)

**Why:** `handle` evaluates scenario hooks and card effects only after all of a command's events (architecture "Command handling", step 2). The rules may require some forced effects to resolve the moment their trigger condition happens, between two events of one command.

**Benefit:** forced effects resolve in the order the rules prescribe, and a test shows it for each case.

- [x] List the trigger points (`ScenarioHooks`, `CardEffect`) and, for each, the Rules Reference timing ("Forced", "when"/"after", "Priority of simultaneous resolution"); ask `rules-checker` and record the answers in `docs/rules.md`
- [x] Find the commands whose events can trigger an effect midway (an advance that also places doom, a draw that spawns, a move that reveals)
- [ ] If any effect must resolve immediately, design the change and update architecture "Command handling"
- [ ] Table tests for each case found, plus an end-to-end step that shows one at the table

**Findings** (`rules-checker`, 2026-10-18). Running "after" hooks once a command's events are done is right when the command is one effect (rules.md, "Timing of forced effects"). Correct as built: doom placed, agenda and act advance, enemy defeated, card enters play, a move that reveals and then engages.

- **Surge** (high): the surge card was drawn before the first card's revelation, spawn choice, test and forced effects had resolved. A surge enemy waiting for a spawn choice was even drawn again, since it stays on top of the deck.
- **Revelation of a drawn card** (medium): `CardEffect.onReveal` runs after the card is placed. The rules resolve the revelation first, so an enemy has already spawned and engaged when its revelation runs.
- **Follow-ups after a decision** (medium, latent): `resolveFollowUps` runs a hook's later commands while an earlier one waits for an answer. The rules finish a nested sequence, choices included, before going on.
- **Order of simultaneous forced effects** (low): the engine uses a fixed order where the lead investigator chooses. Today no two hooks share one event; it shows only between events of one command (turn end hook and turn-end tests, round end hook and round-end discards). Decide together with the timing windows the architecture review proposes.
- **No "when … would" hooks** (gap): no trigger point can act before its condition resolves. Needed once an M4 scenario has such a forced effect.

**Slices**

1. [x] Surge waits for the drawn card (#95): `DrawEncounter` draws one card; `resolveSurge` draws again after its forced effects, held while a decision is open.
2. [x] Revelation before placement: the drawn card waits in `resolving` while its `onReveal` follow-ups run, then `placeDrawnCard` places it (a drawn enemy that waits for a spawn choice is no longer left on the deck). A revelation that asks something still lets the placement go on before the answer; slice 3 covers that.
3. [ ] Hold the remaining follow-ups of a chain while one of them waits for an answer.
       Built as one resolution queue (architecture review P8): a list of plain-data steps that `handle` runs until a decision is pending, then stores in state. Three PRs:
   - [x] 3a. One `Resolution` builder per `handle` call, with rollback for held actions; no behaviour change (#101).
   - [x] 3b. The stored queue (`GameMeta.queue`, `StepsQueued`/`StepResumed`) replaces the held-action slot and `ActionHeld`/`ActionResumed`; behaviour unchanged, except that a surge waiting during attacks of opportunity now queues in front of the action instead of drawing at once.
   - [ ] 3c. Everything as steps: forced effects queued when their events are emitted, `complete` and the phase step loop as continuation steps, and an answer's forced effects before its option commands (ST.6 before ST.7). Carries the intended behaviour changes, with a rules-checker table.
4. [ ] End-to-end step at the table: The Gathering has no surge card, so add one with slice 2 or 3 where the scenario shows it.

Follow-ups: simultaneous ordering and "when" hooks wait for the decision on the architecture review's timing windows.

## M1V.2 Edge case tests (S)

**Why:** most engine tests follow the happy path; the rules bugs found in review came from interactions (hunter order, attacks of opportunity, turn structure).

**Benefit:** interactions are covered by tests before real scenarios rely on them.

- [ ] Collect interaction cases from `docs/rules.md` and past review comments (e.g. a defeated investigator during their own turn, an empty encounter deck during a surge, an agenda advancing during the enemy phase)
- [ ] One table test per case, written so the reader sees the table situation in the test body
