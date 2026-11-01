# Play screen: investigators and enemies

## Investigator bar

The [investigator bar](../../apps/web/src/investigators/InvestigatorBar.tsx) shows each investigator's card drawn as the printed landscape card, [`InvestigatorFace`](../../apps/web/src/investigators/InvestigatorFace.tsx): our own SVG drawing in scan units of the printed layout (`INVESTIGATOR_FACE`, measured on Roland Banks' scan, the exact card templates of MD.10) over the picture of the card's front (setup copies it onto the investigator as `Investigator.imageSrc`, since a resumed game has no investigator cards), so the scan's art shows and its printed frame and text fall under the face's own. Its colours are the card theme's `--color-face-*` tokens, like the other faces. The panel's HTML lies over the face's places, sized in its scan units (`--scan-unit`, `--investigator-*` in tokens.css), so roles and labels stay plain HTML:

- the class shield (colour and icon of the card's class) and their name and subname on the plates, the class and subname from the card catalog by the investigator's card code (`InvestigatorView.code`, `printedInvestigatorOf`),
- their four skills on the chain, each its value on its plate beside the skill's icon in the face's ink, showing the printed value with its lasting boost and the boost in a small badge (`InvestigatorView.boosts`, changed with steppers under the skills while adjusting, `GameActions.boostSkill`),
  - each opening a [skill test](../../apps/web/src/investigators/SkillTestDialog.tsx) on the card dialog shell with the investigator's round portrait over the page: the test block the decisions share ([decisions](play-screen-decisions.md)) with a difficulty stepper, the tokens drawn as round tokens (a symbol token showing its game symbol, its name kept for screen readers), calculated by `BoardView.skillTest` over the engine's `skillTestSuggestion` without changing the game,
- their counters at the foot of the spiral-bound notebook page: the clue token, health and sanity drawn as the card prints them (the shared heart and brain from [`cardFace.tsx`](../../apps/web/src/catalog/cardFace.tsx) with the printed maximum on the symbol and the damage or horror taken in a small count circle beside it, one image each, named by what is left, "4 of 7"), and the resource coin; while the players adjust the board, the counters with their steppers leave the page for a row under the card,
- under the card, where they are and how their round goes, after a pentagon like the game's lead investigator token for `BoardView.lead` and the action arrow for `BoardView.turn` (on the map their pawns carry the pentagon and a glowing gilt ring),
- and the turn controls under the card:
  - start turn,
  - actions left,
  - icon buttons for investigate (off where a card forbids investigating their location, `LocationView.forbidden`: Locked Door), take a resource, draw and play (off while a card forbids them to play assets or events, `InvestigatorView.forbidden`: Dissonant Voices),
  - a button per card action the cards offer them (`BoardView.cardActions`, "Resign · Parlor"),
  - end.

## Threat area and play area

Their [threat area](../../apps/web/src/investigators/ThreatArea.tsx) is a row of small cards on the top edge of their card:

- treacheries
- and engaged enemies, the enemies with their health left (`EnemyView.health`, scaled by the player count through `enemyHealth`).

The threat area shows four cards (`THREAT_CARDS_SHOWN`); more scroll by whole cards with a swipe or its round arrows (CSS scroll snap). The row and its arrows are the shared [`CardStrip`](../../apps/web/src/screens/CardStrip.tsx), which the encounter dialog's pile uses too.

A tap on a treachery opens the [card zoom](../../apps/web/src/screens/CardZoom.tsx), the card as big as a zoomed card to read (`BoardView.cardsIn` a zone: id, name, type, traits and the pictures of both sides):

- a treachery's front drawn as its card ([`TreacheryCard`](../../apps/web/src/treacheries/TreacheryCard.tsx), in scan units like the enemy card: `TREACHERY_FACE` and the frame's paths `TREACHERY_FRAME` in [`treacheryCardFrame.ts`](../../apps/web/src/treacheries/treacheryCardFrame.ts)): the art through the keyhole window cut from its picture (`TREACHERY_ART`), the bead chains and volutes, the set medallion, the name and traits on the page; in the card pictures theme the whole picture lies over it,
- any other card or side as its picture, turned over with a button when it has a back,
- and without a picture its name, type and traits in our own frame,
- and under it the actions the card offers the investigator whose turn it is.

The cards an investigator controls (their `playArea` zone, Lita Chantler after a Parley) lie under their card as the same small cards in the asset frame ([`PlayArea`](../../apps/web/src/investigators/PlayArea.tsx), `SmallCard`), each opening the card zoom.

## Enemy details

A tap on an enemy card opens its [details](../../apps/web/src/enemies/EnemyDetails.tsx) on the card shell (`CardDialog`, with the drawing as its `drawn` card in place of a picture): the engaged investigator in the kicker, the fight, the health left of its health for the player count ("3 / 5") and the evade as a `dl` on the page, and the action rows under them. Beside the page is the enemy drawn as its [card](../../apps/web/src/enemies/EnemyCard.tsx) (`BoardView.enemyStats`), in the Exact card theme our own SVG drawing of the printed enemy card, in scan units like the location's face (`ENEMY_FACE` and the frame's paths `ENEMY_FRAME` in [`enemyCardFrame.ts`](../../apps/web/src/enemies/enemyCardFrame.ts)):

- the name plate, with the frame's scrolls hanging from it (`OrnamentLine`, `scrollPath` in [`cardFace.tsx`](../../apps/web/src/catalog/cardFace.tsx)),
- fight, health and evade on chevrons, each one image named by its value ("Health 3 of 5"), the skill fight and evade test beside them, and the damage on the health as the shared `CountCircle`,
- traits, keywords and victory points on the lens of paper, in our own words as HTML in `foreignObject`s so they wrap,
- the attack as hearts and brains (`Heart`, `Brain` in `cardFace.tsx`) beside the set medallion,
- and the art cut from the picture below the lens, `ENEMY_ART`.

In the card pictures theme the whole picture lies over that drawing once it has loaded, with only the damage count on top; the drawing stays under it, so it still names the card and its values to assistive technology.

The face's shared rules (medallion, count circle, ornament lines, heart and brain) live in [`card_face.css`](../../apps/web/src/catalog/card_face.css), next to the parts they style.

Under it is one row of buttons ([`ActionRow`](../../apps/web/src/screens/ActionRow.tsx), for the details windows to share):

- on an investigator's turn, in one Actions group, the basic actions the rules allow them against the enemy (`BoardView.enemyActions`, a dry run of each command, so the rules stay in the engine: evade only one engaged with them, fight no unengaged aloof enemy, engage none already engaged with them):
  - fight, evade and engage as an action (`cost="action"`, marked, like the turn row's actions left, with the game's action arrow, [`action.svg`](../../apps/web/src/symbols/action.svg))
  - then fight and evade, as some cards allow, without one (`cost="free"`, marked with the game's free-ability symbol, [`free.svg`](../../apps/web/src/symbols/free.svg)); each mark has a column of its own beside the icon,
- the actions the enemy's own card offers them, such as a Parley,
- and at any time the card effects deal 1 damage, disengage and defeat.

## Card actions

Every card screen shows the actions its card offers the same way ([`CardActions`](../../apps/web/src/screens/ActionRow.tsx) over `cardActionsOn`, the turn investigator's `BoardView.cardActions` on that card, found by the `id` each card view carries):
a "Card actions" group named like the turn row's buttons ("Resign · Parlor"), with the action arrow, or the free-ability symbol when the action is free.
Taking one closes the window first.

The turn row keeps a button for every card action besides.
