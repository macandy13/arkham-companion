# Rules summary

The game rules the engine implements, summarised in our own words so sessions don't have to search and re-read the Rules Reference. Each heading links to its section on [ArkhamDB's copy of the Rules Reference](https://arkhamdb.com/rules); fetch that anchor when exact wording matters.

**Source and scope.** ArkhamDB mirrors the Chapter One Rules Reference with FAQ rulings up to v2.5. It does not cover the 2026 Core Set (Chapter Two). Where Chapter Two may differ, check the official 2026 rules and note the difference here. Only scenario-side rules are listed; player-card rules (deckbuilding, slots, costs) are out of scope.

**Never paste rules text here.** The Rules Reference is copyrighted. Keep entries as short paraphrases with an anchor link, and update an entry in the same PR that changes the rule in code.

## Precedence

- [Golden rules](https://arkhamdb.com/rules#The_Golden_Rules): card text beats the Rules Reference, which beats Learn to Play.
- [Grim rule](https://arkhamdb.com/rules#The_Grim_Rule): if a rules question can't be answered, resolve it in the way worst for the investigators. This is a table fallback, not something the engine models.
- [Choices](https://arkhamdb.com/rules#Choices_and_the_Grim_Rule), [lead investigator](https://arkhamdb.com/rules#Lead_Investigator): when the group must choose between valid options (ties for hunter movement, prey, spawn location, order of simultaneous forced effects), the lead investigator decides. The app turns each such choice into a `Decision`. If the lead investigator is eliminated, the remaining players pick a new one.
- [Simultaneous resolution](https://arkhamdb.com/rules#Priority_of_Simultaneous_Resolution): individual choices for an effect that hits several players are made in player order, then the effect applies to all at once. The lead investigator orders forced abilities and lasting effects that would resolve at the same time.

## Round structure

[Phase sequence](https://arkhamdb.com/rules#Phase_Sequence_Timing), [framework details](https://arkhamdb.com/rules#Framework_Event_Details). A round is mythos → investigation → enemy → upkeep. **The mythos phase is skipped in round 1.**

### Mythos

1. The round begins.
2. Put 1 doom on the current agenda.
3. Check the doom threshold (see [Agenda](#agenda-and-doom)).
4. In player order, each investigator draws and resolves one encounter card (see [Encounter draws](#encounter-draws)).
5. Player window, then the phase ends.

### Investigation

- Investigators pick among themselves who goes next. A turn runs to completion before the next one starts, and each investigator takes exactly one turn.
- A turn has 3 actions, in any order and repeatable: investigate, move, draw, resource, play, activate an [action] ability, fight, engage, evade. [Basic actions](https://arkhamdb.com/rules#Basic_Action_Types) are draw, resource, move, investigate, fight, engage and evade.
- An investigator may end the turn early. "At the end of your turn" forced abilities (Frozen in Fear) resolve when the turn ends (framework step 2.2.2). A turn cut short by defeat or resignation triggers none: elimination has already discarded the threat area.

### Enemy

1. [Hunter](#hunter) enemies move (also [patrol](https://arkhamdb.com/rules#Patrol) enemies).
2. In player order, each investigator resolves the attacks of all ready enemies engaged with them, in an order the investigator chooses. An attack deals its damage and horror at the same time. The enemy exhausts after its attack and any triggered abilities resolve.

### Upkeep

1. Reset actions.
2. Ready every exhausted card simultaneously.
3. In player order each investigator draws 1 card, then each gains 1 resource.
4. In player order, anyone holding more than 8 cards discards down to 8.
5. The round ends (framework step 4.6): "until the end of the round" effects expire and "at the end of the round" forced abilities resolve (Dissonant Voices is discarded).

## Setup

[Setting up the game](https://arkhamdb.com/rules#Appendix_III_Setting_Up_The_Game): choose investigators; in a campaign each starts with damage equal to their physical trauma and horror equal to their mental trauma; choose the lead investigator; shuffle decks; build the chaos bag from the campaign (or keep the previous scenario's bag); each investigator gains 5 resources and draws 5 cards with one optional mulligan (weaknesses drawn now are set aside, replaced, and shuffled back afterwards); then the scenario setup (locations, starting positions, set-aside cards, encounter deck); agenda and act decks in order with 1a on top; scenario reference card. There are no player windows during setup. [Surge](#encounter-draws) still applies to cards drawn during setup.

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
- If the act has no "Objective –", the group may spend the required clues from any mix of investigators at any player window during an investigator's turn ([free] ability) to advance it. An "Objective –" replaces or adds to that requirement.
- Advancing an act removes tokens from it, flips it, follows the back, and makes the next act current (unless the back names one).
- A "(→R#)" on any card ends the scenario with that resolution. [Winning and losing](https://arkhamdb.com/rules#Winning_and_Losing): act resolutions are wins in standalone mode, anything else is a loss. If every investigator is eliminated, the scenario ends with "no resolution".

## Per-investigator values

[Per investigator](https://arkhamdb.com/rules#Per_Investigator): the value is multiplied by the number of investigators **who started the scenario**. Eliminated investigators still count. The product is treated as the printed value, so it is applied before any other modifier.

## Encounter draws

[Mythos step 1.4](https://arkhamdb.com/rules#Mythos_Phase), [encounter deck](https://arkhamdb.com/rules#Encounter_Deck). For each draw:

1. Draw the top card. If the deck is empty, shuffle the encounter discard pile back in first.
2. [Peril](https://arkhamdb.com/rules#Peril): while it resolves, other players can't confer, play cards, trigger abilities or commit cards to that investigator's tests.
3. Resolve its [revelation](https://arkhamdb.com/rules#Revelation) ability before it enters play (or, for a treachery, before it is discarded).
4. An enemy [spawns](#spawn-and-engagement).
5. A treachery goes to the encounter discard pile unless its text says otherwise. One whose revelation attaches it somewhere stays there; if a limit ("Limit 1 per location") keeps it from attaching, it is discarded (see [Limits](https://arkhamdb.com/rules#Limits_and_Maximums)). A treachery or enemy with Victory X goes to the victory display instead when it is overcome (see [Victory display](https://arkhamdb.com/rules#Victory_Display_Victory_Points)).

An ability that shuffles an empty discard pile into a deck does not shuffle the deck ([discard piles](https://arkhamdb.com/rules#Discard_Piles)). 6. [Surge](https://arkhamdb.com/rules#Surge): after resolving, draw another encounter card and start over.

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
- [Aloof](https://arkhamdb.com/rules#Aloof): never engages on its own and spawns unengaged. It can only be engaged by the engage action or a card, and can't be attacked while unengaged.
- [Being at no location](https://arkhamdb.com/rules#Being_at_No_Location): enemies and investigators must always be at a location, and effects that would remove them from one are ignored.

## Hunter

[Hunter](https://arkhamdb.com/rules#Hunter), [nearest](https://arkhamdb.com/rules#Nearest).

- In enemy step 1, each **ready, unengaged** hunter moves one connection along the shortest path toward the nearest investigator. It doesn't move if an investigator is already at its location.
- "Nearest" counts connections even through moves a card blocks. If the next step on the path is blocked by a card, the hunter doesn't move.
- Equidistant investigators: prey picks the target; if prey doesn't decide it or there is none, the lead investigator does. The lead investigator also picks between several shortest paths.
- [Patrol](https://arkhamdb.com/rules#Patrol) works the same way but toward a named location. It doesn't move if it's already there, and the lead investigator picks between equal targets.

## Prey

[Prey](https://arkhamdb.com/rules#Prey): used to pick between several investigators when the enemy auto-engages or when a hunter has equidistant targets. Ties go to the lead investigator. "Only" in the prey text makes the enemy ignore everyone else for moving and engaging, though others can still engage it with an action or a card.

## Enemy keywords

- [Massive](https://arkhamdb.com/rules#Massive): when ready it counts as engaged with every investigator at its location, but it never sits in a threat area and doesn't follow investigators who move away. When exhausted it is engaged with nobody. In the enemy phase it attacks each of them in an order the lead investigator picks, and exhausts after the last attack. Its attack of opportunity only hits the investigator who provoked it. A failed attack against it hits no other investigator. Investigators who become engaged mid-attack are added to its targets, and if it exhausts early its remaining attacks are skipped.
- [Retaliate](https://arkhamdb.com/rules#Retaliate): when an investigator fails an attack (combat test) against it while it is ready, it attacks that investigator after the test's results. It doesn't exhaust, and engagement doesn't matter.
- [Alert](https://arkhamdb.com/rules#Alert): when an investigator fails an evade (evasion test) against it while it is ready, it attacks after the test's results. It doesn't exhaust, and engagement doesn't matter. The [2026 Core rulebook](https://images-cdn.fantasyflightgames.com/filer_public/0e/d0/0ed09507-1705-47ed-a630-cd15885cabb0/ahc100_rulebook-web.pdf) (keyword glossary: "fails an evasion test targeting a ready enemy with the alert keyword") names "ready"; the older Rules Reference text leaves it out.
- An exhausted enemy makes no keyword, attack-of-opportunity or enemy-phase attack (2026 Core rulebook: exhausted enemies "do not perform attacks of opportunity" and do not attack in the enemy phase; retaliate and alert name a ready enemy). Any of these attacks can be cancelled by a card ([Cancel](https://arkhamdb.com/rules#Cancel)).
- [Elusive](https://arkhamdb.com/rules#Elusive) (later expansion): after it attacks or is attacked while ready, it disengages, moves to a connecting location (without investigators if possible) and exhausts.
- [Keywords](https://arkhamdb.com/rules#Keywords) in general: having the same keyword twice counts once. Keywords are mandatory unless their text says "may".

## Investigator actions against enemies

- [Attacks of opportunity](https://arkhamdb.com/rules#Attack_of_Opportunity): if an investigator engaged with ready enemies spends an action on anything other than fight, evade, parley or resign, each of those enemies attacks them. The investigator picks the order. The attacks happen after the action's costs are paid and before its effect, and the enemies don't exhaust. Abilities costing several actions provoke only once per enemy. [free]/fast abilities don't provoke.
- [Fight](https://arkhamdb.com/rules#Fight_Action): combat test against the enemy's fight value, which can target any enemy at the location. Success deals 1 damage by default. On failure against an enemy engaged with exactly one _other_ investigator, the damage goes to that investigator instead.
- [Evade](https://arkhamdb.com/rules#Evade_Action): only against an enemy engaged with you; agility test against its evade value. Success (or any "evade" effect) exhausts the enemy if it is ready and moves it unengaged to your location. "Automatically evade" makes no test and isn't a successful evasion.
- [Engage](https://arkhamdb.com/rules#Engage_Action): take an enemy at your location into your threat area, even if it's exhausted, aloof or engaged with someone else (it disengages from them). Engaging and being engaged are the same event.
- [Move](https://arkhamdb.com/rules#Move): to a connecting location unless the effect says otherwise. Leaving and entering happen together, and "moved to X" goes straight there. A move to the current location, or one with no valid destination, can't happen.

## Skill tests

[Skill test timing](https://arkhamdb.com/rules#Skill_Test_Timing), [difficulty](https://arkhamdb.com/rules#Difficulty_skill_tests), [chaos tokens](https://arkhamdb.com/rules#Chaos_Tokens), [automatic failure/success](https://arkhamdb.com/rules#Automatic_Failure_Success).

1. Determine the skill (willpower, intellect, combat or agility). Difficulty is the fight value, shroud, evade value, or the number in parentheses on the card.
2. Commit cards: the tester commits any number, and each other investigator at the same location commits up to one. Each matching or wild icon gives +1.
3. Reveal a chaos token.
4. Resolve its symbol: skull, cultist, tablet and elder thing use the scenario reference card, elder sign uses the tester's investigator card, and auto-fail fails the test.
5. Modified skill = base skill plus icons, the token's modifier and active effects.
6. Success if the skill is at or above the difficulty. Auto-fail sets the skill to 0, and auto-success sets the difficulty to 0. Reactions and forced effects on "succeeded/failed" trigger here.
7. Apply results in an order the tester chooses (clue discovered, damage dealt, card effects).
8. Discard committed cards and return the tokens to the bag.

Bless (+2), curse (-2), frost (-1) and the Core Set (2026) blood token (-1) each make the tester reveal another token, whose modifier also applies. Blood also seals the first box on the investigator card.

If auto-success or auto-failure is known before step 3, skip steps 3 and 4. [Variable difficulty](https://arkhamdb.com/rules#Variable_Difficulty_Skill_Tests) is fixed once step 6 checks it.

## Damage, horror and defeat

[Dealing damage/horror](https://arkhamdb.com/rules#Dealing_Damage_Horror), [defeat](https://arkhamdb.com/rules#Defeat).

- When an investigator is dealt damage or horror, they may assign it to their assets that have health or sanity (no more than would defeat each asset), and the rest goes on the investigator. Prevention happens between assigning and applying, and everything is applied at once.
- An investigator with damage ≥ health or horror ≥ sanity is defeated and [eliminated](#elimination-and-resign). An enemy with damage ≥ health goes to the encounter discard, or to the victory display if it has Victory X, or to its owner's discard if it is a weakness. A defeated asset goes to its owner's discard.

## Elimination and resign

[Elimination](https://arkhamdb.com/rules#Elimination), [resign](https://arkhamdb.com/rules#Resign).

- Defeat or resigning eliminates the investigator. Resigning is not a defeat.
- On elimination: "when the game ends" effects on their weaknesses in play trigger, then those weaknesses are removed. Cards they control and all their out-of-play cards are removed from the game. Cards they own but don't control stay until they leave play, and are then removed. Their clues go to their location, and their resources return to the pool. Engaged enemies are placed unengaged at that location and otherwise keep their state. Other cards in their threat area go to the appropriate discard pile.
- A new lead investigator is chosen if needed. If nobody is left, the scenario ends with "no resolution", and the players read the scenario's "if no resolution was reached" entry in the campaign guide (Learn to Play).
- A card ability can defeat an investigator outright; what follows from that is only what the ability says ([investigator defeat](https://arkhamdb.com/rules#Investigator_Defeat)).
- Eliminated investigators still count for per-investigator values.

## Campaign

[Campaign play](https://arkhamdb.com/rules#Campaign_Play), [trauma](https://arkhamdb.com/rules#Trauma), [killed/insane](https://arkhamdb.com/rules#Killed_Insane_Investigators), [joining or leaving](https://arkhamdb.com/rules#Joining_or_Leaving_a_Campaign), [victory display](https://arkhamdb.com/rules#Victory_Display_Victory_Points).

- The game is for 1–4 players, each choosing one investigator ([setup](https://arkhamdb.com/rules#Appendix_III_Setting_Up_The_Game), step 1), so a campaign team has 1–4 investigators.
- Defeat by damage gives 1 physical trauma, and defeat by horror gives 1 mental trauma. A defeat by a card ability gives trauma only if the ability says so. If both happen at once, the player picks which. Each trauma means starting later scenarios with 1 damage or 1 horror.
- Physical trauma ≥ printed health means killed, and mental trauma ≥ printed sanity means insane. That investigator can't be used again in the campaign, and the player picks a new one with a new level 0 deck for the next scenario. The 2026 Core Set adds a third way out, devoured. If no investigator is left to choose, the campaign is lost.
- Players may drop out and back in between scenarios. A leaving player's log entry stays so they can rejoin. A joining player picks an investigator not used before in this campaign and starts with no experience and no trauma. The rules don't cover one player swapping a living investigator for another.
- At the end of a scenario, revealed locations in play with Victory X and no clues go to the victory display. Experience equals the victory points in the display plus or minus the resolution's adjustments, and unspent experience carries over.
- The next scenario follows in sequence unless the resolution says otherwise. A lost scenario still continues the campaign.
