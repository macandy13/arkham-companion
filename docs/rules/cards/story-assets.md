# Story assets and earned cards

Card rulings for [Elimination and resign](../elimination-and-resign.md).
A story asset is an encounter card the investigators can take control of; a resolution can let an investigator earn it for their deck.
The app tracks it while it is an encounter card and asks the players about it once it becomes a player card.

- Lita Chantler (The Gathering's Parlor): while no player controls her, she gains "[action]: Parley. Test [intellect] (4). If you succeed, take control of Lita Chantler."
  Test: [`packages/scenarios/src/the_gathering/cards.test.ts › Lita Chantler › lets alice Parley with an intellect (4) test; a $result leaves Lita in $zone.kind`](../../../packages/scenarios/src/the_gathering/cards.test.ts#L121)
  Test: [`packages/scenarios/src/the_gathering/cards.test.ts › Lita Chantler › rejects a Parley from bob once alice controls Lita`](../../../packages/scenarios/src/the_gathering/cards.test.ts#L136)
  - Only investigators at her location can take it, and as a Parley it provokes no attacks of opportunity.
    Test: [`packages/engine/src/card_actions.test.ts › UseCardAction › with alice engaged with a ready ghoul › provokes none for a Parley, which adds the ghoul to the victory display`](../../../packages/engine/src/card_actions.test.ts#L352)
  - The investigator who succeeds controls her (she is in play in their play area); her own Ally abilities are then theirs to use, played by hand.
- Dr. Henry Armitage (Spreading Flames): Searching for Dr. Armitage's reverse side puts him "into play under any investigator's control". The players choose who, and the lead investigator decides when they can't agree ([Choices](https://arkhamdb.com/rules#Choices_and_the_Grim_Rule)), so the app asks the lead.
  Test: [`packages/scenarios/src/spreading_flames/spreading_flames.test.ts › Spreading Flames act 3, Searching for Dr. Armitage › asks the lead whose control Dr. Henry Armitage comes under; picking $name puts him in their play area`](../../../packages/scenarios/src/spreading_flames/spreading_flames.test.ts#L418)
  Test: [`packages/engine/src/triggers.test.ts › a pick the lead makes on an act's reverse side › asks the lead, alice, and puts the asset in the play area of bob, whom she picks`](../../../packages/engine/src/triggers.test.ts#L2333)
  - His skill bonus and free first action are his controller's to apply, like a player card's.
- Umôrdhoth (The Devourer Below): "[action] If you control Lita Chantler: … (→R3)". Investigators at its location can take it.
  Test: [`packages/scenarios/src/the_devourer_below/cards.test.ts › The Devourer Below card abilities › Umôrdhoth › ends the scenario with $resolution when alice answers $answered`](../../../packages/scenarios/src/the_devourer_below/cards.test.ts#L504)
  - It is not a Parley, so it provokes attacks of opportunity, Umôrdhoth's own included (massive, it is engaged with everyone at its location).
    Test: [`packages/scenarios/src/the_devourer_below/cards.test.ts › The Devourer Below card abilities › Umôrdhoth › asks alice, who takes its action, after its attack of opportunity whether she controls Lita`](../../../packages/scenarios/src/the_devourer_below/cards.test.ts#L479)
  - In The Devourer Below Lita is a player card the app doesn't track, and earning her in The Gathering only lets an investigator include her in their deck, so the app can't know whether the taker controls her. The action is offered to anyone at Umôrdhoth's location and, once its attacks of opportunity are resolved, asks the taker whether they control her: yes ends the scenario with R3, no does nothing.
