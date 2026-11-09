# Player card analysis

_Why:_ the play tester's bots play no player cards, so they lose almost every game of The Gathering in act 1 or 2 and the later acts are never tested (the nightly statistics show every act and agenda advance after the first unfired). The deck bot ([M1V.4 slice 8](https://github.com/macandy13/arkham-companion/issues/1038)) plays player cards like a table would. The engine holds no player cards, so the bot keeps its own hand and applies each card's effect through commands the table already has. This page sorts the cards by what they change on the table and says which of those changes the table can take today.

_Scope:_ the cards the investigators the tester seats can take from the Core Set at level 0: Roland Banks (Guardian and Neutral, Seeker), Daisy Walker (Seeker and Neutral, Mystic) and Wendy Adams (Survivor and Neutral, Rogue), plus their signature assets. Weaknesses are left for later. Source: the ArkhamDB card data ([arkhamdb-json-data](https://github.com/Kamalisk/arkhamdb-json-data), `pack/core/core.json`), used only as analysis input and never committed; the classification script lives in the project's shared file library, outside the repo (`analysis/player_cards/classify.py`).

## Effects in table terms

Each card does one or more of these, including what it costs the investigator (Dynamite Blast hurts everyone at its location, the paid boosts spend resources). "Bot" means the effect only touches the bot's own hand and deck, which the table never sees.

| What the card does                      | Cards | How the table takes it                                                  | Today  |
| --------------------------------------- | ----- | ----------------------------------------------------------------------- | ------ |
| +N to a skill test                      | 28    | `modifier` passed to `suggestSkillTest`, then its pass or fail answered | yes    |
| the investigator takes damage or horror | 5     | `TakeDamageAndHorror`                                                   | yes    |
| spend resources for a boost             | 5     | `SpendResources`                                                        | yes    |
| +1 to a skill while in play             | 3     | `ManualAdjust` `skillBoost`                                             | yes    |
| damage to an enemy                      | 15    | `DamageEnemy`                                                           | yes    |
| discover clues                          | 5     | `DiscoverClues`                                                         | yes    |
| heal damage or horror                   | 3     | `HealInvestigator`                                                      | yes    |
| gain resources                          | 4     | `GainResources`                                                         | yes    |
| evade an enemy                          | 3     | `EvadeEnemy`                                                            | yes    |
| move or disengage                       | 2     | `MoveInvestigator`, `DisengageEnemy`                                    | yes    |
| an extra action                         | 1     | `ManualAdjust` `actions`                                                | yes    |
| draw an encounter card                  | 1     | `DrawEncounter`                                                         | yes    |
| doom on a player card                   | 1     | `AdjustInvestigator` `doomOnPlayerCards`                                | yes    |
| an asset takes damage or horror         | 9     | `HealInvestigator` right after, up to what the asset can take           | approx |
| cancel an attack or a revelation        | 2     | none                                                                    | no     |
| enemies cannot move in or attack        | 1     | none                                                                    | no     |
| draw, search or hold player cards       | 14    | the bot's own hand and deck, nothing on the table                       | bot    |

Of the 29 cards each investigator can take, the table takes every effect of 23 (Roland, Daisy) and 26 (Wendy), and every effect but cancelling and blocking of 27, 27 and 29 when soaking is approximated: an ally or an accessory that would take damage or horror is played as healing the investigator right after, until the card's health and sanity are used up. Only Ward of Protection and Barricade do something the table can't take; the bot leaves them in the deck as cards it never plays. Dodge's cancel is the attack decision's own cancel option.

## Cards

| Code  | Card                  | Class          | Effects                                                                                   | Today        | Taken by             |
| ----- | --------------------- | -------------- | ----------------------------------------------------------------------------------------- | ------------ | -------------------- |
| 01006 | Roland's .38 Special  | neutral asset  | +N to a skill test, damage to an enemy                                                    | yes          | Roland               |
| 01008 | Daisy's Tote Bag      | neutral asset  | draw, search or hold player cards                                                         | yes          | Daisy                |
| 01014 | Wendy's Amulet        | neutral asset  | draw, search or hold player cards                                                         | yes          | Wendy                |
| 01016 | .45 Automatic         | guardian asset | +N to a skill test, damage to an enemy                                                    | yes          | Roland               |
| 01017 | Physical Training     | guardian asset | +N to a skill test, spend resources for a boost                                           | yes          | Roland               |
| 01018 | Beat Cop              | guardian asset | +1 to a skill while in play, damage to an enemy, an asset takes damage or horror          | approximated | Roland               |
| 01019 | First Aid             | guardian asset | heal damage or horror                                                                     | yes          | Roland               |
| 01020 | Machete               | guardian asset | +N to a skill test, damage to an enemy                                                    | yes          | Roland               |
| 01021 | Guard Dog             | guardian asset | an asset takes damage or horror, damage to an enemy                                       | approximated | Roland               |
| 01022 | Evidence!             | guardian event | discover clues                                                                            | yes          | Roland               |
| 01023 | Dodge                 | guardian event | cancel an enemy attack                                                                    | yes          | Roland               |
| 01024 | Dynamite Blast        | guardian event | damage to an enemy, the investigator takes damage or horror                               | yes          | Roland               |
| 01025 | Vicious Blow          | guardian skill | +N to a skill test, damage to an enemy                                                    | yes          | Roland               |
| 01030 | Magnifying Glass      | seeker asset   | +N to a skill test                                                                        | yes          | Roland, Daisy        |
| 01031 | Old Book of Lore      | seeker asset   | draw, search or hold player cards                                                         | yes          | Roland, Daisy        |
| 01032 | Research Librarian    | seeker asset   | draw, search or hold player cards, an asset takes damage or horror                        | approximated | Roland, Daisy        |
| 01033 | Dr. Milan Christopher | seeker asset   | +1 to a skill while in play, gain resources, an asset takes damage or horror              | approximated | Roland, Daisy        |
| 01034 | Hyperawareness        | seeker asset   | +N to a skill test, spend resources for a boost                                           | yes          | Roland, Daisy        |
| 01035 | Medical Texts         | seeker asset   | heal damage or horror, the investigator takes damage or horror                            | yes          | Roland, Daisy        |
| 01036 | Mind over Matter      | seeker event   | +N to a skill test                                                                        | yes          | Roland, Daisy        |
| 01037 | Working a Hunch       | seeker event   | discover clues                                                                            | yes          | Roland, Daisy        |
| 01038 | Barricade             | seeker event   | enemies cannot move in or attack                                                          | no           | Roland, Daisy        |
| 01039 | Deduction             | seeker skill   | +N to a skill test, discover clues                                                        | yes          | Roland, Daisy        |
| 01044 | Switchblade           | rogue asset    | +N to a skill test, damage to an enemy                                                    | yes          | Wendy                |
| 01045 | Burglary              | rogue asset    | gain resources                                                                            | yes          | Wendy                |
| 01046 | Pickpocketing         | rogue asset    | draw, search or hold player cards                                                         | yes          | Wendy                |
| 01047 | .41 Derringer         | rogue asset    | +N to a skill test, damage to an enemy                                                    | yes          | Wendy                |
| 01048 | Leo De Luca           | rogue asset    | an extra action, an asset takes damage or horror                                          | approximated | Wendy                |
| 01049 | Hard Knocks           | rogue asset    | +N to a skill test, spend resources for a boost                                           | yes          | Wendy                |
| 01050 | Elusive               | rogue event    | move or disengage                                                                         | yes          | Wendy                |
| 01051 | Backstab              | rogue event    | +N to a skill test, damage to an enemy                                                    | yes          | Wendy                |
| 01052 | Sneak Attack          | rogue event    | damage to an enemy                                                                        | yes          | Wendy                |
| 01053 | Opportunist           | rogue skill    | +N to a skill test, draw, search or hold player cards                                     | yes          | Wendy                |
| 01058 | Forbidden Knowledge   | mystic asset   | gain resources, the investigator takes damage or horror                                   | yes          | Daisy                |
| 01059 | Holy Rosary           | mystic asset   | +1 to a skill while in play, an asset takes damage or horror                              | approximated | Daisy                |
| 01060 | Shrivelling           | mystic asset   | +N to a skill test, damage to an enemy, the investigator takes damage or horror           | yes          | Daisy                |
| 01061 | Scrying               | mystic asset   | draw, search or hold player cards                                                         | yes          | Daisy                |
| 01062 | Arcane Studies        | mystic asset   | +N to a skill test, spend resources for a boost                                           | yes          | Daisy                |
| 01063 | Arcane Initiate       | mystic asset   | draw, search or hold player cards, doom on a player card, an asset takes damage or horror | approximated | Daisy                |
| 01064 | Drawn to the Flame    | mystic event   | draw an encounter card, discover clues                                                    | yes          | Daisy                |
| 01065 | Ward of Protection    | mystic event   | cancel a non-weakness treachery's revelation, take 1 horror                               | no           | Daisy                |
| 01066 | Blinding Light        | mystic event   | evade an enemy, damage to an enemy, the investigator takes damage or horror               | yes          | Daisy                |
| 01067 | Fearless              | mystic skill   | +N to a skill test, heal damage or horror                                                 | yes          | Daisy                |
| 01072 | Leather Coat          | survivor asset | an asset takes damage or horror                                                           | approximated | Wendy                |
| 01073 | Scavenging            | survivor asset | draw, search or hold player cards                                                         | yes          | Wendy                |
| 01074 | Baseball Bat          | survivor asset | +N to a skill test, damage to an enemy                                                    | yes          | Wendy                |
| 01075 | Rabbit's Foot         | survivor asset | draw, search or hold player cards                                                         | yes          | Wendy                |
| 01076 | Stray Cat             | survivor asset | evade an enemy, an asset takes damage or horror                                           | approximated | Wendy                |
| 01077 | Dig Deep              | survivor asset | +N to a skill test, spend resources for a boost                                           | yes          | Wendy                |
| 01078 | Cunning Distraction   | survivor event | evade an enemy                                                                            | yes          | Wendy                |
| 01079 | "Look what I found!"  | survivor event | discover clues                                                                            | yes          | Wendy                |
| 01080 | Lucky!                | survivor event | +N to a skill test                                                                        | yes          | Wendy                |
| 01081 | Survival Instinct     | survivor skill | +N to a skill test, move or disengage                                                     | yes          | Wendy                |
| 01086 | Knife                 | neutral asset  | +N to a skill test, damage to an enemy                                                    | yes          | Roland, Daisy, Wendy |
| 01087 | Flashlight            | neutral asset  | +N to a skill test                                                                        | yes          | Roland, Daisy, Wendy |
| 01088 | Emergency Cache       | neutral event  | gain resources                                                                            | yes          | Roland, Daisy, Wendy |
| 01089 | Guts                  | neutral skill  | +N to a skill test, draw, search or hold player cards                                     | yes          | Roland, Daisy, Wendy |
| 01090 | Perception            | neutral skill  | +N to a skill test, draw, search or hold player cards                                     | yes          | Roland, Daisy, Wendy |
| 01091 | Overpower             | neutral skill  | +N to a skill test, draw, search or hold player cards                                     | yes          | Roland, Daisy, Wendy |
| 01092 | Manual Dexterity      | neutral skill  | +N to a skill test, draw, search or hold player cards                                     | yes          | Roland, Daisy, Wendy |
| 01093 | Unexpected Courage    | neutral skill  | +N to a skill test                                                                        | yes          | Roland, Daisy, Wendy |

## The deck bot

Built in [`deck_bot.ts`](../packages/play_tester/src/deck_bot.ts) with the cards in [`player_cards.ts`](../packages/play_tester/src/player_cards.ts); how it plays is on the [play tester page](architecture/play-tester.md#the-deck-bot).

- **Deck:** 30 cards drawn from the cards above an investigator can take (two copies each at most) plus the signature asset, shuffled with the bot seed; a blank investigator takes Neutral cards. Each card's cost, class, skill icons, health, sanity and effects are entered by hand per card code, with no card text, as the test scenario's cards are.
- **Goal:** advance the act fastest. Of the cards it can pay for and whose effect fits the board, it plays the one that does most for the act: clues and intellect boosts while the location has clues, then an extra action, then resources when it runs low, then cards against an engaged enemy, then healing when near defeat. Skill cards go up to two to an investigation or a fight, one to any other test.
- **Cancelling:** an enemy attack's decision already has a cancel option, so the bot answers it with Dodge when it holds one and can pay. Cancelling a treachery's revelation (Ward of Protection) needs the engine first (#1099).
