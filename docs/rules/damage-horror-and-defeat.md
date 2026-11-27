# Damage, horror and defeat

[Dealing damage/horror](https://arkhamdb.com/rules#Dealing_Damage_Horror), [defeat](https://arkhamdb.com/rules#Defeat).
Card rulings: [Resolution order](cards/resolution-order.md).

- When an investigator is dealt damage or horror, they may assign it to their assets that have health or sanity (no more than would defeat each asset), and the rest goes on the investigator. Prevention happens between assigning and applying, and everything is applied at once.
  Test: [`packages/engine/src/attacks_of_opportunity.test.ts › attacks of opportunity › deals the damage and horror the players lower it to when assets soak part of the attack`](../../packages/engine/src/attacks_of_opportunity.test.ts#L104)
  Test: [`packages/engine/src/phases.test.ts › enemy phase › deals the reduced amounts the players enter when assets soak part of an attack`](../../packages/engine/src/phases.test.ts#L376)
- [Direct damage](https://arkhamdb.com/rules#Direct_Damage_Direct_Horror) or horror goes on the card named and can't be assigned elsewhere: "1 direct damage to each player card with health" (Miskatonic University (In Flames)) hits each investigator and each ally there separately; the engine deals the investigators' part, the players the allies'.
  Test: [`packages/scenarios/src/smoke_and_mirrors/cards.test.ts › Smoke and Mirrors card abilities › Miskatonic University (In Flames) › deals 1 damage to each investigator there, and none elsewhere, as the investigation phase ends`](../../packages/scenarios/src/smoke_and_mirrors/cards.test.ts#L577)
- [Heal](https://arkhamdb.com/rules#Heal) X damage removes up to X damage tokens: no more than the card has, so healing an undamaged enemy does nothing.
  Test: [`packages/engine/src/enemies.test.ts › healing › heals $heal of $damage damage from an enemy`](../../packages/engine/src/enemies.test.ts#L954)
  Test: [`packages/engine/src/enemies.test.ts › healing › heals nothing from an undamaged enemy`](../../packages/engine/src/enemies.test.ts#L964)
  - The same holds for an investigator's damage and horror (St. Mary's Hospital's "heal 3 damage" with 1 damage heals 1).
- Readying a ready enemy does nothing, so Umôrdhoth's "at the end of each investigator's turn: ready him" is no error while he is ready.
  Test: [`packages/engine/src/enemies.test.ts › exhaust and ready › readies nothing on a ready enemy`](../../packages/engine/src/enemies.test.ts#L1005)
  Test: [`packages/scenarios/src/the_devourer_below/cards.test.ts › The Devourer Below card abilities › Umôrdhoth › readies at the end of alice’s turn`](../../packages/scenarios/src/the_devourer_below/cards.test.ts#L582)
- Exhausting an exhausted enemy does nothing either ([Exhaust](https://arkhamdb.com/rules#Exhaust_Exhausted)), and the effect's other parts still resolve ([Effects](https://arkhamdb.com/rules#Effects): as much as possible), so "exhaust each enemy at your location" works with some of them exhausted.
  Test: [`packages/engine/src/enemies.test.ts › exhaust and ready › exhausts nothing on an exhausted enemy`](../../packages/engine/src/enemies.test.ts#L1013)
- A turn ended by resignation or defeat opens no turn-end windows, not even for cards in play: our reading, as no rule says whether such a turn "ends".
- An investigator with damage ≥ health or horror ≥ sanity is defeated and [eliminated](elimination-and-resign.md).
  Test: [`packages/engine/src/attacks_of_opportunity.test.ts › attacks of opportunity › defeats the investigator once with damage and horror counted together`](../../packages/engine/src/attacks_of_opportunity.test.ts#L165)
- An enemy with damage ≥ health goes to the encounter discard, or to its owner's discard if it is a weakness; with Victory X it goes to the victory display instead, a weakness too: Victory replaces "the discard pile", whichever pile that is ([Victory display](https://arkhamdb.com/rules#Victory_Display_Victory_Points); FAQ v2.5 §1.12: an encounter-type weakness in play counts as an encounter card; our reading, no ruling names a weakness with Victory).
  Test: [`packages/engine/src/enemies.test.ts › damage and defeat › puts a defeated enemy on top of the encounter discard and readies it`](../../packages/engine/src/enemies.test.ts#L897)
  Test: [`packages/engine/src/enemies.test.ts › damage and defeat › sends a defeated enemy with victory to the victory display`](../../packages/engine/src/enemies.test.ts#L886)
  Test: [`packages/engine/src/weaknesses.test.ts › DrawWeakness › a defeated weakness enemy $name`](../../packages/engine/src/weaknesses.test.ts#L142)
  - Damage moved onto an enemy ("move all damage on that enemy to Mother") defeats it the same way. Moving damage or horror is not dealing it, so nothing prevents or answers it ([Dealing Damage/Horror](https://arkhamdb.com/rules#Dealing_Damage_Horror) is assign then apply; our reading). Damage moves only onto a card with health and horror only onto one with sanity: the October 2024 FAQ is reported to rule this for damage; we could not read its text, and apply it to horror by analogy.
    Test: [`packages/engine/src/scenario_effects.test.ts › card effects that move tokens between cards › moves $damage damage onto Mother with health 3 and 1 damage: defeated $motherDefeated`](../../packages/engine/src/scenario_effects.test.ts#L417)
  - An enemy a card effect defeats ("it is automatically defeated") goes the same way ([Victory display](https://arkhamdb.com/rules#Victory_Display_Victory_Points); FAQ v2.5, Persistent Construct). An effect that discards an enemy is no defeat: it goes to the discard even with Victory X.
    Test: [`packages/engine/src/enemy_effects.test.ts › card effects that exhaust or defeat an enemy › defeats an evaded enemy without damage, to the zone a victory of $victory sends it`](../../packages/engine/src/enemy_effects.test.ts#L112)
    Test: [`packages/engine/src/doomed.test.ts › Doomed › places no doom when the bystander is discarded, which is no defeat`](../../packages/engine/src/doomed.test.ts#L58)
- A defeated asset goes to its owner's discard.
- A "when [this enemy] is defeated" forced ability ([When](https://arkhamdb.com/rules#Ability): before the defeat's impact) resolves after the enemy has gone, and "this location" is where it was (Goat Spawn: "each investigator at this location takes 1 horror").
  Test: [`packages/engine/src/triggers.test.ts › trigger bus › abilities when an enemy is defeated › deals 1 horror to each investigator in the hall when it is defeated $name`](../../packages/engine/src/triggers.test.ts#L1153)
  - Our stand-in for "when" changes nothing while such an ability only acts on its location. Doomed uses it too, so a Bystander's doom advances the agenda after the Bystander has gone; this differs only for an agenda whose reverse side acts on enemies in play, and no Spreading Flames agenda does.
    Test: [`packages/engine/src/doomed.test.ts › Doomed › asks to advance Past Curfew, threshold 1, when that doom reaches it`](../../packages/engine/src/doomed.test.ts#L50)
