# Costs of card actions and basic actions

Card rulings for [Card abilities and modifiers](../card-abilities-and-modifiers.md).
A cost ("Spend 5 resources:") is paid in full before the effect, and an action whose cost can't be paid can't be taken ([Costs](https://arkhamdb.com/rules#Costs)).
The cards below have costs the whole group pays, or that the players pay at the table.

- "The investigators spend 2 clues per investigator, as a group" (Uncovering the Conspiracy) is paid by any investigators together, wherever they are, splitting it as they choose, like advancing the act ([Act Deck and Agenda Deck](https://arkhamdb.com/rules#Act_Deck_and_Agenda_Deck)).
  Test: [`packages/scenarios/src/the_midnight_masks/cards.test.ts › The Midnight Masks card abilities › Uncovering the Conspiracy › spends 4 clues of the group and spawns the top cultist, Herman Collins, in the Graveyard`](../../../packages/scenarios/src/the_midnight_masks/cards.test.ts#L293)
  Test: [`packages/engine/src/card_actions.test.ts › group clue costs › takes the 4 clues from alice and bob as they name them, bob paying from the cellar`](../../../packages/engine/src/card_actions.test.ts#L1098)
- "Spend 1 [per_investigator] clues:" without "as a group" (Elokoss) is the triggering investigator's alone, from their own clues: only the controller of an ability pays its costs ([Costs](https://arkhamdb.com/rules#Costs)).
  Test: [`packages/scenarios/src/queen_of_ash/cards.test.ts › Queen of Ash card abilities › Elokoss › refuses alice's spend when the 2 clues it costs 2 investigators need bob's clue beside her`](../../../packages/scenarios/src/queen_of_ash/cards.test.ts#L409)
  Test: [`packages/scenarios/src/queen_of_ash/cards.test.ts › Queen of Ash card abilities › Elokoss › takes 1 clue per investigator from alice as a fast ability and places 1 clue on Elokoss`](../../../packages/scenarios/src/queen_of_ash/cards.test.ts#L429)
  - "Per investigator" counts the investigators who started the scenario.
  - When the players have a split to choose (more than one of them holds clues, and together more than the cost), the app asks who pays how many, starting from the engine's split: the investigator taking the action pays what they can and the others the rest, in seat order.
    Test: [`packages/engine/src/card_actions.test.ts › group clue costs › takes all of alice’s 1 clue and 3 of bob’s 5 when nobody names the payers`](../../../packages/engine/src/card_actions.test.ts#L1113)
    Test: [`packages/engine/src/card_actions.test.ts › group clue costs › takes 3 of bob’s 3 first and alice’s 1 when bob, in the second seat, takes it`](../../../packages/engine/src/card_actions.test.ts#L1122)
  - The engine pays the action before the attacks of opportunity, but a card action's clue cost after the attacks of opportunity it provokes, not before them, and only this card notices: if an attack of opportunity defeats the investigator taking it, their clues drop to their location before the cost is paid, so the group may no longer afford it (the rules would have spent those clues first).
- "Choose and discard 4 cards from your hand" (Herman Collins' Parley) is paid by the players, since the game holds no player cards; the app trusts that they can pay it.
  Test: [`packages/scenarios/src/the_midnight_masks/cards.test.ts › The Midnight Masks card abilities › adds Herman Collins to the victory display, leaving alice’s 4 discards to the players`](../../../packages/scenarios/src/the_midnight_masks/cards.test.ts#L402)
  Test: [`packages/engine/src/card_actions.test.ts › hand card costs › leaves alice’s discard of 4 cards to the players and still scares her`](../../../packages/engine/src/card_actions.test.ts#L1051)

A card can also raise what a basic action costs, paid in actions when it is taken ([Actions](https://arkhamdb.com/rules#Actions), [Costs](https://arkhamdb.com/rules#Costs)).

- Frozen in Fear ("The first move, fight, or evade action you perform each round costs 1 additional action") raises only the first of those three its investigator performs in a round, whichever it is: after a fight, the round's moves and evades cost 1 again.
  Test: [`packages/engine/src/action_costs.test.ts › actionCost › costs alice $cost for a first $action of the round while frozen`](../../../packages/engine/src/action_costs.test.ts#L55)
  Test: [`packages/engine/src/action_costs.test.ts › actionCost › as alice takes actions, the engine counts them off › makes a fight after the first move cost alice the usual 1`](../../../packages/engine/src/action_costs.test.ts#L93)
  Test: [`packages/engine/src/action_costs.test.ts › actionCost › as alice takes actions, the engine counts them off › raises alice's first move again once the round has ended`](../../../packages/engine/src/action_costs.test.ts#L133)
  - An action they performed earlier in the round, before Frozen in Fear came into play, was already their first, so the card raises none that round (our reading of "the first … each round"; no ruling found).
  - Two copies each add 1, so the first such action costs 3.
    Test: [`packages/engine/src/action_costs.test.ts › actionCost › adds the cost of each copy: two frozen cards make alice's first move cost 3`](../../../packages/engine/src/action_costs.test.ts#L149)
  - An investigator with fewer actions left than the raised cost can't take it.
    Test: [`packages/engine/src/action_costs.test.ts › actionCost › as alice takes actions, the engine counts them off › refuses a first move that costs 2 when alice has only 1 action left`](../../../packages/engine/src/action_costs.test.ts#L121)
  - A free move, fight or evade it has raised to 1 action still provokes no attacks of opportunity: the Rules Reference exempts [free] abilities, and the engine treats a move a card grants the same way (our reading; no ruling found).
  - A move, fight or evade a card lets them perform without spending an action (a granted or free one, Shortcut's move) still costs the additional action, and it is the first one (the card's FAQ on ArkhamDB).
    Test: [`packages/engine/src/action_costs.test.ts › actionCost › as alice takes actions, the engine counts them off › charges a free first move only its additional action, and counts it as the first`](../../../packages/engine/src/action_costs.test.ts#L112)
  - It also raises a card ability with a Move, Fight or Evade designator ("[action] Fight."): such an ability is that action too (RR "Action Designators"). The players count those off at the table, since the app has no player cards.

A location can make what investigators do with it cost more: Waterfront District ("As an additional cost to investigate Waterfront District, you must spend 1 action"), and Arcane Lock attached to a location ("As an additional cost to enter or leave attached location, you must spend 1 action").

- The cost is paid whenever the investigation, entering or leaving happens: a basic action, a free or granted move, a move by a card effect, or an "[action]: Investigate" ability ([Additional Costs](https://arkhamdb.com/rules#Additional_Costs): "If an effect that requires an additional cost would resolve, the additional cost must be paid at that time"; its example is Duke investigating the Orne Library).
  Test: [`packages/scenarios/src/smoke_and_mirrors/cards.test.ts › Smoke and Mirrors card abilities › Arcane Lock › costs alice $cost actions to move $move while it is attached there`](../../../packages/scenarios/src/smoke_and_mirrors/cards.test.ts#L728)
  Test: [`packages/engine/src/action_costs.test.ts › actionCost of an action aimed at a location › alice in the hall, a lock attached to the cellar › costs $cost to move to the $to (free: $free)`](../../../packages/engine/src/action_costs.test.ts#L280)
  - If it can't be paid, that part of the effect fails to resolve (same entry).
- A move from one locked location to another pays both: 1 for the move, 1 for leaving and 1 for entering.
  Test: [`packages/engine/src/action_costs.test.ts › actionCost of an action aimed at a location › costs alice 3 to move from the locked cellar into the locked hall`](../../../packages/engine/src/action_costs.test.ts#L324)
- Like any constant ability of a location, Waterfront District's applies only once it is revealed ([Card abilities and modifiers](../card-abilities-and-modifiers.md)). An investigator investigates only where they are, and entering a location reveals it, so this never comes up.
  Test: [`packages/engine/src/action_costs.test.ts › actionCost of an action aimed at a location › costs the usual action to investigate the hall while it is unrevealed`](../../../packages/engine/src/action_costs.test.ts#L251)
- The app prices basic moves (with the destination) and basic investigations. A card ability's move or investigation doesn't add the location's cost to its button yet (Merchant District's free move into a locked location, an "[action]: Investigate" ability at Waterfront District); the players count it off at the table.

A location can cost clues to enter: Underground Cistern ("As an additional cost to enter Underground Cistern, investigators must spend 3 [per_investigator] clues, as a group") and Sluice Control (1 [per_investigator]).

- The group pays it like any cost "as a group": any investigators, wherever they are, splitting it as they choose (as for Uncovering the Conspiracy above).
  Test: [`packages/engine/src/enter_costs.test.ts › the cost to enter a location › is paid as the players split it`](../../../packages/engine/src/enter_costs.test.ts#L55)
  Test: [`packages/engine/src/enter_costs.test.ts › the cost to enter a location › is 2 clues per investigator for alice and bob: 4`](../../../packages/engine/src/enter_costs.test.ts#L35)
- It is paid whenever an investigator enters, by an action, a free move or a card effect ([Additional Costs](https://arkhamdb.com/rules#Additional_Costs)); with too few clues between them the move can't be made.
  Test: [`packages/engine/src/enter_costs.test.ts › the cost to enter a location › is paid by a card effect that moves alice there too`](../../../packages/engine/src/enter_costs.test.ts#L81)
  Test: [`packages/engine/src/enter_costs.test.ts › the cost to enter a location › refuses the move while the group holds only 3 of the 4 clues`](../../../packages/engine/src/enter_costs.test.ts#L69)
- The cost is printed on the unrevealed side, so it holds only while the location is unrevealed: entering reveals it, and after that entering costs nothing. If A Ritual reveals the Cistern first, entering it is free.
  Test: [`packages/engine/src/enter_costs.test.ts › the cost to enter a location › reveals the cistern as alice pays and enters, so bob then enters for free`](../../../packages/engine/src/enter_costs.test.ts#L94)
  Test: [`packages/engine/src/enter_costs.test.ts › the cost to enter a location › costs nothing to enter once something else revealed the cistern`](../../../packages/engine/src/enter_costs.test.ts#L105)
- For a card effect that moves the investigator there, only the move fails when the cost can't be paid; the app refuses the whole effect then (no Queen of Ash card does this).
- A move by a card effect picked on the map (Shortcut) pays with the engine's split, the mover first, without asking who pays; the map lights only locations the group can pay to enter (#1423).
  Test: [`packages/engine/src/enter_costs.test.ts › the cost to enter a location › is paid by alice first, then bob, as she moves in holding $aliceClues and bob $bobClues`](../../../packages/engine/src/enter_costs.test.ts#L44)
- The app also charges it for a move a mandatory instruction makes (Campaign Guide, act or agenda back); no such move enters either location.
