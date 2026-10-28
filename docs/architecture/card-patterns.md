# Card patterns

How card text becomes card data: one example per pattern, from the Night of the Zealot cards in [`packages/scenarios`](../../packages/scenarios/src/).
The mechanisms are described in [Triggers and card effects](triggers-and-card-effects.md); the rulings behind each card are in the rules' [card rulings](../rules.md#card-rulings).
Entering a new campaign starts here: find the pattern that reads like the card, copy its shape, and add a new pattern only when no existing one fits.

Groups follow the rules' card rulings, so a card's ruling and its data are found under the same name.

## Restrictions ("cannot")

A "cannot" is a `CardStats.restrictions` entry, never an ability.

- Parlor, unrevealed side, "You cannot move into the Parlor":
  `restrictions: [{ cannot: 'moveInto', of: 'self', unrevealed: true }]`.
- Locked Door, "The attached location cannot be investigated":
  `restrictions: [{ cannot: 'investigate', of: 'host' }]`.
- The Masked Hunter, "While you are engaged with The Masked Hunter, you cannot discover or spend clues":
  `{ cannot: ['discover', 'spend'], what: 'clues', who: 'threatArea' }`.
- Dissonant Voices, "You cannot play assets or events":
  `{ cannot: ['play'], what: 'cards', who: 'threatArea', cards: { types: ['asset', 'event'] } }`.

## Objectives and special acts and agendas

An objective is an ability of its act or agenda, with a window that opens only while that card is current.

- "If the Ghoul Priest is defeated, advance": `whenEnemyDefeated(codes.ghoulPriest, advanceAct())`.
- "If an investigator enters the Ritual Site, advance": `whenAnInvestigatorEnters(codes.ritualSite, advanceAct())`.
- "If there are 6 unique Cultist enemies in the victory display, advance":
  `whenVictoryDisplayHolds({ trait: trait('Cultist'), unique: true }, 6, advanceAct())`.
- An act that advances on the clues on it (Disrupting the Ritual): `whenTokensOnSelf('clue', perInvestigator(2), advanceAct())`, and its action places them with `placeCluesOnSelf(1)`.
- A location topping up its clues at round end (Ritual Site): `atEndOfRound(placeCluesOnSelfUpTo(perInvestigator(2)))`.
- Doom per enemy (They're Getting Out!): `forEachEnemy({ trait: trait('Ghoul'), at: [codes.hallway, codes.parlor] }, atEndOfRound(placeDoomOnSelf(1)))`.
- One card as act and agenda (Vengeance Awaits): `whenAdvanced(becomeActAndAgenda())`.
- A reverse side that depends on the current act: `duringAct([codes.trapped, codes.theBarrier], whenAdvanced(…))`.

## Costs of card actions

A cost is `CardAction.cost`, paid before the effects.

- "The investigators spend 2 clues per investigator, as a group" (Uncovering the Conspiracy):
  `cost: { spend: 'groupClues', amount: perInvestigator(2) }`.
- "Choose and discard 4 cards from your hand" (Herman Collins' Parley):
  `parleyAction({ cost: { spend: 'handCards', amount: 4 }, effects: [addToVictoryDisplay({ ref: 'self' })] })`.

## Story assets and earned cards

- Lita Chantler's Parley: `parleyAction({ effects: [skillTest('intellect', 4, { onPass: [takeControl()] })] })`.
- "If you control Lita Chantler:" (Umôrdhoth): `condition: { kind: 'controls', card: codes.litaChantler }`.
  - `controls` checks the taker's play area. When the game has no copy of the card at all, it is a player card the game doesn't track, so the taker is trusted, as with a hand card cost.
  - The campaign log must say the taker earned it (`CampaignInvestigator.earnedCards`, written by The Gathering's resolutions with `earnCard`), so Umôrdhoth's action is hidden from an investigator who didn't.
  - A standalone game has no log and trusts the taker.

## Searching, drawing and attaching encounter cards

- Locked Door, "Attach to the location with the most clues and without a copy of Locked Door attached. If there is no such location, Locked Door gains surge":
  - `locationAttachment: { onePerLocation: true }`, which `locationWithMost` respects,
  - `whenRevealed(attachTo(locationWithMost('clue')))`,
  - `ifNoCandidate(locationWithMost('clue'), whenRevealed(gainSurge()))`.
- Mysterious Chanting's search: `ifEnemiesInPlay(trait('Cultist'), { max: 0 }, whenRevealed(searchAndDraw({ trait: trait('Cultist'), typeCode: 'enemy' })))`, then `whenRevealed(shuffleEncounterDeck())` as its own ability.
- The Midnight Masks' Cultist deck: a `scenarioDeck` setup step, drawn by the act's action with `drawFromScenarioDeck('cultist')`.
- Rise of the Ghouls: `whenAdvanced(shuffleEncounterDiscard(), leadDrawsDiscardingUntil({ trait: trait('Ghoul'), typeCode: 'enemy' }))`.
- False Lead's surge when its drawer has no clues: `ifYouHave('clues', { max: 0 }, whenRevealed(gainSurge()))`.

## Resolution order

- An effect after a test that resolves either way (On Wings of Darkness's "Then, …") is the next effect of the same ability, after the `skillTest`: `disengageFromEachEnemy(…)`, `moveTo(locationWith(trait('Central')))`, `engageReadyEnemies()`.
- A per-point fail cost: `skillTest('intellect', 4, { perPointFailed: 'clues' })` (False Lead).
- An ability after the enemy is evaded (Ruth Turner): `afterEvaded(addToVictoryDisplay({ ref: 'self' }))`.
