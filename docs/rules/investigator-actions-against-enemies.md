# Investigator actions against enemies

- [Attacks of opportunity](https://arkhamdb.com/rules#Attack_of_Opportunity): if an investigator engaged with ready enemies spends an action on anything other than fight, evade, parley or resign, each of those enemies attacks them.
  Test: [`packages/engine/src/attacks_of_opportunity.test.ts › attacks of opportunity › asks the moving investigator to resolve the attack of a ready engaged enemy, at its printed damage and horror`](../../packages/engine/src/attacks_of_opportunity.test.ts#L60)
  Test: [`packages/engine/src/card_actions.test.ts › UseCardAction › with alice engaged with a ready ghoul › provokes none for Resign`](../../packages/engine/src/card_actions.test.ts#L343)
  Test: [`packages/engine/src/card_actions.test.ts › UseCardAction › with alice engaged with a ready ghoul › provokes none for a Parley, which adds the ghoul to the victory display`](../../packages/engine/src/card_actions.test.ts#L352)
  - The investigator picks the order.
  - The attacks happen after the action's costs are paid and before its effect, and the enemies don't exhaust.
    Test: [`packages/engine/src/attacks_of_opportunity.test.ts › attacks of opportunity › deals the printed damage and horror on confirm and leaves the enemy ready`](../../packages/engine/src/attacks_of_opportunity.test.ts#L94)
    Test: [`packages/engine/src/attacks_of_opportunity.test.ts › the action that provokes attacks of opportunity › counts off the move once, before the attack, and not again when it resumes`](../../packages/engine/src/attacks_of_opportunity.test.ts#L380)
    Test: [`packages/engine/src/attacks_of_opportunity.test.ts › the action that provokes attacks of opportunity › asks for the investigate test only after the attack is resolved`](../../packages/engine/src/attacks_of_opportunity.test.ts#L463)
  - Abilities costing several actions provoke only once per enemy.
  - [free]/fast abilities don't provoke.
    Test: [`packages/engine/src/card_actions.test.ts › free actions › lets $who, provoking no attack`](../../packages/engine/src/card_actions.test.ts#L624)
  - Only spending an action provokes: a card effect that moves an investigator, makes them investigate or engages an enemy without costing an action never provokes, while an ability that costs an action provokes like the basic action ([Action Designators](https://arkhamdb.com/rules#Action_Designators)).
    Test: [`packages/engine/src/attacks_of_opportunity.test.ts › attacks of opportunity › does not ask when a decision answer moves the investigator`](../../packages/engine/src/attacks_of_opportunity.test.ts#L341)
    Test: [`packages/engine/src/card_actions.test.ts › UseCardAction › with alice engaged with a ready ghoul › provokes an attack of opportunity for a plain action`](../../packages/engine/src/card_actions.test.ts#L317)
  - An attack of opportunity is an enemy attack, so an "after [this enemy] attacks you" ability fires after it as after an enemy-phase attack.
- [Fight](https://arkhamdb.com/rules#Fight_Action): combat test against the enemy's fight value, which can target any enemy at the location.
  Test: [`packages/engine/src/skill_tests.test.ts › Fight › asks alice for a combat test against the fight value, passing for the basic 1 damage or more`](../../packages/engine/src/skill_tests.test.ts#L398)
  Test: [`packages/engine/src/skill_tests.test.ts › Fight › can attack an unengaged enemy at the location`](../../packages/engine/src/skill_tests.test.ts#L455)
  - Success deals 1 damage by default.
    Test: [`packages/engine/src/skill_tests.test.ts › Fight › deals 1 damage on a pass by default`](../../packages/engine/src/skill_tests.test.ts#L428)
  - On failure against an enemy engaged with exactly one _other_ investigator, the damage goes to that investigator instead.
    Test: [`packages/engine/src/skill_tests.test.ts › failed Fight › deals no damage for an enemy that is $name`](../../packages/engine/src/skill_tests.test.ts#L612)
  - A card may let the investigator fight an enemy at another location (Marksmanship: a connecting location); the engine takes any location then (`Fight.atAnyLocation`), and the card's own limit is the players'. Aloof still blocks an attack on an unengaged aloof enemy there ([Aloof](https://arkhamdb.com/rules#Aloof)), unless the card ignores it as Marksmanship and Telescopic Sight do (`Fight.ignoreAloof`).
    Test: [`packages/engine/src/skill_tests.test.ts › Fight › attacks the ghoul in the hallway when a card lets alice fight at any location`](../../packages/engine/src/skill_tests.test.ts#L532)
    Test: [`packages/engine/src/skill_tests.test.ts › Fight › rejects an aloof ghoul in the hallway nobody is engaged with, even at any location`](../../packages/engine/src/skill_tests.test.ts#L511)
    Test: [`packages/engine/src/skill_tests.test.ts › Fight › attacks an aloof ghoul in the hallway nobody is engaged with when the attack ignores aloof`](../../packages/engine/src/skill_tests.test.ts#L522)
- [Evade](https://arkhamdb.com/rules#Evade_Action): only against an enemy engaged with you; agility test against its evade value.
  Test: [`packages/engine/src/skill_tests.test.ts › Evade › asks alice for an agility test against the evade value`](../../packages/engine/src/skill_tests.test.ts#L633)
  Test: [`packages/engine/src/skill_tests.test.ts › Evade › rejects an enemy that is not engaged with the investigator`](../../packages/engine/src/skill_tests.test.ts#L708)
  - Success (or any "evade" effect) exhausts the enemy if it is ready and moves it unengaged to your location.
    Test: [`packages/engine/src/skill_tests.test.ts › Evade › exhausts and disengages the enemy on a pass`](../../packages/engine/src/skill_tests.test.ts#L645)
    Test: [`packages/engine/src/skill_tests.test.ts › Evade › only disengages an enemy that is already exhausted`](../../packages/engine/src/skill_tests.test.ts#L654)
    Test: [`packages/engine/src/enemies.test.ts › engagement commands › evading by a card effect $name`](../../packages/engine/src/enemies.test.ts#L567)
  - "Automatically evade" makes no test and isn't a successful evasion.
  - A card ability may evade an enemy the investigator isn't engaged with (Stray Cat, Cunning Distraction FAQ), at their location or elsewhere; the engine tests it the same way (`Evade.atAnyLocation`), and a pass exhausts it where it is (our reading: there is no threat area to move it out of).
    Test: [`packages/engine/src/skill_tests.test.ts › Evade › exhausts the unengaged ghoul in the hallway when a card lets alice evade at any location`](../../packages/engine/src/skill_tests.test.ts#L723)
  - Either way the enemy is evaded, so "after [this enemy] is evaded" (Ruth Turner) follows once it is exhausted and disengaged; a failed evasion opens nothing. The evasion happens in ST.7 (apply results), so this comes after the ST.6 "after you succeed" triggers.
    Test: [`packages/engine/src/triggers.test.ts › trigger bus › abilities after an enemy is evaded › deals alice $horror horror for a $result of her evasion`](../../packages/engine/src/triggers.test.ts#L1063)
    Test: [`packages/engine/src/triggers.test.ts › trigger bus › abilities after an enemy is evaded › fires for an exhausted enemy evaded by a card effect`](../../packages/engine/src/triggers.test.ts#L1076)
  - "After you successfully evade [this enemy]" (Cornelia Akely) comes at the same point, but only after a passed evasion test, never after an automatic evade ([Automatic Failure/Success](https://arkhamdb.com/rules#Automatic_Failure_Success)).
- [Engage](https://arkhamdb.com/rules#Engage_Action): take an enemy at your location into your threat area, even if it's exhausted, aloof or engaged with someone else (it disengages from them). Engaging and being engaged are the same event.
  Test: [`packages/engine/src/triggers.test.ts › trigger bus › abilities after an engagement or a clue discovery › deals alice 1 horror when the lurker $name`](../../packages/engine/src/triggers.test.ts#L907)
- [Move](https://arkhamdb.com/rules#Move): to a connecting location unless the effect says otherwise.
  Test: [`packages/engine/src/investigators.test.ts › MoveInvestigator › rejects a location that is not connected`](../../packages/engine/src/investigators.test.ts#L87)
  Test: [`packages/engine/src/investigators.test.ts › MoveInvestigator › allows an unconnected destination when connections are ignored`](../../packages/engine/src/investigators.test.ts#L97)
  - The connections are read from the card of the location you leave, on its side that is up: a location connects to each one whose symbol it prints at its foot. So a connection only one of the two cards prints goes one way; the 2026 rulebook ("Move") notes that revealing a location can change its connections, into a one-way route among others.
    Test: [`packages/engine/src/board.test.ts › neighbours along the printed connection symbols › lead from the path to $fromPath and back to $fromWoods with $revealing revealed`](../../packages/engine/src/board.test.ts#L465)
  - Card text can add connections no symbol shows, as long as its side is up (the Main Path "is connected to each other Woods location").
    Test: [`packages/engine/src/board.test.ts › neighbours along the printed connection symbols › come with $declared, declared, unless they already allow its moves, joined into one edge with the way back ($revealing revealed)`](../../packages/engine/src/board.test.ts#L511)
  - Card text can also remove one ("X is no longer connected to Y"): no move over it remains, even where the symbols still show it, also after a location flips (it doesn't leave play). Removing it from X only, when Y still prints X, leaves the way back open (our reading; no rule says which way it applies). This is not blocking: a connection a card ability blocks still counts for hunters and "nearest" ([Nearest](https://arkhamdb.com/rules#Nearest)), so the hunter doesn't move ([Hunter](https://arkhamdb.com/rules#Hunter)).
    Test: [`packages/engine/src/board.test.ts › neighbours along the printed connection symbols › lead from the path to $fromPath and back to $fromWoods once an effect cuts $cut`](../../packages/engine/src/board.test.ts#L529)
    Test: [`packages/engine/src/board.test.ts › neighbours along the printed connection symbols › stay cut when a revealed side prints the connection again`](../../packages/engine/src/board.test.ts#L558)
  - Hunters, patrols and "nearest" go by the same one-way connections ([Hunter](https://arkhamdb.com/rules#Hunter), [Nearest](https://arkhamdb.com/rules#Nearest)).
  - Leaving and entering happen together, and "moved to X" goes straight there.
  - A move to the current location, or one with no valid destination, can't happen.
    Test: [`packages/engine/src/investigators.test.ts › MoveInvestigator › rejects moving to the current location`](../../packages/engine/src/investigators.test.ts#L119)
  - A location's "after you enter" ability fires for every move into it, by an action or a card effect, after the move has resolved (a reveal and engagements included).
    Test: [`packages/engine/src/triggers.test.ts › trigger bus › abilities after entering a location › deals the horror to alice for $name, not to bob who was there`](../../packages/engine/src/triggers.test.ts#L447)
    Test: [`packages/engine/src/triggers.test.ts › trigger bus › abilities after entering a location › fires when the move reveals the location too`](../../packages/engine/src/triggers.test.ts#L456)
  - Being placed at a starting location during setup is not a move, so it fires nothing (our reading; no rule says so).
    Test: [`packages/engine/src/triggers.test.ts › trigger bus › abilities after entering a location › opens no window for an investigator who starts there`](../../packages/engine/src/triggers.test.ts#L473)
