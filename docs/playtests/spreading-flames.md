# Playtest: Spreading Flames

A checklist for playing _Spreading Flames_ (Core Set (2026), scenario I of _Brethren of Ash_) at the table with the app, from setup to resolution.
The app runs the scenario side; the players play their own cards and tell the app what they did.
The scripted golden game is [`end_to_end.test.ts`](../../packages/scenarios/src/spreading_flames/end_to_end.test.ts) (Roland and Daisy, seed 1, seven rounds to resolution 2); every unit test run replays it, so a regression there shows before the table does.

## Before the game

- Start a new campaign of _Brethren of Ash_ (or a standalone game of _Spreading Flames_) with your investigators and difficulty.
- Set up the physical table as the app shows it: only Your Friend's Room is in play; the other campus locations, Dr. Henry Armitage, the Servant of Flame and all five copies of Fire! are set aside.
- Check the chaos bag the app lists against the campaign guide for your difficulty.

## What to check, in game order

**Setup**

- [ ] Every investigator starts in Your Friend's Room with its clues (2 per investigator).
- [ ] The encounter deck holds the nine encounter sets less the set-aside cards.
- [ ] The skull token's value is the current act's number.

**Act 1, Where There's Smoke...**

- [ ] When the round ends with 2 clues per investigator among the investigators, the lead is asked whether to spend them.
- [ ] Its reverse side discards each enemy, puts the Dormitories and Miskatonic Quad into play, spawns the Servant of Flame in the Dormitories, attaches a Fire! to Your Friend's Room and puts the other set-aside Fire! cards into the encounter discard pile.

**Act 2, Escape the Dorms**

- [ ] Its reverse side sets the Servant of Flame aside (healed), discards each enemy, removes Your Friend's Room with its Fire! and puts Orne Library, Science Hall and Warren Observatory into play.

**Act 3, Searching for Dr. Armitage**

- [ ] When the round ends with 3 clues per investigator held by those at Orne Library, the lead is asked whether to spend them.
- [ ] Its reverse side spawns the Servant of Flame at Miskatonic Quad (it engages an investigator there) and places 3 clues per investigator on the Quad.

**Act 4, Blaze of Glory**

- [ ] Defeating the Servant of Flame advances the act, and the lead chooses: stay and fight the fire (resolution 2) or go with Dr. Armitage (resolution 3).
- [ ] Resigning from the act works.

**Agendas**

- [ ] Wild Flames advancing defeats each investigator with 1 physical trauma (no resolution).

**Locations and enemies**

- [ ] The Dormitories' action heals 1 damage and 1 horror, once per game.
- [ ] Discovering clues at Science Hall asks the investigator to discard a card from hand (under "Do this by hand").
- [ ] The Servant of Flame hunts the investigator with the lowest agility (asks on a tie) and retaliates.
- [ ] Defeating a Mutated Experiment deals 1 horror to each investigator at its location.

**Encounter cards**

- [ ] Cosmic Evils: the drawer chooses 1 doom on the agenda (the app asks to advance it at the threshold) or 1 damage and 1 horror and a surge.
- [ ] Forbidden Secrets surges when its drawer has no clues.
- [ ] Unspeakable Truths goes to the drawer's threat area.
- [ ] Noxious Smoke: the drawer chooses willpower or agility (3), then 1 damage per point failed.
- [ ] Fire!'s action tests agility (3) and discards it on a pass.

**Resolution**

- [ ] Resolution 2 or 3 starts with resolution 1: the masked pursuer recorded as defeated, Dr. Henry Armitage earned by the investigator the players choose, and the victory display plus 3 experience.
- [ ] Resolution 2 records the university saved, gives 1 more experience and 1 physical trauma each; resolution 3 and no resolution record it burned with 1 mental trauma each.

## Left to the players

These are done by hand at the table; the app does not do them.

- The reverse sides of Past Curfew and Lit Up (each investigator tests; Lit Up's Fire! cards), the agendas' Parley to discard a Bystander, and Wild Flames' Fire! draw after doom is placed on it.
- Escape the Dorms' objective: the act advances when each undefeated investigator is at Miskatonic Quad; advance it from the act card.
- Searching for Dr. Armitage's reverse side: Dr. Henry Armitage under an investigator's control and the lead's search for Fire!. His skill bonus and free first action are his controller's to apply.
- Blaze of Glory's group clue spend to deal damage to an enemy.
- Your Friend's Room's Engage action, Miskatonic Quad's free move, Warren Observatory's draw and Orne Library's two-action draw.
- Fire!'s attachment to the nearest location without one and its damage as the investigation phase ends.
- Hellhound's discard after its enemy phase attacks, and Bystander's Doomed keyword.
- Unspeakable Truths' limit of 1 per investigator, its horror after its holder discovers clues and its two-action discard.
- The tests of Forbidden Secrets, Wild Compulsion, Extraplanar Visions and Mutated!.
- The tablet's "reveal another token" and damage, and the elder thing's Fire! draw.
- The resolutions' deck changes and upgrades.

## Reporting a problem

Note the round, the phase and what the app showed against what the rules say, and open an issue under [MC2.10 (#596)](https://github.com/macandy13/arkham-companion/issues/596).
