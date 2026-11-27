# Enemy keywords

Card rulings: [Children of Blood](cards/children-of-blood.md) (Predator).

- [Massive](https://arkhamdb.com/rules#Massive): when ready it counts as engaged with every investigator at its location, but it never sits in a threat area and doesn't follow investigators who move away.
  - In the enemy phase it attacks each of them in an order the lead investigator picks, and exhausts after the last attack.
  - When exhausted it is engaged with nobody.
  - Its attack of opportunity only hits the investigator who provoked it.
  - A failed attack against it hits no other investigator.
  - Investigators who become engaged mid-attack are added to its targets, and if it exhausts early its remaining attacks are skipped.
- [Retaliate](https://arkhamdb.com/rules#Retaliate): when an investigator fails an attack (combat test) against it while it is ready, it attacks that investigator after the test's results. It doesn't exhaust, and engagement doesn't matter.
- [Alert](https://arkhamdb.com/rules#Alert): when an investigator fails an evade (evasion test) against it while it is ready, it attacks after the test's results. It doesn't exhaust, and engagement doesn't matter.
  - The [2026 Core rulebook](https://images-cdn.fantasyflightgames.com/filer_public/0e/d0/0ed09507-1705-47ed-a630-cd15885cabb0/ahc100_rulebook-web.pdf) (keyword glossary: "fails an evasion test targeting a ready enemy with the alert keyword") names "ready"; the older Rules Reference text leaves it out.
- An exhausted enemy makes no keyword, attack-of-opportunity or enemy-phase attack (2026 Core rulebook: exhausted enemies "do not perform attacks of opportunity" and do not attack in the enemy phase; retaliate and alert name a ready enemy). Any of these attacks can be cancelled by a card ([Cancel](https://arkhamdb.com/rules#Cancel)).
- [Elusive](https://arkhamdb.com/rules#Elusive) (also on Core Set (2026) cards, e.g. Bat Horror): after it attacks or is attacked while ready, it disengages, moves to a connecting location (without investigators if possible) and exhausts.
  - It retreats after the attack resolves, whether or not it was engaged with the attacker. "Is attacked" means a fight against it, hit or miss; a hit that defeats it leaves nothing to retreat. On a miss a retaliate enemy attacks first and retreats after that attack, or right away when the players cancel it.
    Test: `packages/engine/src/elusive.test.ts › an elusive enemy after it attacks or is attacked › retreats after it attacks`
    Test: `packages/engine/src/elusive.test.ts › an elusive enemy after it attacks or is attacked › stays defeated when the hit defeats it`
    Test: `packages/engine/src/elusive.test.ts › an elusive enemy after it attacks or is attacked › retaliates on a miss first, then retreats after that attack`
    Test: `packages/engine/src/elusive.test.ts › an elusive enemy after it attacks or is attacked › retreats on a miss when the players cancel the retaliate attack`
  - The app checks "ready" as the retreat resolves, so an effect that exhausts it in between (none known) stops the retreat.
    Test: `packages/engine/src/elusive.test.ts › RetreatEnemy › does nothing for an exhausted enemy`
  - It goes one connection, to a connecting location with no investigators if there is one, otherwise to any connecting location; never into one closed to it (Barricade).
    Test: `packages/engine/src/elusive.test.ts › RetreatEnemy › moves to the connecting location without investigators, disengaged and exhausted`
    Test: `packages/engine/src/elusive.test.ts › MoveEnemy away from investigators › rejects a chosen location that does not connect to the enemy's`
    Test: `packages/engine/src/player_cards.test.ts › a location closed to enemies (Barricade) › sends an elusive enemy to the other connecting location, though Bob is there`
  - Between equal destinations the lead investigator picks; with no connecting location it only disengages and exhausts.
    Test: `packages/engine/src/elusive.test.ts › RetreatEnemy › asks the lead between connecting locations without investigators, and moves there`
    Test: `packages/engine/src/elusive.test.ts › RetreatEnemy › only disengages and exhausts without a connecting location`
  - It engages nobody where it arrives, even at an investigator's location (our reading, unverified: the text says it moves, then exhausts, and a ready enemy that moves to an investigator engages; no official ruling found). The engine exhausts it before the move to get there.
- Doomed (Core Set (2026), reminder text on [Bystander](https://arkhamdb.com/card/12123)): when the enemy is defeated, by an investigator or a scenario effect, place 1 doom on the current agenda.
  - This can make the agenda advance: the app checks the doom threshold right away and asks to advance.
  - Discarding the enemy (e.g. Factory Worker's Parley) is not defeating it, so Doomed doesn't trigger (2026 Core rules: "An effect that 'discards' an enemy is not considered to defeat that enemy"; reported from the campaign guide, not checked in the PDF).
- [Keywords](https://arkhamdb.com/rules#Keywords) in general: having the same keyword twice counts once. Keywords are mandatory unless their text says "may".
