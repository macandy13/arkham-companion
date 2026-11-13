# Agenda and doom

[Act and agenda decks](https://arkhamdb.com/rules#Act_Deck_and_Agenda_Deck), [doom](https://arkhamdb.com/rules#Doom).
Card rulings: [Objectives and special acts and agendas](cards/objectives.md).

- Doom in play counts doom on the agenda **and on every other card in play** (enemies, locations, assets).
- The agenda advances at the mythos "check doom threshold" step when doom in play is at or above its threshold and the agenda has no "Objective –". Outside that step it only advances when a card says so: Ancient Evils' "This effect can cause the current agenda to advance" checks the threshold right after its doom (`checkDoomThreshold`).
- A card that removes doom ("remove 1 doom from the current agenda", "remove all doom from it") takes as much as the card holds: one with less loses all of it, one with none loses nothing ([Effects](https://arkhamdb.com/rules#Effects)). Removed doom no longer counts towards the threshold.
- A card that moves tokens ("move all doom from each [[Cultist]] enemy to the current agenda") moves as many as the card holds, and none from a card out of play ([Effects](https://arkhamdb.com/rules#Effects); [Leaves Play](https://arkhamdb.com/rules#Leaves_Play) returns its tokens). Onto a card out of play it moves none, leaving them where they are, and placing (a move from the pool) onto one places none: our reading. Doom moved onto the agenda is checked at the next threshold step like any other doom.
- Thresholds may be flat or [per investigator](per-investigator-values.md).
- Only the current agenda and act are in play ([In Play and Out of Play](https://arkhamdb.com/rules#In_Play_and_Out_of_Play)), so a constant ability on an agenda's front holds only while it is current: The Ritual Begins' "Each enemy gets +1 fight and +1 evade" covers every enemy at a location or engaged, and none set aside or in a deck.
- Advancing the agenda removes **all doom from all cards in play**, then flips the agenda and follows its back side. Unless the back names a different next card, the next agenda in sequence becomes current and the old one is removed from the game.
