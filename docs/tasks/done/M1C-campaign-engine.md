# M1C – Campaign engine: finished tasks

Finished tasks moved out of `docs/tasks/M1C-campaign-engine.md` so sessions working on open tasks read less. Their Done and Follow-ups notes stay here for reference.

---

## M1C.1 Campaign model (O)

**Why:** A campaign spans several games and must outlive each of them. Event-sourcing it gives the same undo, recovery and export as a game.

**Benefit:** Campaign state is never lost or mis-recorded, and later scenarios can read earlier outcomes.

Ref: product.md "Campaign mode".

- [x] `CampaignLog`: campaign id, difficulty, investigators (code, physical/mental trauma, XP earned/spent, killed/insane), story records (key → value, e.g. `"ghoulPriestDefeated": true`, counts, lists such as "cultists who got away"), chaos bag contents, scenario sequence with the current position
- [x] Campaign commands, events and reducer, separate from the game's (`StartCampaign`, `RecordStory`, `AddChaosToken`, `RemoveChaosToken`, `AwardXp`, `AddTrauma`, `MarkKilled`, `MarkInsane`, `ReplaceInvestigator`, `AdvanceScenario`, `AdjustCampaign` for corrections) with rejections and invariants (no negative XP or trauma, killed/insane investigators cannot play)
- [x] Campaign definition type (scenario order, starting chaos bag per difficulty, interlude steps if any) next to `ScenarioDefinition`; the Night of the Zealot definition (three scenarios, Core Set chaos bags per difficulty), with The Midnight Masks and The Devourer Below entered only as far as the campaign tests need (identity, campaign setup, resolutions)
- [x] Readable unit tests (M1.14 conventions if merged)

Slices (review of #50: one PR was too big to review), each its own PR on top of the previous one:

1. `CampaignLog`, its queries and `checkCampaignInvariants`, replacing the stub in `state.ts`
2. Campaign events and the reducer (`applyCampaign`, `replayCampaign`)
3. `StartCampaign`, story records, chaos bag and `AdvanceScenario` with `handleCampaign`/`executeCampaign` and the rejections
4. Investigator commands: XP, trauma, killed/insane, `ReplaceInvestigator`
5. `AdjustCampaign` corrections
6. `CampaignDefinition`, `compileCampaign` and the Night of the Zealot definition

Done: the campaign is its own aggregate in `packages/engine/src/campaign/`, exported from `@arkham/engine`. `CampaignLog` (replacing the old stub in `state.ts`, so `GameState.campaign` holds the real log): campaign and definition id, difficulty, the team in seat order (`CampaignInvestigator`: card code, printed name, health and sanity, physical/mental trauma, XP earned and spent, `fate` alive/killed/insane), investigators no longer on the team (`formerInvestigators`), typed story records (`StoryValue`: flag, count, list, crossable list; a key keeps its kind), the chaos bag and the scenario order with the position. Commands `StartCampaign`, `RecordStory`, `AddChaosToken`, `RemoveChaosToken`, `AwardXp`, `SpendXp`, `AddTrauma` (trauma reaching health or sanity kills or drives insane, Rules Reference "Trauma"), `MarkKilled`, `MarkInsane`, `ReplaceInvestigator` (only for a killed or insane investigator; nobody can return), `AdvanceScenario` and `AdjustCampaign` (XP, trauma, fate, story removal, position; rejected if the result breaks an invariant) go through `handleCampaign`/`executeCampaign`, events through `applyCampaign`/`replayCampaign`, with `CampaignCommandRejected` and `checkCampaignInvariants` (team of 1–4, no duplicates, no negative or overspent XP, trauma consistent with fate). `CampaignDefinition` and `compileCampaign` sit next to `ScenarioDefinition`. **Night of the Zealot** (`packages/scenarios/src/night_of_the_zealot/campaign.ts`): The Gathering, then The Midnight Masks and The Devourer Below by id only; the campaign starts with The Gathering's bag per difficulty. Follow-up: the setup and resolutions of The Midnight Masks come with the task whose tests first need them (M1C.4/M1C.7).

Follow-ups from Andy's review of #63/#64, for one refactoring PR after this stack:

- [x] Branded `InvestigatorCode` for the card code that keys the campaign team, so it can't be mixed up with a game's `InvestigatorId` (strong-typing rule, #71)
- [x] Campaign commands carry only the card code, and the handlers look up name, health and sanity in the `CampaignContext`'s `CardDb`, which holds investigator cards like every other card, like the game's `execute(ctx, …)`
- [x] The same for the game's setup: `SetupOptions` seats investigators by ID and code, and `compileSetup` takes stats and skills from the `EngineContext`'s `CardDb` (`StartScenario` keeps full investigators, so tests can start from any board)
- [x] Card codes are a branded `CardCode` everywhere (`CardStats`, `CardInstance`, setup steps, decks, set-aside commands); `InvestigatorCode` is a `CardCode` with one more tag (Andy on #72)
- [x] Encounter set codes, scenario IDs and campaign definition IDs are branded (`EncounterSetCode`, `ScenarioId`, `CampaignDefinitionId`)
- [x] The campaign ID and the game ID are branded (`CampaignId`, `GameId`); the IndexedDB store creates game IDs through one `newGameId()`
- [x] Campaign functions are imported through the `campaign` namespace and named verb + noun (`campaign.handleCommand`, `campaign.compileStart`); the campaign types stay flat
- [x] The scenario setup functions are imported through the `scenario` namespace (`scenario.compileSetup`, `scenario.compileMapStep`, `scenario.pickReferenceSide`); the game functions (`execute`, `replay`, `handle`) stay flat (Andy's choice)
