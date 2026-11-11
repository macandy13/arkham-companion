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
  `restrictions: [{ cannot: ['discover', 'spend'], what: 'clues', who: 'threatArea' }]`.
- Dissonant Voices, "You cannot play assets or events":
  `restrictions: [{ cannot: ['play'], what: 'cards', who: 'threatArea', cards: { types: ['asset', 'event'] } }]`.

## Modifiers

A buff or nerf of a number is a `CardStats.modifiers` entry, named by the value it changes.

- Obscuring Fog, "Attached location gets +2 shroud": `modifiers: [{ value: 'shroud', of: 'host', by: 2 }]`.
- "Each enemy at this location gets +1 fight": `modifiers: [{ value: 'fight', of: 'enemiesHere', by: 1 }]`.
- Frozen in Fear, "The first move, fight, or evade action you perform each round costs 1 additional action":
  `modifiers: [{ value: 'actionCost', of: 'threatArea', actions: ['move', 'fight', 'evade'], first: 'eachRound', by: 1 }]`.

## Objectives and special acts and agendas

An objective is an ability of its act or agenda, with a window that opens only while that card is current.

- "If the Ghoul Priest is defeated, advance": `whenEnemyDefeated(codes.ghoulPriest, advanceAct())`.
- "If an investigator enters the Ritual Site, advance": `whenAnInvestigatorEnters(codes.ritualSite, advanceAct())`.
- "If there are 6 unique Cultist enemies in the victory display, advance":
  `whenVictoryDisplayHolds({ trait: trait('Cultist'), unique: true }, 6, advanceAct())`.
- "If there are 6 Elite enemies beneath this act and/or in the victory display, advance" (Augurs of Flame):
  `whenVictoryDisplayHolds(eachInZone([{ kind: 'victoryDisplay' }, { kind: 'beneath', hostId: { ref: 'self' } }], { trait: trait('Elite') }), 6, advanceAct())`; its action that "draws" the facedown card beneath your location is `drawBeneathYourLocation()`.
- An act that advances on the clues on it (Disrupting the Ritual): `whenTokensOnSelf('clue', perInvestigator(2), advanceAct())`, and its action places them with `placeCluesOnSelf(1)`.
- A location topping up its clues at round end (Ritual Site): `atEndOfRound(placeCluesOnSelfUpTo(perInvestigator(2)))`.
- Doom per enemy (They're Getting Out!): `forEachEnemy({ trait: trait('Ghoul'), at: [onlyCopy(codes.hallway), onlyCopy(codes.parlor)] }, atEndOfRound(placeDoomOnSelf(1)))`.
- A forced move toward a location that takes engaged enemies along (Stop the Rite, "each [[Cultist]] enemy moves once toward Underground Cistern"): `atEndOfRound(moveEnemyTowards(eachEnemy({ trait: trait('Cultist') }), onlyCopy(codes.undergroundCistern), { forced: true }))`; without `forced`, an engaged enemy is refused, so a card that moves only unengaged ones filters `unengaged: true`.
- One card as act and agenda (Vengeance Awaits): `whenAdvanced(becomeActAndAgenda())`; the next agenda as both (Queen of Ash's A Ritual, "special agenda 3a replaces the current act and agenda"): `whenAdvanced(nextAgendaBecomesActAndAgenda())`.
- A test each investigator makes on a reverse side (A Gathering, "each investigator tests willpower (4)"): `forEachInvestigator(whenAdvanced(skillTest('willpower', 4, { onFail: [takeHorror(1)] })))`.
- Reverse sides that hit each investigator (Smoke and Mirrors): "each investigator draws 1 copy of the set-aside Mark of Elokoss" is `whenAdvanced(fromSetAside([codes.markOfElokoss], { kind: 'threatArea', investigatorId: { ref: 'eachInvestigator' } }))`, and "each investigator immediately resigns" is `whenAdvanced(eachInvestigatorResigns())`.
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
  - That trust needs the campaign log to say the taker earned Lita (`CampaignInvestigator.earnedCards`, written by The Gathering's resolutions with `earnCard`), so Umôrdhoth's action is hidden from an investigator who didn't.
  - A standalone game has no log and trusts the taker.

## Searching, drawing and attaching encounter cards

- Locked Door, "Attach to the location with the most clues and without a copy of Locked Door attached. If there is no such location, Locked Door gains surge":
  - `locationAttachment: { onePerLocation: true }`, which `locationWithMost` respects,
  - `whenRevealed(attachTo(locationWithMost('clue')))`,
  - `ifNoCandidate(locationWithMost('clue'), whenRevealed(gainSurge()))`.
- Mysterious Chanting's search: `ifThereAre(eachEnemy({ trait: trait('Cultist') }), { max: 0 }, whenRevealed(searchAndDraw({ trait: trait('Cultist'), typeCode: 'enemy' })))`, then `whenRevealed(shuffleEncounterDeck())` as its own ability.
- The Midnight Masks' Cultist deck: a `scenarioDeck` setup step, drawn by the act's action with `drawFromScenarioDeck('cultist')`.
- Rise of the Ghouls: `whenAdvanced(shuffleEncounterDiscard(), leadDrawsDiscardingUntil({ trait: trait('Ghoul'), typeCode: 'enemy' }))`.
- False Lead's surge when its drawer has no clues: `ifYouHave('clues', { max: 0 }, whenRevealed(gainSurge()))`.

## Resolution order

- An effect after a test that resolves either way (On Wings of Darkness's "Then, …") is the next effect of the same ability, after the `skillTest`: `disengageFromEachEnemy(…)`, `moveTo(locationWith({ trait: trait('Central') }))`, `engageReadyEnemies()`.
- A per-point cost or reward: an entry of the outcome that resolves once for each point failed (or succeeded) by, `skillTest('intellect', 4, { onFail: [forEachPoint(placeYourClues(1))] })` (False Lead); a choice repeats per point too (`forEachPoint(youMustEither(…))`, Umôrdhoth's Wrath).
- An outcome that changes with the margin: `skillTest(…, { onFail: [byMargin({ 0: [takeDamage(1)], 2: [takeDamage(2)] })] })` (Blood and Rust), the same in `onPass` for "if you succeed by N or more". The highest tier reached runs alone, so a card that adds to the base effects lists them in the higher tier too; effects next to the `byMargin` entry always run.
- An ability after the enemy is evaded (Ruth Turner): `afterEvaded(addToVictoryDisplay({ ref: 'self' }))`.
