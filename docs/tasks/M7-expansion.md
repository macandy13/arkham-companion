# M7 – More campaigns

Goal: every campaign, in this order: the Chapter Two campaigns (Core Set (2026), Children of Blood), _The Dunwich Legacy_, _The Path to Carcosa_, _The Forgotten Age_, _The Innsmouth Conspiracy_, then the rest in release order (_The Circle Undone_, _The Dream-Eaters_, _Edge of the Earth_, _The Scarlet Keys_, _The Feast of Hemlock Vale_, _The Drowned City_), plus new Chapter Two products as ArkhamDB lists them; and more automated encounter cards.

**Why this milestone**

- **Problem:** the app is only as useful as the content it covers, and each scenario still needs some manual work at the table for cards that are only displayed, not automated.
- **What the app gains:** new products playable within a few sessions of their ArkhamDB release, and less manual work per round as more card effects are automated.
- **Why at this point:** the recipe and the generic primitives are proven by _Night of the Zealot_ (M4/M5), whose rules already cover half of every later campaign's encounter cards; playtests tell us which cards are worth automating.

This milestone is a repeatable recipe plus one section per campaign. Each campaign first builds its steps of the [encounter card plan](../encounter-card-analysis.md#implementation-plan), then runs the recipe per scenario. Add a section per new product when it is released.

---

## Recipe per new scenario

**Why:** a fixed recipe keeps each new scenario small and predictable, and forces shared mechanics into the engine instead of copy-pasted scenario code.

**Benefit:** adding a scenario is routine work, not a project.

1. **Import (S):** `pnpm carddata:fetch <pack>`; M4.1 ArkhamCards import for the scenario.
2. **Connections (O):** M4.2 extraction + review for the pack's locations.
3. **Definition (O):** `ScenarioDefinition`, setup steps, setup test.
4. **Mechanics (O):** special rules as card abilities; promote anything a second scenario needs into an engine primitive.
5. **Playtest (S):** golden replay + playtest checklist.

## M7.1 Chapter Two: Core Set (2026) and Children of Blood (O)

**Why:** the current products, and the Chapter Two rules (Doomed, Elusive, Predator, blood tokens) only they use.

**Benefit:** _Spreading Flames_, _Smoke and Mirrors_, _Queen of Ash_, then _River of Blood_, _New Horizons_ and _Blood Money_ playable as campaigns.

- [ ] Plan steps 13–26, one task each, before the scenarios that need them
- [ ] _Spreading Flames_ via the recipe. Its special mechanics: skull token value from the act number; `drawTopmostFromDiscard('Fire!')`, and agenda 2 adds set-aside _Fire!_ copies to the discard; Parley on agendas to discard a bystander at a location; agenda 3's forced effect after doom is placed; reverse sides and resolutions
- [ ] _Smoke and Mirrors_, _Queen of Ash_ via the recipe; the campaign end
- [ ] _Children of Blood_: _River of Blood_, _New Horizons_, _Blood Money_ via the recipe

## M7.2 Later campaigns (O, one section per campaign when it starts)

Each campaign starts with a card-by-card read of its encounter cards, extending [encounter-card-analysis.md](../encounter-card-analysis.md), then builds its plan step and runs the recipe per scenario.

- [ ] _The Dunwich Legacy_ (step 27)
- [ ] _The Path to Carcosa_ (step 28)
- [ ] _The Forgotten Age_ (step 29)
- [ ] _The Innsmouth Conspiracy_ (step 30)
- [ ] _The Circle Undone_ (step 31)
- [ ] _The Dream-Eaters_ (step 32)
- [ ] _Edge of the Earth_ (step 33)
- [ ] _The Scarlet Keys_ (step 34)
- [ ] _The Feast of Hemlock Vale_ (step 35)
- [ ] _The Drowned City_ (step 36)

## M7.x Card effect automation (S, one card family per task)

**Why:** v1 only displays most encounter cards; the cards resolved by hand most often are the best candidates for automation, measured in playtests rather than guessed.

**Benefit:** Less manual work at the table, with a per-game setting for groups that prefer to resolve cards themselves.

- [ ] Pick the most frequent manual quick actions from playtests
- [ ] Script them in the effects registry, with tests
- [ ] Per-game automation level setting (display / assist / auto); extends the helper-reliance setting from M1C.2 rather than adding a second one
