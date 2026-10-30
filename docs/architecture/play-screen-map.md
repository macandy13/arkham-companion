# Play screen: map and locations

The [map](../../apps/web/src/map/MapBoard.tsx) is an SVG of location tiles at their layout cells with pan, zoom and drag-to-play pieces (its tabs and small zoom icons float over its top corners, and its name is for screen readers only).
The map tabs follow the WAI-ARIA tabs pattern: one Tab stop, the arrow keys, Home and End choose the map.

A tap on a tile (or its "i" button, for the keyboard) opens the location's [details](../../apps/web/src/map/LocationDetails.tsx) (on a phone in the map row instead, the [location mode](play-screen.md#location-mode)):

- its card (the tile's drawing with its pieces, at zoomed-card size),
- its shroud and clues,
- who is there,
- the cards attached to it (each opening the card zoom),
- and an action row (the enemy details' [`ActionRow`](../../apps/web/src/screens/ActionRow.tsx)) built from a list of what the investigator whose turn it is can do there:
  - investigate as an action or take a clue without a test at their own location,
  - move as an action or free to a connected one (`BoardView.connectedTo`),
  - where a card forbids it (`LocationView.forbidden`) investigate off and no move (Locked Door, the unrevealed Parlor's barrier), and taking a clue off while a card forbids the investigator to discover clues (`InvestigatorView.forbidden`, The Masked Hunter),
  - plus the location's own card actions (`CardActions`, the Parlor's Resign),

  While adjusting, the corrections (reveal, clue and doom steppers) take its place.

The pieces on a tile stand in rows along its bottom edge ([`piecesOnTile`](../../apps/web/src/map/mapLayout.ts)): each investigator's pawn followed by the enemies engaged with them, faded since the threat area shows them in full, then after a thin line the enemies engaged with no one. Order alone shows an engagement on the map. An enemy token ([`EnemyToken`](../../apps/web/src/map/LocationTile.tsx)) shows its damage on a red badge at its lower right (`damageBadgeCentre`) and, when exhausted, its initial on its side.
A tap on an enemy token (a press let go where it went down, `isTap`, which a drag is not) opens the enemy's details as from the threat area.

## Location tiles

Location tiles are drawn like the printed location card in the Exact card theme (M3.10): our own SVG face over art cut from the same area of the scan, so the printed frame stays hidden under ours. The face is drawn in scan units (a tile is half an ArkhamDB scan, `TILE_PER_SCAN`), at the places measured on the scans (`LOCATION_FACE` in [`cardOrnament.tsx`](../../apps/web/src/map/cardOrnament.tsx)): the name plate over the frame's band with its pendant, the page arching up into the art, the set medallion with the type plate, the shroud and clue discs at the ends of the page's edge, the connection sockets along the foot. The pieces (pawns, enemies, attachments, the details button) stay in tile units on top.

The parts every card face shares live in [`cardFace.tsx`](../../apps/web/src/catalog/cardFace.tsx), also in scan units: the `CountCircle`, a small circle on a printed value's lower right with the current count (here the clues left on the printed clue value, `LocationView.printedClues`; later the doom on the agenda's threshold, the damage on an enemy's health), the `SetMedallion` with its type plate, and the rounded card outline. Their colours are the `--color-face-*` and `--color-count-*` tokens, so a card theme recolours them in the stylesheet.
A drawn card theme other than Exact is only a set of these tokens under `:root[data-card-theme='…']` in [`tokens.css`](../../apps/web/src/styles/tokens.css) (`data-card-theme` is `Settings.cardTheme`, set by `applySettings`): Night and brass and Eldritch set the faces' tokens there, and the paper and ink tokens on the investigator card alone, since dialogs share them. Eldritch also swaps the ornament's style: every `OrnamentLine` carries a tapered tentacle along its line (`tapered`), which only that theme's stylesheet shows, in place of the three strokes. In the same way `SetMedallion` carries an eye that replaces its inner ring, and each face lays a `NightSky` over its page: stars spread by a fixed sequence (`skyStars`), clipped to the page's outline, under the text; the page's gradient is the vignette. Both show in Eldritch alone. The count, damage, horror, skill and chaos token colours stay the same in every theme.

The location's connection symbol (`LocationView.symbol`) sits in the tile's top left corner where the card prints it, a disc in the symbol's printed colour (`--color-connection-*` tokens) with our own glyph ([`connectionSymbol.ts`](../../apps/web/src/map/connectionSymbol.ts)); the details button mirrors it in the top right corner.

A revealed location's text box prints its action abilities, whoever may take them (`LocationView.printedActions`: the action or free symbol and the name, "Resign."), as HTML in a `foreignObject` styled like the enemy card's text; with the whole card picture shown (the "Card pictures" card theme, `Settings.cardTheme`) it gives way to the printed text, and so do the face's frame, name, shroud and clue value, while the clues left stay on the printed clue value.

Card pictures are fetched from ArkhamDB on the device and cached by the service worker, never bundled.
