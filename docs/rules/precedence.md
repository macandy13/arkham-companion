# Precedence

- [Golden rules](https://arkhamdb.com/rules#The_Golden_Rules): card text beats the Rules Reference, which beats Learn to Play.
- [Grim rule](https://arkhamdb.com/rules#The_Grim_Rule): if a rules question can't be answered, resolve it in the way worst for the investigators. This is a table fallback, not something the engine models.
- [Choices](https://arkhamdb.com/rules#Choices_and_the_Grim_Rule), [lead investigator](https://arkhamdb.com/rules#Lead_Investigator): when the group must choose between valid options (ties for hunter movement, prey, the spawn location of an enemy no investigator spawns, order of simultaneous forced effects), the lead investigator decides.
  - The app turns each such choice into a `Decision`.
    Test: [`packages/engine/src/hunters.test.ts › MoveHunters › ties › asks which investigator to hunt when equally near investigators lead apart`](../../packages/engine/src/hunters.test.ts#L214)
    Test: [`packages/engine/src/enemies.test.ts › SpawnEnemy › asks the players when prey is tied, and engaging answers the question`](../../packages/engine/src/enemies.test.ts#L362)
  - If the lead investigator is eliminated, the remaining players pick a new one.
    Test: [`packages/engine/src/elimination.test.ts › the lead investigator leaving › asks the group for a new lead when several investigators remain`](../../packages/engine/src/elimination.test.ts#L260)
    Test: [`packages/engine/src/elimination.test.ts › the lead investigator leaving › makes the last remaining investigator the lead without asking`](../../packages/engine/src/elimination.test.ts#L304)
- [Simultaneous resolution](https://arkhamdb.com/rules#Priority_of_Simultaneous_Resolution): individual choices for an effect that hits several players are made in player order, then the effect applies to all at once. The lead investigator orders forced abilities and lasting effects that would resolve at the same time.
  Test: [`packages/engine/src/phases.test.ts › mythos phase › places 1 doom on the agenda (1.2) and lets each investigator draw in player order (1.4)`](../../packages/engine/src/phases.test.ts#L200)
  Test: [`packages/engine/src/triggers.test.ts › an effect repeated for each investigator › asks bob first while he is the lead investigator, as player order begins with the lead`](../../packages/engine/src/triggers.test.ts#L3157)
  Test: [`packages/scenarios/src/spreading_flames/cards.test.ts › Spreading Flames card abilities › Past Curfew and Lit Up advancing › tests alice, then bob, on $skill (3) as $agenda advances; only bob, who fails, takes 1 $wound`](../../packages/scenarios/src/spreading_flames/cards.test.ts#L983)
