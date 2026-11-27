# Elimination and resign

[Elimination](https://arkhamdb.com/rules#Elimination), [resign](https://arkhamdb.com/rules#Resign).
Card rulings: [Story assets and earned cards](cards/story-assets.md).

- Defeat or resigning eliminates the investigator. Resigning is not a defeat.
  Test: `packages/engine/src/elimination.test.ts › an investigator who %s › ends their turn`
  Test: `packages/engine/src/campaign/resolution.test.ts › proposeResolution › kills only the investigators who did not resign`
- Resign is an action ability a card offers ("[action] Resign."): the Parlor, the Main Path and The Midnight Masks' agendas. Like Parley it provokes no attacks of opportunity.
  Test: `packages/engine/src/card_actions.test.ts › UseCardAction › resigns the investigator who takes a Resign action`
  Test: `packages/engine/src/card_actions.test.ts › UseCardAction › with alice engaged with a ready ghoul › provokes none for Resign`
  - The only other way is a card effect that makes investigators resign ("Each investigator immediately resigns", Emergent Evils in Smoke and Mirrors), which takes no action, so provokes no attacks of opportunity, and happens in whatever phase the effect resolves ([The Arkham Grimoire v1.1](https://images-cdn.fantasyflightgames.com/filer_public/4e/da/4eda7782-c983-47cc-8d9f-ae372a44d87b/arkham_grimoire_v11.pdf), "Resign": only abilities with the Resign designator are actions).
    Test: `packages/engine/src/elimination.test.ts › Resign › lets an effect resign Bob immediately outside the investigation phase`
- On elimination:
  - "when the game ends" effects on their weaknesses in play trigger, then those weaknesses are removed, wherever they are: an enemy engaged with another investigator or at a location too ([FAQ v2.5](https://images-cdn.fantasyflightgames.com/filer_public/c1/d0/c1d0fab6-7fa6-4ce2-af6a-16416381a19b/ahc_faq_v25_february_2026-web.pdf), errata to "Elimination", step 0). The app leaves a "when the game ends" ability to the players.
    Test: `packages/engine/src/weaknesses.test.ts › DrawWeakness › removes a weakness of alice $name from the game when she is defeated`
  - Cards they control and all their out-of-play cards are removed from the game.
    Test: `packages/engine/src/elimination.test.ts › an investigator who %s › removes the cards they control from the game`
  - Cards they own but don't control stay until they leave play, and are then removed.
  - Their clues go to their location, and their resources return to the pool.
    Test: `packages/engine/src/elimination.test.ts › an investigator who %s › puts their clues on their location`
  - Engaged enemies are placed unengaged at that location and otherwise keep their state.
    Test: `packages/engine/src/elimination.test.ts › an investigator who %s › leaves their enemy at the location, unengaged, with its damage and exhaustion`
    Test: `packages/engine/src/elimination.test.ts › an investigator who %s › leaves the enemies of the others engaged`
  - Other cards in their threat area go to the appropriate discard pile.
    Test: `packages/engine/src/elimination.test.ts › an investigator who %s › discards the cards in their threat area without their doom`
- A new lead investigator is chosen if needed, from those still in the scenario.
  Test: `packages/engine/src/elimination.test.ts › the lead investigator leaving › asks the group for a new lead when several investigators remain`
  Test: `packages/engine/src/elimination.test.ts › the lead investigator leaving › makes the last remaining investigator the lead without asking`
  - One effect that eliminates several investigators ("each investigator … is defeated") eliminates them together ([simultaneous resolution](https://arkhamdb.com/rules#Priority_of_Simultaneous_Resolution)), so the new lead comes from those left afterwards.
  - Another investigator who leaves before the group has chosen (a later attack of the same enemy phase) can't be chosen either: the engine asks again among those left, or makes the one left the lead.
    Test: `packages/engine/src/elimination.test.ts › the lead investigator leaving › while the group still chooses, the enemy phase defeats bob too › makes carol, the one left, the lead`
    Test: `packages/engine/src/elimination.test.ts › the lead investigator leaving › while the group still chooses, the enemy phase defeats bob too › asks again among carol and dave, who are still in`
  - If nobody is left, the scenario ends with "no resolution", and the players read the scenario's "if no resolution was reached" entry in the campaign guide (Learn to Play).
    Test: `packages/engine/src/elimination.test.ts › the last investigator leaving › ends the scenario without a resolution`
- A card ability can defeat an investigator outright; what follows from that is only what the ability says ([investigator defeat](https://arkhamdb.com/rules#Investigator_Defeat)).
  Test: `packages/engine/src/elimination.test.ts › DefeatInvestigator › records that a card effect defeated the investigator`
  Test: `packages/engine/src/elimination.test.ts › DefeatInvestigator › defeats an investigator outside their turn and the investigation phase`
- Eliminated investigators still count for per-investigator values, and only there ([Elimination](https://arkhamdb.com/rules#Elimination)): otherwise they are no longer in the game, so "if there are exactly 1 or 2 investigators in the game" (Miskatonic Quad, Merchant District) counts only those still playing.
  Test: `packages/scenarios/src/spreading_flames/cards.test.ts › Spreading Flames card abilities › Miskatonic Quad › refuses the move with 3 investigators in the game`
  Test: `packages/engine/src/doom.test.ts › Advance the act › keeps the starting player count after bob is defeated, so alice alone cannot pay`
