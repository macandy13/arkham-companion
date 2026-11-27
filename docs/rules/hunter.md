# Hunter

[Hunter](https://arkhamdb.com/rules#Hunter), [nearest](https://arkhamdb.com/rules#Nearest).

- In enemy step 1, each **ready, unengaged** hunter moves one connection along the shortest path toward the nearest investigator. It doesn't move if an investigator is already at its location; with "Prey – … only" only an investigator its prey picks keeps it there ([prey.md](prey.md)).
  Test: `packages/engine/src/hunters.test.ts › MoveHunters › moves a hunter one step along the path to the investigator`
  Test: `packages/engine/src/hunters.test.ts › MoveHunters › heads for the nearest investigator`
  Test: `packages/engine/src/hunters.test.ts › MoveHunters › does not move exhausted, engaged or non-hunter enemies`
  Test: `packages/engine/src/hunters.test.ts › MoveHunters › does not move a hunter that $name`
  Test: `packages/engine/src/hunters.test.ts › MoveHunters with "Prey – Bob only" › moves towards bob past a nearer alice`
  Test: `packages/engine/src/hunters.test.ts › MoveHunters with "Prey – Bob only" › leaves alice at its location and moves on towards bob`
- "Nearest" counts connections even through moves a card blocks. If the next step on the path is blocked by a card, the hunter doesn't move.
- Equidistant investigators: prey picks the target; if prey doesn't decide it or there is none, the lead investigator does. The lead investigator also picks between several shortest paths.
  Test: `packages/engine/src/hunters.test.ts › MoveHunters › ties › lets prey pick between equally near investigators`
  Test: `packages/engine/src/hunters.test.ts › MoveHunters › ties › asks which investigator to hunt when equally near investigators lead apart`
  Test: `packages/engine/src/hunters.test.ts › MoveHunters › ties › asks for the destination when two shortest paths differ`
- Several hunters move one at a time, in an order the lead investigator picks, each with its own choices before the next moves. This is our reading of [Choices](https://arkhamdb.com/rules#Choices_and_the_Grim_Rule); no rule says it explicitly.
  Test: `packages/engine/src/hunters.test.ts › MoveHunters order › asks the lead investigator for the order when two hunters would move, and moves none`
  Test: `packages/engine/src/hunters.test.ts › answering the hunter order › resolves the chosen hunter's own tie decision before the other hunter moves`
- A card effect on "the nearest [[Cultist]] enemy" (Mysterious Chanting; Raising Suspicions, Aerial Pursuit) counts connections from the location of the investigator resolving it; an engaged enemy is at its investigator's location.
  - Over one-way connections that is the way from the investigator to the enemy, the opposite of how a hunter counts its way to an investigator (our reading of "can be reached in the fewest number of connections", [Nearest](https://arkhamdb.com/rules#Nearest)).
  - An enemy with no path there still counts, as farther than every enemy with one (FAQ: "Even if it has no valid path to an investigator, an enemy can still qualify as the 'nearest' enemy", asked about Mysterious Chanting).
  - The lead investigator picks between equally near enemies ([Choices](https://arkhamdb.com/rules#Choices_and_the_Grim_Rule)).
- "The nearest location without Fire! attached" counts the same way from the drawer's location, which is 0 away, so it is the nearest unless it has a Fire! already; the lead investigator picks between equally near ones.
- A card effect that moves an enemy "1 location towards" a location (They're Getting Out!) moves it one connection along a shortest path there, exhausted or not.
  - Equally short ways go to the lead investigator ([Choices](https://arkhamdb.com/rules#Choices_and_the_Grim_Rule)); an enemy with no path, or already there, stays.
  - Arriving ready at an investigator's location, it engages as any moving enemy does.
- [Patrol](https://arkhamdb.com/rules#Patrol) works the same way but toward the target its text names (a location, a direction or a scenario card, 2026 Core rulebook p. 17).
  - It doesn't move if it's already there, and the lead investigator picks between equal targets.
  - Chapter One names a location; Chapter Two also names an enemy (Julia Stern: "nearest [[Civilian]] enemy") or a filtered location (Factory Worker: "nearest location with no [[Elite]] enemies").
