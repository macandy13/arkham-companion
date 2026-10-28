# Round structure

[Phase sequence](https://arkhamdb.com/rules#Phase_Sequence_Timing), [framework details](https://arkhamdb.com/rules#Framework_Event_Details).
A round is mythos → investigation → enemy → upkeep.
**The mythos phase is skipped in round 1.**

## Mythos

1. The round begins.
2. Put 1 doom on the current agenda.
3. Check the doom threshold (see [Agenda](agenda-and-doom.md)).
4. In player order, each investigator draws and resolves one encounter card (see [Encounter draws](encounter-draws.md)).
5. Player window, then the phase ends (framework step 1.5): "at the end of the mythos phase" forced abilities resolve (Wizard of the Order).

## Investigation

- Investigators pick among themselves who goes next. A turn runs to completion before the next one starts, and each investigator takes exactly one turn.
- A turn has 3 actions, in any order and repeatable: investigate, move, draw, resource, play, activate an [action] ability, fight, engage, evade.
  - [Basic actions](https://arkhamdb.com/rules#Basic_Action_Types) are draw, resource, move, investigate, fight, engage and evade.
- An investigator may end the turn early.
  - "At the end of your turn" forced abilities (Frozen in Fear) resolve when the turn ends (framework step 2.2.2).
  - A turn cut short by defeat or resignation triggers none: elimination has already discarded the threat area.
  - "When your turn begins" forced abilities resolve as the turn starts (2.2).
- The phase ends once every investigator has taken a turn (2.3): "at the end of the investigation phase" forced abilities resolve.

## Enemy

1. [Hunter](hunter.md) enemies move (also [patrol](https://arkhamdb.com/rules#Patrol) enemies).
2. In player order, each investigator resolves the attacks of all ready enemies engaged with them, in an order the investigator chooses.
   - An attack deals its damage and horror at the same time.
   - The enemy exhausts after its attack and any triggered abilities resolve.
3. The phase ends (3.4): "at the end of the enemy phase" forced abilities resolve.

## Upkeep

1. Reset actions.
2. Ready every exhausted card simultaneously.
3. In player order each investigator draws 1 card, then each gains 1 resource.
4. In player order, anyone holding more than 8 cards discards down to 8.
5. The upkeep phase and the round end together (framework step 4.6): "until the end of the round" effects expire and "at the end of the round" forced abilities resolve (Dissonant Voices is discarded).
