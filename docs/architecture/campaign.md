# Campaign

A campaign is its own event-sourced aggregate in [`campaign/`](../../packages/engine/src/campaign/) with its own commands, events and reducer, so a game command can never change it.

[`CampaignLog`](../../packages/engine/src/campaign/campaign_log.ts) holds:

- the team (keyed by `InvestigatorCode`) with trauma, XP, fate and the story cards each earned (`earnedCards`, `EarnCard`: Lita Chantler, which a later game trusts that investigator to hold),
- story records,
- chaos bag,
- and scenario order.

A game keeps a copy in `GameState.campaign`.
Reached through the `campaign` namespace (`campaign.handleCommand`).
First definition: [Night of the Zealot](../../packages/scenarios/src/night_of_the_zealot/campaign.ts).

## Lifecycle

A campaign log and each game are separate event logs; the game reads a copy of the log, and only a confirmed resolution writes back.

```mermaid
flowchart TD
  DEF["CampaignDefinition<br/>scenario order, chaos bags"] --> START["StartCampaign<br/>(compileStart)"]
  START --> LOG[("CampaignLog<br/>team, trauma, XP, records, chaos bag")]
  LOG --> SETUP["compileSetup with the log<br/>next scenario, living team"]
  SETUP --> GAME["game: StartScenario … ScenarioEnded<br/>GameState.campaign = copy of the log"]
  GAME --> PROP["campaign.proposeResolution<br/>reads the ended game"]
  PROP --> EDIT["players confirm or edit<br/>the proposed commands"]
  EDIT --> APPLY["campaign.applyResolution<br/>confirmed commands (EndCampaign on the last scenario),<br/>then AdvanceScenario; all or none"]
  APPLY --> LOG
  APPLY -- "after EndCampaign" --> END["CampaignLog.result set:<br/>won, lost or survived"]
```

## Resolutions

A scenario's resolutions are data on `ScenarioDefinition.resolutions` ([`resolution.ts`](../../packages/engine/src/campaign/resolution.ts)): per resolution id, plus "no resolution", a list of `ResolutionStep`s:

- record,
- chaos tokens,
- XP from a bonus and the [victory points](../../packages/engine/src/victory.ts),
- trauma,
- killed/insane,
- a story card earned (`earnCard`, by each target or, with `choose`, a `choice` of one of them),
- the end of the campaign,
- or a step the players do by hand.

Steps that read the ended game:

- `when` picks its steps by a `GameCondition` (a card in play, set aside, in a scenario deck or in the victory display, the current agenda, or any of these)
- and `recordNames` writes the names of the cards whose condition holds as a list record.

Steps name their target (`each`, `lead`, `notResigned`, `resigned`) instead of investigators, so `campaign.proposeResolution` reads the ended game and turns them into campaign commands, followed by the trauma of each defeat:

- 1 physical for damage,
- 1 mental for horror,
- a `choice` between them for both at once (`damageAndHorror`),
- and what a card effect names (`Investigator.defeat`, e.g. `defeatEachInvestigator({ trauma: 'physical' })`).

An investigator the proposal kills, drives insane, or gives trauma up to their health or sanity on the log gets no change after that one, since the campaign rejects commands for them.

`campaign.proposeResolution` only proposes: the players confirm or edit the list, and `campaign.applyResolution` applies the confirmed commands in one step, all or none, followed by `AdvanceScenario`, which adds the scenario and its outcome to `CampaignLog.playedScenarios` and moves on.
Both read the resolution the game ended with (`gameOutcome`) unless the players pass another `ScenarioOutcome`, for a table that played the ending differently (`sameOutcome` compares two); the defeat trauma still comes from the game.

The last scenario's `endCampaign` step proposes `EndCampaign`, which sets `CampaignLog.result` (`won`, `lost`, or `survived` for an ending that is neither); a log without a result is still running.

Story keys of a campaign live next to its definition ([`story.ts`](../../packages/scenarios/src/night_of_the_zealot/story.ts)), so the scenario that writes a record and the one that reads it share the key.

`CampaignDefinition.log` (`CampaignLogLayout`) says how the log page shows those records: which flags are campaign notes, in the guide's order, and the campaign's own sheets (`LogSheet`, only `nameList` so far). Every campaign's log is the same five shared sheets plus sheets of a few kinds, so a campaign adds data, not a page; a record that no note or sheet names stays hidden.

## Extension points

- **A new campaign:** a `CampaignDefinition` next to its scenarios, with its `log` layout.
- **A new kind of log sheet** (tally, checklist, roster, track; see docs/product.md "Campaign screen"): a `LogSheet` case and its drawing in the web app's `CampaignSheets.tsx`.
- **A new command or record:** add it in `campaign/` with its events, reducer case and invariant.
- **A new correction:** a `CampaignAdjustment` case in `handle_campaign_adjustment.ts` that produces the regular event.
- **A new kind of resolution step:** a `ResolutionStep` case and its command in `proposeStep`; a new target is a `ResolutionTarget` case.
- **A new question about the ended game:** a `GameCondition` case in `gameHolds`, or a `CardPlace` case in `isAt`.
