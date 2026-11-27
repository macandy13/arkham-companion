# Act and clues

[Clues](https://arkhamdb.com/rules#Clues), [act deck](https://arkhamdb.com/rules#Act_Deck_and_Agenda_Deck).
Card rulings: [Objectives and special acts and agendas](cards/objectives.md).

- When an investigator first enters an unrevealed location, it is revealed and gets clues equal to its clue value, which is usually per investigator. An enemy moving into an unrevealed location does **not** reveal it.
  Test: [`packages/engine/src/investigators.test.ts › MoveInvestigator › moves along a connection and reveals the destination with its clues`](../../packages/engine/src/investigators.test.ts#L54)
  Test: [`packages/engine/src/board.test.ts › RevealLocation › flips the location and places clues %s`](../../packages/engine/src/board.test.ts#L643)
- A successful investigate discovers 1 clue: it moves from the location to the investigator. It discovers as many as the location has when the results apply (ST.7), and none for an investigator who cannot discover clues; either way the investigation still succeeded ([Investigate](https://arkhamdb.com/rules#Investigate)).
  Test: [`packages/engine/src/skill_tests.test.ts › Investigate › discovers 1 clue on a pass by default`](../../packages/engine/src/skill_tests.test.ts#L163)
  Test: [`packages/engine/src/skill_tests.test.ts › Investigate › discovers only the clues left when some were taken off while the test was open`](../../packages/engine/src/skill_tests.test.ts#L191)
  Test: [`packages/engine/src/restrictions.test.ts › an enemy whose engaged investigator cannot discover or spend clues (The Masked Hunter) › lets alice’s passed investigation end with $clues clues while the hunter is $hunter`](../../packages/engine/src/restrictions.test.ts#L163)
- A card that investigates another revealed location "as if you were at that location" (In the Know) tests against that location's shroud and discovers its clues there; the investigator doesn't move (`Investigate.locationId`). As the FAQ's "As If" has it, the location's "cannot investigate" applies, and so does the investigator's own "cannot discover clues"; their threat area is unchanged, so attacks of opportunity still happen and enemies at that location don't engage them. An unrevealed location is refused.
  Test: [`packages/engine/src/skill_tests.test.ts › Investigate another location › tests against the attic's shroud 1 and discovers its clue for alice in the study`](../../packages/engine/src/skill_tests.test.ts#L296)
  Test: [`packages/engine/src/skill_tests.test.ts › Investigate another location › rejects the unrevealed hallway, as a card investigates only a revealed location`](../../packages/engine/src/skill_tests.test.ts#L310)
  - Sixth Sense picks its location only once a token is revealed, may use either shroud, and at level 4 applies the result to both locations: the players investigate their own location and discover the other clue by hand.
- A card's "discover N clues" at a location with fewer discovers as many as it has ([Effects](https://arkhamdb.com/rules#Effects)), and may name a location other than the investigator's ("discover 1 clue at another location"); the investigator doesn't move ([Clues](https://arkhamdb.com/rules#Clues): discovered by investigating or by a card ability).
  Test: [`packages/engine/src/investigator_effects.test.ts › card effects that discover clues › discovers $discovered clues in an attic with $atticClues when told to discover 2`](../../packages/engine/src/investigator_effects.test.ts#L149)
  Test: [`packages/engine/src/investigator_effects.test.ts › card effects that discover clues › discovers a clue at another location the card names`](../../packages/engine/src/investigator_effects.test.ts#L171)
- "Take control of 1 of the clues on Constance Dumaine" moves the clue from that card onto the investigator; it is not discovering, which only takes clues from a location ([Clues](https://arkhamdb.com/rules#Clues)), so "cannot discover clues" does not stop it. Clues moved onto a card count for its "if there are N clues on it" like placed ones.
  Test: [`packages/engine/src/scenario_effects.test.ts › card effects that move tokens between cards › gives the clues on a card to the investigator who takes control of them`](../../packages/engine/src/scenario_effects.test.ts#L443)
  Test: [`packages/engine/src/triggers.test.ts › objectives on a card's own tokens › advances when a clue is moved onto the act holding 1, as when one is placed`](../../packages/engine/src/triggers.test.ts#L2451)
- An "Objective –" is active only while its agenda or act is current: the cards below it in the deck are not in play.
  Test: [`packages/engine/src/triggers.test.ts › objectives on the current agenda and act › does not fire for an act that is not current yet`](../../packages/engine/src/triggers.test.ts#L2100)
  - Advancing by an objective spends no clues: the objective overrides the clue requirement (RR "Act Deck and Agenda Deck").
    Test: [`packages/engine/src/doom.test.ts › advancing an act without paying clues › advances an act that has a clue threshold when no clues are paid`](../../packages/engine/src/doom.test.ts#L777)
- If the act has no "Objective –", the group may spend the required clues from any mix of investigators at any player window during an investigator's turn ([free] ability) to advance it. An "Objective –" replaces or adds to that requirement.
  Test: [`packages/engine/src/play_table.test.ts › turns, actions and tokens › advances the act by spending the clues of several investigators`](../../packages/engine/src/play_table.test.ts#L459)
  Test: [`packages/engine/src/doom.test.ts › Advance the act › charges the clues per investigator and makes the next act current`](../../packages/engine/src/doom.test.ts#L554)
  - The app models this as the act's own free action, offered during any investigator's turn; clues on the act don't count towards it.
    Test: [`packages/engine/src/card_actions.test.ts › advancing the act by spending clues › shows the clues alice and bob hold against its cost for two investigators`](../../packages/engine/src/card_actions.test.ts#L824)
    Test: [`packages/engine/src/doom.test.ts › Advance the act › does not count clues on the act towards its cost, and removes them as it advances`](../../packages/engine/src/doom.test.ts#L579)
- Advancing an act removes all tokens from it (RR "Act Deck and Agenda Deck" step 1), flips it, follows the back, and makes the next act current (unless the back names one).
  Test: [`packages/engine/src/doom.test.ts › Advance the act › does not count clues on the act towards its cost, and removes them as it advances`](../../packages/engine/src/doom.test.ts#L579)
  Test: [`packages/engine/src/doom.test.ts › Advance the act › charges the clues per investigator and makes the next act current`](../../packages/engine/src/doom.test.ts#L554)
- For agenda and act alike, the back resolves completely first, including any choice it asks. Only then does the next card become current, and at that same moment the advanced card leaves the game (RR "Act Deck and Agenda Deck" step 3: "simultaneously removed").
  Test: [`packages/engine/src/triggers.test.ts › trigger bus › runs the reverse side of the advancing agenda before the next one becomes current`](../../packages/engine/src/triggers.test.ts#L178)
  Test: [`packages/engine/src/doom.test.ts › a last act whose reverse side lets the lead investigator choose the resolution › keeps the last act in play while the question is open instead of asking for a resolution`](../../packages/engine/src/doom.test.ts#L714)
- A "(→R#)" on any card ends the scenario with that resolution.
  Test: [`packages/engine/src/doom.test.ts › Advance the act › ends the scenario with the resolution when the last act advances`](../../packages/engine/src/doom.test.ts#L640)
  Test: [`packages/engine/src/doom.test.ts › Advance the agenda › ends the scenario with the resolution when the last agenda advances`](../../packages/engine/src/doom.test.ts#L502)
  - [Winning and losing](https://arkhamdb.com/rules#Winning_and_Losing): act resolutions are wins in standalone mode, anything else is a loss.
  - If every investigator is eliminated, the scenario ends with "no resolution".
    Test: [`packages/engine/src/elimination.test.ts › the last investigator leaving › ends the scenario without a resolution`](../../packages/engine/src/elimination.test.ts#L389)
