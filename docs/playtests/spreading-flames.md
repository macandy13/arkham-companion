# Playtest: Spreading Flames

A checklist for playing _Spreading Flames_ (Core Set (2026), scenario I of _Brethren of Ash_) at the table with the app, from setup to resolution.
The app runs the scenario side; the players play their own cards and tell the app what they did.
The scripted golden game is [`end_to_end.test_support.ts`](../../packages/scenarios/src/spreading_flames/end_to_end.test_support.ts) (Roland and Daisy, seed 1, seven rounds to resolution 2); every unit test run replays it, so a regression there shows before the table does.

## Before the game

- Start a new campaign of _Brethren of Ash_ (or a standalone game of _Spreading Flames_) with your investigators and difficulty.
- Set up the physical table as the app shows it: only Your Friend's Room is in play; the other campus locations, Dr. Henry Armitage, the Servant of Flame and all five copies of Fire! are set aside.
- Check the chaos bag the app lists against the campaign guide for your difficulty.

## What to check, in game order

**Setup**

- [ ] Every investigator starts in Your Friend's Room with its clues (2 per investigator).
- [ ] The encounter deck holds the nine encounter sets less the set-aside cards.
- [ ] The skull token is -X, X the current act's number (1 more on Hard and Expert).

**Act 1, Where There's Smoke...**

- [ ] When the round ends with 2 clues per investigator among the investigators, the lead is asked whether to spend them.
- [ ] Its reverse side discards each enemy, puts the Dormitories and Miskatonic Quad into play, spawns the Servant of Flame in the Dormitories, attaches a Fire! to Your Friend's Room and puts the other set-aside Fire! cards into the encounter discard pile.

**Act 2, Escape the Dorms**

- [ ] "Advance by hand" on the act's full card advances it once each undefeated investigator is at Miskatonic Quad.
- [ ] Its reverse side sets the Servant of Flame aside (healed), discards each enemy, removes Your Friend's Room with its Fire! and puts Orne Library, Science Hall and Warren Observatory into play.

**Act 3, Searching for Dr. Armitage**

- [ ] When the round ends with 3 clues per investigator held by those at Orne Library, the lead is asked whether to spend them.
- [ ] Orne Library offers its draw once per game for two actions; drawing the 3 cards is by hand.
- [ ] Its reverse side spawns the Servant of Flame at Miskatonic Quad (it engages an investigator there) and places 3 clues per investigator on the Quad; then the lead draws one Fire! per investigator from the encounter deck or discard pile, one after the other, and the encounter deck is shuffled.

**Act 4, Blaze of Glory**

- [ ] Defeating the Servant of Flame advances the act, and the lead chooses: stay and fight the fire (resolution 2) or go with Dr. Armitage (resolution 3).
- [ ] Resigning from the act works.
- [ ] Its fast ability spends 1 clue per investigator as a group and deals 1 damage per investigator to an enemy at your location (you pick when several are there).
- [ ] With 1 or 2 investigators, Miskatonic Quad offers a free move to a connecting location in your turn, once per round for the whole group.

**Agendas**

- [ ] Each agenda offers its Parley (test intellect (2)) only to an investigator with a Bystander at their location; a success discards that Bystander (you pick when several are there).
- [ ] Past Curfew's reverse side asks each investigator, in player order, to test willpower (3); each who fails takes 1 horror.
- [ ] Lit Up's reverse side places the 4 Fire! still set aside in the encounter discard pile; after act 1 has put them out, none. Then each investigator, in player order, tests agility (3); each who fails takes 1 damage.
- [ ] Each time doom is placed on Wild Flames, the lead investigator draws the topmost Fire! of the encounter discard pile, if there is one.
- [ ] Wild Flames advancing defeats each investigator with 1 physical trauma (no resolution).

**Locations and enemies**

- [ ] The Dormitories' action heals 1 damage and 1 horror, once per game.
- [ ] Discovering clues at Science Hall asks the investigator to discard a card from hand (under "Do this by hand").
- [ ] Discovering clues at Warren Observatory offers its reaction to draw 1 card (by hand) once per round; after a pass it is offered again.
- [ ] The Servant of Flame hunts the investigator with the lowest agility (asks on a tie) and retaliates.
- [ ] After a Hellhound attacks in the enemy phase (not an attack of opportunity), the app tells the attacked investigator to discard an asset of their choice.
- [ ] Defeating a Mutated Experiment deals 1 horror to each investigator at its location.
- [ ] Defeating a Bystander (Doomed) places 1 doom on the agenda, and the app asks to advance it at the threshold; discarding one with an agenda's Parley places none.

**Encounter cards**

- [ ] Cosmic Evils: the drawer chooses 1 doom on the agenda (the app asks to advance it at the threshold) or 1 damage and 1 horror and a surge.
- [ ] Forbidden Secrets surges when its drawer has no clues.
- [ ] Unspeakable Truths goes to the drawer's threat area; its two-action discard counts off two actions.
- [ ] Noxious Smoke: the drawer chooses willpower or agility (3), then 1 damage per point failed.
- [ ] Extraplanar Visions: the drawer chooses willpower or intellect and enters the cards in their hand, which is the difficulty; a fail deals 1 damage and asks them to discard 1 card at random.
- [ ] A drawn Fire! attaches to the nearest location without one, the drawer's own first; the lead picks between equally near ones.
- [ ] As the investigation phase ends, each Fire! deals 1 damage to each investigator and non-Elite enemy at its location (each ally there takes 1 damage of its own, placed by hand).
- [ ] Fire!'s action tests agility (3) and discards it on a pass.

**Resolution**

- [ ] Resolution 2 or 3 starts with resolution 1: the masked pursuer recorded as defeated, Dr. Henry Armitage earned by the investigator the players choose, and the victory display plus 3 experience.
- [ ] Resolution 2 records the university saved, gives 1 more experience and 1 physical trauma each; resolution 3 and no resolution record it burned with 1 mental trauma each.

## Left to the players

These are done by hand at the table; the app does not do them.

- Wild Flames' Fire! draw for doom added with a correction by hand: corrections open no forced abilities, so draw the topmost Fire! of the discard yourself.
- Escape the Dorms' objective: the act advances when each undefeated investigator is at Miskatonic Quad. The players advance it with "Advance by hand" on the act's full card.
- Searching for Dr. Armitage's reverse side: Dr. Henry Armitage under an investigator's control. His skill bonus and free first action are his controller's to apply.
- Your Friend's Room's Engage action, and the 3 cards Orne Library's two-action ability draws (a by-hand notice).
- Which asset Hellhound's enemy phase attack discards (the app leaves the pick to the player).
- Unspeakable Truths' limit of 1 per investigator and its horror after its holder discovers clues.
- The tablet's "reveal another token" and damage, and the elder thing's Fire! draw.
- The resolutions' deck changes and upgrades.

## Reporting a problem

Note the round, the phase and what the app showed against what the rules say, and open an issue under [MC2.10 (#596)](https://github.com/macandy13/arkham-companion/issues/596).
