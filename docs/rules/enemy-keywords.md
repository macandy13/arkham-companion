# Enemy keywords

Card rulings: [Children of Blood](cards/children-of-blood.md) (Predator).

- [Massive](https://arkhamdb.com/rules#Massive): when ready it counts as engaged with every investigator at its location, but it never sits in a threat area and doesn't follow investigators who move away.
  Test: [`packages/engine/src/enemies.test.ts › engagement commands › rejects engaging a massive enemy, which already counts as engaged with everyone at its location`](../../packages/engine/src/enemies.test.ts#L538)
  Test: [`packages/engine/src/enemy_effects.test.ts › a card effect that makes an enemy engage you › leaves a massive ghoul where it is`](../../packages/engine/src/enemy_effects.test.ts#L295)
  Test: [`packages/engine/src/skill_tests.test.ts › Fight › can attack a massive aloof enemy, which counts as engaged with everyone at its location`](../../packages/engine/src/skill_tests.test.ts#L488)
  - In the enemy phase it attacks each of them in an order the lead investigator picks, and exhausts after the last attack.
    Test: [`packages/engine/src/enemies.test.ts › enemyAttackList › includes a ready massive enemy for every investigator at its location`](../../packages/engine/src/enemies.test.ts#L1080)
    Test: [`packages/engine/src/phases.test.ts › enemy phase › exhausts a massive enemy only after it attacked everyone at its location`](../../packages/engine/src/phases.test.ts#L465)
  - When exhausted it is engaged with nobody.
  - Its attack of opportunity only hits the investigator who provoked it.
    Test: [`packages/engine/src/attacks_of_opportunity.test.ts › attacks of opportunity › includes a ready massive enemy at the investigator location`](../../packages/engine/src/attacks_of_opportunity.test.ts#L244)
  - A failed attack against it hits no other investigator.
  - Investigators who become engaged mid-attack are added to its targets, and if it exhausts early its remaining attacks are skipped.
- [Retaliate](https://arkhamdb.com/rules#Retaliate): when an investigator fails an attack (combat test) against it while it is ready, it attacks that investigator after the test's results. It doesn't exhaust, and engagement doesn't matter.
  Test: [`packages/engine/src/forced_attacks.test.ts › retaliate › asks alice to resolve the attack of the ready retaliate enemy she failed to hit`](../../packages/engine/src/forced_attacks.test.ts#L91)
  Test: [`packages/engine/src/forced_attacks.test.ts › retaliate › deals the attack and leaves the enemy ready`](../../packages/engine/src/forced_attacks.test.ts#L101)
  Test: [`packages/engine/src/forced_attacks.test.ts › retaliate › first deals the failed attack to bob, who is engaged with the enemy, then attacks alice`](../../packages/engine/src/forced_attacks.test.ts#L134)
- [Alert](https://arkhamdb.com/rules#Alert): when an investigator fails an evade (evasion test) against it while it is ready, it attacks after the test's results. It doesn't exhaust, and engagement doesn't matter.
  Test: [`packages/engine/src/forced_attacks.test.ts › alert › asks alice to resolve the attack of the alert enemy she failed to evade`](../../packages/engine/src/forced_attacks.test.ts#L170)
  Test: [`packages/engine/src/forced_attacks.test.ts › alert › deals the attack, and the enemy stays ready and engaged with alice`](../../packages/engine/src/forced_attacks.test.ts#L180)
  - The [2026 Core rulebook](https://images-cdn.fantasyflightgames.com/filer_public/0e/d0/0ed09507-1705-47ed-a630-cd15885cabb0/ahc100_rulebook-web.pdf) (keyword glossary: "fails an evasion test targeting a ready enemy with the alert keyword") names "ready"; the older Rules Reference text leaves it out.
    Test: [`packages/engine/src/forced_attacks.test.ts › alert › does not attack after $name`](../../packages/engine/src/forced_attacks.test.ts#L202)
- An exhausted enemy makes no keyword, attack-of-opportunity or enemy-phase attack (2026 Core rulebook: exhausted enemies "do not perform attacks of opportunity" and do not attack in the enemy phase; retaliate and alert name a ready enemy). Any of these attacks can be cancelled by a card ([Cancel](https://arkhamdb.com/rules#Cancel)).
  Test: [`packages/engine/src/attacks_of_opportunity.test.ts › attacks of opportunity › does not ask when the engaged enemy is exhausted`](../../packages/engine/src/attacks_of_opportunity.test.ts#L317)
  Test: [`packages/engine/src/forced_attacks.test.ts › retaliate › does not attack after $name`](../../packages/engine/src/forced_attacks.test.ts#L160)
  Test: [`packages/engine/src/forced_attacks.test.ts › retaliate › deals nothing when the players cancel the attack`](../../packages/engine/src/forced_attacks.test.ts#L118)
- [Elusive](https://arkhamdb.com/rules#Elusive) (also on Core Set (2026) cards, e.g. Bat Horror): after it attacks or is attacked while ready, it disengages, moves to a connecting location (without investigators if possible) and exhausts.
  Test: [`packages/engine/src/elusive.test.ts › an elusive enemy after it attacks or is attacked › retreats after it attacks`](../../packages/engine/src/elusive.test.ts#L198)
  Test: [`packages/engine/src/elusive.test.ts › RetreatEnemy › moves to the connecting location without investigators, disengaged and exhausted`](../../packages/engine/src/elusive.test.ts#L43)
  - It retreats after the attack resolves, whether or not it was engaged with the attacker. "Is attacked" means a fight against it, hit or miss; a hit that defeats it leaves nothing to retreat. On a miss a retaliate enemy attacks first and retreats after that attack, or right away when the players cancel it.
    Test: [`packages/engine/src/elusive.test.ts › an elusive enemy after it attacks or is attacked › stays defeated when the hit defeats it`](../../packages/engine/src/elusive.test.ts#L154)
    Test: [`packages/engine/src/elusive.test.ts › an elusive enemy after it attacks or is attacked › retaliates on a miss first, then retreats after that attack`](../../packages/engine/src/elusive.test.ts#L165)
    Test: [`packages/engine/src/elusive.test.ts › an elusive enemy after it attacks or is attacked › retreats on a miss when the players cancel the retaliate attack`](../../packages/engine/src/elusive.test.ts#L182)
  - The app checks "ready" as the retreat resolves, so an effect that exhausts it in between (none known) stops the retreat.
    Test: [`packages/engine/src/elusive.test.ts › RetreatEnemy › does nothing for an exhausted enemy`](../../packages/engine/src/elusive.test.ts#L95)
  - It goes one connection, to a connecting location with no investigators if there is one, otherwise to any connecting location; never into one closed to it (Barricade).
    Test: [`packages/engine/src/elusive.test.ts › RetreatEnemy › moves to the connecting location without investigators, disengaged and exhausted`](../../packages/engine/src/elusive.test.ts#L43)
    Test: [`packages/engine/src/elusive.test.ts › MoveEnemy away from investigators › rejects a chosen location that does not connect to the enemy's`](../../packages/engine/src/elusive.test.ts#L107)
    Test: [`packages/engine/src/player_cards.test.ts › a location closed to enemies (Barricade) › sends an elusive enemy to the other connecting location, though Bob is there`](../../packages/engine/src/player_cards.test.ts#L242)
  - Between equal destinations the lead investigator picks; with no connecting location it only disengages and exhausts.
    Test: [`packages/engine/src/elusive.test.ts › RetreatEnemy › asks the lead between connecting locations without investigators, and moves there`](../../packages/engine/src/elusive.test.ts#L54)
    Test: [`packages/engine/src/elusive.test.ts › RetreatEnemy › only disengages and exhausts without a connecting location`](../../packages/engine/src/elusive.test.ts#L83)
  - It engages nobody where it arrives, even at an investigator's location (our reading, unverified: the text says it moves, then exhausts, and a ready enemy that moves to an investigator engages; no official ruling found). The engine exhausts it before the move to get there.
- Doomed (Core Set (2026), reminder text on [Bystander](https://arkhamdb.com/card/12123)): when the enemy is defeated, by an investigator or a scenario effect, place 1 doom on the current agenda.
  Test: [`packages/engine/src/doomed.test.ts › Doomed › places 1 doom on Past Curfew, threshold 3, when 1 damage defeats the bystander`](../../packages/engine/src/doomed.test.ts#L36)
  - This can make the agenda advance: the app checks the doom threshold right away and asks to advance.
    Test: [`packages/engine/src/doomed.test.ts › Doomed › asks to advance Past Curfew, threshold 1, when that doom reaches it`](../../packages/engine/src/doomed.test.ts#L50)
  - Discarding the enemy (e.g. Factory Worker's Parley) is not defeating it, so Doomed doesn't trigger (2026 Core rules: "An effect that 'discards' an enemy is not considered to defeat that enemy"; reported from the campaign guide, not checked in the PDF).
    Test: [`packages/engine/src/doomed.test.ts › Doomed › places no doom when the bystander is discarded, which is no defeat`](../../packages/engine/src/doomed.test.ts#L58)
- [Keywords](https://arkhamdb.com/rules#Keywords) in general: having the same keyword twice counts once. Keywords are mandatory unless their text says "may".
