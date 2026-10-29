# Play screen: investigators and enemies

## Investigator bar

The [investigator bar](../../apps/web/src/investigators/InvestigatorBar.tsx) shows each investigator's card, drawn like the location tiles in parchment with a dark edge:

- their name on a plate in a dark band with where they are (beside the name, a pentagon like the game's lead investigator token marks `BoardView.lead` and the action arrow `BoardView.turn`; on the map their pawns carry the pentagon and a glowing gilt ring),
- the art window (the art area of the picture of its front, `--investigator-art-*` in tokens.css; setup copies the picture onto the investigator as `Investigator.imageSrc` since a resumed game has no investigator cards),
- their four skills as plates with the Arkham icons, each showing the printed value with its lasting boost and the boost beside it (`InvestigatorView.boosts`, changed with steppers under the plates while adjusting, `GameActions.boostSkill`),
  - each opening a [skill test](../../apps/web/src/investigators/SkillTestDialog.tsx): the skill tested or two added together (`SkillTestInput.addedSkill`), difficulty, modifier and the chaos tokens drawn from the bag (a row of round tokens, a symbol token showing its game symbol over its name kept for screen readers), calculated by `BoardView.skillTest` over the engine's `skillTestSuggestion` without changing the game,
- their counters as round tokens along its foot; health and sanity drawn as the card prints them, the shared heart and brain from [`cardFace.tsx`](../../apps/web/src/catalog/cardFace.tsx) with the printed maximum on the symbol and the damage or horror taken in a small count circle beside it (one image each, named by what is left, "4 of 7"),
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

The threat area shows four cards (`THREAT_CARDS_SHOWN`); more scroll by whole cards with a swipe or its arrows (CSS scroll snap).

A tap on a treachery opens the [card zoom](../../apps/web/src/screens/CardZoom.tsx), the card as big as a zoomed card to read (`BoardView.cardsIn` a zone: id, name, type, traits and the pictures of both sides):

- a treachery's front drawn as its card ([`TreacheryCard`](../../apps/web/src/treacheries/TreacheryCard.tsx), in scan units like the enemy card: `TREACHERY_FACE` and the frame's paths `TREACHERY_FRAME` in [`treacheryCardFrame.ts`](../../apps/web/src/treacheries/treacheryCardFrame.ts)): the art through the keyhole window cut from its picture (`TREACHERY_ART`), the bead chains and volutes, the set medallion, the name and traits on the page; in the card pictures theme the whole picture lies over it,
- any other card or side as its picture, turned over with a button when it has a back,
- and without a picture its name, type and traits in our own frame,
- and under it the actions the card offers the investigator whose turn it is.

The cards an investigator controls (their `playArea` zone, Lita Chantler after a Parley) lie under their card as the same small cards in the asset frame ([`PlayArea`](../../apps/web/src/investigators/PlayArea.tsx), `SmallCard`), each opening the card zoom.

## Enemy details

A tap on an enemy card opens its [details](../../apps/web/src/enemies/EnemyDetails.tsx): the enemy drawn as its [card](../../apps/web/src/enemies/EnemyCard.tsx) (`BoardView.enemyStats`), in the Exact card theme our own SVG drawing of the printed enemy card, in scan units like the location's face (`ENEMY_FACE` and the frame's paths `ENEMY_FRAME` in [`enemyCardFrame.ts`](../../apps/web/src/enemies/enemyCardFrame.ts)):

- the name plate, with the frame's scrolls hanging from it (`OrnamentLine`, `scrollPath` in [`cardFace.tsx`](../../apps/web/src/catalog/cardFace.tsx)),
- fight, health and evade on chevrons, each one image named by its value ("Health 3 of 5"), the skill fight and evade test beside them, and the damage on the health as the shared `CountCircle`,
- traits, keywords and victory points on the lens of paper, in our own words as HTML in `foreignObject`s so they wrap,
- the attack as hearts and brains (`Heart`, `Brain` in `cardFace.tsx`) beside the set medallion,
- and the art cut from the picture below the lens, `ENEMY_ART`.

The face's shared rules (medallion, count circle, ornament lines, heart and brain) live in [`card_face.css`](../../apps/web/src/catalog/card_face.css), next to the parts they style.

Under it is one row of buttons ([`ActionRow`](../../apps/web/src/screens/ActionRow.tsx), for the details windows to share):

- on an investigator's turn the basic actions the rules allow them against the enemy (`BoardView.enemyActions`, a dry run of each command, so the rules stay in the engine: evade only one engaged with them, fight no unengaged aloof enemy, engage none already engaged with them):
  - fight, evade and engage as an action (marked, like the turn row's actions left, with the game's action arrow, [`action.svg`](../../apps/web/src/symbols/action.svg))
  - and fight and evade, as some cards allow, without one,
- the actions the enemy's own card offers them, such as a Parley,
- and at any time the card effects deal 1 damage, disengage and defeat.

## Card actions

Every card screen shows the actions its card offers the same way ([`CardActions`](../../apps/web/src/screens/ActionRow.tsx) over `cardActionsOn`, the turn investigator's `BoardView.cardActions` on that card, found by the `id` each card view carries):
a "Card actions" group named like the turn row's buttons ("Resign · Parlor"), with the action arrow unless the action is free.
Taking one closes the window first.

The turn row keeps a button for every card action besides.
