# M1C – Campaign engine

Goal: campaign mode in `packages/engine` (and its storage), driven only by commands and tested without any UI: a campaign log that outlives each game, chaos bag carried between scenarios, resolutions applied to the log, and a scenario started from the log.
Ref: product.md "Campaign mode" (`CampaignLog`, `campaignSetup`, `resolutions`).

**Why this milestone**

- **Problem:** The Core Set is a campaign. Without campaign support in the engine, the play screen (M3) and the game wizard (M2) would be built around standalone games only, and the campaign would be bolted on later through every screen and the storage.
- **What the app gains:** The engine and storage know what a campaign is before any campaign screen exists: which games belong to it, what each resolution writes, how the next scenario starts. The UI milestones only present it.
- **Why at this point:** Same reasoning as M1 itself: screens display engine state and send commands, so the state and commands come first. It needs a scenario that can end (M1.17) and defeat with trauma (M1.15), so it follows those tasks, but its model task can start earlier.

Every task: the campaign is its own event-sourced aggregate (commands → events → reducer, like a game), pure and deterministic. The test campaign is _Night of the Zealot_ from the original Core Set (The Gathering → The Midnight Masks → The Devourer Below): its structure and resolutions are known and The Gathering is already hand-entered, so the campaign rules are checked against a real campaign rather than an invented one. Its scenarios are entered by hand like The Gathering (real card codes and names, stats by hand, no card text/JSON/images); extend CLAUDE.md's test-data rule to the new scenario directories in the task that adds them.

Every change the engine makes on the players' behalf (a token added to the bag, trauma, XP, a story record) produces a notice (M1C.2), so the players see it and can correct it.

---

## M1C.1 Campaign model (O)

**Why:** A campaign spans several games and must outlive each of them. Event-sourcing it gives the same undo, recovery and export as a game.

**Benefit:** Campaign state is never lost or mis-recorded, and later scenarios can read earlier outcomes.

Ref: product.md "Campaign mode".

- [ ] `CampaignLog`: campaign id, difficulty, investigators (code, physical/mental trauma, XP earned/spent, killed/insane), story records (key → value, e.g. `"ghoulPriestDefeated": true`, counts, lists such as "cultists who got away"), chaos bag contents, scenario sequence with the current position
- [ ] Campaign commands, events and reducer, separate from the game's (`StartCampaign`, `RecordStory`, `AddChaosToken`, `RemoveChaosToken`, `AwardXp`, `AddTrauma`, `MarkKilled`, `MarkInsane`, `ReplaceInvestigator`, `AdvanceScenario`, `AdjustCampaign` for corrections) with rejections and invariants (no negative XP or trauma, killed/insane investigators cannot play)
- [ ] Campaign definition type (scenario order, starting chaos bag per difficulty, interlude steps if any) next to `ScenarioDefinition`; the Night of the Zealot definition (three scenarios, Core Set chaos bags per difficulty), with The Midnight Masks and The Devourer Below entered only as far as the campaign tests need (identity, campaign setup, resolutions)
- [ ] Readable unit tests (M1.14 conventions if merged)

