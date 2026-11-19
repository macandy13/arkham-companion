# Playtest: Smoke and Mirrors

A checklist for playing _Smoke and Mirrors_ (Core Set (2026), scenario II of _Brethren of Ash_) at the table with the app, from setup to resolution.
The app runs the scenario side; the players play their own cards and tell the app what they did.
The scripted golden game is [`end_to_end.test_support.ts`](../../packages/scenarios/src/smoke_and_mirrors/end_to_end.test_support.ts) (Roland and Daisy, seed 1, from the campaign log that _Spreading Flames'_ golden game wrote to both resigning in round 3); every unit test run replays it, so a regression there shows before the table does.

## Before the game

- Continue the _Brethren of Ash_ campaign after _Spreading Flames_ (or start a standalone game of _Smoke and Mirrors_, which takes the university In Flames).
- Set up the physical table as the app shows it: Arkham's nine neighbourhoods, five suspects and the Servant of Flame face down beneath six of them, the sixth suspect and every Mark of Elokoss set aside.
- Check the chaos bag the app lists: the campaign's bag plus 2 cultist tokens.

## What to check, in game order

**Setup**

- [ ] With the university saved in _Spreading Flames_, Miskatonic University (Quiet Campus) is in play, the investigators start there and Arkham Alive has 1 more doom; otherwise it is Miskatonic University (In Flames).
- [ ] Arkham Alive starts with 1 doom per investigator (plus the 1 above).
- [ ] The skull token is -1 for each Elite enemy in the victory display and beneath the act (2 more on Hard and Expert); the elder thing is -1 for each clue the tester controls (-2 each on Hard and Expert).

**Act, Augurs of Flame**

- [ ] Its action spends 2 clues per investigator from the group and draws the card beneath the taker's location: a suspect or the Servant of Flame comes into play there.
- [ ] "Put beneath the act" on an interrogated suspect's card moves it there, fanned at the act's corner, where a tap shows it.
- [ ] Once 6 Elite enemies are in the victory display or beneath the act, the act advances to resolution 1.

**Agenda 1, Arkham Alive**

- [ ] When it advances, each investigator gets a set-aside Mark of Elokoss in their threat area.
- [ ] Its resign action works.

**Agenda 2, Emergent Evils**

- [ ] When it advances, each investigator resigns and the game ends without a resolution.

**Locations and enemies**

- [ ] Miskatonic University (In Flames) deals 1 damage to each investigator there as the investigation phase ends.
- [ ] Discovering clues at Downtown (First Bank of Arkham) offers its reaction to gain 1 resource.
- [ ] Discovering clues at Downtown (Arkham Sanatorium) offers its reaction: heal 1 horror from an investigator there (only those with horror), or an Ally asset there by hand.
- [ ] With 1 or 2 investigators, Merchant District offers a free move to a connecting location in your turn, once per round for each investigator.
- [ ] Discovering the last clue at Easttown offers its reaction once per game: search for an Ally asset and play it, by hand.
- [ ] The Servant of Flame hunts and retaliates; the Rogue Gangster hunts the investigator with the most resources, and as it engages takes 1 of their resources, or attacks them if they have none.
- [ ] Each suspect has its keyword: David Renfield, Abigail Foreman and Margaret Liu are aloof, Cornelia Akely is alert, Naomi O'Bannion retaliates.
- [ ] Investigating David Renfield's location successfully offers his reaction, which asks you to read codex entry 1 by hand.
- [ ] Succeeding at a test by 2 or more at Margaret Liu's location offers her reaction (codex entry 6); by 1 it doesn't.
- [ ] Evading Cornelia Akely offers her reaction: she readies (and engages you again), and you read codex entry 2 by hand.

**Encounter cards**

- [ ] Arcane Lock attaches to the drawer's location (one per location); its action tests willpower or intellect (4) and discards it on a pass.
- [ ] Flash Flood attaches to the drawer's location for +4 shroud and is discarded as the round ends.
- [ ] Crossfire: on a failed agility (3) test each investigator at the location takes 1 damage.
- [ ] Mark of Elokoss goes to the drawer's threat area.
- [ ] Raising Suspicions puts 1 doom on the nearest enemy without doom, and surges when every enemy has some; the lead picks between equally near ones.
- [ ] Aerial Pursuit moves the nearest non-Elite enemy once toward the drawer, engaged or not; if it engages someone there, it attacks them at once. It also surges.

**Resolution**

- [ ] Both endings add 2 cultist tokens to the bag for the rest of the campaign and record the set-aside suspect as the harbinger of Elokoss.
- [ ] Resolution 1 records that the cult's whereabouts were discovered, and records "scoured Arkham for answers" with 6 Elite enemies beneath the act or "stirred up trouble" with 6 in the victory display.
- [ ] Without a resolution the players draw for the harbinger by hand and record whether they found the cult.
- [ ] The Servant of Flame in the victory display records it killed; beneath the act, it escaped and each investigator earns 1 more experience.
- [ ] Experience: the victory display plus 1 for each enemy beneath the act.
- [ ] Once Arkham Alive has advanced, each investigator earns a Mark of Elokoss.

## Left to the players

These are done by hand at the table; the app does not do them.

- The codex entries of the suspects and the Servant of Flame, read from the campaign guide (the suspects' reactions show theirs as a by-hand notice), and the suspects' Parley actions.
- The Elusive keyword of the Servant of Flame, Sgt. Earl Monroe and Bat Horror.
- Adding the Mark of Elokoss to each deck, its damage as its holder's turn ends and its two-action discard.
- The Arkham locations' other reactions and actions, Waterfront District's additional action to investigate, Arcane Lock's additional action to enter or leave, and the damage Miskatonic University (In Flames) deals to allies.
- Two Rogue Gangsters engaging the same investigator at once with 1 resource left: the second should attack instead of taking a resource.
- Whippoorwill's -1 to each skill at its location.
- The cultist's "reveal another token" against an Elite enemy, the tablet's clue placed on a failure, and Dr. Henry Armitage in play under his bearer's control.
- The resolutions' deck changes and upgrades.

## Reporting a problem

Note the round, the phase and what the app showed against what the rules say, and open an issue under [MC2.10 (#596)](https://github.com/macandy13/arkham-companion/issues/596).
