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

Finished task M1C.1 (with its Done and Follow-ups notes) is in `docs/tasks/done/M1C-campaign-engine.md`.

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

Slices, each its own PR:

1. M1C.4a – resolution steps as data, `campaign.proposeResolution` (steps, victory points, defeat trauma by damage or horror) and The Gathering's resolutions
2. M1C.4b1 – trauma named by a card effect's defeat (The Gathering's agenda 3). M1C.4b2 – played scenarios with their resolution in the log, and applying a confirmed proposal in one step
3. M1C.4c – conditional steps that read the game (The Midnight Masks' cultists), with The Midnight Masks' resolutions in M5.3
4. Leaving and joining a campaign stays last; the campaign UI (M5.2) needs it only for replacing killed or insane investigators, which already works

- [x] Declarative resolution steps on the scenario definition (`record`, `addChaosToken`, `removeChaosToken`, `awardXp` (victory display + fixed bonus), `addTrauma`, `markKilled`/`markInsane`, plus `byHand` for the players' cards). Done in M1C.4a: `ScenarioDefinition.resolutions`, steps target `each`, `lead` or `notResigned`
- [ ] Conditional steps that read game state (e.g. "if the Ghoul Priest is in the victory display"): M1C.4c
- [x] `ScenarioEnded { resolution }` → a pure function computes the proposed campaign commands (`campaign.proposeResolution`, M1C.4a)
- [x] Players confirm or edit them; applying them writes the campaign log in one step (M1C.4b2: `campaign.applyResolution`)
- [ ] Applying them produces notices (M1C.2)
- [x] Defeat trauma: an investigator defeated by damage gets 1 physical trauma, by horror 1 mental trauma; resigning gives none (M1C.4a: the reducer keeps `Investigator.defeat`)
- [ ] A defeat that reaches health and sanity at once: the players pick the trauma (Rules Reference, "Trauma"); today the proposal says physical (`defeatCause` prefers damage) and the players edit it (M1C.4b, with the confirmation step)
- [x] A defeat by a card effect (`cause: 'cardEffect'`, M1.17) gives only the trauma the card names, e.g. The Gathering's agenda 3 at act 3 ("is defeated and suffers 1 physical trauma"). Done in M1C.4b1: `DefeatInvestigator.trauma`, kept as `Investigator.defeat`; agenda 3 uses `defeatEachInvestigator({ trauma: 'physical' })`
- [x] "No resolution was reached" handled per scenario (`ScenarioResolutions.none`)
- [x] The Gathering's resolutions entered by hand (M1C.4a, `the_gathering/resolutions.ts`); The Midnight Masks' come with M5.3
- [ ] Leaving and joining a campaign (review of #62): a player may leave between scenarios (their living investigator moves to the former investigators and may rejoin), and a joining player picks an investigator not used before; today `ReplaceInvestigator` only replaces a killed or insane one. Also the 2026 Core Set's third fate, devoured
- [x] Played scenarios with their resolution in the campaign log (Andy, review of #62), e.g. `playedScenarios: { scenarioId, resolution }[]`, written when the resolution is confirmed. It also prepares for non-linear campaigns: the definition then picks the next scenario from the log instead of advancing `position` through a fixed `scenarioIds` order. Done in M1C.4b2: `CampaignLog.playedScenarios`, written by `AdvanceScenario { outcome }`

## M1C.5 Starting a scenario from the campaign (S)

**Why:** The next scenario's setup depends on the log (`campaignSetup`), the investigators bring their trauma, and killed or insane investigators must be replaced.

**Benefit:** Starting scenario 2 is one command; the board, the bag and the investigators are already right.

Ref: product.md "Campaign mode" (`campaignSetup`); product.md "UI concept" (picker only for replacements).

Slices, each its own PR:

1. M1C.5a – `CampaignSetupOptions`: difficulty, bag and trauma from the log; the seats must be the log's living team, for its next scenario
2. M1C.5b – setup steps that read the log's story (`whenStory` with a `StoryCondition`), so The Midnight Masks and The Devourer Below (M5.3, M5.4) can use them; M1C.4c reuses the conditions for resolutions

- [x] `compileSetup` takes the campaign log: setup steps read it. Done in M1C.5b as a `whenStory` step in the scenario's own `setup` rather than a separate `campaignSetup(log)`, so the setup stays data and standalone play takes the `otherwise` steps
- [x] Investigators start with physical trauma as damage and mental trauma as horror; killed/insane ones need a replacement first (rejection otherwise). Done in M1C.5a: `investigatorNeedsReplacement`, plus `notOnCampaignTeam`, `campaignMemberNotSeated` and `notNextCampaignScenario`. A player who wants to sit out has to leave the campaign, which needs the leaving command in M1C.4
- [x] The chaos bag comes from the log (M1C.5a; the log's difficulty too, so `CampaignSetupOptions` has no `difficulty`)
- [x] Standalone play is unchanged (no log): `StandaloneSetupOptions`
- [ ] `PlayTable.setUp` and the app's `startGame` take campaign options (with the campaign UI, M5.2)
- [ ] End to end: The Midnight Masks set up from the log after The Gathering's R1 shows Roland's trauma as 1 horror (with M5.3; until then the end-to-end test only checks that the log refuses The Gathering again)

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

- [ ] Test: start the test campaign → play The Gathering via `PlayTable` to a resolution (shortened if M1.17's test already covers the game) → confirm the resolution → the log shows records, XP, trauma and bag changes → start The Midnight Masks from the log → its setup reflects a story record (e.g. whether the house is still standing, Lita Chantler) and the trauma
- [ ] Replay check for the campaign aggregate

Done when: Night of the Zealot runs from The Gathering into The Midnight Masks in tests, with log, trauma and chaos bag carried over.
