# Campaign

[Campaign play](https://arkhamdb.com/rules#Campaign_Play), [trauma](https://arkhamdb.com/rules#Trauma), [killed/insane](https://arkhamdb.com/rules#Killed_Insane_Investigators), [joining or leaving](https://arkhamdb.com/rules#Joining_or_Leaving_a_Campaign), [victory display](https://arkhamdb.com/rules#Victory_Display_Victory_Points).

- The game is for 1–4 players, each choosing one investigator ([setup](https://arkhamdb.com/rules#Appendix_III_Setting_Up_The_Game), step 1), so a campaign team has 1–4 investigators.
  Test: `packages/engine/src/campaign/handle_campaign.test.ts › StartCampaign › accepts a team of four`
  Test: `packages/engine/src/campaign/handle_campaign_investigator.test.ts › JoinCampaign (Roland left with 3 XP, Agnes was killed and her player left) › rejects a fifth investigator`
- Trauma:
  - Defeat by damage gives 1 physical trauma, and defeat by horror gives 1 mental trauma.
    Test: `packages/engine/src/campaign/resolution.test.ts › proposeResolution › adds 1 physical trauma for a defeat by damage after the resolution steps`
  - A defeat by a card ability gives trauma only if the ability says so.
  - If both happen at once, the player picks which.
  - Each trauma means starting later scenarios with 1 damage or 1 horror.
    Test: `packages/engine/src/setup.test.ts › compileSetup in a campaign › starts each investigator with damage for physical and horror for mental trauma`
  - When a defeat reaches health and sanity at once (`damageAndHorror`), the resolution proposes a choice between 1 physical and 1 mental trauma for the player to make.
- Physical trauma ≥ printed health means killed, and mental trauma ≥ printed sanity means insane.
  Test: `packages/engine/src/campaign/handle_campaign_investigator.test.ts › AddTrauma (Roland: health 9, sanity 5) › physical trauma reaching health kills the investigator`
  Test: `packages/engine/src/campaign/handle_campaign_investigator.test.ts › AddTrauma (Roland: health 9, sanity 5) › mental trauma reaching sanity drives the investigator insane`
  - That investigator can't be used again in the campaign, and the player picks a new one with a new deck (built with 0 experience) for the next scenario.
    Test: `packages/engine/src/campaign/handle_campaign_investigator.test.ts › ReplaceInvestigator (Roland is killed, Daisy stays alive) › puts the newcomer into the same seat and moves Roland to the former investigators`
    Test: `packages/engine/src/campaign/handle_campaign_investigator.test.ts › ReplaceInvestigator (Roland is killed, Daisy stays alive) › rejects a replacement who is a former investigator`
  - A parallel version counts as the same investigator, so it is out of the campaign with its original (unverified: the Rules Reference has no parallel entry, and the parallel investigators' inserts couldn't be read).
  - The 2026 Core Set adds a third way out, devoured, treated like killed: out of the campaign, replaced by a new investigator with a 0-experience deck (unverified: no 2026 Core Set rules text on devoured could be found).
    Test: `packages/engine/src/campaign/resolution.test.ts › proposeResolution › devours the lead and proposes no experience for them after it`
  - Instead of choosing a new investigator, that player may leave the campaign between scenarios ([joining or leaving](https://arkhamdb.com/rules#Joining_or_Leaving_a_Campaign)); the killed or insane investigator still can't come back.
  - If no investigator is left to choose, the campaign is lost.
- Players may drop out and back in between scenarios.
  Test: `packages/engine/src/campaign/handle_campaign_investigator.test.ts › LeaveCampaign (Roland and Daisy on the team) › moves the leaving investigator to the former ones, trauma and XP kept`
  - A leaving player's log entry stays so they can rejoin.
  - A rejoining investigator returns with their log entry as it was: trauma, unspent experience and earned story cards (the Rules Reference keeps the entry for a rejoin, and unspent experience "may be spent at a later time during this campaign").
    Test: `packages/engine/src/campaign/handle_campaign_investigator.test.ts › JoinCampaign (Roland left with 3 XP, Agnes was killed and her player left) › brings Roland back with his XP, no longer among the former investigators`
  - A joining player picks an investigator not used before in this campaign and starts with no experience and no trauma.
    Test: `packages/engine/src/campaign/handle_campaign_investigator.test.ts › JoinCampaign (Roland left with 3 XP, Agnes was killed and her player left) › seats a newcomer last, without trauma or XP`
  - The rules don't cover one player swapping a living investigator for another.
- At the end of a scenario, revealed locations in play with Victory X and no clues go to the victory display.
  Test: `packages/engine/src/board_view.test.ts › victoryPoints › counts the victory display and the cleared locations that print victory`
  - Experience equals the victory points in the display plus or minus the resolution's adjustments, and unspent experience carries over.
    Test: `packages/engine/src/campaign/resolution.test.ts › proposeResolution › awards each investigator the victory points plus the bonus`
    Test: `packages/engine/src/campaign/handle_campaign_investigator.test.ts › AwardXp and SpendXp › spending raises spent XP and keeps the earned total`
  - Defeated and resigned investigators earn it too: the Rules Reference doesn't say so, but "no resolution" (everyone resigned or was defeated) still has each investigator earn experience in the campaign guide.
- A card's chaos bag change "for the remainder of the scenario" ends with the scenario; the campaign log's bag stays as it was ([setup](https://arkhamdb.com/rules#Appendix_III_Setting_Up_The_Game), step 12).
  Test: `packages/engine/src/campaign/resolution.test.ts › proposeResolution › a game that put an elder thing token into the bag for the campaign and a cultist for the scenario › proposes no removal of a token only the scenario put into the bag`
- A change "for the remainder of the campaign" (or "permanently") is written to the campaign log's chaos bag when the scenario ends, since the next scenario uses the bag as it was at the end of the last one ([setup](https://arkhamdb.com/rules#Appendix_III_Setting_Up_The_Game), step 12). Bless and curse tokens never carry over (FAQ).
  Test: `packages/engine/src/campaign/resolution.test.ts › proposeResolution › a game that put an elder thing token into the bag for the campaign and a cultist for the scenario › proposes writing the elder thing into the log after the resolution`
- An encounter-type weakness an investigator draws during a scenario ("each investigator draws 1 copy of the set-aside Mark of Elokoss") resolves as if just drawn from the encounter deck, and the investigator becomes its bearer: it joins their deck for the rest of the campaign without counting toward its size (Grimoire, "Weakness"). The app puts it into play, and the resolution has each investigator earn it for their deck (the ArkhamCards guide asks the group once whether they were told to add it, so an investigator eliminated before the agenda advanced is dropped by hand).
- A bonus "for each enemy beneath the act when the scenario ended" counts the cards beneath the scenario's last act, also when its advance ended the game (Smoke and Mirrors). Its Resolution 2 only follows another resolution, when the Servant of Flame was beneath the act, and adds 1 bonus experience on top.
  Test: `packages/engine/src/campaign/resolution.test.ts › proposeResolution with steps that read the cards beneath the act › awards 1 experience more for each of the three cards beneath the act`
  Test: `packages/engine/src/campaign/resolution.test.ts › proposeResolution with steps that read the cards beneath the act › still finds them beneath the act once it advanced out of the game`
- Removing a chaos token the bag doesn't hold does nothing, and the rest of the effect still resolves ([Effects](https://arkhamdb.com/rules#Effects)).
  Test: `packages/engine/src/chaos_bag.test.ts › ChangeChaosBag › changes nothing when removing a token the bag does not hold`
- The next scenario follows in sequence unless the resolution says otherwise. A lost scenario still continues the campaign.
