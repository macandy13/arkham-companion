# Round structure

[Phase sequence](https://arkhamdb.com/rules#Phase_Sequence_Timing), [framework details](https://arkhamdb.com/rules#Framework_Event_Details).
A round is mythos → investigation → enemy → upkeep.
Test: [`packages/engine/src/phases.test.ts › NextPhase › walks investigation, enemy and upkeep within a round, then starts the next with mythos`](../../packages/engine/src/phases.test.ts#L120)
**The mythos phase is skipped in round 1.**
Test: [`packages/engine/src/phases.test.ts › NextPhase › starts round 1 with the investigation phase, skipping its mythos phase`](../../packages/engine/src/phases.test.ts#L108)

## Mythos

1. The round begins.
2. Put 1 doom on the current agenda.
   Test: [`packages/engine/src/phases.test.ts › mythos phase › places 1 doom on the agenda (1.2) and lets each investigator draw in player order (1.4)`](../../packages/engine/src/phases.test.ts#L200)
3. Check the doom threshold (see [Agenda](agenda-and-doom.md)).
   Test: [`packages/engine/src/phases.test.ts › mythos phase › asks to advance the agenda at the threshold check (1.3) and draws only after the answer`](../../packages/engine/src/phases.test.ts#L229)
4. In player order, each investigator draws and resolves one encounter card (see [Encounter draws](encounter-draws.md)).
   Test: [`packages/engine/src/phases.test.ts › mythos phase › starts the draws with the lead investigator, then follows the seats`](../../packages/engine/src/phases.test.ts#L214)
   Test: [`packages/engine/src/phases.test.ts › mythos phase › skips the draw of an investigator defeated before their turn to draw`](../../packages/engine/src/phases.test.ts#L284)
5. Player window, then the phase ends (framework step 1.5): "at the end of the mythos phase" forced abilities resolve (Wizard of the Order).
   Test: [`packages/scenarios/src/the_midnight_masks/cards.test.ts › The Midnight Masks card abilities › places 1 doom on Wizard of the Order as the mythos phase ends`](../../packages/scenarios/src/the_midnight_masks/cards.test.ts#L534)

## Investigation

- Investigators pick among themselves who goes next. A turn runs to completion before the next one starts, and each investigator takes exactly one turn.
  Test: [`packages/engine/src/turns.test.ts › StartTurn › starts the turn of the investigator the group picks, in any order`](../../packages/engine/src/turns.test.ts#L51)
  Test: [`packages/engine/src/turns.test.ts › StartTurn › rejects a second turn in the same round`](../../packages/engine/src/turns.test.ts#L82)
  Test: [`packages/engine/src/turns.test.ts › StartTurn › rejects a turn while another one is in progress`](../../packages/engine/src/turns.test.ts#L73)
- A turn has 3 actions, in any order and repeatable: investigate, move, draw, resource, play, activate an [action] ability, fight, engage, evade.
  Test: [`packages/engine/src/turns.test.ts › remaining actions › start at 3 for every investigator when the scenario starts`](../../packages/engine/src/turns.test.ts#L238)
  Test: [`packages/engine/src/turns.test.ts › remaining actions › count down as the players spend actions in the turn`](../../packages/engine/src/turns.test.ts#L245)
  - Play: the investigator pays the card's resource cost in full to play it ([Play](https://arkhamdb.com/rules#Play), [Costs](https://arkhamdb.com/rules#Costs)), so a cost above the resources they hold can't be paid. The app spends the cost the players tap (`PlayCard.cost`), after any attacks of opportunity, like a card action's cost for now; the action itself is paid before them.
    Test: [`packages/engine/src/investigators.test.ts › PlayCard › spends a cost of $cost of her 3 resources, leaving $left`](../../packages/engine/src/investigators.test.ts#L355)
    Test: [`packages/engine/src/investigators.test.ts › PlayCard › rejects a cost of 4, more than her 3 resources`](../../packages/engine/src/investigators.test.ts#L370)
  - [Basic actions](https://arkhamdb.com/rules#Basic_Action_Types) are draw, resource, move, investigate, fight, engage and evade.
- An investigator may end the turn early.
  Test: [`packages/engine/src/turns.test.ts › EndTurn › ends the turn and marks it taken for the round`](../../packages/engine/src/turns.test.ts#L104)
  - A card's "end your turn" resolved outside that investigator's turn (mythos phase) does nothing ([Rite of Seeking FAQ](https://arkhamdb.com/card/02028)).
    Test: [`packages/engine/src/investigator_effects.test.ts › a card effect that ends your turn › ends the turn of the investigator who entered`](../../packages/engine/src/investigator_effects.test.ts#L117)
    Test: [`packages/engine/src/investigator_effects.test.ts › a card effect that ends your turn › does nothing when she enters during bob's turn`](../../packages/engine/src/investigator_effects.test.ts#L129)
- A card's "lose N actions" takes as many as remain and none once they are gone; its other parts still resolve ([Effects](https://arkhamdb.com/rules#Effects)), unless they follow a "then" ([Then](https://arkhamdb.com/rules#Then)). Lost outside the turn (mythos phase), they come off that round's turn (RR "Action").
  Test: [`packages/engine/src/investigator_effects.test.ts › card effects that take actions away › lets the players take all remaining actions too, but not from an investigator with none`](../../packages/engine/src/investigator_effects.test.ts#L92)
  - "Lose all remaining actions" takes every action left this round, outside the turn too: drawn in the mythos phase, it leaves the investigator none for their turn, as upkeep has already refilled the round's 3.
  - "At the end of your turn" forced abilities (Frozen in Fear) resolve when the turn ends (framework step 2.2.2).
    Test: [`packages/engine/src/turns.test.ts › the end of a turn › asks the investigator for the willpower test of Frozen in Fear in their threat area`](../../packages/engine/src/turns.test.ts#L167)
    Test: [`packages/engine/src/turns.test.ts › the end of a turn › does not test at the end of another investigator's turn`](../../packages/engine/src/turns.test.ts#L196)
  - A turn cut short by defeat or resignation triggers none: elimination has already discarded the threat area.
  - "When your turn begins" forced abilities resolve as the turn starts (2.2).
- The phase ends once every investigator has taken a turn (2.3): "at the end of the investigation phase" forced abilities resolve.
  Test: [`packages/engine/src/phases.test.ts › NextPhase › does not leave the investigation phase before every active investigator had a turn`](../../packages/engine/src/phases.test.ts#L154)
  Test: [`packages/engine/src/elimination.test.ts › an investigator who leaves › is not waited for at the end of the investigation phase`](../../packages/engine/src/elimination.test.ts#L148)

## Enemy

1. [Hunter](hunter.md) enemies move (also [patrol](https://arkhamdb.com/rules#Patrol) enemies).
   Test: [`packages/engine/src/phases.test.ts › enemy phase › moves the hunters (3.2), then lists the attacks of the ready engaged enemies (3.3)`](../../packages/engine/src/phases.test.ts#L304)
2. In player order, each investigator resolves the attacks of all ready enemies engaged with them, in an order the investigator chooses, before the next investigator's.
   Test: [`packages/engine/src/enemies.test.ts › enemyAttackList › lists ready engaged enemies per investigator in seat order, with their damage and horror`](../../packages/engine/src/enemies.test.ts#L1032)
   - An attack deals its damage and horror at the same time.
     Test: [`packages/engine/src/phases.test.ts › enemy phase › defeats an investigator once from damage and horror dealt together`](../../packages/engine/src/phases.test.ts#L411)
   - The enemy exhausts after its attack and any triggered abilities resolve.
     Test: [`packages/engine/src/phases.test.ts › enemy phase › deals the printed damage and horror of an attack, exhausts the enemy and ends the step`](../../packages/engine/src/phases.test.ts#L362)
     Test: [`packages/engine/src/triggers.test.ts › trigger bus › abilities after an enemy attack › exhausts the ghast in the enemy phase only after its ability has resolved`](../../packages/engine/src/triggers.test.ts#L1000)
   - A cancelled attack (Dodge) has no further consequences, but the enemy still exhausts ([Dodge FAQ](https://arkhamdb.com/card/01023)).
     Test: [`packages/engine/src/phases.test.ts › enemy phase › deals nothing for a cancelled attack, but the ghoul still exhausts`](../../packages/engine/src/phases.test.ts#L394)
   - The app asks about all of the step's attacks at once and leaves their order, across investigators too, to the players at the table.
   - An attack a card makes outside this step ("it attacks you") deals the enemy's printed damage and horror the same way, can go to assets and be cancelled, and counts as an enemy attack for "after it attacks you". It needs no engagement and doesn't exhaust the enemy unless the text says "as if it were the enemy phase" ([As if…](https://arkhamdb.com/rules#As_if) FAQ). It needs no ready enemy either unless the text says so (our reading). "Attacks each investigator at its location" attacks them one at a time; the lead investigator picks the order, which the app leaves to the table and asks in player order.
     Test: [`packages/engine/src/enemy_effects.test.ts › card effects that make an enemy attack › asks alice to take the printed attack, lowered by what her assets soak`](../../packages/engine/src/enemy_effects.test.ts#L150)
     Test: [`packages/engine/src/enemy_effects.test.ts › card effects that make an enemy attack › lets alice cancel the attack`](../../packages/engine/src/enemy_effects.test.ts#L183)
     Test: [`packages/engine/src/enemy_effects.test.ts › card effects that make an enemy attack › asks each investigator in the attic in turn, when the ghoul attacks each of them`](../../packages/engine/src/enemy_effects.test.ts#L206)
3. The phase ends (3.4): "at the end of the enemy phase" forced abilities resolve.

## Upkeep

1. Reset actions.
   Test: [`packages/engine/src/phases.test.ts › upkeep phase › resets the remaining actions of each active investigator to 3 (4.2)`](../../packages/engine/src/phases.test.ts#L513)
2. Ready every exhausted card simultaneously.
   Test: [`packages/engine/src/phases.test.ts › upkeep phase › readies exhausted enemies (4.3), which engage investigators at their location`](../../packages/engine/src/phases.test.ts#L532)
3. In player order each investigator draws 1 card, then each gains 1 resource.
   Test: [`packages/engine/src/phases.test.ts › upkeep phase › has each investigator draw 1 card at the table, then each gain 1 resource (4.4)`](../../packages/engine/src/phases.test.ts#L566)
4. In player order, anyone holding more than 8 cards discards down to 8.
5. The upkeep phase and the round end together (framework step 4.6): "until the end of the round" effects expire and "at the end of the round" forced abilities resolve (Dissonant Voices is discarded), then a round-end objective that is not forced, such as The Barrier's clue spend ([objectives](cards/objectives.md)).
   Test: [`packages/engine/src/phases.test.ts › upkeep phase › ends the round (4.6) by discarding the cards that last until the end of the round`](../../packages/engine/src/phases.test.ts#L610)
   Test: [`packages/engine/src/card_actions.test.ts › advancing the act by spending clues at the end of the round › asks as the round ends with alice and bob in the hall, and both pay a clue to advance`](../../packages/engine/src/card_actions.test.ts#L877)
