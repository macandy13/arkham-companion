# M7 – Expansion

Goal: more Chapter Two products as soon as ArkhamDB lists them, and more automated encounter cards.

**Why this milestone**

- **Problem:** the app is only as useful as the content it covers, and each scenario still needs some manual work at the table for cards that are only displayed, not automated.
- **What the app gains:** new products playable within a few sessions of their ArkhamDB release, and less manual work per round as more card effects are automated.
- **Why at this point:** the recipe and the engine primitives are proven by the three Core Set scenarios from M4/M5; playtests tell us which cards are worth automating.

This milestone is a repeatable recipe rather than a fixed list. Add a section per product when it is released.

---

## Recipe per new scenario

**Why:** a fixed recipe keeps each new scenario small and predictable, and forces shared mechanics into the engine instead of copy-pasted scenario code.

**Benefit:** adding a scenario is routine work, not a project.

1. **Import (S):** `pnpm carddata:fetch <pack>`; M4.1 ArkhamCards import for the scenario.
2. **Connections (O):** M4.2 extraction + review for the pack's locations.
3. **Definition (O):** `ScenarioDefinition`, setup steps, setup test.
4. **Mechanics (O):** special rules as hooks; promote anything a second scenario needs into an engine primitive.
5. **Playtest (S):** golden replay + playtest checklist.

## M7.x Card effect automation (S, one card family per task)

**Why:** v1 only displays most encounter cards; the cards resolved by hand most often are the best candidates for automation, measured in playtests rather than guessed.

**Benefit:** Less manual work at the table, with a per-game setting for groups that prefer to resolve cards themselves.

- [ ] Pick the most frequent manual quick actions from playtests
- [ ] Script them in the effects registry, with tests
- [ ] Per-game automation level setting (display / assist / auto); extends the helper-reliance setting from M1C.2 rather than adding a second one
