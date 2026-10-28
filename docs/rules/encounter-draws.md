# Encounter draws

[Mythos step 1.4](https://arkhamdb.com/rules#Mythos_Phase), [encounter deck](https://arkhamdb.com/rules#Encounter_Deck).
A player card or effect that makes an investigator draw outside the mythos phase follows the same steps.

For each draw:

1. Draw the top card. If the deck is empty, shuffle the encounter discard pile back in first.
2. [Peril](https://arkhamdb.com/rules#Peril): while it resolves, other players can't confer, play cards, trigger abilities or commit cards to that investigator's tests.
3. Resolve its [revelation](https://arkhamdb.com/rules#Revelation) ability before it enters play (or, for a treachery, before it is discarded).
   - A treachery is discarded afterwards unless its revelation put it into play (2026 Core rulebook p. 18).
   - If the revelation eliminates the drawer, our reading (no explicit ruling exists): a treachery is discarded; an enemy with a spawn instruction still spawns there; an enemy without one would spawn engaged with the drawer, which can no longer be fulfilled, so it is discarded (2026 Core rulebook p. 19).
4. An enemy [spawns](spawn-and-engagement.md).
5. A treachery goes to the encounter discard pile unless its text says otherwise.
   - One whose revelation attaches it somewhere stays there; if there is nothing to attach it to, or a [limit](https://arkhamdb.com/rules#Limits_and_Maximums) ("Limit 1 per location", counted by title) keeps it from attaching, it is discarded ([Attach To](https://arkhamdb.com/rules#Attach_To)).
   - A treachery or enemy with Victory X goes to the victory display instead when it is overcome (see [Victory display](https://arkhamdb.com/rules#Victory_Display_Victory_Points)).
6. [Surge](https://arkhamdb.com/rules#Surge): after resolving, draw another encounter card and start over.
   - A card that gains surge while it resolves (False Lead: "if you have no clues, False Lead gains surge") surges like one with printed surge; one with both surges once (our reading, no explicit ruling exists).
   - "Resolving" covers the whole card: its revelation and revelation test, its spawn and engagement, and the forced effects it triggers (2026 Core rulebook p. 19: "after resolving its text"; FAQ §1.4).
   - If the card eliminates the drawer, our reading (no explicit ruling exists): the surge draw is lost, since Surge makes "the investigator who drew it" draw again and an eliminated investigator no longer takes part; the others play on (2026 Core rulebook, Surge and Elimination).

"Search the encounter deck and discard pile for a [[Cultist]] enemy and draw it. Shuffle the encounter deck" (Mysterious Chanting):

- The investigator who drew the card picks one of the matching cards and draws it, resolving it like any draw (an enemy spawns engaged with them); with no match nothing is drawn (Grimoire, Search).
- The engine takes the first match, deck first, for now (#346).
- The shuffle is its own sentence, so it happens even while a Cultist is in play (our reading of the card text; no ruling found).
- "Cultist enemies in play" counts the enemies at locations and engaged with investigators.

The Midnight Masks' Cultist deck is a deck of its own, out of play:

- At setup the five unique Cultists of the Cult of Umôrdhoth are shuffled into it, while The Masked Hunter is set aside (act 01123: "not all 6 are in the Cultist deck").
- "Draw the top card of the Cultist deck" puts that enemy into play like a drawn enemy: it [spawns](spawn-and-engagement.md) by its spawn instruction, else engaged with the drawer.
- With the deck empty the act's action can't change the game state, so it can't be taken and its clues aren't spent (an ability can be initiated only if its effect could change the game state, [Abilities](https://arkhamdb.com/rules#Abilities)); the engine refuses the action as a whole, so nobody pays, though it still offers the action.

An ability that shuffles an empty discard pile into a deck does not shuffle the deck ([discard piles](https://arkhamdb.com/rules#Discard_Piles)).

"Discard cards from the top until a Ghoul enemy is discarded, draw it" with no such card left:

- The players would discard the whole deck, shuffle the discard back in when the deck runs out ([encounter deck](https://arkhamdb.com/rules#Encounter_Deck)) and stop when no progress is possible ([effects](https://arkhamdb.com/rules#Effects): resolve as much as possible).
- When the discard was just shuffled into the deck, as Rise of the Ghouls does first, that ends where it started, so the engine draws and discards nothing.
