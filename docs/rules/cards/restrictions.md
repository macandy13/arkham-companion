# Restrictions ("cannot")

Card rulings for [Card abilities and modifiers](../card-abilities-and-modifiers.md).
"Cannot" is absolute: no ability or effect overrides it ([Cannot](https://arkhamdb.com/rules#Cannot)).
Each ruling below says what the card refuses, whom it binds and what still happens.

- The Parlor's unrevealed side ("You cannot move into the Parlor") refuses every move there, the move action and a card effect alike, until act 2 reveals it.
  Test: `packages/engine/src/restrictions.test.ts › a location nobody may move into while it is unrevealed (the Parlor) › rejects $move into it while unrevealed`
  Test: `packages/engine/src/restrictions.test.ts › a location nobody may move into while it is unrevealed (the Parlor) › lets alice in once it is revealed`
- Locked Door ("The attached location cannot be investigated") refuses every investigation there while it is attached, the action or a card ability that investigates.
  Test: `packages/engine/src/restrictions.test.ts › a treachery whose attached location cannot be investigated (Locked Door) › rejects investigating the hall while the door is attached to it`
  Test: `packages/engine/src/restrictions.test.ts › a treachery whose attached location cannot be investigated (Locked Door) › lets alice investigate the hall while the door is set aside`
  - Clues there can still be discovered by an ability that doesn't investigate (RR "Clues").
- The Masked Hunter ("While you are engaged with The Masked Hunter, you cannot discover or spend clues") binds only the investigator engaged with it.
  Test: `packages/engine/src/restrictions.test.ts › an enemy whose engaged investigator cannot discover or spend clues (The Masked Hunter) › rejects alice discovering a clue while the hunter is engaged with her`
  - Their investigation can still succeed but discovers nothing.
    Test: `packages/engine/src/restrictions.test.ts › an enemy whose engaged investigator cannot discover or spend clues (The Masked Hunter) › lets alice’s passed investigation end with $clues clues while the hunter is $hunter`
  - A card effect's "discover N clues" discovers none for them either ("cannot" is absolute, RR "Cannot").
    Test: `packages/engine/src/investigator_effects.test.ts › card effects that discover clues › discovers nothing for an investigator an engaged enemy forbids to discover clues`
  - Their clues can't pay a cost, the act's group spend included, while the others' still can.
    Test: `packages/engine/src/restrictions.test.ts › an enemy whose engaged investigator cannot discover or spend clues (The Masked Hunter) › counts only bob’s 2 clues toward the act while the hunter is engaged with alice`
    Test: `packages/engine/src/restrictions.test.ts › an enemy whose engaged investigator cannot discover or spend clues (The Masked Hunter) › rejects alice paying for the act while the hunter is engaged with her`
    Test: `packages/engine/src/restrictions.test.ts › an enemy whose engaged investigator cannot discover or spend clues (The Masked Hunter) › neither offers nor accepts alice an action that costs her own clue`
  - Placing their clues by an effect (False Lead's "place 1 of your clues on your location") is not spending, so it still happens (our reading: the Rules Reference spends clues only to pay costs).
- Dissonant Voices ("You cannot play assets or events") stops its investigator from playing any card, since only assets and events are played, fast ones and asset or event weaknesses included (skills are committed to tests, RR "Play", "Weakness").
  Test: `packages/engine/src/restrictions.test.ts › a treachery whose investigator cannot play assets or events (Dissonant Voices) › rejects alice playing a card, and leaves bob’s play to the players`
  - Committing skills is still allowed, and so is a card an effect puts into play, which isn't played.
- Barricade ("Non-Elite enemies cannot move into attached location") keeps every non-Elite enemy out of its location ([Barricade FAQ](https://arkhamdb.com/card/01038)):
  Test: `packages/engine/src/player_cards.test.ts › a location closed to enemies (Barricade) › $name`
  - A hunter whose step on its shortest route would go there stays; distance still counts through the location, and with another equally short step open it takes that one (RR "Hunter"; the other step is our reading).
    Test: `packages/engine/src/player_cards.test.ts › a location closed to enemies (Barricade) › sends a hunter along the other equally short way, round the hall`
    Test: `packages/engine/src/player_cards.test.ts › a location closed to enemies (Barricade) › lets the hunter in again once Barricade is discarded`
  - A card effect that moves an enemy there, or one location towards somewhere through it, leaves it where it is (our reading, by analogy with RR "Hunter").
    Test: `packages/engine/src/player_cards.test.ts › a location closed to enemies (Barricade) › keeps a card effect from $name`
  - An enemy may still spawn there: spawning is not moving in (FAQ).
  - An investigator who moves in leaves an engaged non-Elite enemy behind, disengaged at the location they left, after its attack of opportunity (FAQ).
    Test: `packages/engine/src/player_cards.test.ts › a location closed to enemies (Barricade) › when Alice moves in from the study, engaged with the ghoul › $name`
    Test: `packages/engine/src/player_cards.test.ts › a location closed to enemies (Barricade) › when Alice moves in from the study, engaged with the ghoul › has the ghoul left behind engage Bob, still at the study`
  - It is discarded when any investigator leaves the location (its Forced text), and with the location if it leaves play (RR "Attach To").
    Test: `packages/engine/src/player_cards.test.ts › AttachPlayerCard › leaves play with its host`
- Handcuffs ("If the attached enemy is non-Elite, it cannot ready and doom cannot be placed on it") keeps a non-Elite enemy exhausted through the upkeep phase and any card effect that readies it, and no doom goes on it; an Elite enemy is not held ([Handcuffs FAQ](https://arkhamdb.com/card/04265)):
  Test: `packages/engine/src/enemy_attachments.test.ts › Handcuffs on an exhausted enemy at the hall › $name`
  Test: `packages/engine/src/enemy_attachments.test.ts › Handcuffs on an exhausted enemy at the hall › keeps doom off it`
  - Flipping clues to their doom side is not placing doom.
  - Effects that don't ready the enemy still work on it: Dance of the Yellow King still moves it, engages it and has it attack.
- A Gathering and A Ritual ("Each enemy at a location with a copy of Fire! attached cannot be damaged") deal no damage to an enemy at a burning location while either is the current agenda:
  Test: `packages/engine/src/enemy_damage_restrictions.test.ts › an enemy that cannot be damaged at a location with Fire! attached › deals the ghoul $where $damage damage`
  - A fight against it can still be made and still succeeds or fails; a hit deals nothing, and so does Fire!'s own damage as the investigation phase ends, or any effect that damages each enemy.
  - It counts only where the enemy is when the damage would be dealt: once the Fire! is discarded, or the enemy moves away, it takes damage again.
    Test: `packages/engine/src/enemy_damage_restrictions.test.ts › an enemy that cannot be damaged at a location with Fire! attached › damages the ghoul in the hall again once the agenda has left play`
  - "After you successfully attack" reactions still trigger, since success is decided before the damage (FAQ v2.5 §1.7); "after damage is dealt" ones don't, as none was dealt ([Dealing Damage/Horror](https://arkhamdb.com/rules#Dealing_Damage_Horror)).
  - Moving damage onto such an enemy is still allowed: no ruling says whether moving is damaging (unverified; no Core Set (2026) card does it).
- Hiding Spot ("Each non-Elite enemy at attached location gains aloof") makes each non-Elite enemy at its location aloof ([Hiding Spot FAQ](https://arkhamdb.com/card/03038), RR "Aloof", "Gains"):
  Test: `packages/engine/src/enemy_attachments.test.ts › Hiding Spot at the hall, where Alice is › $name`
  - It does not engage when it readies, spawns there or an investigator enters, and while unengaged it cannot be attacked.
    Test: `packages/engine/src/enemy_attachments.test.ts › Hiding Spot at the hall, where Alice is › keeps Alice from fighting the evaded, unengaged enemy`
  - An enemy already engaged stays engaged: aloof only stops engaging.
  - Once Hiding Spot leaves play, a ready enemy at the location engages an investigator there (RR "Enemy Engagement").
    Test: `packages/engine/src/enemy_attachments.test.ts › Hiding Spot at the hall, where Alice is › has a ready enemy engage Alice once Hiding Spot is discarded`
  - Its Forced discard ("at the end of the enemy phase, if a ready enemy is at attached location") is left to the players.
