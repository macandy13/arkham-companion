# Encounter card analysis

What the scenario cards ask of the engine beyond the generic rules in [rules.md](rules.md), and the plan to support it. Written from every Chapter Two encounter card, read one by one, plus a pattern survey of all Chapter One encounter cards. Keyword and token rules are stated in [rules.md](rules.md); this document only says which cards need them. Progress is tracked in the [task files](tasks/), not here.

## Source and method

- **Data:** [arkhamdb-json-data](https://github.com/Kamalisk/arkhamdb-json-data) at commit `6f4760e` (2026-10-14), the repository ArkhamDB itself is built from. It was cloned and read by a throwaway script for this analysis only; the app keeps fetching from the ArkhamDB API, and nothing from it is committed.
- **Chapter Two, read card by card:** all 211 encounter cards of the two products marked `chapter: 2` in `packs.json`: the Core Set (2026) (`core_2026`, 92 cards, scenarios _Spreading Flames_, _Smoke and Mirrors_, _Queen of Ash_) and Children of Blood (`cob`, 119 cards, _River of Blood_, _New Horizons_, _Blood Money_). Rules for new Children of Blood mechanics come from its [campaign guide](https://images-cdn.fantasyflightgames.com/filer_public/a8/9c/a89c98b9-9de4-4b6c-8110-80fedbdcdb60/ahc106_campaign_guide-web.pdf).
- **Chapter One, surveyed:** 3,853 encounter cards from 145 scenarios, counted by regular expressions over the rules text (keywords, trigger windows, effect phrases). The counts rank how often a mechanic recurs; they are not exact.
- **Not in the data:** location connection symbols, scenario setup, codex entries and resolutions. These live on the card images and in the campaign guides (see "Data gaps").

## At a glance

1. **Most of the work is generic.** About two dozen generic primitives (below) cover nearly every Chapter Two card. The truly one-off effects are mostly agenda and act reverse sides, which are scenario hooks already.
2. **Two new keywords, plus Elusive:** _Doomed_ (Core Set (2026)) and _Predator_ (Children of Blood) are new; _Elusive_ comes from Chapter One and is common in Chapter Two. The engine parses none of them yet.
3. **Skill tests need the margin.** 11 Chapter Two cards (and 125 Chapter One cards) scale with "for each point you fail by" or "succeed by 2 or more", but a skill test answer is only pass or fail.
4. **Locations carry state.** Attachments that change a location (Fire!, Arcane Lock, Flash Flood), extra costs to enter or leave, connections defined in text, and location _versions_ chosen by difficulty or time of day.
5. **Players' cards stay physical, so many effects are reminders.** Many forced effects hit hands, decks or assets the app does not track. A generic "timing window reminder" covers them all without card scripts.
6. **Children of Blood adds a chaos bag economy:** blood tokens added to the bag and sealed on investigators (max 3 each, 12 in total), read by prey, test difficulty and the reference card.

## Support tiers

Each special case is put in one tier. The tier decides how much code a card needs. The names match the per-game automation level planned in [M7](tasks/M7-expansion.md) (display / assist / auto).

- **Auto** – The engine applies the effect. When: It only touches state the app tracks: doom, clues, enemies, locations, encounter deck, damage and horror, actions, resources.
- **Assist** – The engine raises a decision with prefilled options and applies the answer. When: The effect needs a choice or a test result, but its outcome is tracked state.
- **Display** – The app shows the card text at the right moment; players resolve it. When: It hits hands, decks, assets or other player cards (out of scope, see [product.md](product.md)).

## Keywords

Counts are cards whose text has the keyword. "Engine" is today's status.

- **Hunter** – Ch. 2: 26. Ch. 1: 269. Engine: done
- **Retaliate, Alert** – Ch. 2: 17, 5. Ch. 1: 155, 60. Engine: done
- **Aloof, Massive** – Ch. 2: 8, 5. Ch. 1: 98, 91. Engine: done
- **Surge, Peril** – Ch. 2: 7, 3. Ch. 1: 143, 101. Engine: done. Needed: conditional surge ("gains surge" if …), see Treacheries
- **Spawn** – Ch. 2: 10. Ch. 1: 277. Engine: parsed, named locations. Needed: filters: "any empty [[Arkham]] location", "any empty location"
- **Prey** – Ch. 2: 8. Ch. 1: 90. Engine: health, sanity, resources, clues. Needed: "lowest [agility]" (investigator skills are known since M1C), "most sealed [blood] tokens"
- **Patrol** – Ch. 2: 4. Ch. 1: 49. Engine: parsed only. Needed: movement toward the named target, including enemy and filtered targets ([rules.md](rules.md#hunter))
- **Elusive** – Ch. 2: 11. Ch. 1: 17. Engine: rule in rules.md, not parsed. Needed: parse and implement ([rules.md](rules.md#enemy-keywords))
- **Doomed** – Ch. 2: 6. Ch. 1: 0. Needed: parse and implement ([rules.md](rules.md#enemy-keywords))
- **Predator** – Ch. 2: 12. Ch. 1: 0. Needed: parse and implement as an enemy phase step ([rules.md](rules.md#enemy-keywords))
- **Swarming, Hidden, Haunted, Concealed** – Ch. 2: 0. Ch. 1: 14, 32, 45, 24. Needed: Chapter One only so far; plan when a Chapter Two product prints them

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
- **Forced effect when revealed: spawn set-aside enemy, put set-aside locations into play** – Cards: Cavern Entrance 13049, Zburamoarte's Lair 13051, Secret Chamber 13054/13057. Primitive: `onReveal` card effect (exists). Tier: auto
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

The engine has `turnEndTest` and `discardAtRoundEnd` as card data already. Generalising these into a **timing window** list (enter location, end turn at location, turn begins, discover clues, failed test at location, phase ends, round ends, enemy engages, treachery resolved) gives one place to hang both hooks and reminders.

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
- **Defeated: codex entry, removed from the game, or spawns a replacement** – Cards: Servant of Flame 12138/12180, Priscilla Thomas 13083, Sanguine Rebirth 13092, agenda 13072. Primitive: `afterEnemyDefeated` (exists) with codex reminders. Tier: auto / display
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

## Chapter One survey

Share of the 3,853 Chapter One encounter cards whose text matches each family, to see which primitives keep paying off as more products arrive.

- **Abilities on scenario cards ([action], [fast], [reaction])** – Cards: 1,470. Note: scenario actions
- **Forced effects** – Cards: 1,440. Note: timing windows
- **"Cannot" restrictions** – Cards: 518. Note: enemy and movement restrictions
- **"Set aside"** – Cards: 483. Note: setup and mid-game card moves
- **"Per investigator"** – Cards: 481. Note: `ScaledValue` beyond stats
- **Ability limits** – Cards: 382. Note: ability usage record
- **Stat modifiers ("gets +1 …")** – Cards: 357. Note: derived stats
- **"Either … or" choices** – Cards: 346. Note: decisions with branches
- **Connections in text** – Cards: 282. Note: text connections
- **Resolution jumps (→R)** – Cards: 244. Note: scenario end
- **"Nearest"** – Cards: 200. Note: board queries with filters
- **Fail or succeed "by N"** – Cards: 125. Note: skill test margin
- **Threat area** – Cards: 118. Note: timing windows
- **Additional costs** – Cards: 94. Note: movement and investigate costs
- **Attach to a location** – Cards: 69. Note: location modifiers

## Implementation plan

Ordered so each step unlocks the most cards for the scenarios coming next (M4 _Spreading Flames_, M5 the rest of the Core Set, M7 Children of Blood). Each line is one task of one or a few small PRs; the task files get them when their milestone starts.

### Before M4 (data and parsing)

1. **Chapter Two packs** – add `cob`, or read the chapter from the data (see "Data gaps").
2. **New keywords** – parse Elusive, Doomed, Predator; Patrol and Prey details with enemy and trait targets; "+N per investigator" health into `ScaledValue`.

### M4 – Spreading Flames, and the generic rules it needs

3. **Doomed and Elusive** – rules with unit tests and an end-to-end step (Bystander in _Spreading Flames_).
4. **Scenario actions** – cost (actions, resources, clues as a group per investigator), condition, test, effect, ability limits; Parley and Resign on agendas, acts and locations. Generalises the `ScenarioAction` M4.5 plans for Parley.
5. **Skill test margin** – the answer carries "by how much"; the suggestion computes it; revelation tests use it.
6. **Location attachments and modifiers** – Fire! (attach to nearest without Fire!, phase-end damage), shroud and movement costs from attachments.
7. **Timing windows** – one list of windows, used by hooks and by reminders; migrate `turnEndTest` and `discardAtRoundEnd`.

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

Everything in the _display_ tier rides on step 7 and needs no per-card code.
