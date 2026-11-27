# Searching, drawing and attaching encounter cards

Card rulings for [Encounter draws](../encounter-draws.md).
A card drawn by an effect resolves like any encounter draw, and an effect that can't find what it names does as much as it can ([Effects](https://arkhamdb.com/rules#Effects)).
The cards below search or dig through a deck, draw from a deck of their own, or pick where they attach.

## Attaching

- Queen of Ash, act 1b: the investigator at Underground Cistern draws a set-aside Fire!, whose revelation attaches it to the nearest location without Fire!. No Fire! is in play then, so it lands on the Cistern; the engine attaches it there directly, so cards that react to drawing a treachery get no window (a shortcut, low impact).
  Test: `packages/scenarios/src/queen_of_ash/queen_of_ash.test.ts › Queen of Ash agendas and acts › advances Search the Sewers when the tank enters Underground Cistern: Elokoss, a Fire! there, Sluice Control into play and the rest shuffled in`
- Locked Door ("Attach to the location with the most clues and without a copy of Locked Door attached. If there is no such location, Locked Door gains surge") attaches to the location in play with the most clues among those without a copy, wherever the drawer is.
  Test: `packages/engine/src/attachment_targets.test.ts › a treachery that attaches to the location with the most clues (Locked Door) › attaches to the study with 3 clues, not to the hall alice drew it in`
  Test: `packages/engine/src/attachment_targets.test.ts › a treachery that attaches to the location with the most clues (Locked Door) › attaches to the hall when the study already has a copy`
  - Locations with equally many go to the lead investigator ([Choices](https://arkhamdb.com/rules#Choices_and_the_Grim_Rule)), and that includes every location without a copy when none has a clue.
    Test: `packages/engine/src/attachment_targets.test.ts › a treachery that attaches to the location with the most clues (Locked Door) › asks alice, the lead, between the hall with $hallClues clues and the $study study with $studyClues`
  - With a copy everywhere it is discarded and surges.
    Test: `packages/engine/src/attachment_targets.test.ts › a treachery that attaches to the location with the most clues (Locked Door) › is discarded and surges when both locations have a copy`

## Searching

"Search the encounter deck and discard pile for a [[Cultist]] enemy and draw it. Shuffle the encounter deck" (Mysterious Chanting):

- The investigator who drew the card picks one of the matching cards and draws it, resolving it like any draw (an enemy spawns engaged with them); with no match nothing is drawn (Grimoire, Search).
  Test: `packages/scenarios/src/the_midnight_masks/cards.test.ts › The Midnight Masks card abilities › Mysterious Chanting › draws Wizard of the Order with no Cultist in play`
  Test: `packages/engine/src/triggers.test.ts › doom on the nearest Cultist enemy, or a search for one › draws a cultist from $where when none is in play, then shuffles the deck`
- The engine takes the first match, deck first, for now (#346).
- The shuffle is its own sentence, so it happens even while a Cultist is in play (our reading of the card text; no ruling found).
  Test: `packages/scenarios/src/the_midnight_masks/cards.test.ts › The Midnight Masks card abilities › Mysterious Chanting › draws nothing with a Cultist in play, and shuffles the encounter deck`
  Test: `packages/engine/src/triggers.test.ts › doom on the nearest Cultist enemy, or a search for one › places no doom and finds nothing without a cultist in the game, but shuffles the deck`
- "Cultist enemies in play" counts the enemies at locations and engaged with investigators.

"The lead investigator must search the encounter deck and discard pile for 1 [per_investigator] copies of Fire! and draw them. (Shuffle the encounter deck if it was searched.)" (Searching for Dr. Armitage, act 3b):

- It is one search: the lead finds up to that many copies, then draws them one after another, each resolving like any draw ([Draw](https://arkhamdb.com/rules#Draw); [Search](https://arkhamdb.com/rules#Search)). Fewer copies left means fewer draws.
  Test: `packages/engine/src/triggers.test.ts › a search for 1 copy per investigator › has alice, the lead, draw the copy in the deck first, then the first one in the discard`
  Test: `packages/engine/src/triggers.test.ts › a search for 1 copy per investigator › draws one copy for alice alone`
- A copy whose revelation was cancelled goes to the discard but was found already, so it isn't drawn a second time.
  Test: `packages/scenarios/src/spreading_flames/spreading_flames.test.ts › Spreading Flames act 3, Searching for Dr. Armitage › the search for 1 Fire! per investigator, 2 investigators › has the lead draw both copies one search found, not a cancelled one again`
- The encounter deck is shuffled once all of them are drawn ([Search](https://arkhamdb.com/rules#Search): "If an effect searches an entire deck, the deck must be shuffled upon completion of the search").
  Test: `packages/scenarios/src/spreading_flames/spreading_flames.test.ts › Spreading Flames act 3, Searching for Dr. Armitage › the search for 1 Fire! per investigator, 2 investigators › shuffles the encounter deck once both copies are drawn`
- The lead picks the copies, and with them how many Fire! stay in the deck. The engine takes the first copies, deck first, without asking: the same shortcut as Mysterious Chanting (#346).

## A deck of its own

The Midnight Masks' Cultist deck is a deck of its own, out of play:

- At setup the five unique Cultists of the Cult of Umôrdhoth are shuffled into it, while The Masked Hunter is set aside (act 01123: "not all 6 are in the Cultist deck").
  Test: `packages/engine/src/setup.test.ts › compileSetup › shuffles the Cultist deck to the order of seed $seed, leaving a set-aside card in place`
- "Draw the top card of the Cultist deck" draws an encounter card (RR "Encounter Deck": encounter cards are any non-player cards of the scenario), so it resolves like any encounter draw: revelation and forced "when drawn" effects, peril, and an enemy [spawns](../spawn-and-engagement.md) by its spawn instruction, else engaged with the drawer, while any other card is discarded. A surge draws from the encounter deck ([surge](https://arkhamdb.com/rules#Surge)), and emptying the Cultist deck shuffles nothing back.
  Test: `packages/engine/src/encounter.test.ts › DrawCard › spawns the top card of the Cultist deck engaged with the drawer and leaves the rest`
  Test: `packages/engine/src/encounter.test.ts › DrawCard › discards a treachery drawn from the Cultist deck, as an encounter draw does`
  Test: `packages/engine/src/encounter.test.ts › DrawCard › draws the top encounter card for a surging card from the Cultist deck`
- With the deck empty the act's action can't change the game state, so it can't be taken and its clues aren't spent (an ability can be initiated only if its effect could change the game state, [Abilities](https://arkhamdb.com/rules#Abilities)); the engine refuses the action as a whole, so nobody pays, though it still offers the action.
  Test: `packages/scenarios/src/the_midnight_masks/cards.test.ts › The Midnight Masks card abilities › Uncovering the Conspiracy › is refused with the Cultist deck empty, and nobody pays`

## The card beneath your location

"Draw the facedown card beneath your location" (Augurs of Flame, Smoke and Mirrors act 1):

- The card is turned face up and resolves like any encounter draw, as a card from the Cultist deck does: an enemy [spawns](../spawn-and-engagement.md) by its spawn instruction, else engaged with the drawer, and an aloof one stays unengaged at the location. Smoke and Mirrors deals only facedown cards beneath its locations, so the engine draws the top card there.
  Test: `packages/engine/src/encounter.test.ts › DrawCard › beneath a location › turns up the facedown card beneath the hall and spawns it engaged with her`
  Test: `packages/engine/src/encounter.test.ts › DrawCard › beneath a location › leaves an aloof enemy unengaged at her location`
- With no facedown card there the action can't change the game state, so it isn't taken and its clues aren't spent, as with an empty Cultist deck above.
  Test: `packages/engine/src/encounter.test.ts › DrawCard › beneath a location › rejects the draw with nothing beneath the hall`

## Discarding until a card turns up

"Discard cards from the top until a Ghoul enemy is discarded, draw it" with no such card left:

- The players would discard the whole deck, shuffle the discard back in when the deck runs out ([encounter deck](https://arkhamdb.com/rules#Encounter_Deck)) and stop when no progress is possible ([effects](https://arkhamdb.com/rules#Effects): resolve as much as possible).
- When the discard was just shuffled into the deck, as Rise of the Ghouls does first, that ends where it started, so the engine draws and discards nothing.
  Test: `packages/scenarios/src/the_gathering/the_gathering.test.ts › The Gathering agendas 2 and 3 › shuffles the discard back and makes the lead draw the first Ghoul enemy`
- When the match is only in the discard (Infested Pipes late in Queen of Ash), the engine discards the rest of the deck, shuffles the discard back in and goes on discarding until the match turns up.
  Test: `packages/engine/src/encounter.test.ts › DrawCard with a match › discards the whole deck and shuffles the discard back in when the only match is in the discard`
