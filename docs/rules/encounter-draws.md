# Encounter draws

[Mythos step 1.4](https://arkhamdb.com/rules#Mythos_Phase), [encounter deck](https://arkhamdb.com/rules#Encounter_Deck).
Card rulings: [Searching, drawing and attaching encounter cards](cards/encounter-searches.md).
A player card or effect that makes an investigator draw outside the mythos phase follows the same steps.
A [weakness](https://arkhamdb.com/rules#Weakness) enemy or treachery drawn from a player deck (Mob Enforcer, Haunted) resolves as if it were an encounter card, so it follows the same steps from step 2, peril and surge included; a surge draws from the encounter deck. It is not an encounter card: when it is discarded or defeated it goes to its owner's discard pile, not the encounter discard, which the app shows as the card leaving the scenario.
Test: [`packages/engine/src/weaknesses.test.ts › DrawWeakness › draws an encounter card for surge, as an encounter card does`](../../packages/engine/src/weaknesses.test.ts#L127)
Test: [`packages/engine/src/weaknesses.test.ts › DrawWeakness › gives a resolved treachery back to its owner, not to the encounter discard`](../../packages/engine/src/weaknesses.test.ts#L118)
Test: [`packages/engine/src/weaknesses.test.ts › DrawWeakness › gives a discarded weakness in the threat area back to its owner`](../../packages/engine/src/weaknesses.test.ts#L153)

For each draw:

1. Draw the top card. If the deck is empty, shuffle the encounter discard pile back in first.
   Test: [`packages/engine/src/encounter.test.ts › DrawCard › reveals the top card and discards a plain treachery on top of the discard`](../../packages/engine/src/encounter.test.ts#L89)
   Test: [`packages/engine/src/encounter.test.ts › DrawCard › reshuffles the discard into a deck that was already empty before drawing`](../../packages/engine/src/encounter.test.ts#L314)
2. [Peril](https://arkhamdb.com/rules#Peril): while it resolves, other players can't confer, play cards, trigger abilities or commit cards to that investigator's tests.
   Test: [`packages/engine/src/encounter.test.ts › DrawCard › records peril on the draw`](../../packages/engine/src/encounter.test.ts#L221)
3. Resolve its [revelation](https://arkhamdb.com/rules#Revelation) ability before it enters play (or, for a treachery, before it is discarded).
   Test: [`packages/engine/src/encounter.test.ts › revelation before the drawn card is placed › resolves the revelation of $drawn.code before placing it`](../../packages/engine/src/encounter.test.ts#L1246)
   Test: [`packages/engine/src/skill_tests.test.ts › revelation test › keeps the card out of the discard while its revelation is resolved`](../../packages/engine/src/skill_tests.test.ts#L813)
   - A treachery is discarded afterwards unless its revelation put it into play (2026 Core rulebook p. 18).
     Test: [`packages/engine/src/encounter.test.ts › DrawCard › puts a treachery that stays in play into the threat area`](../../packages/engine/src/encounter.test.ts#L122)
     Test: [`packages/engine/src/encounter.test.ts › revelation before the drawn card is placed › does not place a card its revelation has already moved`](../../packages/engine/src/encounter.test.ts#L1282)
   - A [cancelled](https://arkhamdb.com/rules#Cancel) revelation (Ward of Protection: "When you draw a non-weakness treachery card … Cancel that card's revelation effect. Then, take 1 horror") resolves none of it; the card is still placed as usual, and its keywords (surge, peril) still apply, as they are not part of the revelation.
     Test: [`packages/engine/src/encounter.test.ts › the question a drawn treachery asks before its revelation › discards a cancelled card without its revelation and records the cancel`](../../packages/engine/src/encounter.test.ts#L1345)
     Test: [`packages/engine/src/encounter.test.ts › the question a drawn treachery asks before its revelation › still draws again for a cancelled card with surge`](../../packages/engine/src/encounter.test.ts#L1366)
   - If the revelation eliminates the drawer, our reading (no explicit ruling exists): a treachery is discarded; an enemy with a spawn instruction still spawns there; an enemy without one would spawn engaged with the drawer, which can no longer be fulfilled, so it is discarded (2026 Core rulebook p. 19).
     Test: [`packages/engine/src/encounter.test.ts › revelation before the drawn card is placed › discards a card whose revelation defeated alice before putting it into her threat area`](../../packages/engine/src/encounter.test.ts#L1175)
     Test: [`packages/engine/src/encounter.test.ts › revelation before the drawn card is placed › places $drawn.code without the drawer it defeated: $placed`](../../packages/engine/src/encounter.test.ts#L1300)
4. An enemy [spawns](spawn-and-engagement.md).
5. A treachery goes to the encounter discard pile unless its text says otherwise.
   - One whose revelation attaches it somewhere stays there; if there is nothing to attach it to, or a [limit](https://arkhamdb.com/rules#Limits_and_Maximums) ("Limit 1 per location", counted by title) keeps it from attaching, it is discarded ([Attach To](https://arkhamdb.com/rules#Attach_To)).
     Test: [`packages/engine/src/encounter.test.ts › DrawCard › a treachery that attaches to the location, limit 1 per location › is discarded while another copy is attached there`](../../packages/engine/src/encounter.test.ts#L143)
     Test: [`packages/engine/src/encounter.test.ts › DrawCard › a treachery that attaches to the location, limit 1 per location › is discarded when the drawer is at no location`](../../packages/engine/src/encounter.test.ts#L164)
   - Likewise one that goes into a threat area: with "Limit 1 per investigator" and a copy of its title already in the drawer's threat area, it is discarded. "Limit X per investigator" pertains to the investigator's play area, and another copy "cannot enter the specified play area if this limit has already been reached" ([FAQ v2.5](https://images-cdn.fantasyflightgames.com/filer_public/c1/d0/c1d0fab6-7fa6-4ce2-af6a-16416381a19b/ahc_faq_v25_february_2026-web.pdf) §2.3); a treachery that does not enter play goes from limbo to the discard (§1.23). Encounter cards in play near an investigator are only ever in the threat area, so the engine counts that zone.
     Test: [`packages/engine/src/encounter.test.ts › DrawCard › a treachery in the threat area, limit 1 per investigator › is discarded while the drawer already has a copy in their threat area`](../../packages/engine/src/encounter.test.ts#L184)
     Test: [`packages/engine/src/encounter.test.ts › DrawCard › a treachery in the threat area, limit 1 per investigator › comes into play beside a card of another title`](../../packages/engine/src/encounter.test.ts#L198)
   - An attached card's action ("[action]: Test [combat] (4) or [agility] (4). If you succeed, discard Locked Door") can be taken by an investigator at the location it is attached to ([Abilities](https://arkhamdb.com/rules#Abilities): a card's actions are available to investigators at its location).
     Test: [`packages/engine/src/card_actions.test.ts › UseCardAction › lets bob take the action of $name`](../../packages/engine/src/card_actions.test.ts#L199)
   - A treachery or enemy with Victory X goes to the victory display instead when it is overcome (see [Victory display](https://arkhamdb.com/rules#Victory_Display_Victory_Points)).
6. [Surge](https://arkhamdb.com/rules#Surge): after resolving, draw another encounter card and start over.
   Test: [`packages/engine/src/encounter.test.ts › DrawCard › draws again after a surge card`](../../packages/engine/src/encounter.test.ts#L236)
   Test: [`packages/engine/src/encounter.test.ts › surge after the drawn card has resolved › draws the surge card once the test is answered and the card discarded`](../../packages/engine/src/encounter.test.ts#L1058)
   - A card that gains surge while it resolves (False Lead: "if you have no clues, False Lead gains surge") surges like one with printed surge; one with both surges once (our reading, no explicit ruling exists).
     Test: [`packages/engine/src/triggers.test.ts › a card that gains surge without clues › draws $drawn for alice with $clues clues`](../../packages/engine/src/triggers.test.ts#L3888)
     Test: [`packages/engine/src/triggers.test.ts › a card that gains surge without clues › draws only once more for a card with printed surge that also gains it`](../../packages/engine/src/triggers.test.ts#L4047)
   - "Resolving" covers the whole card: its revelation and revelation test, its spawn and engagement, and the forced effects it triggers (2026 Core rulebook p. 19: "after resolving its text"; FAQ §1.4).
     Test: [`packages/engine/src/encounter.test.ts › surge after the drawn card has resolved › draws the surge card only after the players chose where the enemy spawns`](../../packages/engine/src/encounter.test.ts#L1111)
   - If the card eliminates the drawer, our reading (no explicit ruling exists): the surge draw is lost, since Surge makes "the investigator who drew it" draw again and an eliminated investigator no longer takes part; the others play on (2026 Core rulebook, Surge and Elimination).
     Test: [`packages/engine/src/encounter.test.ts › surge after the drawn card has resolved › places the card, but draws nothing more once its revelation defeated alice`](../../packages/engine/src/encounter.test.ts#L1096)
     Test: [`packages/engine/src/triggers.test.ts › a card that gains surge without clues › draws nothing more for a drawer the card defeated`](../../packages/engine/src/triggers.test.ts#L3986)

Discarding cards from the top of the encounter deck ("Discard the top 3 cards of the encounter deck") stops when the deck runs out, having done as much as it can ([effects](https://arkhamdb.com/rules#Effects)); the discard is shuffled back in once the effect has resolved, not while it resolves (FAQ ruling on [Smite the Wicked](https://arkhamdb.com/card/02007): "Generally, you reshuffle the encounter discard pile into the encounter deck when it is empty … but not while you're resolving an effect").
Test: [`packages/engine/src/triggers.test.ts › trigger bus › discarding from the top of the encounter deck › discards the 2 left, then the empty deck takes the discard back once the card resolved`](../../packages/engine/src/triggers.test.ts#L1243)
Our reading (no explicit ruling): the cards are discarded one at a time off the top, so the first one ends lowest of them on the discard, rather than "at the same time" in an order the lead investigator picks ([discard piles](https://arkhamdb.com/rules#Discard_Piles)).
Test: [`packages/engine/src/triggers.test.ts › trigger bus › discarding from the top of the encounter deck › discards the top 3 one by one onto the discard, below Out of This World`](../../packages/engine/src/triggers.test.ts#L1224)

An ability that shuffles an empty discard pile into a deck does not shuffle the deck ([discard piles](https://arkhamdb.com/rules#Discard_Piles)).
Test: [`packages/engine/src/encounter.test.ts › ShuffleEncounterDiscard › leaves the deck in its order when the discard is empty`](../../packages/engine/src/encounter.test.ts#L802)
Our reading (no explicit ruling): "shuffle the set-aside [card] into the encounter deck" is done as far as it can be ([effects](https://arkhamdb.com/rules#Effects)): the copies still set aside go in, and the deck is shuffled even when none was left. The rule above covers only an empty discard pile.
Test: [`packages/engine/src/scenario_effects.test.ts › card effects that shuffle cards into the encounter deck › shuffles a set-aside card into the encounter deck`](../../packages/engine/src/scenario_effects.test.ts#L149)
Test: [`packages/engine/src/scenario_effects.test.ts › card effects that shuffle cards into the encounter deck › adds nothing but still shuffles the deck when the card is not set aside`](../../packages/engine/src/scenario_effects.test.ts#L173)
Not modelled yet: "A single card cannot be shuffled into an empty player deck or encounter deck via card effect" ([discard piles](https://arkhamdb.com/rules#Discard_Piles)). No card in our scenarios can shuffle a single card into an empty encounter deck; the rule waits for the first that can (#1344).
