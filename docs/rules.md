# Rules summary

The game rules the engine implements, summarised in our own words so sessions don't have to search and re-read the Rules Reference. Each heading links to its section on [ArkhamDB's copy of the Rules Reference](https://arkhamdb.com/rules); fetch that anchor when exact wording matters.

**Source and scope.** ArkhamDB mirrors the Chapter One Rules Reference with FAQ rulings up to v2.5. It does not cover the 2026 Core Set (Chapter Two). Where Chapter Two may differ, check the official 2026 rules and note the difference here. Only scenario-side rules are listed; player-card rules (deckbuilding, slots, costs) are out of scope.

**Never paste rules text here.** The Rules Reference is copyrighted. Keep entries as short paraphrases with an anchor link, and update an entry in the same PR that changes the rule in code.

## Precedence

- [Golden rules](https://arkhamdb.com/rules#The_Golden_Rules): card text beats the Rules Reference, which beats Learn to Play.
- [Grim rule](https://arkhamdb.com/rules#The_Grim_Rule): if a rules question can't be answered, resolve it in the way worst for the investigators. This is a table fallback, not something the engine models.
- [Choices](https://arkhamdb.com/rules#Choices_and_the_Grim_Rule), [lead investigator](https://arkhamdb.com/rules#Lead_Investigator): when the group must choose between valid options (ties for hunter movement, prey, spawn location, order of simultaneous forced effects), the lead investigator decides. The app turns each such choice into a `Decision`. If the lead investigator is eliminated, the remaining players pick a new one.
- [Simultaneous resolution](https://arkhamdb.com/rules#Priority_of_Simultaneous_Resolution): individual choices for an effect that hits several players are made in player order, then the effect applies to all at once. The lead investigator orders forced abilities and lasting effects that would resolve at the same time.

## Timing of forced effects

[Forced abilities](https://arkhamdb.com/rules#Forced_Abilities), [At](https://arkhamdb.com/rules#At), [Effects](https://arkhamdb.com/rules#Effects), [FAQ v2.5](https://images-cdn.fantasyflightgames.com/filer_public/c1/d0/c1d0fab6-7fa6-4ce2-af6a-16416381a19b/ahc_faq_v25_february_2026-web.pdf) §1.4 (nested sequences).

- Each triggering condition runs "when" → the condition resolves → "after". A forced "When…" starts before the condition takes effect; a forced "After…" starts once its effect has fully resolved. "At …" and "If …" abilities (also "at the end of the turn/round") resolve between the two.
- Every part of an effect resolves before the "after" triggers it causes. So an engine command that is one effect may run its "after" abilities once all its events are done.
- Forced abilities on a timing point resolve before reactions to it.
- A forced ability that causes a new trigger opens a nested sequence. It finishes, choices included, before the sequence it interrupted goes on (last in, first out).
- Once an ability starts, as much of it as possible resolves, in order, before the next one starts ([Triggered Abilities](https://arkhamdb.com/rules#Triggered_Abilities)). A choice that is part of an effect is part of that effect, so it comes before "after" triggers on it. The one exception is a skill test: "after you succeed/fail" triggers in step 6, before the results (FAQ v2.5 §1.7).
- A [Revelation](https://arkhamdb.com/rules#Revelation_Abilities) starts as the card is drawn: before an enemy spawns and before a treachery is placed or discarded.
- Forced abilities that resolve at the same time are ordered by the lead investigator (see [Precedence](#precedence)).

## Round structure

[Phase sequence](https://arkhamdb.com/rules#Phase_Sequence_Timing), [framework details](https://arkhamdb.com/rules#Framework_Event_Details). A round is mythos → investigation → enemy → upkeep. **The mythos phase is skipped in round 1.**

### Mythos

1. The round begins.
2. Put 1 doom on the current agenda.
3. Check the doom threshold (see [Agenda](#agenda-and-doom)).
4. In player order, each investigator draws and resolves one encounter card (see [Encounter draws](#encounter-draws)).
5. Player window, then the phase ends (framework step 1.5): "at the end of the mythos phase" forced abilities resolve (Wizard of the Order).

### Investigation

- Investigators pick among themselves who goes next. A turn runs to completion before the next one starts, and each investigator takes exactly one turn.
- A turn has 3 actions, in any order and repeatable: investigate, move, draw, resource, play, activate an [action] ability, fight, engage, evade. [Basic actions](https://arkhamdb.com/rules#Basic_Action_Types) are draw, resource, move, investigate, fight, engage and evade.
- An investigator may end the turn early. "At the end of your turn" forced abilities (Frozen in Fear) resolve when the turn ends (framework step 2.2.2). A turn cut short by defeat or resignation triggers none: elimination has already discarded the threat area. "When your turn begins" forced abilities resolve as the turn starts (2.2).
- The phase ends once every investigator has taken a turn (2.3): "at the end of the investigation phase" forced abilities resolve.

### Enemy

1. [Hunter](#hunter) enemies move (also [patrol](https://arkhamdb.com/rules#Patrol) enemies).
2. In player order, each investigator resolves the attacks of all ready enemies engaged with them, in an order the investigator chooses. An attack deals its damage and horror at the same time. The enemy exhausts after its attack and any triggered abilities resolve.
3. The phase ends (3.4): "at the end of the enemy phase" forced abilities resolve.

### Upkeep

1. Reset actions.
2. Ready every exhausted card simultaneously.
3. In player order each investigator draws 1 card, then each gains 1 resource.
4. In player order, anyone holding more than 8 cards discards down to 8.
5. The upkeep phase and the round end together (framework step 4.6): "until the end of the round" effects expire and "at the end of the round" forced abilities resolve (Dissonant Voices is discarded).

## Setup

[Setting up the game](https://arkhamdb.com/rules#Appendix_III_Setting_Up_The_Game): choose investigators; in a campaign each starts with damage equal to their physical trauma and horror equal to their mental trauma; choose the lead investigator; shuffle decks; build the chaos bag from the campaign (or keep the previous scenario's bag); each investigator gains 5 resources and draws 5 cards with one optional mulligan (weaknesses drawn now are set aside, replaced, and shuffled back afterwards); then the scenario setup (locations, starting positions, set-aside cards, encounter deck); agenda and act decks in order with 1a on top; scenario reference card. There are no player windows during setup. [Surge](#encounter-draws) still applies to cards drawn during setup. Setup's own placements and engagements are not game events, so no "after" ability fires for them (our reading; no rule says so).

## Agenda and doom

[Act and agenda decks](https://arkhamdb.com/rules#Act_Deck_and_Agenda_Deck), [doom](https://arkhamdb.com/rules#Doom).

- Doom in play counts doom on the agenda **and on every other card in play** (enemies, locations, assets).
- The agenda advances at the mythos "check doom threshold" step when doom in play is at or above its threshold and the agenda has no "Objective –". Outside that step it only advances when a card says so.
- Thresholds may be flat or [per investigator](#per-investigator-values).
- Advancing the agenda removes **all doom from all cards in play**, then flips the agenda and follows its back side. Unless the back names a different next card, the next agenda in sequence becomes current and the old one is removed from the game.

## Act and clues

[Clues](https://arkhamdb.com/rules#Clues), [act deck](https://arkhamdb.com/rules#Act_Deck_and_Agenda_Deck).

- When an investigator first enters an unrevealed location, it is revealed and gets clues equal to its clue value, which is usually per investigator. An enemy moving into an unrevealed location does **not** reveal it.
- A successful investigate discovers 1 clue: it moves from the location to the investigator.
- An "Objective –" is active only while its agenda or act is current: the cards below it in the deck are not in play. "If the Ghoul Priest is defeated, advance" fires when the defeat happens while act 3 is current, and advancing by an objective spends no clues: the objective overrides the clue requirement (RR "Act Deck and Agenda Deck").
- If the act has no "Objective –", the group may spend the required clues from any mix of investigators at any player window during an investigator's turn ([free] ability) to advance it. An "Objective –" replaces or adds to that requirement.
- Our convention, not a rule: the players can put clues on the current act by hand (the act card's steppers), standing for clues the group already spent towards it. They count towards its requirement, so advancing pays only the rest from the investigators. A card that puts clues on an act with a meaning of its own would need this checked again.
- Advancing an act removes all tokens from it (RR "Act Deck and Agenda Deck" step 1), flips it, follows the back, and makes the next act current (unless the back names one).
- For agenda and act alike, the back resolves completely first, including any choice it asks. Only then does the next card become current, and at that same moment the advanced card leaves the game (RR "Act Deck and Agenda Deck" step 3: "simultaneously removed").
- A "(→R#)" on any card ends the scenario with that resolution. [Winning and losing](https://arkhamdb.com/rules#Winning_and_Losing): act resolutions are wins in standalone mode, anything else is a loss. If every investigator is eliminated, the scenario ends with "no resolution".

## Per-investigator values

[Per investigator](https://arkhamdb.com/rules#Per_Investigator): the value is multiplied by the number of investigators **who started the scenario**. Eliminated investigators still count. The product is treated as the printed value, so it is applied before any other modifier.

## Encounter draws

[Mythos step 1.4](https://arkhamdb.com/rules#Mythos_Phase), [encounter deck](https://arkhamdb.com/rules#Encounter_Deck). For each draw:

1. Draw the top card. If the deck is empty, shuffle the encounter discard pile back in first.
2. [Peril](https://arkhamdb.com/rules#Peril): while it resolves, other players can't confer, play cards, trigger abilities or commit cards to that investigator's tests.
3. Resolve its [revelation](https://arkhamdb.com/rules#Revelation) ability before it enters play (or, for a treachery, before it is discarded). A treachery is discarded afterwards unless its revelation put it into play (2026 Core rulebook p. 18). If the revelation eliminates the drawer, our reading (no explicit ruling exists): a treachery is discarded; an enemy with a spawn instruction still spawns there; an enemy without one would spawn engaged with the drawer, which can no longer be fulfilled, so it is discarded (2026 Core rulebook p. 19).
4. An enemy [spawns](#spawn-and-engagement).
5. A treachery goes to the encounter discard pile unless its text says otherwise. One whose revelation attaches it somewhere stays there; if there is nothing to attach it to, or a [limit](https://arkhamdb.com/rules#Limits_and_Maximums) ("Limit 1 per location", counted by title) keeps it from attaching, it is discarded ([Attach To](https://arkhamdb.com/rules#Attach_To)). A treachery or enemy with Victory X goes to the victory display instead when it is overcome (see [Victory display](https://arkhamdb.com/rules#Victory_Display_Victory_Points)).
6. [Surge](https://arkhamdb.com/rules#Surge): after resolving, draw another encounter card and start over. A card that gains surge while it resolves (False Lead: "if you have no clues, False Lead gains surge") surges like one with printed surge; one with both surges once (our reading, no explicit ruling exists). "Resolving" covers the whole card: its revelation and revelation test, its spawn and engagement, and the forced effects it triggers (2026 Core rulebook p. 19: "after resolving its text"; FAQ §1.4). If the card eliminates the drawer, our reading (no explicit ruling exists): the surge draw is lost, since Surge makes "the investigator who drew it" draw again and an eliminated investigator no longer takes part; the others play on (2026 Core rulebook, Surge and Elimination).

"Search the encounter deck and discard pile for a [[Cultist]] enemy and draw it. Shuffle the encounter deck" (Mysterious Chanting): the investigator who drew the card picks one of the matching cards and draws it, resolving it like any draw (an enemy spawns engaged with them); with no match nothing is drawn (Grimoire, Search). The engine takes the first match, deck first, for now (#346). The shuffle is its own sentence, so it happens even while a Cultist is in play (our reading of the card text; no ruling found). "Cultist enemies in play" counts the enemies at locations and engaged with investigators.

An ability that shuffles an empty discard pile into a deck does not shuffle the deck ([discard piles](https://arkhamdb.com/rules#Discard_Piles)).

"Discard cards from the top until a Ghoul enemy is discarded, draw it" with no such card left: the players would discard the whole deck, shuffle the discard back in when the deck runs out ([encounter deck](https://arkhamdb.com/rules#Encounter_Deck)) and stop when no progress is possible ([effects](https://arkhamdb.com/rules#Effects): resolve as much as possible). When the discard was just shuffled into the deck, as Rise of the Ghouls does first, that ends where it started, so the engine draws and discards nothing.

## Spawn and engagement

[Spawn](https://arkhamdb.com/rules#Spawn), [spawning an enemy](https://arkhamdb.com/rules#Spawning_an_Enemy), [engagement](https://arkhamdb.com/rules#Enemy_Engagement).

- A "Spawn –" instruction applies whenever the enemy enters play, not only when drawn. A card effect that spawns an enemy somewhere specific overrides the printed instruction.
- No spawn instruction: the enemy spawns engaged with the investigator who drew it.
- No legal location: the enemy is discarded instead.
- Several valid locations: the investigator spawning it chooses.
- Prey never affects where an enemy spawns.
- An enemy is either engaged (in an investigator's threat area, which counts as that investigator's location and moves with them) or unengaged at a location.
- A **ready, unengaged** enemy engages as soon as it shares a location with an investigator: when it spawns there, moves there, or an investigator moves in. With several investigators present, [prey](#prey) decides, then the lead investigator. There is no limit on enemies engaged with one investigator.
- An exhausted enemy doesn't engage, but engages the moment it readies if it shares a location with an investigator.
- A card effect that moves an enemy ("move it to the Hallway") needs no connection unless its text says "connecting location" (Elusive does). An engaged enemy moves only with its investigator, so a plain effect must disengage it first (Elusive disengages, then moves), but a forced instruction is followed whatever the engagement: the enemy disengages and moves. At the destination it engages by the rule above.
- [Aloof](https://arkhamdb.com/rules#Aloof): never engages on its own and spawns unengaged. It can only be engaged by the engage action or a card, and can't be attacked while unengaged.
- [Being at no location](https://arkhamdb.com/rules#Being_at_No_Location): enemies and investigators must always be at a location, and effects that would remove them from one are ignored.

## Hunter

[Hunter](https://arkhamdb.com/rules#Hunter), [nearest](https://arkhamdb.com/rules#Nearest).

- In enemy step 1, each **ready, unengaged** hunter moves one connection along the shortest path toward the nearest investigator. It doesn't move if an investigator is already at its location.
- "Nearest" counts connections even through moves a card blocks. If the next step on the path is blocked by a card, the hunter doesn't move.
- Equidistant investigators: prey picks the target; if prey doesn't decide it or there is none, the lead investigator does. The lead investigator also picks between several shortest paths.
- Several hunters move one at a time, in an order the lead investigator picks, each with its own choices before the next moves. This is our reading of [Choices](https://arkhamdb.com/rules#Choices_and_the_Grim_Rule); no rule says it explicitly.
- A card effect on "the nearest [[Cultist]] enemy" (Mysterious Chanting) counts connections from the location of the investigator resolving it; an engaged enemy is at its investigator's location. An enemy with no path there still counts, as farther than every enemy with one (FAQ: "Even if it has no valid path to an investigator, an enemy can still qualify as the 'nearest' enemy", asked about Mysterious Chanting). The lead investigator picks between equally near enemies ([Choices](https://arkhamdb.com/rules#Choices_and_the_Grim_Rule)).
- [Patrol](https://arkhamdb.com/rules#Patrol) works the same way but toward the target its text names (a location, a direction or a scenario card, 2026 Core rulebook p. 17). It doesn't move if it's already there, and the lead investigator picks between equal targets. Chapter One names a location; Chapter Two also names an enemy (Julia Stern: "nearest [[Civilian]] enemy") or a filtered location (Factory Worker: "nearest location with no [[Elite]] enemies").

## Prey

[Prey](https://arkhamdb.com/rules#Prey): used to pick between several investigators when the enemy auto-engages or when a hunter has equidistant targets. Ties go to the lead investigator. "Only" in the prey text makes the enemy ignore everyone else for moving and engaging, though others can still engage it with an action or a card.

## Enemy keywords

- [Massive](https://arkhamdb.com/rules#Massive): when ready it counts as engaged with every investigator at its location, but it never sits in a threat area and doesn't follow investigators who move away. When exhausted it is engaged with nobody. In the enemy phase it attacks each of them in an order the lead investigator picks, and exhausts after the last attack. Its attack of opportunity only hits the investigator who provoked it. A failed attack against it hits no other investigator. Investigators who become engaged mid-attack are added to its targets, and if it exhausts early its remaining attacks are skipped.
- [Retaliate](https://arkhamdb.com/rules#Retaliate): when an investigator fails an attack (combat test) against it while it is ready, it attacks that investigator after the test's results. It doesn't exhaust, and engagement doesn't matter.
- [Alert](https://arkhamdb.com/rules#Alert): when an investigator fails an evade (evasion test) against it while it is ready, it attacks after the test's results. It doesn't exhaust, and engagement doesn't matter. The [2026 Core rulebook](https://images-cdn.fantasyflightgames.com/filer_public/0e/d0/0ed09507-1705-47ed-a630-cd15885cabb0/ahc100_rulebook-web.pdf) (keyword glossary: "fails an evasion test targeting a ready enemy with the alert keyword") names "ready"; the older Rules Reference text leaves it out.
- An exhausted enemy makes no keyword, attack-of-opportunity or enemy-phase attack (2026 Core rulebook: exhausted enemies "do not perform attacks of opportunity" and do not attack in the enemy phase; retaliate and alert name a ready enemy). Any of these attacks can be cancelled by a card ([Cancel](https://arkhamdb.com/rules#Cancel)).
- [Elusive](https://arkhamdb.com/rules#Elusive) (also on Core Set (2026) cards, e.g. Bat Horror): after it attacks or is attacked while ready, it disengages, moves to a connecting location (without investigators if possible) and exhausts.
- Doomed (Core Set (2026), reminder text on Bystander): when the enemy is defeated, place 1 doom on the current agenda. This can make the agenda advance. Discarding the enemy (e.g. Factory Worker's Parley) is not defeating it, so Doomed doesn't trigger (2026 Core rulebook glossary).
- Predator ([Children of Blood campaign guide](https://images-cdn.fantasyflightgames.com/filer_public/a8/9c/a89c98b9-9de4-4b6c-8110-80fedbdcdb60/ahc106_campaign_guide-web.pdf), p. 4): in the enemy phase, after hunters move and before enemies attack, each ready, unengaged predator deals 1 damage to a non-Elite enemy at its location with a lower fight value than its own. Between several, it picks the one with the lowest remaining health; the guide names no tie-break, so the players choose.
- [Keywords](https://arkhamdb.com/rules#Keywords) in general: having the same keyword twice counts once. Keywords are mandatory unless their text says "may".

## Investigator actions against enemies

- [Attacks of opportunity](https://arkhamdb.com/rules#Attack_of_Opportunity): if an investigator engaged with ready enemies spends an action on anything other than fight, evade, parley or resign, each of those enemies attacks them. The investigator picks the order. The attacks happen after the action's costs are paid and before its effect, and the enemies don't exhaust. Abilities costing several actions provoke only once per enemy. [free]/fast abilities don't provoke. Only spending an action provokes: a card effect that moves an investigator, makes them investigate or engages an enemy without costing an action never provokes, while an ability that costs an action provokes like the basic action ([Action Designators](https://arkhamdb.com/rules#Action_Designators)). An attack of opportunity is an enemy attack, so an "after [this enemy] attacks you" ability fires after it as after an enemy-phase attack.
- [Fight](https://arkhamdb.com/rules#Fight_Action): combat test against the enemy's fight value, which can target any enemy at the location. Success deals 1 damage by default. On failure against an enemy engaged with exactly one _other_ investigator, the damage goes to that investigator instead.
- [Evade](https://arkhamdb.com/rules#Evade_Action): only against an enemy engaged with you; agility test against its evade value. Success (or any "evade" effect) exhausts the enemy if it is ready and moves it unengaged to your location. "Automatically evade" makes no test and isn't a successful evasion.
- [Engage](https://arkhamdb.com/rules#Engage_Action): take an enemy at your location into your threat area, even if it's exhausted, aloof or engaged with someone else (it disengages from them). Engaging and being engaged are the same event.
- [Move](https://arkhamdb.com/rules#Move): to a connecting location unless the effect says otherwise. Leaving and entering happen together, and "moved to X" goes straight there. A move to the current location, or one with no valid destination, can't happen. A location's "after you enter" ability fires for every move into it, by an action or a card effect, after the move has resolved (a reveal and engagements included). Being placed at a starting location during setup is not a move, so it fires nothing (our reading; no rule says so).

## Card abilities and modifiers

[Constant abilities](https://arkhamdb.com/rules#Constant_Abilities), [in play and out of play](https://arkhamdb.com/rules#In_Play_and_Out_of_Play), [modifiers](https://arkhamdb.com/rules#Modifiers); wording from [The Arkham Grimoire v1.1](https://images-cdn.fantasyflightgames.com/filer_public/4e/da/4eda7782-c983-47cc-8d9f-ae372a44d87b/arkham_grimoire_v11.pdf).

- A constant ability applies only while its card is in play. Set-aside, removed, in-deck, in-hand, discarded and victory-display cards are out of play, so their abilities do nothing. An attachment is in play while its host is.
- An unrevealed location has only its unrevealed side's text. Its revealed side's abilities ("each enemy at this location gets +1 fight") apply once it is revealed. This is our reading of "do not read the revealed side" (Grimoire, Location Cards); no rule says it in one sentence.
- A modified value is the printed value plus all active modifiers, applied together and recalculated whenever one starts or stops. A result below zero counts as zero.
- An engaged enemy is at its investigator's location, so "each enemy at X" includes enemies engaged with investigators at X.
- "You must either A or B" (and "the lead investigator must decide") offers only the options that can change the game state ([Must](https://arkhamdb.com/rules#Must)): with no clues, "spend 1 clue or take 2 damage" leaves only the damage. With neither possible, nothing happens ([Effects](https://arkhamdb.com/rules#Effects): resolve as much as you are able). An option that resolves only in part is still allowed by the rule; the engine drops it for now (no Night of the Zealot card has one).

## Skill tests

[Skill test timing](https://arkhamdb.com/rules#Skill_Test_Timing), [difficulty](https://arkhamdb.com/rules#Difficulty_skill_tests), [chaos tokens](https://arkhamdb.com/rules#Chaos_Tokens), [automatic failure/success](https://arkhamdb.com/rules#Automatic_Failure_Success).

1. Determine the skill (willpower, intellect, combat or agility). Difficulty is the fight value, shroud, evade value, or the number in parentheses on the card, each with its active modifiers (Obscuring Fog's +2 shroud).
2. Commit cards: the tester commits any number, and each other investigator at the same location commits up to one. Each matching or wild icon gives +1.
3. Reveal a chaos token.
4. Resolve its symbol: skull, cultist, tablet and elder thing use the scenario reference card, elder sign uses the tester's investigator card, and auto-fail fails the test.
5. Modified skill = base skill plus icons, the token's modifier and active effects.
6. Success if the skill is at or above the difficulty. Auto-fail sets the skill to 0, and auto-success sets the difficulty to 0. Reactions and forced effects on "succeeded/failed" trigger here.
7. Apply results in an order the tester chooses (clue discovered, damage dealt, card effects), including "if this test succeeds/fails" effects. "After you succeed/fail" abilities are not results: they trigger in step 6, before these (Rules Reference, "Skill Test Results and Advanced Timing"). That includes "after you successfully investigate" and "after attached location is successfully investigated" (Obscuring Fog is discarded before the clue is discovered).
8. Discard committed cards and return the tokens to the bag.

Bless (+2), curse (-2), frost (-1) and the blood token (-1) each make the tester reveal another token, whose modifier also applies.

The blood token comes with Children of Blood, not the Core Set (2026) ([campaign guide](https://images-cdn.fantasyflightgames.com/filer_public/a8/9c/a89c98b9-9de4-4b6c-8110-80fedbdcdb60/ahc106_campaign_guide-web.pdf), p. 3): if a test with a blood token fails, 1 blood token revealed during it is sealed on the tester (only for the first blood token of the test). At most 3 are sealed on one investigator, and at most 12 are in the bag and sealed together. Added tokens stay in the bag for the campaign. Some resolutions (River of Blood, New Horizons) release the sealed ones back into the bag. A blood token revealed outside a skill test has no effect unless a card says so. Encounter cards check for, and can release, blood tokens sealed on an investigator.

A test [succeeds by](https://arkhamdb.com/rules#Skill_Test_Timing) the modified skill minus the difficulty ("succeed by 2 or more") and fails by the difficulty minus the modified skill; after an [auto-fail](https://arkhamdb.com/rules#Automatic_Failure_Success), whose skill is 0, that is the whole difficulty. "For each point you fail by" scales with it (Grasping Hands: 1 damage per point), so a fail by 0 (an auto-fail against difficulty 0) deals nothing. False Lead's "place 1 of your clues on your location" for each point places as many as the investigator has when they have fewer ([golden rules](https://arkhamdb.com/rules#Golden_Rules): resolve as much as possible). The players confirm the margin with their answer.

If auto-success or auto-failure is known before step 3, skip steps 3 and 4. [Variable difficulty](https://arkhamdb.com/rules#Variable_Difficulty_Skill_Tests) is fixed once step 6 checks it.

## Damage, horror and defeat

[Dealing damage/horror](https://arkhamdb.com/rules#Dealing_Damage_Horror), [defeat](https://arkhamdb.com/rules#Defeat).

- When an investigator is dealt damage or horror, they may assign it to their assets that have health or sanity (no more than would defeat each asset), and the rest goes on the investigator. Prevention happens between assigning and applying, and everything is applied at once.
- [Heal](https://arkhamdb.com/rules#Heal) X damage removes up to X damage tokens: no more than the card has, so healing an undamaged enemy does nothing. "When [this enemy] attacks: heal 1 damage from him" ("Wolf-Man" Drew) resolves after the attack in the engine, a stand-in for "when" that only matters when a player card damages him during his attack (Guard Dog), which the players resolve by hand, healing him first; besides that, only a skipped attack of opportunity (a cancelled attack, whose "when" abilities would still resolve) heals him in the rules and not in the engine. Readying a ready enemy does nothing, so Umôrdhoth's "at the end of each investigator's turn: ready him" is no error while he is ready. A turn ended by resignation or defeat opens no turn-end windows, not even for cards in play: our reading, as no rule says whether such a turn "ends".
- An investigator with damage ≥ health or horror ≥ sanity is defeated and [eliminated](#elimination-and-resign). An enemy with damage ≥ health goes to the encounter discard, or to the victory display if it has Victory X, or to its owner's discard if it is a weakness. A defeated asset goes to its owner's discard. A "when [this enemy] is defeated" forced ability ([When](https://arkhamdb.com/rules#Ability): before the defeat's impact) resolves after the enemy has gone, and "this location" is where it was (Goat Spawn: "each investigator at this location takes 1 horror"). Our stand-in for "when" changes nothing while such an ability only acts on its location; Doomed must not use it, as its doom can advance the agenda while the enemy is still in play.

## Elimination and resign

[Elimination](https://arkhamdb.com/rules#Elimination), [resign](https://arkhamdb.com/rules#Resign).

- Defeat or resigning eliminates the investigator. Resigning is not a defeat.
- On elimination: "when the game ends" effects on their weaknesses in play trigger, then those weaknesses are removed. Cards they control and all their out-of-play cards are removed from the game. Cards they own but don't control stay until they leave play, and are then removed. Their clues go to their location, and their resources return to the pool. Engaged enemies are placed unengaged at that location and otherwise keep their state. Other cards in their threat area go to the appropriate discard pile.
- A new lead investigator is chosen if needed, from those still in the scenario. One effect that eliminates several investigators ("each investigator … is defeated") eliminates them together ([simultaneous resolution](https://arkhamdb.com/rules#Priority_of_Simultaneous_Resolution)), so the new lead comes from those left afterwards. If nobody is left, the scenario ends with "no resolution", and the players read the scenario's "if no resolution was reached" entry in the campaign guide (Learn to Play).
- A card ability can defeat an investigator outright; what follows from that is only what the ability says ([investigator defeat](https://arkhamdb.com/rules#Investigator_Defeat)).
- Eliminated investigators still count for per-investigator values.

## Campaign

[Campaign play](https://arkhamdb.com/rules#Campaign_Play), [trauma](https://arkhamdb.com/rules#Trauma), [killed/insane](https://arkhamdb.com/rules#Killed_Insane_Investigators), [joining or leaving](https://arkhamdb.com/rules#Joining_or_Leaving_a_Campaign), [victory display](https://arkhamdb.com/rules#Victory_Display_Victory_Points).

- The game is for 1–4 players, each choosing one investigator ([setup](https://arkhamdb.com/rules#Appendix_III_Setting_Up_The_Game), step 1), so a campaign team has 1–4 investigators.
- Defeat by damage gives 1 physical trauma, and defeat by horror gives 1 mental trauma. A defeat by a card ability gives trauma only if the ability says so. If both happen at once, the player picks which. Each trauma means starting later scenarios with 1 damage or 1 horror.
- Physical trauma ≥ printed health means killed, and mental trauma ≥ printed sanity means insane. That investigator can't be used again in the campaign, and the player picks a new one with a new level 0 deck for the next scenario. The 2026 Core Set adds a third way out, devoured. If no investigator is left to choose, the campaign is lost.
- Players may drop out and back in between scenarios. A leaving player's log entry stays so they can rejoin. A joining player picks an investigator not used before in this campaign and starts with no experience and no trauma. The rules don't cover one player swapping a living investigator for another.
- At the end of a scenario, revealed locations in play with Victory X and no clues go to the victory display. Experience equals the victory points in the display plus or minus the resolution's adjustments, and unspent experience carries over. Defeated and resigned investigators earn it too: the Rules Reference doesn't say so, but "no resolution" (everyone resigned or was defeated) still has each investigator earn experience in the campaign guide. When a defeat reaches health and sanity at once, the app proposes physical trauma and the players change it if they pick mental.
- The next scenario follows in sequence unless the resolution says otherwise. A lost scenario still continues the campaign.
