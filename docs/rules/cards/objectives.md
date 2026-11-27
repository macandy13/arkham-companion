# Objectives and special acts and agendas

Card rulings for [Act and clues](../act-and-clues.md) and [Agenda and doom](../agenda-and-doom.md).
An "Objective –" is active only while its agenda or act is current, and advancing by it spends no clues.
The cards below add when an objective is checked, what counts towards it, and acts or agendas that leave the usual clue and doom track.

## Objectives

- "If the Ghoul Priest is defeated, advance" (The Gathering, act 3) fires when the defeat happens while act 3 is current.
  Test: `packages/scenarios/src/the_gathering/the_gathering.test.ts › The Gathering acts 2 and 3 › advances act 3 when the Ghoul Priest is defeated and asks the lead whether to burn the house`
  Test: `packages/scenarios/src/the_gathering/the_gathering.test.ts › The Gathering acts 2 and 3 › does not advance act 3 when another enemy is defeated`
- "If an investigator enters the Ritual Site, advance" (Into the Darkness, The Devourer Below act 2) fires when an investigator moves into it, revealed or not ([Move](https://arkhamdb.com/rules#Move): moving enters the new location).
  Test: `packages/engine/src/triggers.test.ts › objectives on entering a location › $outcome when alice moves to the $to (cellar revealed: $cellarRevealed)`
  - It can't fire at setup: the Ritual Site is set aside until act 1 advances, and act 2 isn't current yet.
- "If there are 6 unique [[Cultist]] enemies in the victory display, advance" (Uncovering the Conspiracy, The Midnight Masks act 1) counts unique (✷) Cultists only, so an Acolyte there doesn't count.
  Test: `packages/engine/src/triggers.test.ts › objectives on the victory display › with $newcomer defeated, the act is $act`
  - The app checks it whenever a card enters the victory display, by a defeat or by an effect such as a Parley.
    Test: `packages/engine/src/triggers.test.ts › objectives on the victory display › advances when a unique Cultist is put into the victory display without a defeat (by an effect such as a Parley)`
  - Ruth Turner, who goes there once evaded, triggers it as well.
    Test: `packages/scenarios/src/the_midnight_masks/cards.test.ts › The Midnight Masks card abilities › Uncovering the Conspiracy › ends in R1 once alice evades Ruth Turner as the sixth unique Cultist`
  - A card put there by hand, a correction, doesn't.
- "If there are a total of 6 [[Elite]] enemies in the victory display and/or under the act, advance" (Augurs of Flame, Smoke and Mirrors act 1) counts the face-up cards beneath the current act together with the victory display.
  Test: `packages/engine/src/triggers.test.ts › objectives on the victory display and beneath the act › counting $objective, a suspect placed beneath the act leaves act $current current`
  Test: `packages/scenarios/src/smoke_and_mirrors/smoke_and_mirrors.test.ts › Smoke and Mirrors act, Augurs of Flame › advances to Resolution 1 with $elite Elite enemies in the victory display: $ended`
  - The app checks it whenever a card enters either place; cards beneath a location don't count.
    Test: `packages/engine/src/triggers.test.ts › objectives on the victory display and beneath the act › does not count a card beneath a location`

- "When the round ends, investigators in the Hallway may, as a group, spend the requisite number of clues to advance" (The Barrier, The Gathering act 2) replaces the usual spend: it can't be spent during a turn, and only clues of investigators in the Hallway count.
  Test: `packages/engine/src/card_actions.test.ts › advancing the act by spending clues at the end of the round › rejects bob in the cellar paying for the investigators in the hall`
  - The app asks the lead as the round ends, once those in the Hallway hold enough; the group may also keep them.
    Test: `packages/engine/src/card_actions.test.ts › advancing the act by spending clues at the end of the round › asks as the round ends with alice and bob in the hall, and both pay a clue to advance`
    Test: `packages/engine/src/card_actions.test.ts › advancing the act by spending clues at the end of the round › leaves the act and both clues as they are when the lead keeps them`
  - It resolves after They're Getting Out!'s forced round-end doom (forced before non-forced, RR "Forced Abilities"), so a Ghoul Priest it spawns adds no doom that round.
- "At the end of the round, investigators may spend the requisite clues, as a group, to advance" (Where There's Smoke…, Spreading Flames act 1) is the same objective without a place: the clues of every investigator count, wherever they are.
  Test: `packages/engine/src/card_actions.test.ts › advancing the act by spending clues anywhere at the end of the round › counts the clues of alice in the hall and bob in the cellar together`
  Test: `packages/scenarios/src/spreading_flames/spreading_flames.test.ts › Spreading Flames act 1, Where There's Smoke... › asks as round 1 ends once the investigators hold 2 clues each between them, wherever they are`
  - Searching for Dr. Armitage (act 3) names a place again: only investigators at Orne Library.
    Test: `packages/scenarios/src/spreading_flames/spreading_flames.test.ts › Spreading Flames act 3, Searching for Dr. Armitage › asks as round 1 ends with both investigators and their 6 clues at $at: $asked`

## Acts that advance on their own clues

- Disrupting the Ritual (The Devourer Below, act 3) has no clue requirement: its objective advances it once 2 clues per investigator lie on it.
  Test: `packages/scenarios/src/the_devourer_below/cards.test.ts › The Devourer Below card abilities › Disrupting the Ritual › advances by itself to R1 once a pass places the second clue a lone investigator needs`
  - Only its own action puts clues there, 1 from the token pool on a passed test (the clue its cost spends is not one of them).
    Test: `packages/scenarios/src/the_devourer_below/cards.test.ts › The Devourer Below card abilities › Disrupting the Ritual › spends alice’s clue on a $skill (3) test; a $result places $actClues clue on the act`
  - Investigators can't spend clues to advance it.
  - The app checks the objective as clues arrive and advances the act itself; clues put on it by hand, a correction, don't trigger it.
    Test: `packages/engine/src/triggers.test.ts › objectives on a card's own tokens › $outcome when a clue is placed on the act holding $clues`
    Test: `packages/engine/src/triggers.test.ts › objectives on a card's own tokens › does not fire for a clue put on by hand, a correction`

## Doom and clues placed by cards

- Doom "for each [[Ghoul]] enemy in the Hallway or Parlor" (They're Getting Out!, at the end of the round) counts the matching enemies there as the round-end window opens, engaged ones included (an engaged enemy is at its investigator's location).
  Test: `packages/engine/src/triggers.test.ts › an effect repeated for each Ghoul enemy in the Hall or Parlor › places 2 doom for the ghoul engaged with alice in the hall and the one in the parlor`
  - Placed outside the mythos phase, it can only advance the agenda at the next threshold check.
  - Our reading: counting as the window opens rather than as the effect resolves differs only if another round-end ability moved a Ghoul first, which no Night of the Zealot card does.
- Ritual Site (The Devourer Below): "At the end of the round, if there are fewer than 2 clues per investigator on Ritual Site: Add clues to it until it has 2 clues per investigator on it."
  Test: `packages/engine/src/triggers.test.ts › trigger bus › turn-end and round-end abilities › tops up the $cellar cellar to 4 clues at the end of the round only once revealed`
  - The clues come from the token pool, counted per investigator who started the scenario, like its clue value ([Per Investigator](https://arkhamdb.com/rules#Per_Investigator): eliminated investigators still count).
  - Only a revealed Ritual Site does it: an unrevealed location's abilities are on its revealed side ([Locations](https://arkhamdb.com/rules#Locations)).

## One card as act and agenda

- A reverse side that replaces the current act and agenda with itself (The Devourer Below, the reverse of Vengeance Awaits, agenda 3 of The Devourer Below) makes that card both the current act and the current agenda.
  Test: `packages/engine/src/triggers.test.ts › trigger bus › a reverse side that is act and agenda at once › replaces the act and stays as both, face down, without ending the scenario`
  - It stays in play on its reverse side, which prints no doom threshold and no clue requirement, so doom no longer advances it (doom is still placed on it).
    Test: `packages/engine/src/triggers.test.ts › trigger bus › a reverse side that is act and agenda at once › asks for no advance by doom, as its reverse side prints no threshold`
  - Its objective is the only resolution point left, and it fires once, as one card's; the scenario can still end with no resolution reached if every investigator is eliminated or resigns.
    Test: `packages/engine/src/triggers.test.ts › trigger bus › a reverse side that is act and agenda at once › fulfils its objective once, as one card`
  - Our reading: the rest of the act deck leaves the game, since the card does not say so but no act can follow.
- A reverse side can make the next agenda both instead (Queen of Ash: A Ritual's "special agenda 3a replaces the current act and agenda"). Its "If it is act 1" is checked before the replacement. Brethren of Ash, agenda 3a, prints no doom threshold; its objective (Elokoss defeated, R1) fires once, and its own forced advance when each investigator is defeated kills each of them.
  Test: `packages/engine/src/triggers.test.ts › trigger bus › a reverse side that makes the next agenda act and agenda › puts the ritual and the acts out of the game and makes the brethren act and agenda`
- Sluice Control's success ("each enemy is defeated and each investigator who has not resigned is killed (→R3)") ends the scenario in R3 and then defeats each enemy, so those with victory reach the victory display for R3's experience. Nothing triggers once the scenario has ended, so Elokoss's defeat does not reach her "(→R1)" objectives (our reading: the card names R3).
  Test: `packages/engine/src/triggers.test.ts › a chain after the scenario ended › still defeats the elder, but its objective does not end the scenario a second time`
