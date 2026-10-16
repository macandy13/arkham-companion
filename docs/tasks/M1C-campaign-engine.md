# M1C – Campaign engine

Goal: campaign mode in `packages/engine` (and its storage), driven only by commands and tested without any UI: a campaign log that outlives each game, chaos bag carried between scenarios, resolutions applied to the log, and a scenario started from the log.
Ref: architecture §5 (`CampaignLog`), §7 (`campaignSetup`, `resolutions`), §8 Campaign mode.

**Why this milestone**

- **Problem:** The Core Set is a campaign. Without campaign support in the engine, the play screen (M3) and the game wizard (M2) would be built around standalone games only, and the campaign would be bolted on later through every screen and the storage.
- **What the app gains:** The engine and storage know what a campaign is before any campaign screen exists: which games belong to it, what each resolution writes, how the next scenario starts. The UI milestones only present it.
- **Why at this point:** Same reasoning as M1 itself: screens display engine state and send commands, so the state and commands come first. It needs a scenario that can end (M1.17) and defeat with trauma (M1.15), so it follows those tasks, but its model task can start earlier.

Model hint: **S** = Sonnet is enough, **O** = use Opus (design-heavy). Each task = one session = one PR.
Start from the phone: Code tab → repo → `Do task M1C.x from docs/tasks/M1C-campaign-engine.md`.

Every task: the campaign is its own event-sourced aggregate (commands → events → reducer, like a game), pure and deterministic; tests use The Gathering and invented follow-up scenarios with hand-entered data (no card text/JSON/images).

---

## M1C.1 Campaign model (O)

**Why:** A campaign spans several games and must outlive each of them. Event-sourcing it gives the same undo, recovery and export as a game.

**Benefit:** Campaign state is never lost or mis-recorded, and later scenarios can read earlier outcomes.

Ref: §5, §8.

- [x] `CampaignLog`: campaign id, difficulty, investigators (code, physical/mental trauma, XP earned/spent, killed/insane), story records (key → value, e.g. `"ghoulPriestDefeated": true`, counts, lists such as "cultists who got away"), chaos bag contents, scenario sequence with the current position
- [x] Campaign commands, events and reducer, separate from the game's (`StartCampaign`, `RecordStory`, `AddChaosToken`, `RemoveChaosToken`, `AwardXp`, `AddTrauma`, `MarkKilled`, `MarkInsane`, `ReplaceInvestigator`, `AdvanceScenario`, `ManualAdjust` for corrections) with rejections and invariants (no negative XP or trauma, killed/insane investigators cannot play)
- [x] Campaign definition type (scenario order, starting chaos bag per difficulty, interlude steps if any) next to `ScenarioDefinition`; a test campaign: The Gathering plus one invented follow-up scenario
- [x] Readable unit tests (M1.14 conventions if merged)

