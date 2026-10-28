# Play screen: encounter piles

The [game screen](../../apps/web/src/screens/GameScreen.tsx) has a header with the encounter deck, agenda, act, scenario and victory display laid out as cards, centred, each under the playmat's label.
Big round tokens show:

- the agenda's doom,
- the act's clues (the ones the investigators hold against its cost, or for an act that advances itself the ones on it, `ActAdvance`)
- and the cards left in the encounter deck ("2 of 7").

## Agenda and act

A tap on the agenda or act (or its name, a button for the keyboard) opens it as a full card in a dialog ([`CardDetails`](../../apps/web/src/screens/GameHeader.tsx)), the same face with its picture large and its buttons at full size, and under it the card actions it offers the investigator whose turn it is (`CardActions`, as in the details windows); advancing or taking one closes it, since a decision may follow.

The act's Advance button takes its spend-clues action for the investigator whose turn it is (`GameActions.advanceAct`), so it waits for a turn and enough clues.
The clue steppers, a correction while adjusting, show only for an act that counts the clues on it.

## Piles

The piles lie as small fans of their top three cards, slightly turned against each other, with a count on a disc ([`PileFan`](../../apps/web/src/encounter/PileFan.tsx), [`EncounterPiles`](../../apps/web/src/encounter/EncounterPiles.tsx)):

- the encounter discard pile tucked under the deck's lower right corner,
- the set-aside cards under the scenario card's,
- and the victory display in its own slot with the victory points earned so far (`BoardView.victoryPoints`, the victory display plus cleared locations that print victory).

An empty pile is a dashed card outline.

## Encounter dialog

A tap on the deck or a pile opens the [encounter dialog](../../apps/web/src/encounter/EncounterDialog.tsx) on it:

- on the deck, its count with a "Draw for …" button per active investigator, the one whose turn it is first (`GameActions.drawEncounter`, for player cards and effects that draw outside the mythos phase; the card then resolves as in the mythos phase);
- on a pile, its cards as a row of pictures, top card first (`PileStrip`: five side by side, `--encounter-strip-cards-shown`; more scroll by whole cards with a swipe or the investigator picker's round arrows), the chosen card (the top one at first) named under the row with its victory points and its moves.

A tap on a line of the drawn-cards notice below opens the places the players can put it ([`CardMoves`](../../apps/web/src/encounter/CardMoves.tsx) over [`cardMoves`](../../apps/web/src/encounter/cardMoves.ts)):

- a treachery goes into a threat area,
- any card onto the discard pile or aside,

each a `ManualAdjust` `moveCard` step (`GameActions.moveEncounterCard`), for revelations the engine leaves to them.

An enemy not yet on the map gets one Spawn button instead, which closes the dialog and asks the players to tap a location ([`SpawnPrompt`](../../apps/web/src/encounter/SpawnPrompt.tsx) with Cancel, `OpenGame.spawning`; every tile glows and `MapBoard.onPick` takes the tap).
The tap plays `SpawnEnemy` (`GameActions.spawnEnemy`), so the engine engages it by the rules (prey, Aloof).

## Drawn-cards notice

After a step that drew or placed encounter cards, a [notice](../../apps/web/src/encounter/DrawnCardsNotice.tsx) beside the skipped effects' says for whom each was drawn and where it went ("Crypt Chill for Roland Banks: discard pile"; `OpenGame.drawnCards`, worked out by [`drawnCards`](../../apps/web/src/encounter/drawnCards.ts) from the step's events with `BoardView.placeOf`), since most draws resolve within one step and the players never see the card otherwise.
