# Play screen: encounter piles

The [game screen](../../apps/web/src/screens/GameScreen.tsx) has a header with the encounter deck, agenda, act, scenario and victory display laid out as cards, centred, each under the playmat's label.
Tokens show:

- the agenda's doom and the act's clues (the ones the investigators hold against its cost, or for an act that advances itself the ones on it, `ActAdvance`), each as a small count on the card's threshold disc,
- and the cards left in the encounter deck, a big round token at the foot of its card back.

The deck is drawn after the printed encounter card back ([`EncounterBack`](../../apps/web/src/encounter/EncounterBack.tsx), in portrait scan units, `ENCOUNTER_BACK`, our own drawing): the night sky hanging from the top edge with its stars, the eye in a triangle with pale rays writhing round it, beams falling from it onto a dark body with tapered tentacles curling up on both sides, and the rust-brown ground at the foot, where the count token sits.
Each face names itself for its stylesheet (`data-face="book"`, `"scenario"`, `"encounter-back"`), so one face's paper colours never reach another.

## Agenda and act

The agenda and act are drawn as the printed cards in the Exact card theme ([`BookFace`](../../apps/web/src/screens/BookFace.tsx), in landscape scan units, `BOOK_FACE`): the art cut from the picture (`AGENDA_ART`, `ACT_ART`) beside an open book with its page edges and title scrolls, the encounter set's icon between the title's brackets (`AgendaView.encounterSet`, `SetIcon`), and the threshold on a disc at the page's corner (the act's mirrored, with a magnifier handle). A scan that loads standing upright, as about one in fifty ArkhamDB scans does, never shows (`useCardPicture` with the card's `PictureShape`): the face keeps its pattern rather than cutting the wrong part as art. The scenario card checks the same, the other way round.
The header card lays its HTML over that drawing in fractions of the card (`--book-*` tokens): the name on the page, the token as the small count circle on the disc's lower right, and the plate with its buttons at the page's foot.
In the card pictures theme the whole picture lies over the drawing, and the count stays on the printed threshold.

A tap on the agenda or act (or its name, a button for the keyboard) opens it on the card shell ([`BookDetails`](../../apps/web/src/screens/GameHeader.tsx), `DetailsDialog`, MD.6b2):

- the same face over the page as a landscape card, with its name and token, tapped to read it whole;
- "Agenda" or "Act" as the kicker;
- its count on the page (the doom in play; the clues the investigators hold, or the clues on the act);
- while adjusting, its steppers in a group of their own ("On the agenda", "On the act");
- the card actions it offers the investigator whose turn it is (`CardActions`);
- the act's Advance as the dialog's one brass primary.

A card action keeps it open and shows the decision it raises in its place (`useDecisionHost`). Advance closes it first, since the act it was about is gone. On a phone the header cards open the detail view instead, as before.
In the phone's [detail view](play-screen.md#detail-view) the agenda and act are shown full instead (`GameHeader` `full`): their card actions sit under them and a tap opens no dialog.

The act's Advance button takes its spend-clues action for the investigator whose turn it is (`GameActions.advanceAct`), so it waits for a turn and enough clues.
When the players have a split to choose, it first asks who pays how many in the [clue payment dialog](../../apps/web/src/screens/CluePaymentDialog.tsx) (`useCluePayment` over `BoardView.cluePayers`, on the card shell since MD.6b4: the card the cost is paid for beside the page, an act over it; each payer a row with their round portrait, their name over what they pay, and their clues as tokens to tap, starting at the engine's split; a Split evenly shortcut, `evenClueSplit`, and Pay as the primary); card actions with a group clue cost (`CardActionView.groupClues`) ask the same.
The clue steppers, a correction while adjusting, show only for an act that counts the clues on it.

## Scenario card

The scenario card is drawn as the printed reference card ([`ScenarioFace`](../../apps/web/src/screens/ScenarioFace.tsx), in portrait scan units, `SCENARIO_FACE`): the dark frame, the band across the top with its half wheel and a serpent coiling in from each corner, and the set medallion with the scenario's set icon (`ReferenceView.encounterSet`, the current agenda's set).
Over it lies its HTML, placed in the face's scan units (`--scenario-*` tokens, `cqw` of the card, so every size prints the same layout): the scenario's name (the screen's heading), the side the difficulty plays with, and one row per symbol token from `BoardView.reference`, the token's game symbol on a disc in its colour beside its printed text.
The texts come from the card catalog ([Card data](card-data.md), `CardCatalog.references` by `BoardView.reference.code` and side), rendered by [`cardText`](../../apps/web/src/catalog/cardText.tsx), which also sets the enemy cards' keyword lines: traits (`[[Ghoul]]`) in bold italics, symbols as icons. Until the catalog has loaded (a first start offline) a row shows only its token. In the card pictures theme the side's picture (`CardCatalog.referencePictures`, gathered with the texts as `PrintedReference` by `printedReferenceOf`) lies over the face once loaded; the title and rows stay beneath it for assistive technology.
The header's small card shows only the name (a container query hides the rest from sight, not from screen readers); a tap on it or its name opens it on the card shell (`ScenarioDetails`, `CardDialog`, MD.6b3), and the phone's detail view shows it a zoomed card wide. The dialog has:

- the upright card beside the page (decorative there, since the page repeats its rows);
- "Scenario" and the difficulty's side as the kicker;
- the cards set aside and the victory points on the page;
- one row per symbol token at the page's print size, so it reads even when only the card's top shows (the shell's phone sheet; the phone itself opens the header cards in the detail view).

The reference card is no instance in play, so the shell takes a `ShownCard` (a `CardFaceView` without its `id`, [`cardFace.tsx`](../../apps/web/src/catalog/cardFace.tsx)), as `CardZoom` does.

## Piles

The piles lie as small fans of their top three cards, slightly turned against each other, with a count on a disc ([`PileFan`](../../apps/web/src/encounter/PileFan.tsx), [`EncounterPiles`](../../apps/web/src/encounter/EncounterPiles.tsx)):

- the encounter discard pile tucked under the deck's lower right corner,
- the set-aside cards under the scenario card's,
- and the victory display in its own slot with the victory points earned so far (`BoardView.victoryPoints`, the victory display plus cleared locations that print victory).

An empty pile is a dashed card outline.

## Encounter dialog

A tap on the deck or a pile opens the [encounter dialog](../../apps/web/src/encounter/EncounterDialog.tsx) on it:

- on the deck, its count with a "Draw for …" button per active investigator, the one whose turn it is first (`GameActions.drawEncounter`, for player cards and effects that draw outside the mythos phase; the card then resolves as in the mythos phase);
- on a pile, its cards as a row of pictures, top card first (`PileStrip` in the shared [`CardStrip`](../../apps/web/src/screens/CardStrip.tsx): five side by side, `--encounter-strip-cards-shown`; more scroll by whole cards with a swipe or the investigator picker's round arrows, as in the threat area), the chosen card (the top one at first) named under the row with its victory points and its moves.

A tap on a line of the drawn-cards notice below opens the places the players can put it ([`CardMoves`](../../apps/web/src/encounter/CardMoves.tsx) over [`cardMoves`](../../apps/web/src/encounter/cardMoves.ts)), each a `ManualAdjust` `moveCard` step (`GameActions.moveEncounterCard`), for revelations the engine leaves to them:

- a treachery goes into a threat area,
- any card onto the discard pile or aside.

An enemy not yet on the map gets one Spawn button instead, which closes the dialog and asks the players to tap a location ([`SpawnPrompt`](../../apps/web/src/encounter/SpawnPrompt.tsx) with Cancel, `OpenGame.spawning`; every tile glows, `data-pickable`, and `MapBoard.onPick` takes the tap).
The tap plays `SpawnEnemy` (`GameActions.spawnEnemy`), so the engine engages it by the rules (prey, Aloof).

## Drawn-cards notice

After a step that drew or placed encounter cards, a [notice](../../apps/web/src/encounter/DrawnCardsNotice.tsx) beside the skipped effects' says for whom each was drawn and where it went ("Crypt Chill for Roland Banks: discard pile"; `OpenGame.drawnCards`, worked out by [`drawnCards`](../../apps/web/src/encounter/drawnCards.ts) from the step's events with `BoardView.placeOf`), since most draws resolve within one step and the players never see the card otherwise.
