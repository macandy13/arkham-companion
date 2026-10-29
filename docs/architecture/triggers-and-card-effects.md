# Triggers and card effects

Forced effects are **abilities**: data on a card's `CardStats`, so card data holds no code and the same card behaves the same in every scenario.
A scenario's own rules are abilities of its agendas and acts.

An [`Ability`](../../packages/engine/src/abilities.ts) is:

- a timing window (setup opens none):
  - `revealed`,
  - `entered`,
  - `turnBegins`,
  - `turnEnds`,
  - `eachTurnEnds` (any investigator's turn, for a card in play),
  - `phaseEnds`,
  - `roundEnds`,
  - `advanced`,
  - `enemyDefeated`, `investigatorEntered` and `addedToVictoryDisplay`, objectives opened for the current agenda and act (`whenEnemyDefeated`, `whenAnInvestigatorEnters`, `whenVictoryDisplayHolds`),
  - `tested` after a basic action's test,
  - `engaged` either way round,
  - `attacked` (attacks of opportunity included),
  - `evaded` for the enemy, naming the evader, once `EvadeEnemy` (a passed evasion or an effect) has exhausted and disengaged it, so later than `tested` (`afterEvaded`, Ruth Turner),
  - `cluesDiscovered`,
  - `defeated` for the enemy itself, naming where it was,
  - `tokensPlaced` for tokens placed on the card;
- an optional condition:
  - the current act,
  - the tokens on the card itself: `whenTokensOnSelf('clue', perInvestigator(2), advanceAct())` for an objective on the act's own clues, whose count the act's view shows as its threshold,
  - what the window's investigator has: `ifYouHave('clues', { max: 0 }, …)`,
  - how many enemies of a trait are in play: `ifEnemiesInPlay(trait('Cultist'), { max: 0 }, …)`,
  - how many cards of a trait, unique ones only if asked (`CardStats.unique`), the victory display holds: `whenVictoryDisplayHolds({ trait: trait('Cultist'), unique: true }, 6, advanceAct())`,
  - or that a reference with candidates stands for nothing: `ifNoCandidate(locationWithMost('clue'), whenRevealed(gainSurge()))` for Locked Door's "If there is no such location, Locked Door gains surge";
- an optional repeat once per matching enemy (`forEachEnemy({ trait, at }, …)`, counted with the condition as the window opens);
- and a list of effects.

Some effects in detail:

- "Replace the current act and agenda with this card" on an agenda's reverse side is `becomeActAndAgenda()` (`BecomeActAndAgenda`): the advancing agenda becomes the current act too and the act deck goes out of the game; `completeAdvance` then leaves the card in play, face down, so the scenario goes on until its objective or the investigators' elimination. A face-down agenda asks for no advance by doom (`agendaThresholdDecision`), and its view shows no threshold.
- "Take 1 horror and 1 damage" is one `TakeDamageAndHorror` (`takeDamageAndHorror({ damage, horror })`), placed at once through the same `woundEvents` as an enemy attack, so a defeat by one does not lose the other.
- An effect that leaves an enemy unengaged next to an investigator ends with `engageReadyEnemies()` (`EngageReadyEnemies`), which runs the engagement rule for every enemy at a location, as setup does.
- "This card gains surge" (`GainSurge`) marks the resolving card (`CardInstance.gainedSurge`), and placing it queues the surge draw a printed surge would have queued.

`windowsOpenedBy` maps an event to the windows it opens.

## Templated commands

Effects are **templated commands**: a command card data may use (`AbilityCommand`) with every ID replaced by a reference relative to the ability:

- `self`,
- `windowInvestigator`,
- `lead`,
- `onlyCopy(code)`,
- `eachInvestigator`,
- `eachEnemy({ trait, withoutTrait, unengaged, engagedWith })`,
- `nearestEnemy(trait)`,
- `locationWith(trait)`,
- `locationWithMost(token)`,
- `eachSetAside(trait)`,
- …

An `each…` reference repeats the command once per investigator or card.
When its turn comes, `resolveEffect` fills in the IDs from the current state, so handlers and the log only see plain commands.

- A reference with candidates (`nearestEnemy`, `locationWith`, `locationWithMost`) stands for the only one, or becomes a decision with one option per candidate and the effect filled in for it: equally near enemies are the lead investigator's `chooseCard`, a location to move to is the moving investigator's `chooseLocation`, and so are locations with equally many tokens to attach to (`chooseLocation`, the lead's).
  - `locationWithMost(token)` leaves out a location where the card's `LocationAttachment.onePerLocation` limit is reached, so Locked Door is `attachTo(locationWithMost('clue'))` ("the location with the most clues and without a copy of Locked Door attached").
- A test's outcomes stay templated until the answer: each runs as a `ResolveEffect` command, which `handle` turns into an `ability` step, so it resolves in its own turn like any effect (a choice's options, by contrast, resolve when it is raised, so they can be dry-run).
- A reference that names nobody drops the command; a missing `onlyCopy` card records `AbilityEffectSkipped` and the players do it by hand.

Commands on player cards (`DrawCards`, `SearchDeck`, `PlayCard`; factories `drawCards`, `searchDeck`; and `DiscardFromHand`, which only a `handCards` cost emits) are written as if the engine could carry them out.

- Their handler decides it can't, since the game holds no player cards, and records `CommandDeferred` (`PlayCard` is first rejected while a card forbids its investigator to play assets or events, below), which the play screen lists with the skipped effects for the players to do, unless the players took it as an action themselves (`asAction`).
- Such a command a card asked for carries its `source` (`CommandSource`: the card and the timing window), stamped by `resolveEffect` (`withSource`, a choice's options included) or by the action's hand card cost, so the notice names the card ("Your House asks Roland Banks to draw 1 card"); a command without one is the players' own.
- The basic draw and play actions are these commands taken `asAction`, and the resource action is `GainResources` (which card effects use too) taken `asAction`, so all three provoke attacks of opportunity like the actions the engine carries out.
- Supporting player cards later only changes those handlers.

Factories write effects the way the card reads:

```ts
whenRevealed(takeHorror(1))
atEndOfTurn(skillTest('willpower', 3, { onPass: [discardSelf()] }))
afterTest('investigate', 'pass', discardSelf())   // Obscuring Fog
whenAdvanced(revealLocation(onlyCopy(codes.parlor)), …)
```

- A card's test can cost the tester for each point it fails by (`skillTest(…, { perPointFailed })`: 1 damage, 1 horror, or 1 of their clues placed on their location by `PlaceClues`); the fail answer's `margin` is the count.
- "Test [willpower] (3) or [agility] (3)" is `skillTestOfEither(id, ['willpower', 'agility'], 3, outcomes)`: a choice for the tester with one `skillTest` per skill, the same outcomes either way.
- `PlaceTokens` puts clues from the token pool on a card in play (`placeCluesOnSelf(1)`, "place 1 clue on this act"), or tops it up to a count (`placeCluesOnSelfUpTo(perInvestigator(2))`, Ritual Site); doom keeps its own `PlaceDoom`.
- Windows for every card in play (`eachTurnEnds`, `phaseEnds`, `roundEnds`) skip unrevealed locations, whose abilities are on their revealed side (`hasActiveAbilities`, also read by modifiers and card actions).

## Card actions

Action abilities ("[action]: …") are data too: `CardStats.actions` lists [`CardAction`](../../packages/engine/src/card_actions.ts)s, each a list of effects and an optional designator (`resign`, `parley`).

`UseCardAction` takes one in the investigator's own turn where the card offers it (`offersActionsTo`):

- a location's at it,
- an enemy's at its location,
- a threat area's at its owner's location,
- a card's attached to a location at that location (Locked Door's "Test [combat] (4) or [agility] (4)"),
- the current agenda's and act's for anyone.

It continues with its effects as ability steps in an `action` window naming the investigator.
An action ability provokes attacks of opportunity unless it is a Resign or Parley, which is why `CommandSpec.provokes` and `continueWith` see the context and state.

### Limits, costs and conditions

- A `CardAction.limit` ("once per turn", "once per game", group limit) is checked against the uses `CardActionUsed` records on the card (`CardInstance.actionUses`, with who took it and in which round; `withinLimit`), so `cardActionsOfferedTo` leaves out an action used up.
- A `CardAction.cost` ("Spend 5 resources:", `ActionCost`) is paid by `UseCardAction` before the effects; an action that can't be paid for (`canPay`) is neither offered nor accepted (`cardActionCostUnpaid`).
  - A group cost (`groupClues`, "2 clues per investigator, as a group") is paid by any active investigators: `UseCardAction.spend` names who pays how many (`groupCluePayments`), and without it the taker pays what they can and the others the rest (`defaultCluePayments`).
  The view gives the screen what it needs to let the players split it: the cost on the offered action (`CardActionView.groupClues`) and who may pay with the clues they hold and the default split (`BoardView.cluePayers`).
  - A cost the game can't pay itself (`handCards`, "choose and discard 4 cards from your hand") is always payable to the engine and paid by a deferred `DiscardFromHand`.
- A free action (`CardAction.free`, a "[free]" ability) costs no action: `UseCardAction` takes it in any player window, outside the taker's turn too, and it never provokes (`UseCardAction` has no `asAction`: the printed ability decides); `GameActions.useCardAction` counts off an action only for the others.
- An action whose effects would change nothing can't be taken (RR "Triggered Abilities"): `UseCardAction`'s spec names its effects as `CommandSpec.mustChangeState`, which `handle` dry-runs after the handler's own checks and rejects (`changesNothing`) when they would emit no event, so the limit isn't used up; `BoardView.cardActions` leaves such an action out (`changesGameState`). An action with no effects the engine runs is done at the table and always offered.
- A `CardAction.condition` ("If you control Lita Chantler:", `ActionCondition`) must hold for the taker (`actionConditionHolds`), else the action is neither offered nor accepted (`cardActionConditionUnmet`).
  - `controls` checks their play area; a card of which the game has no copy at all is a player card it doesn't track, and is trusted to the taker if the campaign log says they earned it (`CampaignInvestigator.earnedCards`), and always in a standalone game (example in [Card patterns](card-patterns.md)).
- A rejected effect rejects the whole action, cost included.

### Advancing the act

The `investigatorTurn` condition ("during any investigator's turn") holds while anyone's turn is in progress.

- `advanceBySpendingClues(clues)` is the act's group clue spend as a free action with that condition, a `groupClues` cost and `AdvanceAct`, which the act builders give every act with a clue threshold (after its printed actions, so their indices stay).
- `AdvanceAct` itself pays nothing: it is that action's effect, an objective's or another card's.
- `BoardView.act.advance` says how clues advance the act (`ActAdvance`): `spendClues`, the clues the investigators hold against that cost (`cluesToAdvance`), or `cluesOnAct`, an objective counting the clues on it (`tokenObjective`).
- `PlayTable.spendCluesToAdvanceAct` takes the action for the investigator whose turn it is.

### Resign, Parley and story assets

- `resignAction()` is the Resign of the Parlor, the Main Path and The Midnight Masks' agendas; an investigator resigns only through such a card, so `PlayTable` and `GameActions` offer no plain resign.
- `parleyAction({ cost, limit, effects })` marks any card action a Parley; its consequences are ordinary effects, so a cultist's "Parley. Add it to the victory display" is `addToVictoryDisplay({ ref: 'self' })` and another card's Parley can test, discard or take a cost with the same blocks.
- A story asset an investigator takes control of (Lita Chantler's Parley at the Parlor, `takeControl()`) moves to their `playArea` zone:
  - it counts as in play,
  - `InvestigatorView.controls` lists it,
  - it offers no actions (its abilities are the controller's to use by hand, like a player card's),
  - and it is removed from the game when they leave the scenario (`investigatorLeavesEvents`).

### Offering actions

`BoardView.cardActions(investigator)` lists the actions the cards in play offer them (`cardActionsOfferedTo`), which the turn row and the card screens show as buttons.

- When a card prints more than one action of a kind (two plain ones, two Parleys) each gets a `number` over the printed actions, so its button has a name of its own ("Action 2 · Parlor") that stays put when another drops out.
- The act's spend-clues advance is left out of that list and of the numbering, since `act.advance` shows it.

## Constant abilities

Constant abilities are data too (`CardStats.modifiers`); [`effectiveValue`](../../packages/engine/src/card_values.ts) is the one place that answers "what is this value now". "Cannot" abilities are `CardStats.restrictions` ([`CardRestriction`](../../packages/engine/src/restrictions.ts): what is forbidden, `moveInto` or `investigate`, at which location, the card itself or its host), and [`isRestricted`](../../packages/engine/src/restrictions.ts) is the one place that answers "may anyone do this here": `MoveInvestigator` and `Investigate` reject a forbidden step (`restricted`), and `LocationView.forbidden` lists them so the screen offers neither. Like a modifier a restriction holds while its card is in play and a location's once it is revealed, except one printed on the unrevealed side (`unrevealed`, the Parlor's barrier), which holds until then.

A restriction can also bind an investigator (`InvestigatorCardRestriction`), which [`isRestrictedFor`](../../packages/engine/src/restrictions.ts) answers:

- It names verbs and the noun they act on (`RESTRICTED_VERBS`): The Masked Hunter is `cannot: ['discover', 'spend'], what: 'clues'`, Dissonant Voices `cannot: ['play'], what: 'cards'`. A new "cannot", such as healing horror or gaining resources, adds its verb and noun there and a check in its handler.
- It binds the investigator in whose threat area the card is, an engaged enemy included (`who: 'threatArea'`).
- `play` `cards` names the cards by type and trait (`PlayedCardFilter`). The engine never sees the card played, so it refuses a `PlayCard` only where the filter names every played card, as Dissonant Voices' assets or events do.
- `DiscoverClues` and `PlayCard` reject it (`restrictedFor`), and a passed investigation discovers nothing.
- Clue costs leave their clues out (`cluesHeldByGroup`, `defaultCluePayments`); `groupCluePayments` rejects them as payers, and `canPay` an own clue cost.
- `InvestigatorView.forbidden` lists them for the screen, verbs by noun (`forbiddenFor`: `{ clues: ['discover', 'spend'] }`).

## Extension points

- **A card's ability, action or modifier:** list it in the card's data; no code. [Card patterns](card-patterns.md) shows how card text maps to it.
- **A new window or condition:** a case in `TimingWindow` / `windowsOpenedBy` or `AbilityCondition` / `actionConditionHolds`.
- **A new kind of effect:** add its command to `AbilityCommand` (and a factory); a new reference is a case in `resolveRefs`.
