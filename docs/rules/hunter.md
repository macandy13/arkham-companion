# Hunter

[Hunter](https://arkhamdb.com/rules#Hunter), [nearest](https://arkhamdb.com/rules#Nearest).

- In enemy step 1, each **ready, unengaged** hunter moves one connection along the shortest path toward the nearest investigator. It doesn't move if an investigator is already at its location; with "Prey – … only" only an investigator its prey picks keeps it there ([prey.md](prey.md)).
  Test: [`packages/engine/src/hunters.test.ts › MoveHunters › moves a hunter one step along the path to the investigator`](../../packages/engine/src/hunters.test.ts#L70)
  Test: [`packages/engine/src/hunters.test.ts › MoveHunters › heads for the nearest investigator`](../../packages/engine/src/hunters.test.ts#L138)
  Test: [`packages/engine/src/hunters.test.ts › MoveHunters › does not move exhausted, engaged or non-hunter enemies`](../../packages/engine/src/hunters.test.ts#L123)
  Test: [`packages/engine/src/hunters.test.ts › MoveHunters › does not move a hunter that $name`](../../packages/engine/src/hunters.test.ts#L117)
  Test: [`packages/engine/src/hunters.test.ts › MoveHunters with "Prey – Bob only" › moves towards bob past a nearer alice`](../../packages/engine/src/hunters.test.ts#L298)
  Test: [`packages/engine/src/hunters.test.ts › MoveHunters with "Prey – Bob only" › leaves alice at its location and moves on towards bob`](../../packages/engine/src/hunters.test.ts#L310)
- "Nearest" counts connections even through moves a card blocks. A hunter never steps into a location a card closes to it (Barricade): it takes another equally short step if there is one, else it doesn't move. That holds after the players picked whom it hunts too.
  Test: [`packages/engine/src/player_cards.test.ts › a location closed to enemies (Barricade) › $name`](../../packages/engine/src/player_cards.test.ts#L198)
  Test: [`packages/engine/src/player_cards.test.ts › a location closed to enemies (Barricade) › sends a hunter along the other equally short way, round the hall`](../../packages/engine/src/player_cards.test.ts#L206)
  Test: [`packages/engine/src/player_cards.test.ts › a location closed to enemies (Barricade) › keeps a hunter out on its way to the investigator the players chose`](../../packages/engine/src/player_cards.test.ts#L220)
- Equidistant investigators: prey picks the target; if prey doesn't decide it or there is none, the lead investigator does. The lead investigator also picks between several shortest paths.
  Test: [`packages/engine/src/hunters.test.ts › MoveHunters › ties › lets prey pick between equally near investigators`](../../packages/engine/src/hunters.test.ts#L246)
  Test: [`packages/engine/src/hunters.test.ts › MoveHunters › ties › asks which investigator to hunt when equally near investigators lead apart`](../../packages/engine/src/hunters.test.ts#L214)
  Test: [`packages/engine/src/hunters.test.ts › MoveHunters › ties › asks for the destination when two shortest paths differ`](../../packages/engine/src/hunters.test.ts#L167)
  Test: [`packages/engine/src/hunters.test.ts › MoveHunters › ties › asks for the destination after prey picked one investigator with two routes`](../../packages/engine/src/hunters.test.ts#L279)
  Test: [`packages/engine/src/hunters.test.ts › MoveHunters › ties › engages the investigator the players chose when the hunter can reach them`](../../packages/engine/src/hunters.test.ts#L233)
- Several hunters move one at a time, in an order the lead investigator picks, each with its own choices before the next moves. This is our reading of [Choices](https://arkhamdb.com/rules#Choices_and_the_Grim_Rule); no rule says it explicitly.
  Test: [`packages/engine/src/hunters.test.ts › MoveHunters order › asks the lead investigator for the order when two hunters would move, and moves none`](../../packages/engine/src/hunters.test.ts#L346)
  Test: [`packages/engine/src/hunters.test.ts › answering the hunter order › resolves the chosen hunter's own tie decision before the other hunter moves`](../../packages/engine/src/hunters.test.ts#L509)
- A card effect on "the nearest [[Cultist]] enemy" (Mysterious Chanting; Raising Suspicions, Aerial Pursuit) counts connections from the location of the investigator resolving it; an engaged enemy is at its investigator's location.
  Test: [`packages/engine/src/triggers.test.ts › doom on the nearest Cultist enemy, or a search for one › places 2 doom on the cultist in the cellar, not on the one in the attic or the nearer monster`](../../packages/engine/src/triggers.test.ts#L2935)
  Test: [`packages/engine/src/triggers.test.ts › doom on the nearest Cultist enemy, or a search for one › counts a cultist engaged with alice as at her location`](../../packages/engine/src/triggers.test.ts#L2949)
  Test: [`packages/scenarios/src/the_midnight_masks/cards.test.ts › The Midnight Masks card abilities › Mysterious Chanting › places 2 doom on the nearest Cultist, not on a Nightgaunt`](../../packages/scenarios/src/the_midnight_masks/cards.test.ts#L564)
  - Over one-way connections that is the way from the investigator to the enemy, the opposite of how a hunter counts its way to an investigator (our reading of "can be reached in the fewest number of connections", [Nearest](https://arkhamdb.com/rules#Nearest)).
    Test: [`packages/engine/src/triggers.test.ts › doom on the nearest Cultist enemy, or a search for one › counts a one-way connection from alice: the cultist she can reach in 1 gets the doom`](../../packages/engine/src/triggers.test.ts#L2961)
  - An enemy with no path there still counts, as farther than every enemy with one (FAQ: "Even if it has no valid path to an investigator, an enemy can still qualify as the 'nearest' enemy", asked about Mysterious Chanting).
    Test: [`packages/engine/src/triggers.test.ts › doom on the nearest Cultist enemy, or a search for one › places the doom on a cultist with no path to alice when no other cultist is in play`](../../packages/engine/src/triggers.test.ts#L3001)
    Test: [`packages/engine/src/triggers.test.ts › doom on the nearest Cultist enemy, or a search for one › prefers a cultist alice can reach over one with no path to her`](../../packages/engine/src/triggers.test.ts#L3013)
  - The lead investigator picks between equally near enemies ([Choices](https://arkhamdb.com/rules#Choices_and_the_Grim_Rule)).
    Test: [`packages/engine/src/triggers.test.ts › doom on the nearest Cultist enemy, or a search for one › lets the lead investigator pick between two cultists equally near`](../../packages/engine/src/triggers.test.ts#L2976)
- "The nearest location without Fire! attached" counts the same way from the drawer's location, which is 0 away, so it is the nearest unless it has a Fire! already; the lead investigator picks between equally near ones.
  Test: [`packages/scenarios/src/spreading_flames/cards.test.ts › Spreading Flames card abilities › Fire! › attaches to alice's own location, the nearest, when it has no Fire!`](../../packages/scenarios/src/spreading_flames/cards.test.ts#L798)
  Test: [`packages/engine/src/attachment_targets.test.ts › a treachery that attaches to the nearest location without a copy (Fire!) › asks alice, the lead, between the study and the cellar, each 1 away`](../../packages/engine/src/attachment_targets.test.ts#L155)
- A card effect that moves an enemy "1 location towards" a location (They're Getting Out!) moves it one connection along a shortest path there, exhausted or not.
  Test: [`packages/engine/src/enemies.test.ts › MoveEnemy toward a location › moves an enemy in the attic one location towards the hall, into the cellar`](../../packages/engine/src/enemies.test.ts#L704)
  Test: [`packages/engine/src/enemies.test.ts › MoveEnemy toward a location › moves an exhausted enemy too`](../../packages/engine/src/enemies.test.ts#L722)
  - Equally short ways go to the lead investigator ([Choices](https://arkhamdb.com/rules#Choices_and_the_Grim_Rule)); an enemy with no path, or already there, stays.
    Test: [`packages/engine/src/enemies.test.ts › MoveEnemy toward a location › lets the lead investigator pick between two equally short ways`](../../packages/engine/src/enemies.test.ts#L749)
    Test: [`packages/engine/src/enemies.test.ts › MoveEnemy toward a location › leaves the enemy in the cellar when $name`](../../packages/engine/src/enemies.test.ts#L737)
  - Arriving ready at an investigator's location, it engages as any moving enemy does.
    Test: [`packages/engine/src/enemies.test.ts › MoveEnemy toward a location › engages alice when the enemy arrives at her location`](../../packages/engine/src/enemies.test.ts#L714)
- [Patrol](https://arkhamdb.com/rules#Patrol) works the same way but toward the target its text names (a location, a direction or a scenario card, 2026 Core rulebook p. 17).
  - It doesn't move if it's already there, and the lead investigator picks between equal targets.
  - Chapter One names a location; Chapter Two also names an enemy (Julia Stern: "nearest [[Civilian]] enemy") or a filtered location (Factory Worker: "nearest location with no [[Elite]] enemies").
