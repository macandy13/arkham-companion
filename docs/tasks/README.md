# Tasks

The plan lives in GitHub issues, as a tree of sub-issues:

- **Milestone** – a parent issue with the `milestone` label: [M1](https://github.com/macandy13/arkham-companion/issues/261), [M1C](https://github.com/macandy13/arkham-companion/issues/262), [M1V](https://github.com/macandy13/arkham-companion/issues/263), [M2](https://github.com/macandy13/arkham-companion/issues/264) (done), [M3](https://github.com/macandy13/arkham-companion/issues/265), [M4](https://github.com/macandy13/arkham-companion/issues/266), [M5](https://github.com/macandy13/arkham-companion/issues/267) (done), [M6](https://github.com/macandy13/arkham-companion/issues/268), [M7](https://github.com/macandy13/arkham-companion/issues/270), [M8](https://github.com/macandy13/arkham-companion/issues/271), [M9](https://github.com/macandy13/arkham-companion/issues/372); [ME](https://github.com/macandy13/arkham-companion/issues/545) for engine consistency; [MD](https://github.com/macandy13/arkham-companion/issues/740) for the design language; and one milestone per campaign, in play order: [MC1](https://github.com/macandy13/arkham-companion/issues/552) Night of the Zealot, [MC2](https://github.com/macandy13/arkham-companion/issues/554) Core Set (2026), [MC3](https://github.com/macandy13/arkham-companion/issues/555) Children of Blood, [MC4](https://github.com/macandy13/arkham-companion/issues/556) Dunwich, [MC5](https://github.com/macandy13/arkham-companion/issues/557) Carcosa, [MC6](https://github.com/macandy13/arkham-companion/issues/558) Forgotten Age, [MC7](https://github.com/macandy13/arkham-companion/issues/559) Innsmouth, [MC8](https://github.com/macandy13/arkham-companion/issues/560) Circle Undone, [MC9](https://github.com/macandy13/arkham-companion/issues/561) Dream-Eaters, [MC10](https://github.com/macandy13/arkham-companion/issues/562) Edge of the Earth, [MC11](https://github.com/macandy13/arkham-companion/issues/563) Scarlet Keys, [MC12](https://github.com/macandy13/arkham-companion/issues/564) Hemlock Vale, [MC13](https://github.com/macandy13/arkham-companion/issues/565) Drowned City. Its body says why the milestone exists and in which order its tasks go.
- **Task** – a sub-issue of its milestone, titled with its ID (`MC1.6 Campaign mode UI`). The body is self-contained: a `**Model:** Opus · **Area:** engine` line, **Why**, **Benefit**, references and a checklist.
- **Slice** – a sub-issue of its task (`M1C.4c …`), one PR each. Follow-ups found while working are sub-issues too.

The milestone's sub-issue list is the task order. Finished tasks before 2026-10-24 and the Done notes written so far are archived in `done/`, one file per milestone.

## Campaign milestones

Each campaign is one `MCx` milestone (tasks `MCx.1`, `MCx.2` …). Generic engine work that several campaigns need goes to ME instead, so a campaign milestone only holds what is new for it. A campaign starts by re-running the encounter rule census ([encounter-card-analysis.md](../encounter-card-analysis.md#encounter-rule-census)) and filing its blocking rules as tasks, ordered before the scenarios that need them.

### Recipe per new scenario

A fixed recipe keeps each new scenario small and predictable, and forces shared mechanics into the engine instead of copy-pasted scenario code.

1. **Import (Sonnet):** `pnpm carddata:fetch <pack>`; the ArkhamCards import (M4.1) for the scenario.
2. **Connections (Opus):** connection symbol extraction and review (M4.2) for the pack's locations. The symbols each campaign needs are listed in [location-symbols.md](../location-symbols.md).
3. **Definition (Opus):** `ScenarioDefinition`, setup steps, setup test.
4. **Mechanics (Opus):** special rules as card abilities; promote anything a second scenario needs into an engine primitive.
5. **Playtest (Sonnet):** golden replay and the playtest checklist.
