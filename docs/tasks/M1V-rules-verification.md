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

- [ ] List the trigger points (`ScenarioHooks`, `CardEffect`) and, for each, the Rules Reference timing ("Forced", "when"/"after", "Priority of simultaneous resolution"); ask `rules-checker` and record the answers in `docs/rules.md`
- [ ] Find the commands whose events can trigger an effect midway (an advance that also places doom, a draw that spawns, a move that reveals)
- [ ] If any effect must resolve immediately, design the change and update architecture "Command handling"
- [ ] Table tests for each case found, plus an end-to-end step that shows one at the table

## M1V.2 Edge case tests (S)

**Why:** most engine tests follow the happy path; the rules bugs found in review came from interactions (hunter order, attacks of opportunity, turn structure).

**Benefit:** interactions are covered by tests before real scenarios rely on them.

- [ ] Collect interaction cases from `docs/rules.md` and past review comments (e.g. a defeated investigator during their own turn, an empty encounter deck during a surge, an agenda advancing during the enemy phase)
- [ ] One table test per case, written so the reader sees the table situation in the test body
