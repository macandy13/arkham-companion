# Spawn and engagement

[Spawn](https://arkhamdb.com/rules#Spawn), [spawning an enemy](https://arkhamdb.com/rules#Spawning_an_Enemy), [engagement](https://arkhamdb.com/rules#Enemy_Engagement).

- A "Spawn –" instruction applies whenever the enemy enters play, not only when drawn. A card effect that spawns an enemy somewhere specific overrides the printed instruction.
  Test: [`packages/engine/src/enemies.test.ts › SpawnEnemy › $name`](../../packages/engine/src/enemies.test.ts#L120)
- No spawn instruction: the enemy spawns engaged with the investigator who drew it.
  Test: [`packages/engine/src/enemies.test.ts › SpawnEnemy › with alice (1 clue) and bob (3 clues) at the hall › engages the drawer whatever the prey, without a spawn instruction`](../../packages/engine/src/enemies.test.ts#L227)
- No legal location: the enemy is discarded instead.
  Test: [`packages/engine/src/enemies.test.ts › SpawnEnemy › discards the enemy when the named location is not in play`](../../packages/engine/src/enemies.test.ts#L184)
- Several valid locations: the investigator spawning it chooses: the one who drew it, or the lead investigator when no investigator spawns it ([Choices](https://arkhamdb.com/rules#Choices_and_the_Grim_Rule)).
  Test: [`packages/engine/src/enemies.test.ts › SpawnEnemy › asks the players when the spawn keyword matches several locations`](../../packages/engine/src/enemies.test.ts#L141)
  Test: [`packages/engine/src/enemies.test.ts › SpawnEnemy with "Spawn - Any empty location" › leaves the pick to $decider.kind after $spawnedBy`](../../packages/engine/src/enemies.test.ts#L1266)
- Prey never affects where an enemy spawns, except where the instruction names it: "Spawn – Engaged with prey" (The Masked Hunter) spawns the enemy engaged with the investigator its prey picks among all investigators, wherever they are, not the one who drew it. A tie goes to the lead investigator.
  Test: [`packages/engine/src/enemies.test.ts › SpawnEnemy with "Spawn - Engaged with prey" and prey "Most clues" › spawns engaged with the investigator its prey picks, wherever they are, not the drawer`](../../packages/engine/src/enemies.test.ts#L1317)
  Test: [`packages/engine/src/enemies.test.ts › SpawnEnemy with "Spawn - Engaged with prey" and prey "Most clues" › asks the lead investigator on a tie, and the answer spawns it engaged with the chosen one`](../../packages/engine/src/enemies.test.ts#L1332)
- "Spawn – Any empty location" (Acolyte, Wizard of the Order): an [empty location](https://arkhamdb.com/rules#Empty_Location) has no enemies and no investigators at it.
  Test: [`packages/engine/src/enemies.test.ts › SpawnEnemy with "Spawn - Any empty location" › spawns at the only location without investigators and enemies`](../../packages/engine/src/enemies.test.ts#L1206)
  - Other cards there, such as a story asset, don't count.
    Test: [`packages/engine/src/enemies.test.ts › SpawnEnemy with "Spawn - Any empty location" › counts a location with only a story asset as empty`](../../packages/engine/src/enemies.test.ts#L1221)
  - With none, the enemy is discarded.
    Test: [`packages/engine/src/enemies.test.ts › SpawnEnemy with "Spawn - Any empty location" › discards the enemy when no location is empty`](../../packages/engine/src/enemies.test.ts#L1283)
- "Spawn – Any location (empty, if able)": an empty location if there is one, else any location.
  Test: [`packages/engine/src/enemies.test.ts › SpawnEnemy with a filtered spawn instruction › spawns "Any location (empty, if able)" in the only empty location`](../../packages/engine/src/enemies.test.ts#L1433)
  Test: [`packages/engine/src/enemies.test.ts › SpawnEnemy with a filtered spawn instruction › asks among every location for "Any location (empty, if able)" when none is empty`](../../packages/engine/src/enemies.test.ts#L1444)
- "Nearest / Farthest (empty) location", "Location farthest from you", "A or B (whichever is nearest to you)": counted in connections from the location of the investigator spawning the enemy (for the forms that don't say "you", our reading; not the same as [Farthest from all investigators](https://arkhamdb.com/rules#Farthest_from_all_investigators)).
  Test: [`packages/engine/src/enemies.test.ts › SpawnEnemy with a filtered spawn instruction › spawns "$spawn" in the $spawnsIn`](../../packages/engine/src/enemies.test.ts#L1389)
  Test: [`packages/engine/src/enemies.test.ts › SpawnEnemy with a filtered spawn instruction › spawns "Location nearest to you" in your location, engaged with you`](../../packages/engine/src/enemies.test.ts#L1399)
  - A location with no path there counts as farther than every location with one, so it can still be the nearest when nothing else qualifies ([FAQ on Mysterious Chanting](https://arkhamdb.com/card/03139), see [hunter.md](hunter.md); for "farthest", our reading).
    Test: [`packages/engine/src/enemies.test.ts › SpawnEnemy with a filtered spawn instruction › counts a location with no path there as the farthest`](../../packages/engine/src/enemies.test.ts#L1409)
  - With nobody spawning it, the players choose among the locations that meet the rest of the instruction (for example, the empty ones), our reading.
    Test: [`packages/engine/src/enemies.test.ts › SpawnEnemy with a filtered spawn instruction › lets the players choose among the empty locations when nobody spawns a "Farthest" enemy`](../../packages/engine/src/enemies.test.ts#L1488)
    Test: [`packages/engine/src/enemies.test.ts › SpawnEnemy with a filtered spawn instruction › lets the players choose among all locations when nobody spawns a "connected to yours" enemy`](../../packages/engine/src/enemies.test.ts#L1473)
- "Any [[Trait]] location", "Location with the most clues", "Any location connected to yours": the locations in play that match; ties go to the investigator spawning it.
  Test: [`packages/engine/src/enemies.test.ts › SpawnEnemy with a filtered spawn instruction › asks between the locations tied for the most clues`](../../packages/engine/src/enemies.test.ts#L1420)
- "X. Otherwise, Y." (Jeremiah Pierce): Y only when X gives no location in play.
- An enemy is either engaged (in an investigator's threat area, which counts as that investigator's location and moves with them) or unengaged at a location.
- A **ready, unengaged** enemy engages as soon as it shares a location with an investigator: when it spawns there, moves there, or an investigator moves in.
  Test: [`packages/engine/src/enemies.test.ts › SpawnEnemy › produces a move and an engagement`](../../packages/engine/src/enemies.test.ts#L129)
  Test: [`packages/engine/src/enemies.test.ts › MoveEnemy toward a location › engages alice when the enemy arrives at her location`](../../packages/engine/src/enemies.test.ts#L716)
  - With several investigators present, [prey](prey.md) decides, then the lead investigator.
    Test: [`packages/engine/src/enemies.test.ts › MoveEnemy › asks the players whom it engages when two investigators are there`](../../packages/engine/src/enemies.test.ts#L647)
  - There is no limit on enemies engaged with one investigator.
- Engaging an enemy and being engaged by it are the same ([engage action](https://arkhamdb.com/rules#Engage_Action)), so "after [this enemy] engages you" (Rogue Gangster) fires however the engagement came about: spawning engaged, a move by either side, the engage action or a card's "engages you".
  Test: [`packages/engine/src/triggers.test.ts › trigger bus › abilities after an engagement or a clue discovery › deals alice 1 horror when the lurker $name`](../../packages/engine/src/triggers.test.ts#L906)
- An exhausted enemy doesn't engage, but engages the moment it readies if it shares a location with an investigator.
  Test: [`packages/engine/src/phases.test.ts › upkeep phase › readies exhausted enemies (4.3), which engage investigators at their location`](../../packages/engine/src/phases.test.ts#L532)
  Test: [`packages/engine/src/enemies.test.ts › SpawnEnemy › never engages an exhausted enemy`](../../packages/engine/src/enemies.test.ts#L201)
- A card effect that moves an enemy ("move it to the Hallway") needs no connection unless its text says "connecting location" (Elusive does).
  Test: [`packages/engine/src/enemies.test.ts › MoveEnemy › moves an enemy to a location it has no connection to, without revealing it`](../../packages/engine/src/enemies.test.ts#L600)
  - An engaged enemy otherwise moves only with its investigator ([Enemy Engagement](https://arkhamdb.com/rules#Enemy_Engagement)). A card effect that moves an enemy moves it even when engaged, and it disengages, unless its text names unengaged enemies (They're Getting Out!); Elusive disengages, then moves. Our reading: no official ruling found, only player consensus. Stop the Rite's "each Cultist enemy moves once toward Underground Cistern" moves engaged Cultists too (the engine's `forced` move), and so does Aerial Pursuit's "the nearest non-[[Elite]] enemy moves once toward your location".
    Test: [`packages/engine/src/enemies.test.ts › MoveEnemy › disengages an engaged enemy and moves it by a forced instruction`](../../packages/engine/src/enemies.test.ts#L611)
    Test: [`packages/engine/src/enemies.test.ts › MoveEnemy toward a location › disengages an enemy engaged with alice in the hall and moves it into the cellar when the move is forced`](../../packages/engine/src/enemies.test.ts#L796)
    Test: [`packages/engine/src/enemies.test.ts › MoveEnemy toward a location › rejects moving an engaged enemy, which moves only with its investigator`](../../packages/engine/src/enemies.test.ts#L786)
  - At the destination it engages by the rule above.
- A card that swaps an investigator and an enemy (Ethereal Slip: "swap places with that enemy") moves each to the other's location at once, ignoring connections: the enemy leaves any engagement, the investigator takes the enemies engaged with them along, and only then do ready, unengaged enemies engage at both locations, so the two never engage each other (our reading of [Enemy Engagement](https://arkhamdb.com/rules#Enemy_Engagement); no official ruling found).
  Test: [`packages/engine/src/enemies.test.ts › SwapPlaces › moves alice to the ghoul in the attic and the ghoul to the hall, neither engaging the other`](../../packages/engine/src/enemies.test.ts#L858)
  Test: [`packages/engine/src/enemies.test.ts › SwapPlaces › takes the rat engaged with alice along and disengages the ghoul from bob in the cellar`](../../packages/engine/src/enemies.test.ts#L877)
  Test: [`packages/engine/src/enemies.test.ts › SwapPlaces › lets the ghoul engage bob, who stays behind in the hall`](../../packages/engine/src/enemies.test.ts#L867)
  Test: [`packages/engine/src/enemies.test.ts › SwapPlaces › engages alice with a ready rat waiting where the ghoul was`](../../packages/engine/src/enemies.test.ts#L893)
  - The investigator's half is a card effect's move: it pays an enter cost, reveals the location and opens "after you enter" (our reading).
    Test: [`packages/engine/src/enemies.test.ts › SwapPlaces › lets alice take 1 horror from the attic, which she enters by the swap`](../../packages/engine/src/enemies.test.ts#L905)
  - Where a card keeps the enemy out of the investigator's location (Barricade: "Non-[[Elite]] enemies cannot move into attached location"), the swap doesn't happen at all, rather than only the investigator's half (our reading).
    Test: [`packages/engine/src/enemies.test.ts › SwapPlaces › rejects the swap when a card keeps the ghoul out of the hall, as Barricade does`](../../packages/engine/src/enemies.test.ts#L921)
  - When the investigator and the enemy already share a location, nothing happens.
    Test: [`packages/engine/src/enemies.test.ts › SwapPlaces › changes nothing when alice and the ghoul share the hall`](../../packages/engine/src/enemies.test.ts#L939)
  - The app offers the swap only for a non-Elite enemy at another location; whether it is within 2 connections, or at a revealed location, is for the players to judge.
    Test: [`packages/engine/src/board_view.test.ts › enemy actions › card effects: $name`](../../packages/engine/src/board_view.test.ts#L2007)
- A card that says an enemy "engages you" puts it in your threat area even from another location: it ends up at your location without moving, so no connection is needed and nothing that triggers on a move fires (our reading of [Enemy Engagement](https://arkhamdb.com/rules#Enemy_Engagement); a card that means a move says "moves to … and engages you"). It works on exhausted and aloof enemies too.
  Test: [`packages/engine/src/enemy_effects.test.ts › a card effect that makes an enemy engage you › engages alice with the ghoul that starts $ghoulStarts`](../../packages/engine/src/enemy_effects.test.ts#L276)
  - An enemy already engaged with you stays as it is; one engaged with another investigator leaves their threat area for yours ([Engage Action](https://arkhamdb.com/rules#Engage_Action)).
  - A massive enemy never goes into a threat area, so "engages you" changes nothing for it, and one at another location stays there (our reading of [Massive](https://arkhamdb.com/rules#Massive)).
    Test: [`packages/engine/src/enemy_effects.test.ts › a card effect that makes an enemy engage you › leaves a massive ghoul where it is`](../../packages/engine/src/enemy_effects.test.ts#L295)
- [Aloof](https://arkhamdb.com/rules#Aloof): never engages on its own and spawns unengaged. It can only be engaged by the engage action or a card, and can't be attacked while unengaged.
  Test: [`packages/engine/src/enemies.test.ts › SpawnEnemy › $name`](../../packages/engine/src/enemies.test.ts#L120)
  Test: [`packages/engine/src/skill_tests.test.ts › Fight › rejects attacking an aloof enemy nobody is engaged with`](../../packages/engine/src/skill_tests.test.ts#L463)
  Test: [`packages/engine/src/skill_tests.test.ts › Evade › rejects an aloof enemy at the location that nobody is engaged with`](../../packages/engine/src/skill_tests.test.ts#L732)
- [Being at no location](https://arkhamdb.com/rules#Being_at_No_Location): enemies and investigators must always be at a location, and effects that would remove them from one are ignored.
