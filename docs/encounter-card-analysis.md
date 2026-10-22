# Encounter card analysis

What the scenario cards ask of the engine beyond the generic rules in [rules.md](rules.md), and the plan to support it. Written from every Chapter Two encounter card, read one by one, plus a pattern survey of all Chapter One encounter cards. Keyword and token rules are stated in [rules.md](rules.md); this document only says which cards need them. Progress is tracked in the [task files](tasks/), not here.

## Source and method

- **Data:** [arkhamdb-json-data](https://github.com/Kamalisk/arkhamdb-json-data) at commit `6f4760e` (2026-10-14), the repository ArkhamDB itself is built from. It was cloned and read by a throwaway script for this analysis only; the app keeps fetching from the ArkhamDB API, and nothing from it is committed.
- **Chapter Two, read card by card:** all 211 encounter cards of the two products marked `chapter: 2` in `packs.json`: the Core Set (2026) (`core_2026`, 92 cards, scenarios _Spreading Flames_, _Smoke and Mirrors_, _Queen of Ash_) and Children of Blood (`cob`, 119 cards, _River of Blood_, _New Horizons_, _Blood Money_). Rules for new Children of Blood mechanics come from its [campaign guide](https://images-cdn.fantasyflightgames.com/filer_public/a8/9c/a89c98b9-9de4-4b6c-8110-80fedbdcdb60/ahc106_campaign_guide-web.pdf).
- **Chapter One, surveyed:** 3,853 encounter cards from 145 scenarios, counted by regular expressions over the rules text (keywords, trigger windows, effect phrases). The counts rank how often a mechanic recurs; they are not exact.
- **Coverage, all cards:** "Coverage by rule" re-reads both chapters at commit `5f633d3` (2026-10-19) with one regular expression per rule, and marks each as covered by the engine of 2026-10-22 (after P1 slice 5c2), planned or a gap. Reprints (`duplicate_of`) are left out.
- **Not in the data:** location connection symbols, scenario setup, codex entries and resolutions. These live on the card images and in the campaign guides (see "Data gaps").

## At a glance

1. **The plan covers about 60 % of Chapter Two.** 12 of 211 cards (6 %) run fully today; after the plan 130 (62 %) do. Six gaps outside the plan hold back most of the rest (see "Not covered yet").
2. **Most of the work is generic.** About two dozen generic primitives (below) cover nearly every Chapter Two card. The truly one-off effects are mostly agenda and act reverse sides, which are scenario hooks already.
3. **Two new keywords, plus Elusive:** _Doomed_ (Core Set (2026)) and _Predator_ (Children of Blood) are new; _Elusive_ comes from Chapter One and is common in Chapter Two. The engine parses none of them yet.
4. **Skill tests need the margin.** 11 Chapter Two cards (and about 170 Chapter One cards) scale with "for each point you fail by" or "succeed by 2 or more", but a skill test answer is only pass or fail.
5. **Locations carry state.** Attachments that change a location (Fire!, Arcane Lock, Flash Flood), extra costs to enter or leave, connections defined in text, and location _versions_ chosen by difficulty or time of day.
6. **Players' cards stay physical, so many effects are reminders.** Many forced effects hit hands, decks or assets the app does not track. A generic "timing window reminder" covers them all without card scripts.
7. **Children of Blood adds a chaos bag economy:** blood tokens added to the bag and sealed on investigators (max 3 each, 12 in total), read by prey, test difficulty and the reference card.

## Support tiers

Each special case is put in one tier. The tier decides how much code a card needs. The names match the per-game automation level planned in [M7](tasks/M7-expansion.md) (display / assist / auto).

- **Auto** – The engine applies the effect. When: It only touches state the app tracks: doom, clues, enemies, locations, encounter deck, damage and horror, actions, resources.
- **Assist** – The engine raises a decision with prefilled options and applies the answer. When: The effect needs a choice or a test result, but its outcome is tracked state.
- **Display** – The app shows the card text at the right moment; players resolve it. When: It hits hands, decks, assets or other player cards (out of scope, see [product.md](product.md)).

## Coverage by rule

Every encounter card in the data (4,064: 211 Chapter Two, 3,853 Chapter One) sorted into the rule patterns its text uses. A card counts once in each pattern it matches, so the rows don't add up to the card total. Chapter Two rows were checked card by card; Chapter One counts come from the same regular expressions unchecked, so read them as ±10 %.

**Status** says how far the engine is today:

- **Covered** – the rule runs today, or card data can write the effect as an ability ([architecture.md](architecture.md), "Triggers and card effects").
- **Command** – the engine has the command, but `AbilityCommand` doesn't list it yet, so card data can't use it. Adding it is one line.
- **Plan N** – step N of the [implementation plan](#implementation-plan) below; **M4.5** is a task in [M4](tasks/M4-scenario-data-first-scenario.md).
- **Reminder** – display tier: the app shows the text in its timing window (plan step 3), players resolve it.
- **Gap** – no plan step yet; listed under [Not covered yet](#not-covered-yet).

### Cards per scenario card type

A card is "covered today" when every pattern it matches is covered, "after the plan" when none is a gap.

| Type                   | Ch. 2 cards | Covered today | After the plan | Ch. 1 after the plan  |
| ---------------------- | ----------- | ------------- | -------------- | --------------------- |
| Treachery              | 44          | 3             | 16             | 226 of 607            |
| Enemy                  | 49          | 3             | 32             | 314 of 630            |
| Location               | 68          | 2             | 50             | 728 of 1,229          |
| Agenda                 | 20          | 4             | 14             | 149 of 316            |
| Act                    | 15          | 0             | 4              | 88 of 367             |
| Scenario reference     | 6           | 0             | 5              | 48 of 146             |
| Story asset            | 9           | 0             | 9              | 289 of 290            |
| All (incl. story, key) | 211         | 12 (6 %)      | 130 (62 %)     | 1,949 of 3,853 (51 %) |

The plan lifts Chapter Two from 6 % to 62 %. Almost every card left over needs one of six gaps: a choice between two costs, "nearest" queries, enemy healing, placing clues, objective conditions and a test difficulty read from the board.

### Keywords

The keyword rules are in [rules.md](rules.md#enemy-keywords).

| Rule                                                            | Ch. 2 | Ch. 1 | Status  |
| --------------------------------------------------------------- | ----- | ----- | ------- |
| Hunter                                                          | 26    | 321   | Covered |
| Retaliate                                                       | 17    | 175   | Covered |
| Alert                                                           | 5     | 71    | Covered |
| Aloof                                                           | 8     | 154   | Covered |
| Massive                                                         | 5     | 97    | Covered |
| Surge, printed                                                  | 1     | 34    | Covered |
| Surge gained by a condition                                     | 6     | 108   | Plan 7  |
| Peril                                                           | 3     | 108   | Covered |
| Spawn at a named location                                       | 0     | 70    | Covered |
| Spawn with a filter ("any empty [[Arkham]] location")           | 4     | 104   | Plan 2  |
| Prey: lowest health or sanity, most clues or resources          | 2     | 12    | Covered |
| Prey: a skill or another counter ("lowest [agility]")           | 1     | 46    | Plan 2  |
| Prey: most sealed blood tokens                                  | 5     | 0     | Plan 13 |
| Prey: anything else (bearer, named investigator, cards in hand) | 0     | 36    | Gap     |
| Patrol                                                          | 4     | 65    | Plan 12 |
| Elusive                                                         | 11    | 21    | Plan 5  |
| Doomed                                                          | 6     | 0     | Plan 5  |
| Predator                                                        | 13    | 6     | Plan 14 |
| Victory X                                                       | 58    | 707   | Covered |
| Health per investigator, printed                                | 3     | 84    | Covered |
| Health "+N per investigator" on a printed value                 | 14    | 83    | Plan 2  |
| Vengeance X                                                     | 0     | 20    | Gap     |
| Swarming, Hidden, Haunted, Concealed, Veiled                    | 0     | 217   | Gap     |

### Revelations and threat area

| Rule                                                             | Ch. 2 | Ch. 1 | Status                                       |
| ---------------------------------------------------------------- | ----- | ----- | -------------------------------------------- |
| Take damage or horror (direct included)                          | 33    | 670   | Covered                                      |
| Lose or gain resources                                           | 9     | 140   | Covered                                      |
| Skill test with a printed difficulty                             | 41    | 531   | Covered                                      |
| Skill test whose difficulty is X or grows with the board         | 8     | 121   | Gap                                          |
| Test one of two skills ("[willpower] or [intellect]")            | 5     | 83    | Gap                                          |
| Skill test margin ("for each point you fail by", "by 2 or more") | 11    | 169   | Plan 4                                       |
| Choose one of two costs ("you must either …")                    | 18    | 393   | Gap                                          |
| Put into your threat area                                        | 7     | 116   | Covered                                      |
| At the end of your turn (threat area)                            | 0     | 41    | Covered                                      |
| At the end of the round                                          | 5     | 147   | Covered                                      |
| When or after your turn begins                                   | 1     | 28    | Plan 3                                       |
| Limit 1 per location / per investigator                          | 5     | 22    | Covered per location; per investigator a gap |
| Lose actions                                                     | 4     | 73    | Command (`AdjustActions`)                    |
| Heal damage or horror                                            | 11    | 127   | Covered for investigators; enemies a gap     |

### Player cards

Players' cards stay physical, so these are reminders in every case.

| Rule                                       | Ch. 2 | Ch. 1 | Status                 |
| ------------------------------------------ | ----- | ----- | ---------------------- |
| Hand: discard, draw, reveal                | 17    | 333   | Reminder               |
| Deck: discard, search, shuffle             | 4     | 102   | Reminder               |
| Assets, allies, events, skills             | 29    | 567   | Reminder               |
| Story assets and rewards in encounter sets | 9     | 299   | Reminder               |
| Weaknesses added to decks                  | 3     | 120   | Reminder               |
| Trauma, killed, insane                     | 1     | 85    | Covered (campaign log) |

### Modifiers and constant abilities

| Rule                                                       | Ch. 2 | Ch. 1 | Status                                                          |
| ---------------------------------------------------------- | ----- | ----- | --------------------------------------------------------------- |
| Shroud modifier                                            | 3     | 118   | Covered from attachments; conditions Plan 7                     |
| "Cannot" restrictions                                      | 11    | 497   | Enemies Plan 12, entry rules Plan 16; player-side ones Reminder |
| Enemy stat modifier ("+1 fight", "deals +1 damage")        | 3     | 142   | Gap                                                             |
| Skill modifier on investigators ("you get -1 [willpower]") | 2     | 44    | Gap                                                             |
| X from the board in constant text, skill swaps             | 3     | 173   | Gap (reference cards: Covered)                                  |
| Blank or ignore text, keywords or tokens                   | 0     | 65    | Gap                                                             |

### Doom, clues and the encounter deck

| Rule                                                             | Ch. 2 | Ch. 1 | Status                                    |
| ---------------------------------------------------------------- | ----- | ----- | ----------------------------------------- |
| Place doom on the agenda, the card itself or an enemy            | 14    | 270   | Covered                                   |
| Doom read from the board ("enemy with no doom", "for each doom") | 3     | 71    | Gap                                       |
| Remove doom                                                      | 0     | 47    | Gap                                       |
| Discover clues                                                   | 1     | 38    | Command (`DiscoverClues`)                 |
| Place clues from the pool on locations, enemies or acts          | 10    | 170   | Gap                                       |
| Spend clues, as a group or per investigator                      | 22    | 377   | Plan 6                                    |
| Draw the top encounter card                                      | 15    | 180   | Covered                                   |
| Search the encounter deck or discard for a card                  | 10    | 156   | Draw-until Covered; by name M4.5          |
| Shuffle into the encounter deck                                  | 6     | 168   | Discard: Covered; a card in play: Command |
| Discard the top N encounter cards                                | 0     | 27    | Gap                                       |
| Set aside, put set-aside cards into play                         | 26    | 477   | Covered                                   |
| Remove from the game                                             | 6     | 160   | Covered                                   |

### Enemies

| Rule                                               | Ch. 2 | Ch. 1 | Status                                                 |
| -------------------------------------------------- | ----- | ----- | ------------------------------------------------------ |
| Engage, disengage, exhaust, ready                  | 30    | 384   | Rules Covered; as an effect Command                    |
| Spawn a set-aside or found enemy                   | 12    | 236   | Covered                                                |
| Attacks outside the enemy phase ("it attacks you") | 8     | 185   | Command (`DealEnemyAttack`)                            |
| Damage dealt to an enemy by an effect              | 4     | 72    | Command (`DamageEnemy`)                                |
| Moves toward a target, or one step                 | 16    | 111   | Plan 12                                                |
| "Nearest" board queries                            | 16    | 244   | Gap                                                    |
| Values "per investigator" in text                  | 37    | 489   | Health Plan 2, clue costs Plan 6; the rest a gap       |
| Effects when the enemy is defeated                 | 14    | 242   | Agenda and act windows Covered; the enemy's own Plan 9 |

### Locations and movement

| Rule                                      | Ch. 2 | Ch. 1 | Status                                                |
| ----------------------------------------- | ----- | ----- | ----------------------------------------------------- |
| Reveal or flip a location                 | 4     | 417   | Covered                                               |
| Move investigators by an effect           | 9     | 163   | Covered                                               |
| Resign                                    | 13    | 143   | Covered                                               |
| Treachery attached to a location          | 2     | 61    | Your location Covered; nearest Plan 7                 |
| Attach to an enemy, asset or act          | 2     | 22    | Gap                                                   |
| Extra cost to enter, leave or investigate | 10    | 94    | Plan 10                                               |
| Connections written in text               | 5     | 214   | Plan 10                                               |
| After you enter or leave a location       | 5     | 159   | Plan 3                                                |
| Several versions of one location          | 5     | 59    | Plan 15                                               |
| Location leaves play or is replaced       | 4     | 155   | `MoveCard` Covered; with tokens and attachments a gap |

### Abilities players trigger

| Rule                                           | Ch. 2 | Ch. 1 | Status |
| ---------------------------------------------- | ----- | ----- | ------ |
| [action] ability on a scenario card            | 56    | 873   | Plan 6 |
| [fast] ability                                 | 13    | 257   | Plan 6 |
| [reaction] ability                             | 11    | 152   | Plan 6 |
| Parley                                         | 13    | 178   | Plan 6 |
| Ability limits ("once per round", group limit) | 22    | 333   | Plan 6 |

### Forced effects and timing windows

| Rule                                                          | Ch. 2 | Ch. 1 | Status                                               |
| ------------------------------------------------------------- | ----- | ----- | ---------------------------------------------------- |
| When revealed or drawn                                        | 44    | 697   | Covered                                              |
| At a phase's start or end                                     | 8     | 115   | Plan 3                                               |
| After clues are discovered                                    | 15    | 74    | Plan 3                                               |
| After a test, investigation, fight or evade succeeds or fails | 14    | 170   | Plan 3                                               |
| When doom is placed                                           | 2     | 32    | Covered (`afterDoomPlaced`); "would advance" Plan 11 |
| Replacement effect ("would … instead")                        | 2     | 64    | Plan 11                                              |

### Agendas, acts and scenario flow

| Rule                                                   | Ch. 2 | Ch. 1 | Status                            |
| ------------------------------------------------------ | ----- | ----- | --------------------------------- |
| Objective: spend clues to advance                      | 3     | 81    | Covered                           |
| Objective: an enemy is defeated                        | 6     | 83    | Covered                           |
| Objective: any other condition                         | 10    | 221   | Gap                               |
| Resolution jump (→R)                                   | 14    | 243   | Covered                           |
| Victory display read or written                        | 11    | 249   | Covered                           |
| Codex entry, "check your Campaign Log"                 | 13    | 309   | Plan 9                            |
| "Remember that …" records                              | 4     | 162   | Plan 16                           |
| Cards beneath or under other cards                     | 11    | 117   | Plan 8                            |
| Agenda or act deck changes (flip back, reset, replace) | 1     | 200   | Act reset Plan 17; the rest a gap |

### Chaos bag and tokens

| Rule                                                 | Ch. 2 | Ch. 1 | Status      |
| ---------------------------------------------------- | ----- | ----- | ----------- |
| Symbol token values on reference cards               | 6     | 108   | Covered     |
| Blood tokens                                         | 36    | 0     | Plan 13     |
| Snares, reference-card damage, "keys" records        | 12    | 0     | Plan 16, 17 |
| Other scenario tokens (keys, seals, flood, breaches) | 0     | 409   | Gap         |
| Add, remove or seal other chaos tokens               | 1     | 111   | Gap         |

## Not covered yet

The gaps from the tables above, ranked by the Chapter Two cards that need them. "Only gap" counts cards that need nothing else outside the plan, so closing the gap finishes them. Most already have a primitive in "Special cases by mechanic"; none has a plan step.

1. **Choose one of two costs** – 18 Ch. 2 cards (13 only gap), 393 Ch. 1. Cosmic Evils 12124, Unnatural Decay 12191, Ashen Rebirth 12176, Mutated! 12131, Blood Moon 13101, Of the Night 13106, Nowhere to Hide 13107, the margin cards Forbidden Secrets 12126, Wild Compulsion 12128, Downpour 12158, Misinformation 13108; Main Street 13015, Factory Floor 13044/13045, Howard Wilkes 13084. Decisions already carry commands per option; card data needs a `chooseOne(…branches)` effect that raises one. A branch that hits player cards is a reminder option.
2. **"Nearest" queries** – 16 (11), 244. Fire! 12129, Aerial Pursuit 12163, Raising Suspicions 12160, Dark Magician 12189, Unnatural Strength 13098, Sanguine Rebirth 13092, Morbid Rituals 13114, Main Street 13015, Julia Stern's patrol 13024–13026, agendas 13002, 13004, 13033. A board query "nearest card matching …" with ties as a decision; Fire! (Plan 7) and Patrol (Plan 12) need it first, so it belongs at the start of step 7.
3. **Enemy healing** – 11 (10), 127. Zburamoarte 13058–13060, Spawn of Zburamoarte 13097, Night Feeder 13110, Herald of Flame 12178, agenda 13003, act 12110. A negative `DamageEnemy` (or `HealEnemy`) as an ability effect, plus an "after it deals damage / attacks" window.
4. **Place clues from the token pool** – 10 (7), 170. Hidden Laboratory 13052/13055, Locked Chamber 13053/13056, Foyer 13076 ("up to its clue threshold"), Abigail Foreman 12143, Elokoss 12179, Loading Dock 13042, act 13037. A `PlaceClues` command on any card, with an "up to threshold" option.
5. **Objective conditions** – 10 (5), 221. Enters play (13006), leaves play (13007), an investigator enters a location (12172, 13074), all undefeated investigators at a location (12110), every survivor resigned (13036–13038), a card not in play at round end (13073), a count reached (12136). New timing windows (enter location, enemy enters / leaves play) plus a condition check at round end.
6. **Test difficulty from the board** – 8 (5), 121. Mutated! 12131, Red Herring 12161, Grisly Compulsion 13100, Abigail Foreman 12143, Secret Chamber 13057, Javier Rivera 13061, Loading Dock 13047, Sgt. Earl Monroe 12142; hand size (Extraplanar Visions 12127) is entered by players. Difficulty as a `ScaledValue`-like expression read when the test is raised.
7. **Limit 1 per investigator** – 5 (4), 22. Unspeakable Truths 12125, Languor 12193, Echoing in Darkness 13065, The Blood Blight 13118. The per-location check of `LocationAttachment.onePerLocation` applied to threat areas.
8. **Test one of two skills** – 5 (2), 83. Arcane Lock 12157, Noxious Smoke 12130, Sluice Control 12175, Extraplanar Visions 12127, act 13075. `skillTest` with a list of skills, the investigator picks.
9. **Constant modifiers** – enemy stats 3 (2), 142: Dining Hall 13077, Unnatural Strength 13098, Zburamoarte's Lair 13051; investigator skills 2 (2), 44: Whippoorwill 12166, Blighted Blood 13099. Feed the skill test suggestion from the board (architecture review P3, constant abilities).
10. **Location leaves play with its tokens and attachments** – 4 (2), 155. Manager's Office 13041, act 12110, agendas 12170, 13072. `MoveCard` plus moving everyone at it first.
11. **Doom read from the board** – 3 (1), 71. "Enemy with no doom on it" (Raising Suspicions 12160, Dark Magician 12189, Blasphemous Invocation 12190). A filter on the nearest query (gap 2).
12. **Attach to an enemy** – 2 (0), 22. Unnatural Strength 13098, Sanguine Rebirth 13092; both also need gaps 2 and 9.

Chapter One only, no Chapter Two card yet: the keywords Swarming, Hidden, Haunted, Concealed, Veiled (217), Vengeance (20) and prey on a named investigator or bearer (36); scenario tokens such as keys, seals, flood levels and breaches (409); agenda and act decks that flip back or swap (200); blanking text (65); removing doom (47); discarding the top N encounter cards (27). They wait until a Chapter Two product prints them.

## Special cases by mechanic

Cards are named with their code. "Primitive" names the generic building block proposed for it; the plan below orders them.

### Locations

- **Treachery attaches to a location and changes it: +4 shroud, extra action to enter or leave, damage at phase end** – Cards: Fire! 12129, Arcane Lock 12157, Flash Flood 12159. Primitive: **location modifiers** from attachments (shroud delta, enter/leave cost). Tier: auto
- **Shroud changes with what is there: +1 while enemies are present, +1 from an enemy's aura** – Cards: Garrison Street (Dusk) 13011, Factory Worker 13063. Primitive: location modifiers from conditions and from enemies. Tier: auto
- **Extra cost to enter: actions, or clues per investigator as a group; some only on the unrevealed side** – Cards: Arcane Lock, Underground Cistern 12174 back, Sluice Control 12175 back, Side Chamber 13052–13054 back, Master Bedroom 13079 back, Unvisited Isle 13018 (leave). Primitive: **movement cost** on location sides, checked by `MoveInvestigator`. Tier: assist (group spends clues)
- **Extra action to investigate** – Cards: Waterfront District 12152. Primitive: investigate cost. Tier: auto
- **Entry forbidden unless a scenario record is set** – Cards: Manager's Office 13041/13046 back. Primitive: movement condition on a scenario record. Tier: auto
- **Connections written in text: "connected to each Sewer Tunnels", "connected while enemies are moving", "connected for the rest of the game"** – Cards: Sewer Culvert 12182, Unvisited Isle 13018 back, River Docks 13012. Primitive: **text connections** by name or trait, an enemy-only flag, `AddConnection` at runtime. Tier: auto
- **Several versions of one location; setup picks one at random or by difficulty / day and night** – Cards: Downtown, Uptown, Miskatonic University 12145–12156; Sewer Tunnels ×5 12183–12187; Dawn/Dusk 13008–13023; Day/Night 13039–13048; Side Chamber ×3. Primitive: setup step `chooseVersion(by: random \. Tier: difficulty \
- **Location leaves play: removed with its tokens and attachments, added to the victory display, or replaced** – Cards: Your Friend's Room (act 12110), Manager's Office, Waterfront Warehouse 13020, Back Alley 13022. Primitive: `MoveCard` exists; add "with tokens and attachments" and move everyone at it first. Tier: auto
- **Clues placed "up to its clue value / threshold", on locations "without victory X"** – Cards: Underground Cistern, acts 13006, 13073, 13074, Foyer 13076. Primitive: clue refill helper on the board. Tier: auto
- **Forced effect when revealed: spawn set-aside enemy, put set-aside locations into play** – Cards: Cavern Entrance 13049, Zburamoarte's Lair 13051, Secret Chamber 13054/13057. Primitive: a `revealed` card ability (exists). Tier: auto
- **Constant aura on enemies at the location (+1 fight, -1 evade)** – Cards: Dining Hall 13077. Primitive: enemy stat modifiers from location. Tier: assist (feeds the skill test suggestion)
- **First treachery drawn here each mythos phase gains surge** – Cards: Master Bedroom 13079. Primitive: conditional surge with a per-phase counter. Tier: auto
- **"Central" trait** – Cards: Miskatonic Quad, Merchant District, Sewer Culvert, Erwin Bridge, Cavern Entrance. Primitive: none: only read by their own abilities. Tier: display

### Timing windows on locations and threat-area cards

Forced effects fire at a fixed moment. Where the effect touches tracked state it is a trigger hook; otherwise the same window shows a reminder.

- **After you enter** – Cards: Sewer Tunnels: Infested Pipes 12183 (discard until enemy, draw it), Overgrown Tunnels 12184 (lose 1 action). Effect touches: encounter deck, actions. Tier: auto
- **When you end your turn here** – Cards: Flooded Crypt 12185 (horror), Toxic Waste Pit 12187 (discard from hand), Smuggler's Cache 12186 (reaction: resource). Effect touches: horror / hand / resources. Tier: auto, display, assist
- **After clues are discovered here / the last clue** – Cards: Science Hall 12118, Water Street (Dusk) 13009, Main Street (Dusk) 13015, Factory Floors 13039–13045, Kitchen 13080, Office 13081. Effect touches: doom, encounter draw, horror, resources, hand. Tier: mixed
- **After a failed investigation / fight / evade here** – Cards: Study 13078, Erwin Bridge 13016/13017. Effect touches: encounter draw; test, damage, disengage, move. Tier: auto, assist
- **When the investigation phase ends** – Cards: Fire!, Miskatonic University (In Flames) 12155, Underground Cistern. Effect touches: direct damage to "cards with health" (investigators, enemies, allies), discard cultists and place doom. Tier: auto for enemies and investigators, display for allies
- **When / after your turn begins or ends (threat area)** – Cards: Mark of Elokoss 12137, Languor 12193, Frenzied Hunger 13094. Effect touches: damage to assets, top card of deck, extra action cost. Tier: display (Frenzied Hunger: assist test)
- **After you discover clues / after an enemy engages you / after another treachery (threat area)** – Cards: Unspeakable Truths 12125, Voices in the Night 13116, Echoing in Darkness 13065. Effect touches: horror, enemy attack, encounter draw. Tier: auto

The engine had `turnEndTest` and `discardAtRoundEnd` as card flags; they are now the `turnEnds` and `roundEnds` windows of card abilities (P1 slice 3). Generalising these into a **timing window** list (enter location, end turn at location, turn begins, discover clues, failed test at location, phase ends, round ends, enemy engages, treachery resolved) gives one place to hang both hooks and reminders.

### Abilities on scenario cards

Players trigger these with their own actions, so the app needs a way to activate them. M4.5 plans a `ScenarioAction` for Parley; it should be the general shape.

- **Parley on an agenda or enemy: test, then discard / set aside / codex** – Cards: Agendas 12106–12108; David Renfield to Margaret Liu 12139–12144; Waterfront Civilian 13027; Javier Rivera 13061; Factory Worker 13063; act 13075. Primitive: **scenario action**: cost, condition, skill test, effect commands
- **Resign on a location, agenda or act; or gained mid-game** – Cards: Blaze of Glory 12112, Arkham Alive 12134, Sewer Culvert 12182, Loading Dock 13042/13047, Foyer 13076. Primitive: `Resign` exists; action availability from card text or a "gains" record
- **Spend clues or resources, as a group, per investigator** – Cards: acts 12112, 12136, 12173, 13006, 13007; Elokoss 12179; River Docks 13012; Cavern Entrance 13050; Locked Chamber 13053; Zburamoarte's Lair 13051. Primitive: group payment decision (who pays how many)
- **Ability limits: once per game, per round, per phase, per turn; group limits** – Cards: 28 Chapter Two cards. Primitive: **ability usage record** in state, cleared by the matching phase step
- **Ability with a tracked outcome: discover a clue anywhere, move everyone and add to victory, place a clue on the act, three chained tests to defeat an enemy, an automatic fight** – Cards: Northside 12149, Waterfront Warehouse, Back Alley, Hidden Laboratory 13052, Balcony 13082, Zburamoarte's Lair, Sluice Control 12175. Primitive: scenario action effects
- **Ability with only player-side outcome: draw cards, heal, search your deck** – Cards: Orne Library 12120, Dormitories 12117, St. Mary's 12147, Magick Shoppe 12148, Southside 12153, Water Street (Dawn) 13008. Primitive: display (show the ability; heal is tracked and can be assisted)

### Enemies

- **Health "+N per investigator" on top of a printed value** – Cards: Elokoss 12179, Julia Stern 13024–13026, Zburamoarte 13058–13060, Howard Wilkes 13084–13086. Primitive: parse into `ScaledValue` (fixed + per investigator); today only "health per investigator" is read. Tier: auto
- **Cannot move, cannot attack of opportunity, cannot be damaged while at a Fire! location** – Cards: Elokoss, Zburamoarte, agendas 12169/12170. Primitive: **enemy restrictions** read by hunters, AoO and `DamageEnemy`. Tier: auto
- **Damage replacement: remove a snare instead, else no damage** – Cards: Julia Stern (River of Blood). Primitive: snare counter (`resource` tokens on her) and a damage hook. Tier: auto
- **Reacts to its own damage: ready, damage others, damage another enemy, discard an attachment** – Cards: Queen's Knight 12177, Howard Wilkes, Unnatural Strength 13098. Primitive: trigger on `EnemyDamaged`. Tier: auto / assist
- **Heals after dealing damage or attacking** – Cards: Zburamoarte, Spawn of Zburamoarte 13097, Night Feeder 13110, Herald of Flame 12178. Primitive: trigger on attack resolved. Tier: auto
- **Places doom on itself or the nearest enemy without doom; doom counts toward the threshold** – Cards: Zealot 12188, Dark Magician 12189, Sanguine Cultist 13112, Blood-Crazed Zealot 13113. Primitive: `PlaceDoom` on enemies (doom count already includes them). Tier: auto
- **Reacts to clues discovered anywhere: ready, or disengage and move toward that location** – Cards: Night Watchman 13062. Primitive: trigger on `CluesDiscovered` + "move toward". Tier: auto
- **Enemy vs enemy: deal damage to each other at phase end** – Cards: Julia Stern (Blood Money) 13087–13089. Primitive: trigger at enemy phase end. Tier: auto
- **Lowers investigators' skills or raises test difficulty at its location** – Cards: Whippoorwill 12166, Javier Rivera 13061. Primitive: skill modifier sources for the suggestion. Tier: assist
- **After it engages / attacks: lose a resource or attack; discard an asset; seal a blood token** – Cards: Rogue Gangster 12164, Hellhound 12122, Blighted Worker 13064. Primitive: triggers; asset part is a reminder. Tier: auto / display
- **Defeated: codex entry, removed from the game, or spawns a replacement** – Cards: Servant of Flame 12138/12180, Priscilla Thomas 13083, Sanguine Rebirth 13092, agenda 13072. Primitive: the `enemyDefeated` window (exists for the current agenda and act) with codex reminders. Tier: auto / display
- **Spawn variants: exhausted, engaged with "the investigator with the most clues", "at the location nearest the most investigators", "at a different location with no investigators, if able"** – Cards: agendas 13032, 13033, 13069, 13070; locations 13054. Primitive: spawn options on `SpawnEnemy`. Tier: auto / assist
- **Search all in-play and out-of-play areas for an enemy, heal it and set it aside** – Cards: act 12110. Primitive: `MoveCard` from any zone + heal. Tier: auto
- **Double-sided enemy flipped mid-game, keeping damage and attachments** – Cards: Elokoss 12179 / 12179b. Primitive: flip a card instance to its linked code. Tier: auto

### Treacheries

- **"For each point you fail by", "fail by 2 or more", "succeed by 2 or more"** – Cards: Forbidden Secrets 12126, Wild Compulsion 12128, Noxious Smoke 12130, Downpour 12158, Blasphemous Invocation 12190, Misinformation 13108, Rotting Remains 13096, Grasping Hands 13104; reference cards 12105; Dining Hall; Margaret Liu. Primitive: **skill test margin** in the answer (players enter it, the suggestion pre-computes it). Tier: assist
- **Difficulty X from board state: damage on you, clues you control, enemy at your location, sealed blood tokens, clues on a location, ready enemies; or from your hand size** – Cards: Eager for Death 12167, Red Herring 12161, Mutated! 12131, Grisly Compulsion 13100, Abigail Foreman 12143, Secret Chamber 13057; Extraplanar Visions 12127. Primitive: difficulty as a function of state (hand size entered by players). Tier: assist
- **Choose one of two costs** – Cards: Cosmic Evils 12124, Unnatural Decay 12191, Ashen Rebirth 12176, Of the Night 13106, Nowhere to Hide 13107, Blood Moon 13101. Primitive: decision with one option per branch. Tier: assist
- **Conditional surge** – Cards: Forbidden Secrets, Raising Suspicions 12160, Cosmic Evils, Frenzied Hunger, Unnatural Strength. Primitive: revelation result says "surge". Tier: auto
- **Limit 1 per investigator / per location** – Cards: Unspeakable Truths, Languor, Echoing in Darkness, Arcane Lock. Primitive: placement check; surge or discard if over. Tier: auto
- **Attach to the nearest enemy of a trait, or search the deck for one first** – Cards: Sanguine Rebirth, Unnatural Strength. Primitive: "nearest … with trait" query + search. Tier: auto
- **Search the encounter deck and discard for a trait and draw it** – Cards: Blasphemous Invocation, In the Shadows 13115, act 12111 (Fire! ×per investigator), 13069. Primitive: search + shuffle. Tier: auto
- **Draw the topmost copy of a named card from the discard** – Cards: reference cards 12105/12168, agenda 12108. Primitive: `drawTopmostFromDiscard` (planned in M4.5). Tier: auto
- **Nearest non-Elite enemy moves once toward you and attacks if it engages** – Cards: Aerial Pursuit 12163. Primitive: "move toward" + immediate attack. Tier: auto
- **Draw a random set-aside enemy of a trait** – Cards: Burning Daylight 13028. Primitive: set-aside query with RNG. Tier: auto
- **Hand, deck and card-type effects** – Cards: Wild Compulsion, Dissonance 12194, Torment 12195, Languor, Putrid Vapors 12192. Tier: display

### Agendas, acts and scenario flow

- **Objectives beyond "spend clues at round end": all undefeated investigators at a location; an investigator enters a location; an enemy enters / leaves play or is defeated; exactly N clues on the act; N Elite enemies in the victory display _and under the act_; every surviving investigator resigned** – Cards: 12110, 12136, 12172, 13006, 13007, 13036–13038, 13073–13075. Primitive: **objective conditions** as data, checked after each command
- **Act and agenda merged into one card** – Cards: Brethren of Ash 12171. Primitive: scenario state: current act may be the agenda
- **Reset the act deck to act 1** – Cards: Corner the Suspect 13007. Primitive: act deck operation
- **Agenda or act chosen by version, difficulty or campaign record** – Cards: 13032–13035, 13070/13071. Primitive: setup picks decks (`campaignSetup`)
- **Replacement effect: "when doom would be placed, deal damage instead"** – Cards: Brethren of Ash. Primitive: **replacement hook** on `PlaceDoom` (a new trigger kind)
- **Constant agenda effects: cards of traits gain victory 0; enemies at Fire! locations cannot be damaged** – Cards: 13069–13071, 12169/12170. Primitive: derived stats from the current agenda
- **Encounter cards placed facedown beneath locations; revealed one at a time later; drawn by an act ability** – Cards: 13002–13006; _Smoke and Mirrors_ act 12136. Primitive: zone `beneath` a card (also "under the act")
- **Damage stored on the scenario reference card and moved back** – Cards: 13003, 13004. Primitive: tokens on the reference card instance
- **Investigators killed, defeated with trauma, or forced to resign** – Cards: 12108, 12135, 12171, 12175. Primitive: `EndScenario` with outcomes (exists)
- **Weakness added to each investigator's deck** – Cards: Mark of Elokoss (agenda 12134). Primitive: display + campaign record
- **Story asset under an investigator's control** – Cards: Dr. Henry Armitage 12115, Detective Reynolds 13029. Primitive: track as a card in their play area, effects reminded

### Chaos bag and tokens

- **Symbol values from the board: act or agenda number, Elite enemies in the victory display and under the act, Fire! copies in play, sealed tokens, clues you control, at a Ritual Site** – Cards: reference cards 12105, 12133, 12168, 13001, 13031, 13068. Primitive: `tokenValues` modifiers (exist)
- **"Reveal another token", "automatically fail instead"** – Cards: same. Primitive: skill test suggestion (exists for printed values)
- **Blood token: add to the bag, seal on an investigator (max 3), release; total in bag and sealed max 12; persists across scenarios** – Cards: 40 Children of Blood cards. Primitive: **sealed tokens** on investigators + chaos bag counts in the campaign log
- **"Remember that …": scenario-scoped records used as conditions** – Cards: 13018, 13042, 13046, 13048, 13061. Primitive: scenario records (the campaign log's typed records, scoped to the game)
- **Codex entries and resolutions (→R1)** – Cards: 12136–12144, 12138, 12180, 13073, 13083 and every last act/agenda. Primitive: text from the campaign guide, not ArkhamDB: show the entry number; script outcomes per scenario

## Data gaps

- **Connections:** no ArkhamDB field; planned in M4.2 (symbol extraction) and M4.3 (editor).
- **Setup and codex:** campaign guide only; M4.1 imports ArkhamCards campaign data for setup. Codex texts stay with the players' book; the app names the entry.
- **Chapter of a pack:** the code hard-codes `CHAPTER_TWO_PACK_CODES = ['core_2026']`, which misses Children of Blood (`cob`). The data repository's `packs.json` marks both as chapter 2; check whether the ArkhamDB packs API returns that field before reading it instead of the list.
- **Location versions:** same-named cards (Downtown, Sewer Tunnels, Dawn/Dusk) differ only by subname or trait; setup must name the code, not the name.

## Implementation plan

Ordered so each step unlocks the most cards for the scenarios coming next (M4 _Spreading Flames_, M5 the rest of the Core Set, M7 Children of Blood). Each line is one task of one or a few small PRs; the task files get them when their milestone starts.

### Before M4 (data and parsing)

1. **Chapter Two packs** – add `cob`, or read the chapter from the data (see "Data gaps").
2. **New keywords** – parse Elusive, Doomed, Predator; Patrol and Prey details with enemy and trait targets; Spawn filters ("any empty [[Arkham]] location"); "+N per investigator" health into `ScaledValue`.

### M4 – Spreading Flames, and the generic rules it needs

3. **Timing windows** – one list of windows, used by card and scenario abilities (data only, replacing the code hooks) and by reminders; migrate `turnEndTest` and `discardAtRoundEnd`. First, because every later step lands as an ability.
4. **Skill test margin** – the answer carries "by how much"; the suggestion computes it; revelation tests use it. Second, so the steps after it can use the margin.
5. **Doomed and Elusive** – rules with unit tests and an end-to-end step (Bystander in _Spreading Flames_).
6. **Scenario actions** – cost (actions, resources, clues as a group per investigator), condition, test, effect, ability limits; Parley and Resign on agendas, acts and locations. Generalises the `ScenarioAction` M4.5 plans for Parley.
7. **Location attachments and modifiers** – Fire! (attach to nearest without Fire!, phase-end damage), shroud and movement costs from attachments; shroud from conditions and enemies (Garrison Street, Factory Worker); surge gained by a condition ("if …, this card gains surge").

### M5 – Smoke and Mirrors, Queen of Ash

8. **Cards beneath cards** – zone `beneath` (locations, act); draw facedown card; count Elite under the act.
9. **Codex reminders** – card ability or defeat names a codex entry; the app shows the number and lets the players apply the outcome commands.
10. **Text connections and movement costs** – Sewer Culvert, entering Underground Cistern and Sluice Control.
11. **Replacement hooks and merged act/agenda** – Brethren of Ash.
12. **Patrol movement** and enemy restrictions (cannot move, no attacks of opportunity, cannot be damaged).

### M7 – Children of Blood

13. **Blood tokens** – chaos bag counts in the campaign log, sealed tokens per investigator, limits; prey and difficulty read them.
14. **Predator** – enemy phase step between hunters and attacks.
15. **Location versions** – setup picks Dawn/Dusk, Day/Night and random versions.
16. **Scenario records and snares** – "remember that …" conditions, Manager's Office entry rule, Julia Stern's snares.
17. **Act deck reset, reference-card tokens, enemy vs enemy damage** – the remaining River of Blood and Blood Money hooks.

Everything in the _display_ tier rides on step 3 and needs no per-card code.
