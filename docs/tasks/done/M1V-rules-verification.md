# M1V – Rules verification: finished tasks

Finished tasks moved out of `docs/tasks/M1V-rules-verification.md` so sessions working on open tasks read less. Their Done and Follow-ups notes stay here for reference.

---

## M1V.3 Test table builder (S)

**Why:** almost every engine test starts from a board, and each file grew its own `startedWith`/`placed`/`at` helpers around `startBoard` and a module-level card table, so a reader has to learn a new setup vocabulary per file before the edge-case tests of M1V.2 can be read.

**Benefit:** one way to build a table, with each card's stats next to where it is placed; the same builder can set up a sandbox board or a scenario under construction outside tests.

**Slices**

1. [x] `newGame()` builder and blank cards (`blankLocation`, `blankEnemy`, …), zone constructors, `forced_attacks.test.ts` as the first migrated file (#104).
2. [x] Migrate `skill_tests` and `hunters`, then `enemies` (#107, #108).
3. [x] Migrate `board`, `investigators`, `elimination`, `turns`, `lookup` (#109).
4. [x] Migrate `decisions`, `triggers`, `attacks_of_opportunity`, `describe_decision` (#110).
5. [x] Migrate `encounter`; add `withEffects` and the encounter pile zone constants (#111).
6. [x] Builder seed, difficulty, shuffle and maps; migrate `phases` (#112), then `doom`, `undo`, `skill_modifiers`, `format_board` (#113).
7. [x] Move `setup`, `cards`, `engine`, `replay` onto blank cards and the builder; remove `startBoard`, `makeCard`, `contextWith`, `makeInvestigator`, `testCardDefs`, `testContext` and the `L*`/`E*` codes; point `docs/coding-guidelines.md` §3 at the builder only.
8. [x] Sweep the remaining file-local setup helpers (`forced_attacks`, `skill_tests`, `triggers`, `attacks_of_opportunity`, `turns`) onto the builder chain, using `withEffects` for card scripts.

The slices are stacked PRs. Slices 4–6 edit test files the resolution queue (M1V.1 slice 3) also changes; whichever merges second merges the other in. Tests of setup compilation (`setup`, The Gathering) keep `startScenario`, since they test the real setup.

Each migration slice keeps the tests' assertions as they are; the builder adds `with*` methods (seed, difficulty, scenario, hidden maps) as the first test needs them.

**Follow-ups**

- [x] One shared `answer(decision, optionId, amount?)` command builder in `packages/engine/test/utils/` instead of the copies in eight test files (#129).
- [x] `withHooks`, `withReferenceCard` and `withSkillModifiers` builder methods next to `withEffects`, replacing the `withScenario` test helper (#129).
- [x] `blankAgenda(code, null)` builds an agenda without a doom threshold; `blankAct`'s doc says its default `fixed(0)` clues is a threshold of 0, not none (#129).
- [x] `withTurnOf(investigator)`: a general way to start a table in the investigation phase with one investigator's turn begun; about 30 tests in `attacks_of_opportunity` and `turns` (and some in `elimination`, `undo`, `format_board`) run `NextPhase` and `StartTurn` first. Migrated `attacks_of_opportunity`, `turns` and `elimination`; `undo` and `format_board` keep the commands, since they test the log and the phase sequence (#130).

Done: every engine test builds its table with `newGame()` and blank cards; card scripts, scenario rules and a begun turn are builder methods, and decisions are answered with the shared `answer()`.