Done: the campaign is its own aggregate in `packages/engine/src/campaign/`, exported from `@arkham/engine`. `CampaignLog` (replacing the old stub in `state.ts`, so `GameState.campaign` holds the real log): campaign and definition id, difficulty, the team in seat order (`CampaignInvestigator`: card code, printed health and sanity, physical/mental trauma, XP earned and spent, `fate` alive/killed/insane), replaced investigators (`formerInvestigators`), typed story records (`StoryValue`: flag, count, list, crossable list; a key keeps its kind), the chaos bag and the scenario order with the position. Commands `StartCampaign`, `RecordStory`, `AddChaosToken`, `RemoveChaosToken`, `AwardXp`, `SpendXp`, `AddTrauma` (trauma reaching health or sanity kills or drives insane, Rules Reference "Trauma"), `MarkKilled`, `MarkInsane`, `ReplaceInvestigator` (only for a killed or insane investigator; nobody can return), `AdvanceScenario` and `ManualAdjust` (XP, trauma, fate, story removal, position; rejected if the result breaks an invariant) go through `handleCampaign`/`executeCampaign`, events through `applyCampaign`/`replayCampaign`, with `CampaignCommandRejected` and `checkCampaignInvariants` (team of 1–4, no duplicates, no negative or overspent XP, trauma consistent with fate, no alive former investigator). `CampaignDefinition` and `compileCampaign` sit next to `ScenarioDefinition`. **Test campaign (review #44):** Night of the Zealot (`packages/scenarios/src/night_of_the_zealot/campaign.ts`) instead of an invented follow-up: The Gathering, then The Midnight Masks and The Devourer Below by id only (their data comes with M4/M5); the campaign starts with The Gathering's bag per difficulty.
Follow-ups: the plan in #44 is to be reworked around Night of the Zealot and a general player notification mechanism (review #44); interludes are only a placeholder type; the unit tests use the engine's current test style, to be moved to the M1.14 conventions with the rest.

## M1C.2 Chaos bag (O)

**Why:** The chaos bag differs per difficulty and changes during a campaign; skill test modifiers (M1.13) need to know which tokens exist and what they are worth in this scenario.

**Benefit:** The bag is always right for the game in front of the players, standalone or campaign, and the token values feed the skill test suggestion.

Ref: §5 `chaosBag`, §8; M1.13.

- [ ] Game state carries the chaos bag: standalone = scenario default per difficulty, campaign = from the log at scenario start
- [ ] Token values per scenario and difficulty (number tokens, skull/cultist/tablet/elder thing from the scenario reference card, auto-fail, elder sign from the investigator) feed the M1.13 pipeline
- [ ] Commands for card effects that add/remove tokens during a game (`AddChaosToken`/`RemoveChaosToken` with "until the end of the scenario" vs. permanent, the latter written back at resolution)
- [ ] Drawing stays physical: the players enter the drawn token; an optional seeded draw is an M6 follow-up

## M1C.3 Resolutions (O)

**Why:** At the end of a scenario the resolution decides what the campaign log records, which tokens enter the bag and how much XP and trauma each investigator gets. Done on paper, this is where campaigns go wrong.

**Benefit:** Ending a scenario produces a list of log changes the players confirm, and the log is updated in one step.

Ref: §7 `resolutions`, §8.

- [ ] Declarative resolution steps on the scenario definition (`record`, `addChaosToken`, `removeChaosToken`, `awardXp` (victory display + fixed bonus), `addTrauma`, `markKilled`/`markInsane`), including conditional steps that read game state (e.g. "if the Ghoul Priest is in the victory display")
- [ ] `ScenarioEnded { resolution }` → a pure function computes the proposed campaign commands; players confirm or edit them; applying them writes the campaign log
- [ ] Defeat trauma: an investigator defeated by damage gets 1 physical trauma, by horror 1 mental trauma; resigning gives none (needs M1.15)
- [ ] "No resolution was reached" handled per scenario
- [ ] The Gathering's resolutions entered by hand

## M1C.4 Starting a scenario from the campaign (S)

**Why:** The next scenario's setup depends on the log (`campaignSetup`), the investigators bring their trauma, and killed or insane investigators must be replaced.

**Benefit:** Starting scenario 2 is one command; the board, the bag and the investigators are already right.

Ref: §7 `campaignSetup`; §11 (picker only for replacements).

- [ ] `compileSetup` takes the campaign log: `campaignSetup(log)` adds or replaces setup steps
- [ ] Investigators start with physical trauma as damage and mental trauma as horror; killed/insane ones need a replacement first (rejection otherwise)
- [ ] The chaos bag comes from the log (M1C.2)
- [ ] Standalone play is unchanged (no log)

## M1C.5 Campaign storage (S)

**Why:** The campaign must survive refreshes and link its games, like a game does today; `GameStore` is the only way the app touches IndexedDB.

**Benefit:** Campaigns are saved, resumed and undone like games, and M2/M5 screens can list them.

Ref: §10 Persistence (`campaigns` table).

- [ ] `GameStore` methods for campaigns: create, load (replay), append events, undo last group, list; games carry an optional `campaignId`
- [ ] `IndexedDbStore` implementation with fake-indexeddb tests; export/import of a whole campaign stays in M5.5
- [ ] Deleting a game that belongs to a campaign: decide and document (keep the campaign's record of it)

## M1C.6 Campaign end-to-end test (S)

**Why:** Each piece is tested alone; this proves a campaign runs from start to the second scenario.

**Benefit:** A regression test for the whole campaign flow before any campaign screen exists.

- [ ] Test: start the test campaign → play The Gathering via `TestTable` to a resolution (shortened if M1.17's test already covers the game) → confirm the resolution → the log shows records, XP, trauma and bag changes → start the invented scenario 2 from the log → its setup reflects a story record and the trauma
- [ ] Replay check for the campaign aggregate

Done when: a two-scenario test campaign runs end to end in tests, with log, trauma and chaos bag carried over.
