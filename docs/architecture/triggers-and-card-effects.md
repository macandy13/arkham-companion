# Triggers and card effects

Forced effects are **abilities**: data on a card's `CardStats`, so card data holds no code and the same card behaves the same in every scenario.
A scenario's own rules are abilities of its agendas and acts.

The code lives in [`abilities/`](../../packages/engine/src/abilities/), one file per part:

- `types.ts`: `Ability`, `TimingWindow`, `AbilityEffect` and the references (`RelativeCard`, `RelativeInvestigator`);
- `dsl.ts`: the factories card data is written with (`whenRevealed`, `takeHorror`, `self()`), most of what scenarios use besides the types;
- `windows.ts`: which cards an event opens a window for (`windowsOpenedBy`);
- `resolve.ts`: turning an ability into steps and resolving its effects (`abilitySteps`, `resolveEffect`, `conditionHolds`);
- `objectives.ts`: the objective thresholds the board shows.

The engine's modules import from `abilities/index.ts`; the package index lists what scenarios see.

An `Ability` is:

- a timing window (`TimingWindow`; setup opens none): the event it waits for (`on`), whose cards hear it (`of`, a `ListenerScope`) and, optionally, which card the event must be about (`filter`, a `CardFilter`). A new window on a known event is a scope or a filter, not a new kind.
  - The scopes (`windowsOpenedBy` opens each event for its scopes in a fixed order, `openFor`):
    - `self`, the card the event is about (for a test, also the cards attached to it);
    - `yours`, the named investigator's threat area, then their location;
    - `inPlay`, every card in play with active abilities;
    - `currentActOrAgenda`, the current agenda, then act, for objectives;
    - `here`, every card at the location the window names (`cardsWhoseLocationIs`), for "at [this card]'s location".
  - A window without `of` takes the event's usual listeners (`defaultScope`): `yours` for `turnBegins` and `turnEnds`, `inPlay` for `phaseEnds` and `roundEnds`, `currentActOrAgenda` for `addedToVictoryDisplay`, `here` for `succeeded`, otherwise `self`.
  - One matcher (`hears`) fires an ability when the event matches (with its phase, action, outcome or token), the scope matches, and the filter matches the event's card (`OpenedWindow.subjectId`).
  - The objectives are scoped windows: `whenEnemyDefeated(code)` is `{ on: 'defeated', of: 'currentActOrAgenda', filter: { code } }`, `whenAnInvestigatorEnters(code)` the same on `entered`, and `atEndOfEachTurn` is `{ on: 'turnEnds', of: 'inPlay' }` (Umôrdhoth).
  - The events:
    - `revealed`,
    - `entered`,
    - `turnBegins`,
    - `turnEnds`,
    - `phaseEnds`,
    - `roundEnds`,
    - `advanced`,
    - `addedToVictoryDisplay` (`whenVictoryDisplayHolds`), which also opens for a card placed beneath the current act, which counts when the reference names that zone too (Augurs of Flame),
    - `tested` after a basic action's test, at ST.6 before its results,
    - `succeeded` after any passed test, at ST.6, heard `here` at the location of what the test was about (the tester's own location for a card at no location, such as a revelation), once more with the basic action it belongs to (`afterSucceedingHere({ action: 'investigate' }, …)`, David Renfield's "after you successfully investigate [his] location"), naming the tester and the margin when the answer gave one,
    - `testEnded` once that test has ended (`EndSkillTest`, queued after its results, ST.8), for "after applying all results" keywords,
    - `engaged` either way round,
    - `attacked` (attacks of opportunity included),
    - `evaded` for the enemy, naming the evader, once `EvadeEnemy` (a passed evasion or an effect) has exhausted and disengaged it, so later than `tested` (`afterEvaded`, Ruth Turner), and once more with `successful` after a passed evasion test only, not an automatic evade (`afterEvadingSuccessfully`, Cornelia Akely),
    - `cluesDiscovered`,
    - `defeated` for the enemy itself, naming where it was,
    - `tokensPlaced` for tokens placed on the card (`afterTokensPlaced`, Wild Flames' "after doom is placed on the agenda"; `whenTokensOnSelf` for an objective on a count);
- an optional condition (`AbilityCondition`), mostly over the references effects use:
  - `currentCard`, the current act or agenda: `duringAct([codes.trapped], …)`, `duringAgenda([codes.theyreGettingOut], …)`;
  - `countOf`, how many things a reference names as the window opens:
    - the enemies or investigators of an `each…` reference: `ifThereAre(eachEnemy({ at: yourLocation() }), { min: 1 }, …)` for "if there is an enemy at your location", `ifThereAre(eachEnemy({ engagedWith: you() }), { max: 0 }, …)` for "if no enemy is engaged with you", `ifThereAre(eachEnemy({ trait: trait('Cultist') }), { max: 0 }, …)` for "if there are no [[Cultist]] enemies in play";
    - the cards in one or more zones (`eachInZone`), filtered by what is printed on them (`CardFilter`: code, name, trait, without a trait, type, unique; the one description of a card's print, which `eachEnemy` and `eachInPlay`, and so the picked references built on them, extend with what the table shows and a matched encounter draw takes as its `match`): `whenVictoryDisplayHolds(eachInZone({ kind: 'victoryDisplay' }, { trait: trait('Cultist'), unique: true }), 6, advanceAct())`, and with `[{ kind: 'victoryDisplay' }, { kind: 'beneath', hostId: { ref: 'self' } }]` for "in the victory display and beneath this act" (facedown cards beneath a card show no traits, so they never count);
    - the cards in play (`eachInPlay`), by `CardFilter` and optionally where they are (`at`, `locationOfCard`): `ifThereAre(eachInPlay({ code: codes.maskedHunter }), { min: 1 }, …)` for "if the Masked Hunter is in play", `ifThereAre(eachInPlay({ code: codes.litaChantler, at: yourLocation() }), { min: 1 }, …)` for "if Lita Chantler is at your location";
    - the candidates of a picked reference: `ifNoCandidate(locationWithMost('clue'), whenRevealed(gainSurge()))` for Locked Door's "If there is no such location, Locked Door gains surge";
  - `valueOf`, a value on the table (`Quantity`), within a range whose bounds may be per investigator:
    - a stat of each investigator a reference names (`statOf(who, stat)`): `ifYouHave('clues', { max: 0 }, …)`, short for `ifValue(statOf(you(), 'clues'), …)`, and `ifValue(statOf(lead(), 'clues'), { max: 0 }, …)` for the lead; over `eachInvestigator()` it holds only when each of them is in range;
    - the tokens on a card (`tokensOn(card, token)`): `ifValue(tokensOn(self(), 'clue'), { max: 0 }, …)` for "if there are no clues on it", `whenTokensOnSelf('clue', perInvestigator(2), advanceAct())` for an objective on the act's own clues, whose count the act's view shows as its threshold;
    - the clues a group holds (`groupClues`, see The Barrier below);
  - `atLeast`, one value on the table at least another, each summed over what it names: `atLeast(statOf(you(), 'damage'), statOf(you(), 'horror'))`;
  - `phase`, the phase the game is in: `duringPhase('enemy', afterAttacking(discardAsset()))` for Hellhound's "after it attacks you during the enemy phase";
  - `margin`, how much the test the window follows succeeded by: `afterSucceedingHere({ by: 2 }, …)` for Margaret Liu's "after you succeed at a skill test by 2 or more at [her] location". It counts only with a confirmed margin, so a test whose location holds such an ability asks for its pass margin (`passMarginMatters`, `DecisionView.asksMargin`);
  - `turn`, `allOf`, `anyOf` and `not`, whose turn it is and combinations of conditions, which card actions use most (see the card action section below);
- an optional repeat (`Ability.forEach`, any `each…` reference, `repetitionsOf`): the effects resolve once for each investigator or card it names as the window opens, counted with the condition, and each copy of the window binds what it is for:
  - an investigator becomes the window's, so an effect that asks something (a skill test) asks each of them in turn (`forEachInvestigator(…)`, over `eachInvestigator()`);
  - a card becomes `thatCard()` (`OpenedWindow.thatCardId`): `forEachEnemy({ trait, at: [onlyCopy(codes.hallway), onlyCopy(codes.parlor)] }, …)`, and `forEachEnemy({}, atEndOfRound(placeDoomOn(thatCard(), 1)))` for "for each enemy, place 1 doom on it";
- an optional reaction mark (`reaction(ability, limit)`, `Ability.reaction`): a "[reaction]" the players trigger. As its window opens and its condition holds, the investigator the window names is asked to use it or pass (`reactionOffer`, a `chooseOption` with id `reaction:<card>:<ability index>`, prompt `decision.reaction`); using it records the use (`UseReaction`, `ReactionUsed`, `CardInstance.reactionUses`) and resolves its effects. Its `UsageLimit` ("(Limit once per round.)", `reactionWithinLimit`) is checked as the window opens, so a used-up reaction asks nothing, and a location's reaction is offered only to an investigator there. Warren Observatory: `reaction(afterDiscoveringClues(drawCards(1)), { per: 'round' })`. The questions wait behind the forced effects a command triggers (`triggeredSteps`, `isReactionOffer`), as forced abilities on a timing point resolve before reactions to it;
- and a list of effects.

Some effects in detail:

- Card data moves a card with `move(card, zone, end?)`, naming the zone with the zone helpers of `zone.ts`, which take references in card data (`move(onlyCopy(codes.study), outOfGame)`, `move(self(), threatAreaOf(you()))`); only moves a rule gives a name of their own keep a factory (`discard`, `putIntoThreatArea`, `attachTo`, `takeControl`, `fromSetAside`). A card a `MoveCard` takes out of play (discarded, set aside, removed from the game, into a deck or the victory display) leaves its tokens and attachments behind and is readied (`handleMoveCard`, RR "Leaves Play"); a discarded player card goes back to its owner, and a card that granted enemies a keyword lets ready enemies engage as it goes (Hiding Spot): Escape the Dorms sets the Servant of Flame aside healed and removes Your Friend's Room with its Fire!. Cards come back from the set-aside area with `fromSetAside(codes, zone)` ("attach 1 set-aside copy of Fire! to Your Friend's Room"): one `MoveCard` per code, whose card is the reference `setAsideCopy(code)`, and `move(eachInZone(setAside, { code }), zone)` moves however many copies are left ("each other set-aside copy of Fire!"). A code with no copy left moves nothing, since another effect may have taken it first (Lit Up's "place 4 set-aside Fire! in the discard" after Where There's Smoke...). In an effect repeated for each investigator, each repetition takes the next copy (Mark of Elokoss).
- "Replace the current act and agenda with this card" on an agenda's reverse side is `becomeActAndAgenda()` (`BecomeActAndAgenda`): the advancing agenda becomes the current act too and the act deck goes out of the game (with `next`, `nextAgendaBecomesActAndAgenda()`, the agenda after it takes both places, and the advance moves on to it as usual); `completeAdvance` then leaves the card in play, face down, so the scenario goes on until its objective or the investigators' elimination. A face-down agenda asks for no advance by doom (`agendaThresholdDecision`), and its view shows no threshold.
- An investigator's wounds are one command, `TakeDamageAndHorror`: `takeDamage(n)` and `takeHorror(n)` build it with the other amount at 0, and "take 1 horror and 1 damage" is `takeDamageAndHorror({ damage, horror })`, placed at once through the same `woundEvents` as an enemy attack, so a defeat by one does not lose the other. `heal` (`HealInvestigator`) takes them off again. Like the token factories, each takes an investigator's ID too and then builds a plain command (`takeDamage(2, alice)`), which a failed fight against an enemy engaged with someone else also deals. `AdjustInvestigator` stays for the players' corrections and the spending a "you must either" option does (`spendClues`).
- An effect that leaves an enemy unengaged next to an investigator ends with `engageReadyEnemies()` (`EngageReadyEnemies`), which runs the engagement rule for every enemy at a location, as setup does.
- Effects on an enemy take a reference to it: `dealDamageTo(enemy, amount)` (`DamageEnemy`, which defeats the enemy once the damage reaches its health), `exhaustEnemy` and `defeatEnemy` ("it is automatically defeated"), next to `healSelf` and `readySelf`. Exhausting an exhausted enemy, like readying a ready one, does nothing, so an `each…` reference resolves whatever state its enemies are in.
- Tokens changing holder are one command, `MoveTokens { token, amount, from, to }`, between `TokenHolder`s: `'pool'`, `'currentAgenda'`, `{ card }`, `{ investigator }` (their clues and resources) or `{ locationOf }` (the location an investigator is at). Placing is a move from the pool, removing a move back to it. It moves as many as `from` holds (`amount` a number, a per-investigator value, `'all'`, or `{ upTo }` to top `to` up), and nothing from or to a card out of play, nor damage onto a card without health or horror onto one without sanity. A card counting its own tokens (`whenTokensOnSelf`) sees moved ones like placed ones, and an enemy that ends up with as much damage as its health is defeated (`defeatedByDamage`, shared with `DamageEnemy`). The factories keep the card's words: `placeDoomOnAgenda`, `placeDoomOn`, `placeDoomOnSelf`, `removeDoomFromAgenda`, `removeDoomFrom(eachEnemy({ trait: trait('Cultist') }), 1)` (passes over a cultist without doom), `placeCluesOn`, `placeCluesOnSelf`, `placeCluesOnSelfUpTo(perInvestigator(2))` (Ritual Site), `moveTokens(token, amount, from, to?)` (to the current agenda by default) and `takeCluesFrom(card, amount, investigator?)` ("take control of 1 of the clues on Constance Dumaine"), `gainClues`, `gainResources` (the basic resource action stays `GainResources`, which provokes) and `placeYourClues` ("place 1 of your clues on your location", False Lead). Paying and discovering keep their own commands (`SpendResources`, `SpendCluesAsGroup`, `DiscoverClues`), as a cost is paid in full and discovering has its own restrictions and windows. Each factory takes instances too and then builds a plain command (overloads: `placeDoomOn(hall, 1)` is a `MoveTokens`, `placeDoomOn({ ref: 'self' }, 1)` an `AbilityEffect`), so the UI and tests write moves the way card data does. The enemy, location and card factories do the same (`dealDamageTo`, `healEnemy`, `readyEnemy`, `disengageEnemy`, `exhaustEnemy`, `defeatEnemy`, `revealLocation`, `spawnEnemyAt`, `move`; one literal for both shapes, typed by the overloads), so the play screen builds every command it performs with them. The players' own corrections stay a `ManualAdjust`.
- `enemyAttacks(enemy, who)` ("it attacks you", `EnemyAttacks`) asks the attacked investigator the same confirm decision as a retaliate or alert attack (`attackDecision`, kind `cardAttack`, id `cardAttack:<enemy>:<investigator>`; with a keyword `kind` it is that keyword's attack): printed damage and horror, lowered for soak, or skipped for a cancel. `engagesYou(enemy, who)` is `EngageEnemy` asked by a card: it takes the enemy from any location and does nothing for a massive enemy or one already engaged with the investigator, while the engage action keeps refusing those.
- `advanceAgenda()` advances the current agenda as its doom threshold would, and `removeConnection(from, to)` removes a declared connection or cuts a printed one, and does nothing when it is already gone (`source`, below).
- "Shuffle it into the encounter deck" is `shuffleSelfIntoEncounterDeck()` (`MoveCard`, then `ShuffleEncounterDeck`): a drawn card moved there while it resolves is not placed afterwards. `shuffleSetAsideIntoEncounterDeck(codes)` is `fromSetAside(codes, encounterDeck)` and then `ShuffleEncounterDeck`: the copies there are go in, and the deck is shuffled once, even when no copy was left.
- "This card gains surge" (`GainSurge`) marks the resolving card (`CardInstance.gainedSurge`), and placing it queues the surge draw a printed surge would have queued.
- A drawn treachery with a `revealed` ability asks before its revelation (`revelationDecision`, id `revelation:<card>`, `isRevelationDecision`): the draw marks itself (`EncounterCardDrawn.asksRevelation`), so `CardFlipped` opens no `revealed` window, and the players answer with `ResolveRevelation`. `RevelationResolved` opens the window, or none when `cancelled` (Ward of Protection), and the queued placement and surge go on either way. The players see the card before they choose, so a cancel needs no replay; a treachery without a `revealed` ability, which the players resolve by hand, asks nothing.

`windowsOpenedBy` maps an event to the windows it opens. `abilitySteps` adds the abilities a keyword gives (`keywordAbilities`), so the keywords resolve like printed forced abilities: retaliate and alert are an `enemyAttacks(self(), you(), keyword)` on `testEnded` after a failed fight or evade (asked `<keyword>:<enemy>`, only by a ready enemy); elusive is `retreatEnemy(self())` on `attacked` and on `testEnded` after a fight, hit or miss. Retaliate comes first, so an elusive enemy retreats after its retaliate attack, and its own retreat on `testEnded` then finds it exhausted, unless the attack was cancelled.

## Templated commands

Effects are **templated commands**: a command card data may use (`AbilityCommand`) with every ID replaced by a reference relative to the ability:

- `self` (`self()`),
- `windowInvestigator` (`you()`), `windowLocation` (`yourLocation()`, `itsLocation()`),
- `lead` (`lead()`),
- `onlyCopy(code)`,
- `setAsideCopy(code)`, a set-aside copy; in an effect repeated for each investigator, each repetition takes the next copy, and none is left out when the copies run out,
- `eachInvestigator({ at, atLocationWith, name, bearerOf })`, only those at `at`, at a location the `CardFilter` matches, with a name, or the bearer of a weakness,
- `eachEnemy({ trait, withoutTrait, unengaged, ready, withoutToken, at, engagedWith })`, where `at` is one location reference or a list of them, so "each enemy at your location" is a filter of `eachEnemy`, not a reference of its own, and `ready: true` keeps only ready enemies ("each ready non-Elite [[Cultist]] enemy at this location", Underground Cistern),
- `eachInZone(zone, { trait, code, typeCode, unique })`, the cards in a zone or a list of zones: the victory display, the set-aside cards (`eachInZone({ kind: 'setAside' }, { trait, typeCode: 'enemy' })` for "each set-aside [[Cultist]] enemy"), the cards beneath a card; with `first`, only that many in zone order (`first: perInvestigator(1)` for "1 [per_investigator] copies", `searchAndDrawCopies`),
- `eachInPlay({ trait, code, name, typeCode, unique, at, connectedTo, empty })`, the cards in play, only those at one of the `at` locations when given, with `connectedTo` only those at a location connecting to the one it names, and with `empty` only those at a location with no investigators and no enemies; `name` may list several ("A or B"),
- `nearestEnemy({ trait, withoutTrait, unengaged, withoutToken })`, `withoutToken: 'doom'` for "the nearest enemy with no doom on it",
- `locationWith({ trait, connected })`, a location other than yours, with `connected` only those connecting to yours (`moveToConnectingLocation()`),
- `anEnemy(filter)`, an enemy the filter matches (an `EnemyFilter`, at `at` when given) the window investigator picks: Blaze of Glory's `dealDamageTo(anEnemy({ at: yourLocation() }), perInvestigator(1))` (`DamageEnemy.amount` may be scaled per investigator), Blasphemous Invocation's `placeDoomOn(anEnemy({ trait: trait('Cultist'), withoutToken: 'doom' }), 1)`,
- `locationWithMost(token)`,
- `nearestLocation()`, the nearest location the card may attach to,
- `thisLocation()`, the location the card is at or attached to (`selfLocation`, `locationOfCard`),
- `anInvestigator({ at })`, one investigator (at a location) the window investigator picks: Arkham Sanatorium's `heal('horror', 1, anInvestigator({ at: thisLocation() }))`,
- …

An `each…` reference repeats the command once per investigator or card.
When its turn comes, `resolveEffect` fills in the IDs from the current state, so handlers and the log only see plain commands.

- A reference with candidates is one `Selector` (`{ ref: 'pick' }`): the investigators or cards of an `each…` reference (`among`), without the one `except` names, with `best` only those that measure the most or the fewest (`PickMeasure`: tokens on the card, connections from the window investigator's location, one with no path an infinite number away, an investigator's stat, or an investigator's distance to the nearest other enemy), and a `chooser`. `nearestEnemy`, `anEnemy`, `locationWith`, `locationWithMost`, `nearestLocation` and `anInvestigator` are factories that build one: `nearestEnemy(filter)` is `eachEnemy(filter)` with the fewest connections, the lead's pick (Rules Reference, "Choices"); `anEnemy` and `anInvestigator` are the window investigator's pick of `eachEnemy` and `eachInvestigator`. `candidatesFor` lists the candidates (`candidatesOf` for spawn and prey, outside an ability); the reference stands for the only one, or `pickDecision` raises one decision (id `pick:<card>`) with an option per candidate and the effect filled in for it. It asks by what `among` names: `chooseInvestigator` for an investigator, which like a choice keeps only the investigators the effect changes something for (`withResolvableOptions`), `chooseCard` for an enemy or another card, and `chooseLocation` for a location, whose prompt says whether the investigator moves there or the card attaches there.
  - `locationWithMost(token)` and `nearestLocation()` are `attachable`: they leave out a location where the card's `CardStats.limit` is reached (`limitReached`), so Locked Door is `attachTo(locationWithMost('clue'))` ("the location with the most clues and without a copy of Locked Door attached"). The same check makes a `MoveCard` into a threat area or onto a host that already holds a copy of the title do nothing, so "Limit 1 per investigator" (`limit: 'onePerInvestigator'`) leaves a second copy to be discarded.
- A choice option can be offered only while a condition holds (`ChoiceOption.when`, any `AbilityCondition`), read as the choice is raised, so after the test it follows: Ashen Rebirth's "take 2 direct damage or 2 direct horror (whichever you have more of)" is two options, `when: atLeast(statOf(you(), 'damage'), statOf(you(), 'horror'))` and the reverse, so a tie offers both. `withOfferedOptions` drops the others before the references become IDs; when one option is left (and asks no count), its effects apply without asking, and with none left the choice does nothing.
- A test's outcomes stay templated until the answer: each runs as a `ResolveEffect` command, which `handle` turns into an `ability` step, so it resolves in its own turn like any effect (a choice's options, by contrast, resolve when it is raised, so they can be dry-run; only an option effect with an `each…` reference or a reference with candidates is deferred the same way, so it repeats itself, or asks for its candidate, after the answer rather than before the choice: What's Going On?!'s "each investigator discards 1 card at random", Arkham Sanatorium's investigator to heal).
- A reference that names nobody drops the command; a missing `onlyCopy` card records `AbilityEffectSkipped` and the players do it by hand.

Commands on player cards (`DrawCards`, `SearchDeck`, `PlayCard`, `DiscardFromHand`, `DiscardAsset`, `HealAsset`; factories `drawCards`, `searchDeck` (with `play` for "search … and play it", Easttown), `discardAtRandom`, `discardFromHand`, `discardAsset`, `healAsset`; a `handCards` cost emits `DiscardFromHand` too) are written as if the engine could carry them out. So is reading a codex entry in the campaign guide (`ReadCodexEntry`, `codex(6)` for "([codex] 6)"), whose text the app doesn't have.

- Their handler decides it can't, since the game holds no player cards, and records `CommandDeferred` (`PlayCard` is first rejected while a card forbids its investigator to play assets or events, below, and spends the `cost` the players name from the investigator's resources in the same step, rejected above what they hold), which the play screen lists with the skipped effects for the players to do, unless the players took it as an action themselves (`asAction`) or no card asked for it (no `source`: the upkeep draw of step 4.4, which the changes notice tells).
- Such a command a card asked for carries its `source` (`CommandSource`: the card and the timing window), stamped by `resolveEffect` (`withSource`, a choice's options included) or by the action's hand card cost, so the notice names the card ("Your House asks Roland Banks to draw 1 card"); a command without one is the players' own.
- The basic draw and play actions are these commands taken `asAction`, and the resource action is `GainResources` (which card effects use too) taken `asAction`, so all three provoke attacks of opportunity like the actions the engine carries out.
- Supporting player cards later only changes those handlers.

Commands also sent without a card (by the players or a rule step) that refuse when they have nothing to do (`AdjustActions`, `EndTurn`, `DiscoverClues`, `RemoveConnection`) carry the same `source` when a card asks for them, and then do as much as they can (Rules Reference, "Effects"), so one effect never fails the whole ability. The players' buttons send them without one and keep refusing, since the board offers a button by dry-running its command.

- `loseActions(1)` takes no more actions than remain, `loseActions('all')` all of them, outside the turn too, where they come off the round's actions (`delta: 'allRemaining'`, which the players may send too).
- `endYourTurn()` does nothing outside the turn of the investigator the window names.
- `discoverClues(amount, location)` takes as many clues as the location has, at any location (by default the window's location, else the investigator's own), and none for an investigator a card forbids to discover clues.

Factories write effects the way the card reads:

```ts
whenRevealed(takeHorror(1))
atEndOfTurn(skillTest('willpower', 3, { onPass: [discardSelf()] }))
afterTest('investigate', 'pass', discardSelf())   // Obscuring Fog
whenAdvanced(revealLocation(onlyCopy(codes.parlor)), …)
```

- What a card's test does can depend on how much it passed or failed by: an entry of `onPass` or `onFail` is then a `ForEachPoint` (`forEachPoint(…)`) or a `ByMargin` (`byMargin({ 0: […], 2: […] })`), next to the outcome's plain effects and in their order. `answerCommands` expands them with the answer's `margin` (`withMargin`): a `ForEachPoint`'s amount (`takeDamage(1)`, `placeYourClues(1)`, doom) is multiplied by the margin into one effect, as the Rules Reference's "For each" asks, and anything else (a `youMustEither`, or an effect that picks its target, marked `ResolveEffect.picks`: "place 1 doom on a [[Cultist]] enemy with no doom on it") resolves once for each point, each picking anew; a `ByMargin` runs the highest tier the margin reaches. Their effects are deferred like the outcome's others (`withDeferredOutcomes`). An answer without a margin counts as the least its outcome means, a fail by 1 or a pass by 0. On their own, outside a test's outcome, both are rejected (`marginOutsideTest`).
- A test whose difficulty depends on the table lists `difficultyChanges` on its `TestSkill`: `plusDifficultyPer(statOf(you(), 'damage'))` adds 1 for each damage on the tester (Eager for Death), `plusDifficultyIf(condition, 2)` adds 2 while an `AbilityCondition` holds (Red Herring's 2 or more clues, Mutated!'s enemy at your location). `resolveEffect` reads them first (`withDifficultyChanges`), folds them into `test.difficulty` (never below 0) and drops them, so the command and its decision carry a plain number, and a reference inside a change (`eachEnemy`) is never taken for one the effect repeats over. A test among a test's outcomes reads the table when that outcome resolves.
- "Test [willpower] (3) or [agility] (3)" is `skillTestOfEither(id, ['willpower', 'agility'], 3, outcomes)`: a choice for the tester with one `skillTest` per skill, the same outcomes either way. A difficulty the app can't read is an `AskedCount` in place of the number: `cardsInYourHand` ("X, where X is the number of cards in your hand", Extraplanar Visions) gives each skill's option a `cardsInHand` count, and the test's difficulty is `{ answer: 'cardsInHand' }`, which the answer fills in (`AnsweredAmount`, also inside `TestSkill.test`) before the test is asked.
- Windows heard by every card in play (scope `inPlay`: `atEndOfEachTurn`, `phaseEnds`, `roundEnds`) skip unrevealed locations, whose abilities are on their revealed side (`hasActiveAbilities`, also read by modifiers and card actions).

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

- A `CardAction.limit` (a [`UsageLimit`](../../packages/engine/src/usage_limits.ts): once or `times` per turn, round, phase or game, group or not) is checked against the uses `CardActionUsed` records on the card (`CardInstance.actionUses`, with who took it and in which round, phase and turn; `withinLimit`), so `cardActionsOfferedTo` leaves out an action used up. A reaction counts its limit the same way (`CardInstance.reactionUses`, `reactionWithinLimit`): checked as its window opens and again by `UseReaction`, which rejects a second answer to two offers that waited at once (`reactionLimitReached`).
- A `CardAction.cost` ("Spend 5 resources:", `ActionCost`) is paid by `UseCardAction` before the effects; an action that can't be paid for (`canPay`) is neither offered nor accepted (`cardActionCostUnpaid`).
  - A group cost (`groupClues`, "2 clues per investigator, as a group") is paid by any active investigators: `UseCardAction.spend` names who pays how many (`groupCluePayments`), and without it the taker pays what they can and the others the rest (`defaultCluePayments`).
  The view gives the screen what it needs to let the players split it: the cost on the offered action (`CardActionView.groupClues`) and who may pay with the clues they hold and the default split (`BoardView.cluePayers`).
  - A cost the game can't pay itself (`handCards`, "choose and discard 4 cards from your hand") is always payable to the engine and paid by a deferred `DiscardFromHand`.
- A free action (`CardAction.free`, a "[free]" ability) costs no action: `UseCardAction` takes it in any player window, outside the taker's turn too, and it never provokes (`UseCardAction` has no `asAction`: the printed ability decides); the engine counts off an action only for the others (`actionPayment`).
- An action that costs more than one ("[action][action]:", `CardAction.actions`) is offered with its count (`OfferedCardAction.actions`, also on `PrintedActionView`); the engine counts off that many (`actionPayment`) and the screen marks one action arrow for each (Orne Library's draw, the threat-area discards of Unspeakable Truths, Mark of Elokoss and Languor).
- An action whose effects would change nothing can't be taken (RR "Triggered Abilities"): `UseCardAction`'s spec names its effects as `CommandSpec.mustChangeState`, which `handle` dry-runs after the handler's own checks and rejects (`changesNothing`) when they would emit no event, so the limit isn't used up; `BoardView.cardActions` leaves such an action out (`changesGameState`). An action with no effects the engine runs is done at the table and always offered.
- A `CardAction.condition` ("During your turn:") is an `AbilityCondition`, read in the action's window, where `you()` is the taker (`actionConditionHolds`). It must hold, else the action is neither offered nor accepted (`cardActionConditionUnmet`).
- A resolution step reads an `AbilityCondition` too, on the ended game and outside any window (`conditionHolds` without one, [Campaign](campaign.md)): a reference to the window's card, investigator or location names nothing there, only `lead`, `onlyCopy` and `setAsideCopy` stand for something, and a picked reference has no candidates, so it counts 0. `thereAre(of, range)` writes the usual question, "there are N of these": `thereAre(eachInZone(victoryDisplay, { code }), { min: 1 })`.
  - A condition on player cards, which the game doesn't track ("If you control Lita Chantler:"), is no condition: the action's effects ask its taker, and the players answer (example in [Card patterns](card-patterns.md)).
  - `{ kind: 'turn', of: you() }` ("during your turn") holds in the taker's own turn, a `countOf` over `eachInvestigator()` ("if there are exactly 1 or 2 investigators in the game") counts the investigators still in it, and `allOf` combines them (Miskatonic Quad's free move, `moveToConnectingLocation()`); `anyOf` and `not` combine conditions too.
- A rejected effect rejects the whole action, cost included.

### Advancing the act

The `turn` condition without `of` ("during any investigator's turn") holds while anyone's turn is in progress.

- `advanceBySpendingClues(clues)` is the act's group clue spend as a free action with that condition, a `groupClues` cost and `advanceAct()`, which the act builders give every act with a clue threshold (after its printed actions, so their indices stay).
- An act whose objective sets its own time and place (The Barrier: "When the round ends, investigators in the Hallway may, as a group, spend the requisite number of clues to advance") has no such action but `advanceBySpendingCluesAtRoundEnd(decision, clues, location)`: a `roundEnds` ability that, once those at the location hold the clues (a `groupClues` value), lets the lead decide; its spend option pays with `SpendCluesAsGroup` (only investigators at the location, the lead first by default) and advances the act. Without a location (Spreading Flames' "Where There's Smoke…": "At the end of the round, investigators may spend the requisite number of clues, as a group") every investigator who may spend clues counts and pays (`cluesHeldForObjective`).
- `Advance { deck: 'act' }` itself pays nothing: it is that action's effect, an objective's or another card's. Act and agenda share the one command (`deck`); only its first step differs, an agenda removing all doom in play.
- `BoardView.act.advance` says how clues advance the act (`ActAdvance`): `spendClues`, the clues the investigators hold against that cost (`cluesToAdvance`), `spendCluesAtRoundEnd`, the clues of those at the objective's location (`roundEndClueObjective`), shown without an Advance button, or `cluesOnAct`, an objective counting the clues on it (`tokenObjective`).
- `PlayTable.spendCluesToAdvanceAct` takes the action for the investigator whose turn it is.

### Resign, Parley and story assets

- `resignAction()` is the Resign of the Parlor, the Main Path and The Midnight Masks' agendas; a player resigns only through such a card, so `PlayTable` and `GameActions` offer no plain resign.
- `eachInvestigatorResigns()` is an effect that resigns them all at once (Emergent Evils' reverse side): its `Resign` is `immediately`, so it takes no action and skips the phase and turn checks.
- `parleyAction({ cost, limit, effects })` marks any card action a Parley; its consequences are ordinary effects, so a cultist's "Parley. Add it to the victory display" is `move(self(), victoryDisplay)` and another card's Parley can test, discard or take a cost with the same blocks.
- A story asset an investigator takes control of (Lita Chantler's Parley at the Parlor, `takeControl()`) moves to their `playArea` zone:
  - it counts as in play,
  - `InvestigatorView.controls` lists it,
  - it offers no actions (its abilities are the controller's to use by hand, like a player card's),
  - and it is removed from the game when they leave the scenario (`investigatorLeavesEvents`).

### Offering actions

`BoardView.cardActions(investigator)` lists the actions the cards in play offer them (`cardActionsOfferedTo`), which the turn row and the card screens show as buttons; `cardAction(investigator, card, action)` finds one of them, e.g. to see whether it is free.

- When a card prints more than one action of a kind (two plain ones, two Parleys) each gets a `number` over the printed actions, so its button has a name of its own ("Action 2 · Parlor") that stays put when another drops out.
- The act's spend-clues advance is left out of that list and of the numbering, since `act.advance` shows it.

## Constant abilities

Constant abilities are data too. A buff or nerf of any number is a `CardStats.modifiers` entry ([`Modifier`](../../packages/engine/src/modifiers.ts)), keyed by the value it changes: `{ value: 'shroud', of: 'host', by: 2 }`. Each variant ties its value to the scope that may name it, so a card value never names an investigator.

- [`modifiersOn`](../../packages/engine/src/modifiers.ts) is the one place that collects the active ones for a card or an investigator, each with its source card; a new value is one union member plus the reader that needs it.
- [`effectiveValue`](../../packages/engine/src/modifiers.ts) answers "what is this card value now" (shroud, fight, evade), `modifiedValue` the same in parts (the printed value and each card's change, which a skill test's trace names), and `actionCost` what an action costs.
- An investigator's skill is a modifier too: "You get -1 [willpower]" on a treachery in their threat area is `{ value: 'willpower', of: 'threatArea', by: -1 }`. `skillChanges` lists the cards changing one skill, and `skillValues` adds them to the printed skills and the players' lasting boosts, never below 0. Prey comparisons and the investigator card (`InvestigatorView.boostedSkills`) read `skillValues`; a skill test adds one trace step per card instead.
- Who a modifier or restriction is about is one shared vocabulary ([`scopes.ts`](../../packages/engine/src/scopes.ts)): cards by `CardScope` (`self`, `host`, `enemiesHere`, `enemiesAtHost`, `eachEnemy` for every enemy on the table, as The Ritual Begins' "Each enemy gets +1 fight and +1 evade", read by `namesCard`), investigators by `InvestigatorScope` (`threatArea`, `investigatorsHere` for each investigator at the card's location, as Whippoorwill's "-1 to each skill", read by `binds`).
- The plan for further values (health, doom threshold) and lasting modifiers is ME.7 (#865).

"Cannot" abilities are `CardStats.restrictions` ([`CardRestriction`](../../packages/engine/src/restrictions.ts): what is forbidden, `moveInto` or `investigate`, at which location, the card itself or its host), and [`isRestricted`](../../packages/engine/src/restrictions.ts) is the one place that answers "may anyone do this here": `MoveInvestigator` and `Investigate` reject a forbidden step (`restricted`), and `LocationView.forbidden` lists them so the screen offers neither. Like a modifier a restriction holds while its card is in play and a location's once it is revealed, except one printed on the unrevealed side (`unrevealed`, the Parlor's barrier), which holds until then. An `EnemyLocationRestriction` (`enemiesMoveInto`, with `exceptTraits` for Barricade's "non-Elite") closes a location to enemies, answered by [`isClosedToEnemy`](../../packages/engine/src/restrictions.ts): a hunter or a card effect does not step in (RR "Hunter"), and an engaged enemy is left behind, disengaged, when its investigator moves in. A player card the players attach to an enemy or a location ([`AttachPlayerCard`](../../packages/engine/src/player_cards.ts), ME.25a) is an ordinary `CardInstance` in the host's `attachedTo` zone, with its card data in the card DB like a scenario's cards: the app adds the hand-entered player cards ([`playerCardDefs`](../../packages/scenarios/src/player_cards.ts), Barricade) to each scenario's. So it leaves play with its host, `discard` sends it out of the game, back to its owner (`handleMoveCard`, `isPlayerCard`) and `LocationView.attachments` and `EnemyView.attachments` list it. `CardStats.attachesTo` names the host type its text attaches it to (Handcuffs an enemy, Barricade a location): the details of that type offer it (ME.25c), and `AttachPlayerCard` refuses another (`invalidAttachmentHost`).

An `EnemyCardRestriction` holds an enemy (`ready`, `placeDoom`, with `exceptTraits`; Handcuffs), answered by [`isEnemyRestricted`](../../packages/engine/src/restrictions.ts): `ReadyEnemy` leaves it exhausted and `MoveTokens` places no doom on it.

A card may also give other cards a keyword while it is in play (`CardStats.keywordGrants`: Hiding Spot's aloof for each non-Elite enemy at its host, scope `enemiesAtHost`). [`cardKeywords`](../../packages/engine/src/card_keywords.ts) lists the printed and given keywords together, and every rule about a keyword of a card in play asks it (`cardHasKeyword`), as does `BoardView.enemyStats`. Discarding such a card has a ready enemy left unengaged next to an investigator engage them.

A restriction can also bind an investigator (`InvestigatorCardRestriction`), which [`isRestrictedFor`](../../packages/engine/src/restrictions.ts) answers:

- It names verbs and the noun they act on (`RESTRICTED_VERBS`): The Masked Hunter is `cannot: ['discover', 'spend'], what: 'clues'`, Dissonant Voices `cannot: ['play'], what: 'cards'`. A new "cannot", such as healing horror or gaining resources, adds its verb and noun there and a check in its handler.
- It binds the investigator in whose threat area the card is, an engaged enemy included (`who: 'threatArea'`).
- `play` `cards` names the cards by type and trait (`PlayedCardFilter`). The engine never sees the card played, so it refuses a `PlayCard` only where the filter names every played card, as Dissonant Voices' assets or events do.
- `DiscoverClues` and `PlayCard` reject it (`restrictedFor`), and a passed investigation discovers nothing.
- Clue costs leave their clues out (`cluesHeldByGroup`, `defaultCluePayments`); `groupCluePayments` rejects them as payers, and `canPay` an own clue cost.
- `InvestigatorView.forbidden` lists them for the screen, verbs by noun (`forbiddenFor`: `{ clues: ['discover', 'spend'] }`).

A card can also make basic actions cost more (an `actionCost` modifier, [`ActionCostModifier`](../../packages/engine/src/modifiers.ts)): the actions it raises by their card text words (`BasicAction`), by how much, whom it binds (`of: 'threatArea'`, the `InvestigatorScope` a restriction's `who` takes), and with `first: 'eachRound'` only the first of them each round (Frozen in Fear).

- The engine counts off what an action command taken `asAction` costs before it handles it ([`actionPayment`](../../packages/engine/src/action_costs.ts), one `SpendActions`): [`actionCost`](../../packages/engine/src/action_costs.ts) (`BoardView.actionCost`, also shown on the action's button), 1 (none for `asAction: 'free'`, a card's free action) plus what the binding cards add, each copy its own. Only the player's own command pays: an action held for attacks of opportunity and resumed (`StepsQueued`) doesn't pay again.
- The payment is its own command and event (`SpendActions`, `ActionsSpent`), not an `AdjustActions`, so the log tells an action taken apart from a correction or a card that grants or takes actions, and a card that reacts to an action being spent can read what it paid for.
- It names what it pays for (`ActionPaidFor`): a basic action by its word, or a card's action ability by card and number. The engine records a basic action for the round (`GameMeta.actionsTaken`, cleared by `RoundEnded`), so a cost of the first one is paid once, even when the action came before the card. A free basic action is recorded with an amount of 0.
- A cost the investigator can't pay is refused like any count below zero (`invalidActionAdjustment`).

## Extension points

- **A card's ability, action or modifier:** list it in the card's data; no code. [Card patterns](card-patterns.md) shows how card text maps to it.
- **A new window or condition:** a case in `TimingWindow` / `windowsOpenedBy`; a condition is usually a new reference to count or a new `Quantity` to read, rarely a new `AbilityCondition` kind.
- **A new kind of effect:** add its command to `AbilityCommand` (and a factory in `dsl.ts`, exported from the package index); a new reference is a case in `resolveRefs`.
