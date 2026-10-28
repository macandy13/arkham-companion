# Searching, drawing and attaching encounter cards

Card rulings for [Encounter draws](../encounter-draws.md).
A card drawn by an effect resolves like any encounter draw, and an effect that can't find what it names does as much as it can ([Effects](https://arkhamdb.com/rules#Effects)).
The cards below search or dig through a deck, draw from a deck of their own, or pick where they attach.

## Attaching

- Locked Door ("Attach to the location with the most clues and without a copy of Locked Door attached. If there is no such location, Locked Door gains surge") attaches to the location in play with the most clues among those without a copy, wherever the drawer is.
  - Locations with equally many go to the lead investigator ([Choices](https://arkhamdb.com/rules#Choices_and_the_Grim_Rule)), and that includes every location without a copy when none has a clue.
  - With a copy everywhere it is discarded and surges.

## Searching

"Search the encounter deck and discard pile for a [[Cultist]] enemy and draw it. Shuffle the encounter deck" (Mysterious Chanting):

- The investigator who drew the card picks one of the matching cards and draws it, resolving it like any draw (an enemy spawns engaged with them); with no match nothing is drawn (Grimoire, Search).
- The engine takes the first match, deck first, for now (#346).
- The shuffle is its own sentence, so it happens even while a Cultist is in play (our reading of the card text; no ruling found).
- "Cultist enemies in play" counts the enemies at locations and engaged with investigators.

## A deck of its own

The Midnight Masks' Cultist deck is a deck of its own, out of play:

- At setup the five unique Cultists of the Cult of Umôrdhoth are shuffled into it, while The Masked Hunter is set aside (act 01123: "not all 6 are in the Cultist deck").
- "Draw the top card of the Cultist deck" puts that enemy into play like a drawn enemy: it [spawns](../spawn-and-engagement.md) by its spawn instruction, else engaged with the drawer.
- With the deck empty the act's action can't change the game state, so it can't be taken and its clues aren't spent (an ability can be initiated only if its effect could change the game state, [Abilities](https://arkhamdb.com/rules#Abilities)); the engine refuses the action as a whole, so nobody pays, though it still offers the action.

## Discarding until a card turns up

"Discard cards from the top until a Ghoul enemy is discarded, draw it" with no such card left:

- The players would discard the whole deck, shuffle the discard back in when the deck runs out ([encounter deck](https://arkhamdb.com/rules#Encounter_Deck)) and stop when no progress is possible ([effects](https://arkhamdb.com/rules#Effects): resolve as much as possible).
- When the discard was just shuffled into the deck, as Rise of the Ghouls does first, that ends where it started, so the engine draws and discards nothing.
