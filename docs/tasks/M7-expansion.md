# M7 – Expansion

Goal: more Chapter Two products as soon as ArkhamDB lists them, and more automated encounter cards.

Model hint: **S** = Sonnet, **O** = Opus. Each task = one session = one PR.

This milestone is a repeatable recipe rather than a fixed list. Add a section per product when it is released.

---

## Recipe per new scenario

1. **Import (S):** `pnpm carddata:fetch <pack>`; M4.1 ArkhamCards import for the scenario.
2. **Connections (O):** M4.2 extraction + review for the pack's locations.
3. **Definition (O):** `ScenarioDefinition`, setup steps, setup test.
4. **Mechanics (O):** special rules as hooks; promote anything a second scenario needs into an engine primitive.
5. **Playtest (S):** golden replay + playtest checklist.

## M7.x Card effect automation (S, one card family per task)

- [ ] Pick the most frequent manual quick actions from playtests
- [ ] Script them in the effects registry, with tests
- [ ] Per-game automation level setting (display / assist / auto)
