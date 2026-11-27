# Agenda and doom

[Act and agenda decks](https://arkhamdb.com/rules#Act_Deck_and_Agenda_Deck), [doom](https://arkhamdb.com/rules#Doom).
Card rulings: [Objectives and special acts and agendas](cards/objectives.md).

- Doom in play counts doom on the agenda **and on every other card in play** (enemies, locations, assets).
  Test: `packages/engine/src/doom.test.ts › doom total › adds agenda, other cards in play and investigators player-card doom`
  Test: `packages/engine/src/doom.test.ts › doom total › ignores doom on cards outside play`
- The agenda advances at the mythos "check doom threshold" step when doom in play is at or above its threshold and the agenda has no "Objective –". Outside that step it only advances when a card says so: Ancient Evils' "This effect can cause the current agenda to advance" checks the threshold right after its doom (`checkDoomThreshold`).
  Test: `packages/engine/src/doom.test.ts › threshold check › asks to advance the agenda when a check finds the threshold reached`
  Test: `packages/engine/src/doom.test.ts › threshold check › does not ask when doom reaches the threshold outside a check`
  Test: `packages/scenarios/src/the_gathering/cards.test.ts › The Gathering treacheries › places 1 doom on agenda 1 at $doomBefore doom when alice draws Ancient Evils, asking $asked`
- A card that removes doom ("remove 1 doom from the current agenda", "remove all doom from it") takes as much as the card holds: one with less loses all of it, one with none loses nothing ([Effects](https://arkhamdb.com/rules#Effects)). Removed doom no longer counts towards the threshold.
  Test: `packages/engine/src/scenario_effects.test.ts › card effects that remove doom › removes 1 doom from each Cultist enemy, as much as each holds`
  Test: `packages/engine/src/scenario_effects.test.ts › card effects that remove doom › removes nothing from a card that has left play`
- A card that moves tokens ("move all doom from each [[Cultist]] enemy to the current agenda") moves as many as the card holds, and none from a card out of play ([Effects](https://arkhamdb.com/rules#Effects); [Leaves Play](https://arkhamdb.com/rules#Leaves_Play) returns its tokens). Onto a card out of play it moves none, leaving them where they are, and placing (a move from the pool) onto one places none: our reading. Doom moved onto the agenda is checked at the next threshold step like any other doom.
  Test: `packages/engine/src/scenario_effects.test.ts › card effects that move tokens between cards › moves nothing from a card that has left play`
  Test: `packages/engine/src/scenario_effects.test.ts › card effects that move tokens between cards › moves nothing onto a card that is not in play`
  Test: `packages/engine/src/doom.test.ts › placing doom (MoveTokens from the pool) › places no doom on $name, which is not in play`
- A forced "after doom is placed on the agenda" (Wild Flames) fires for doom put on the agenda card itself, the mythos 1.2 doom included, and resolves before 1.3 checks the threshold: forced abilities need no player window ([Forced Abilities](https://arkhamdb.com/rules#Forced_Abilities)). Doom on other cards counts towards the threshold but is not placed on the agenda. One effect placing several doom is one placement. Doom moved onto the agenda from another card counts as placed too: our reading.
  Test: `packages/scenarios/src/spreading_flames/cards.test.ts › Spreading Flames card abilities › Wild Flames › has the lead investigator draw the topmost Fire! of the encounter discard after doom is placed on it, not one from the deck`
  Test: `packages/scenarios/src/spreading_flames/cards.test.ts › Spreading Flames card abilities › Wild Flames › draws no Fire! when the doom is placed on an enemy instead of on it`
- Thresholds may be flat or [per investigator](per-investigator-values.md).
- Only the current agenda and act are in play ([In Play and Out of Play](https://arkhamdb.com/rules#In_Play_and_Out_of_Play)), so a constant ability on an agenda's front holds only while it is current: The Ritual Begins' "Each enemy gets +1 fight and +1 evade" covers every enemy at a location or engaged, and none set aside or in a deck.
  Test: `packages/scenarios/src/the_devourer_below/cards.test.ts › The Devourer Below card abilities › The Ritual Begins › gives each enemy +1 fight and +1 evade, one $name: fight 3 and evade 2`
- Advancing the agenda removes **all doom from all cards in play**, then flips the agenda and follows its back side. Unless the back names a different next card, the next agenda in sequence becomes current and the old one is removed from the game.
  Test: `packages/engine/src/doom.test.ts › Advance the agenda › removes all doom in play`
  Test: `packages/engine/src/doom.test.ts › Advance the agenda › flips the agenda, removes it from the game and makes the next one current`
