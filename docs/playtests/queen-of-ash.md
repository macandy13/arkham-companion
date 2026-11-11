# Playtest: Queen of Ash

A checklist for playing _Queen of Ash_ (Core Set (2026), scenario III of _Brethren of Ash_) at the table with the app, from setup to the campaign end.
The app runs the scenario side; the players play their own cards and tell the app what they did.
The scripted golden game is [`end_to_end.test.ts`](../../packages/scenarios/src/queen_of_ash/end_to_end.test.ts) (Roland and Daisy, seed 1, from the campaign log that _Smoke and Mirrors'_ golden game wrote to resolution 3: the whole campaign in one run); every unit test run replays it, so a regression there shows before the table does.

## Before the game

- Continue the _Brethren of Ash_ campaign after _Smoke and Mirrors_ (or start a standalone game of _Queen of Ash_, which sets up as if the cult's whereabouts were not discovered and the Servant of Flame was not killed).
- Set up the physical table as the app shows it: Underground Cistern above the five Sewer Tunnels, shuffled and unrevealed, above Sewer Culvert; Sluice Control, the Fire! copies, both Collectors, Elokoss, Queen's Knight and Herald of Flame set aside.
- Check the chaos bag the app lists: the campaign's bag plus the intro's tokens for your difficulty (Easy: elder thing; Standard: elder thing, tablet; Hard: elder thing, tablet, skull; Expert: elder thing, tablet, cultist, skull).

## What to check, in game order

**Setup**

- [ ] The investigators start at Sewer Culvert, which connects to each Sewer Tunnels.
- [ ] A Gathering has 1 doom unless the cult's whereabouts were discovered, and 1 more with 3 or 4 investigators.
- [ ] With "scoured Arkham for answers" in the log each investigator starts with 1 clue; with "stirred up trouble" 1 Cultist enemy per investigator spawns at different tunnels (a Zealot with 1 doom on it).
- [ ] The Servant of Flame is set aside unless it was killed in _Smoke and Mirrors_; then it is out of the game.
- [ ] The skull token is -1 for each Fire! in play (-2 each on Hard and Expert); the tablet is -2, or -4 at a Ritual Site (Easy and Standard).

**Agenda 1, A Gathering**

- [ ] When it advances, a set-aside Servant of Flame spawns at Underground Cistern, then each investigator tests willpower (4), lead first, taking 1 horror on a fail.

**Agenda 2, A Ritual**

- [ ] If it advances during act 1, Underground Cistern is revealed and Elokoss spawns there.
- [ ] Its reverse side makes agenda 3 the act and the agenda at once.

**Agenda 3, Brethren of Ash**

- [ ] Defeating Elokoss ends the scenario with resolution 1.

**Act 1, Search the Sewers**

- [ ] An investigator entering Underground Cistern advances the act.
- [ ] Its reverse side spawns Elokoss at the Cistern, attaches a Fire! there, shuffles the other Fire! copies, Queen's Knight and Herald of Flame into the encounter deck, and puts Sluice Control into play.

**Act 2, Stop the Rite**

- [ ] As the round ends, each Cultist enemy moves one step toward Underground Cistern, engaged ones too (they disengage).
- [ ] Defeating Elokoss advances the act to resolution 1.

**Locations and enemies**

- [ ] Sluice Control's action tests agility or combat (5); on a pass the scenario ends with resolution 3 and each enemy is defeated.
- [ ] An investigator who enters the revealed Sewer Tunnels with the square (Overgrown Tunnels) loses 1 action.
- [ ] Sewer Culvert's resign action works.
- [ ] Elokoss is massive and retaliates and has 5 plus 5 per investigator health; the Servant of Flame, Queen's Knight, Herald of Flame and Dark Magician hunt; Zealots are aloof.

**Encounter cards**

- [ ] Putrid Vapors: 1 horror on a failed agility (3) test.
- [ ] Languor (spelled "Langour" in the app, as on ArkhamDB) goes to the drawer's threat area.
- [ ] Cosmic Evils, Noxious Smoke and Fire! work as in _Spreading Flames_.

**Resolution and campaign end**

- [ ] Resolution 1 and 2 (2 only once [MC2.19](https://github.com/macandy13/arkham-companion/issues/1238) lets the players end the game in it): each investigator earns the victory display plus 5 experience and 2 mental and 2 physical trauma; the campaign is won.
- [ ] Resolution 3: each investigator who did not resign is killed; those who resigned earn the victory display plus 3 experience and 3 mental trauma; the campaign is won.
- [ ] Without a resolution Elokoss is reborn, each investigator is killed and the campaign is lost.
- [ ] The Collector earned as a campaign reward shows under "At the table" on the resolution screen.

## Left to the players

These are done by hand at the table; the app does not do them.

- The agendas' rule that enemies at a location with Fire! attached cannot be damaged, agenda 3a's damage instead of doom, and act 2a's clue spend to discard a Fire!.
- Elokoss: that she cannot move or make attacks of opportunity, her Mother of Flame side and her clue spend toward resolution 2. The play screen can't end the game in resolution 2 yet ([MC2.19](https://github.com/macandy13/arkham-companion/issues/1238), [MC2.17](https://github.com/macandy13/arkham-companion/issues/1236)).
- The additional clue costs to enter Underground Cistern and Sluice Control.
- Underground Cistern's clues placed again once it has none, and its discard of ready non-Elite Cultists as the investigation phase ends, with 1 doom each.
- Infested Pipes' discard until an enemy, and the turn-end effects of Flooded Crypt (horror), Smuggler's Cache (resource) and Toxic Waste Pit (discard).
- Queen's Knight's damage to Elokoss, Herald of Flame's healing after it attacks, and the Servant of Flame's codex entry as it is defeated.
- The Zealot's doom as it enters play (setup places it) and the Dark Magician's as the round ends.
- The revelations of Ashen Rebirth, Blasphemous Invocation, Unnatural Decay, Dissonance and Torment, and Putrid Vapors' asset discard.
- Languor's limit of 1 per investigator, its discard as its holder's turn begins and its two-action discard.
- Fire!'s attachment to the nearest location without one and its damage as the investigation phase ends.
- The cultist's "reveal another token" against a Cultist enemy, the tablet's automatic failure at a Ritual Site on Hard and Expert, and the elder thing's Fire! draw.
- Adding both Collectors to the player card pool.

## Reporting a problem

Note the round, the phase and what the app showed against what the rules say, and open an issue under [MC2.10 (#596)](https://github.com/macandy13/arkham-companion/issues/596).
