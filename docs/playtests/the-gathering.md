# Playtest: The Gathering

A checklist for playing _The Gathering_ at the table with the app, from setup to resolution.
The app runs the scenario side; the players play their own cards and tell the app what they did.
The scripted golden game is [`end_to_end.test.ts`](../../packages/scenarios/src/the_gathering/end_to_end.test.ts) (Roland, Daisy and Wendy, seed 24, setup to resolution 1); every unit test run replays it, so a regression there shows before the table does.

## Before the game

- Start a new campaign of _Night of the Zealot_ (or a standalone game of _The Gathering_) with your investigators and difficulty.
- Set up the physical table as the app shows it: only the Study is in play; the Hallway, Attic, Cellar, Parlor, the Ghoul Priest and Lita Chantler are set aside.
- Check the chaos bag the app lists against the campaign guide for your difficulty.

## What to check, in game order

**Setup**

- [ ] Every investigator starts in the revealed Study with its clues (2 per investigator).
- [ ] The encounter deck has 26 cards (the six sets less the set-aside cards).

**Agenda 1, What's Going On?!**

- [ ] When it advances, the lead is asked: each investigator discards a random card, or the lead takes 2 horror. The discard shows up under "Do this by hand" for each investigator.

**Act 1, Trapped**

- [ ] The act offers to spend 2 clues per investigator.
- [ ] Its reverse side puts the house into play, discards the enemies in the Study, moves everyone to the Hallway and removes the Study.
- [ ] Moving into the Attic deals 1 horror; moving into the Cellar deals 1 damage.
- [ ] The unrevealed Parlor can't be entered.
- [ ] Flesh-Eater spawns in the Attic and Icy Ghoul in the Cellar; with those rooms not in play yet, they are discarded.

**Agenda 2, Rise of the Ghouls**

- [ ] Its reverse side shuffles the encounter discard into the deck and the lead draws until a Ghoul enemy comes up.

**Act 2, The Barrier**

- [ ] Spending 3 clues per investigator reveals the Parlor, puts Lita Chantler there and spawns the Ghoul Priest in the Hallway.
- [ ] The Ghoul Priest hunts the investigator with the highest combat (asks on a tie) and retaliates.
- [ ] Parleying with Lita (intellect 4) gives the investigator control of her.

**Agenda 3, They're Getting Out!**

- [ ] At the end of the enemy phase, unengaged Ghouls move one step toward the Parlor.
- [ ] At the end of the round, each Ghoul in the Hallway or the Parlor places 1 doom on the agenda.
- [ ] If it advances during act 1 or 2, the scenario ends with resolution 3; during act 3, every investigator is defeated with 1 physical trauma (no resolution).

**Act 3, What Have You Done?**

- [ ] Defeating the Ghoul Priest advances the act, and the lead chooses: burn the house (resolution 1) or not (resolution 2).
- [ ] Resigning from the Parlor works.

**Encounter cards**

- [ ] Grasping Hands and Rotting Remains: the test, then damage or horror per point failed.
- [ ] Frozen in Fear: the first move, fight or evade each round costs 1 more action; the end-of-turn willpower test discards it on a pass.
- [ ] Dissonant Voices: no assets or events can be played until the end of the round.
- [ ] Obscuring Fog: +2 shroud on the location until a successful investigation there.
- [ ] Ancient Evils: 1 doom on the agenda; if that reaches the threshold, the app asks to advance the agenda right away.
- [ ] Crypt Chill: on a failed test the drawer is asked to discard an asset (shown under "Do this by hand") or, controlling none, take 2 damage.

**Resolution**

- [ ] The campaign log records what the resolution says (house standing, Ghoul Priest alive, Lita earned or not, trauma, killed investigators in resolution 3).
- [ ] Experience: the victory display plus 2 after resolution 1 or no resolution; the same plus 1 more for the lead after resolution 2; none after resolution 3.

## Left to the players

These are done by hand at the table; the app does not do them.

- Discarding player cards: agenda 1's random card from each hand and Crypt Chill's asset. The app doesn't know your cards, so it lists them under "Do this by hand".
- Lita Chantler's abilities once you control her (+1 combat at her location, +1 damage against Monsters).
- Act 2's clues: spend them as the act says (investigators in the Hallway, at the end of the round). The app offers the spend at any time during a turn and from any location. ([#118](https://github.com/macandy13/arkham-companion/issues/118))
- The resolutions' deck changes and upgrades (adding Lita to a deck, spending experience, replacing a killed investigator).

## Reporting a problem

Note the round, the phase and what the app showed against what the rules say, and open an issue under [M4.7 (#297)](https://github.com/macandy13/arkham-companion/issues/297).