Slices (review of #50: one PR was too big to review), each its own PR on top of the previous one:

1. `CampaignLog`, its queries and `checkCampaignInvariants`, replacing the stub in `state.ts`
2. Campaign events and the reducer (`applyCampaign`, `replayCampaign`)
3. `StartCampaign`, story records, chaos bag and `AdvanceScenario` with `handleCampaign`/`executeCampaign` and the rejections
4. Investigator commands: XP, trauma, killed/insane, `ReplaceInvestigator`
5. `AdjustCampaign` corrections
6. `CampaignDefinition`, `compileCampaign` and the Night of the Zealot definition

## M1C.2 Change notices (O)

**Why:** The engine applies changes the players would otherwise make by hand (tokens into the bag, trauma, XP, story records, and in a game doom, damage or moves). If they happen silently, the players cannot tell what the app did and stop trusting it, or rely on it more than they want to ("assistant, not referee", architecture "Overview").

**Benefit:** Every automatic change is visible and correctable, and each group decides how much it leans on the digital helpers.

Ref: architecture "Overview"; M7 per-game automation level.

- [ ] A pure function maps events (campaign and game) to player-facing notices: what changed, why (the card, rule or resolution step that caused it) and how to undo or correct it
- [ ] Notices carry a kind (e.g. chaos bag, trauma/XP, story record, board) so the UI can filter them; no automatic change reaches the log without one
- [ ] A per-game/per-campaign setting for how much the players rely on the helpers (show every notice, only important ones, or ask before applying); align with the M7 automation level (display / assist / auto) instead of adding a second setting
- [ ] Display stays a UI task (M3 event log, M5 campaign screen); this task defines the data and the setting

## M1C.3 Chaos bag (O)

**Why:** The chaos bag differs per difficulty and changes during a campaign; skill test modifiers (M1.13) need to know which tokens exist and what they are worth in this scenario.

**Benefit:** The bag is always right for the game in front of the players, standalone or campaign, and the token values feed the skill test suggestion.

Ref: product.md "Campaign mode" (chaos bag); M1.13.

- [ ] Game state carries the chaos bag: standalone = scenario default per difficulty, campaign = from the log at scenario start
- [ ] Token values per scenario and difficulty (number tokens, skull/cultist/tablet/elder thing from the scenario reference card, auto-fail, elder sign from the investigator) feed the M1.13 pipeline
- [ ] Commands for card effects that add/remove tokens during a game (`AddChaosToken`/`RemoveChaosToken` with "until the end of the scenario" vs. permanent, the latter written back at resolution); each change produces a notice (M1C.2) naming the token, the cause and whether it lasts
- [ ] Drawing stays physical: the players enter the drawn token; an optional seeded draw is an M6 follow-up

## M1C.4 Resolutions (O)

**Why:** At the end of a scenario the resolution decides what the campaign log records, which tokens enter the bag and how much XP and trauma each investigator gets. Done on paper, this is where campaigns go wrong.

**Benefit:** Ending a scenario produces a list of log changes the players confirm, and the log is updated in one step.

Ref: product.md "Campaign mode" (resolutions).

- [ ] Declarative resolution steps on the scenario definition (`record`, `addChaosToken`, `removeChaosToken`, `awardXp` (victory display + fixed bonus), `addTrauma`, `markKilled`/`markInsane`), including conditional steps that read game state (e.g. "if the Ghoul Priest is in the victory display")
- [ ] `ScenarioEnded { resolution }` → a pure function computes the proposed campaign commands; players confirm or edit them; applying them writes the campaign log and produces notices (M1C.2)
- [ ] Defeat trauma: an investigator defeated by damage gets 1 physical trauma, by horror 1 mental trauma; resigning gives none (needs M1.15)
- [ ] "No resolution was reached" handled per scenario
- [ ] The Gathering's and The Midnight Masks' resolutions entered by hand
- [ ] Leaving and joining a campaign (review of #62): a player may leave between scenarios (their living investigator moves to the former investigators and may rejoin), and a joining player picks an investigator not used before; today `ReplaceInvestigator` only replaces a killed or insane one. Also the 2026 Core Set's third fate, devoured
- [ ] Played scenarios with their resolution in the campaign log (Andy, review of #62), e.g. `playedScenarios: { scenarioId, resolution }[]`, written when the resolution is confirmed. It also prepares for non-linear campaigns: the definition then picks the next scenario from the log instead of advancing `position` through a fixed `scenarioIds` order

## M1C.5 Starting a scenario from the campaign (S)

**Why:** The next scenario's setup depends on the log (`campaignSetup`), the investigators bring their trauma, and killed or insane investigators must be replaced.

**Benefit:** Starting scenario 2 is one command; the board, the bag and the investigators are already right.

Ref: product.md "Campaign mode" (`campaignSetup`); product.md "UI concept" (picker only for replacements).

- [ ] `compileSetup` takes the campaign log: `campaignSetup(log)` adds or replaces setup steps
- [ ] Investigators start with physical trauma as damage and mental trauma as horror; killed/insane ones need a replacement first (rejection otherwise)
- [ ] The chaos bag comes from the log (M1C.3)
- [ ] Standalone play is unchanged (no log)

## M1C.6 Campaign storage (S)

**Why:** The campaign must survive refreshes and link its games, like a game does today; `GameStore` is the only way the app touches IndexedDB.

**Benefit:** Campaigns are saved, resumed and undone like games, and M2/M5 screens can list them.

Ref: architecture "Persistence" (`campaigns` table).

- [ ] `GameStore` methods for campaigns: create, load (replay), append events, undo last group, list; games carry an optional `campaignId`
- [ ] `IndexedDbStore` implementation with fake-indexeddb tests; export/import of a whole campaign stays in M5.5
- [ ] Deleting a game that belongs to a campaign: decide and document (keep the campaign's record of it)

## M1C.7 Campaign end-to-end test (S)

**Why:** Each piece is tested alone; this proves a campaign runs from start to the second scenario.

**Benefit:** A regression test for the whole campaign flow before any campaign screen exists.

- [ ] Test: start the test campaign → play The Gathering via `TestTable` to a resolution (shortened if M1.17's test already covers the game) → confirm the resolution → the log shows records, XP, trauma and bag changes → start The Midnight Masks from the log → its setup reflects a story record (e.g. whether the house is still standing, Lita Chantler) and the trauma
- [ ] Replay check for the campaign aggregate

Done when: Night of the Zealot runs from The Gathering into The Midnight Masks in tests, with log, trauma and chaos bag carried over.
