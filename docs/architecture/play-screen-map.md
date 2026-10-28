# Play screen: map and locations

The [map](../../apps/web/src/map/MapBoard.tsx) is an SVG of location tiles at their layout cells with pan, zoom and drag-to-play pieces (its tabs and small zoom icons float over its top corners, and its name is for screen readers only).

A tap on a tile (or its "i" button, for the keyboard) opens the location's [details](../../apps/web/src/map/LocationDetails.tsx):

- its card (the tile's drawing with its pieces, at zoomed-card size),
- its shroud and clues,
- who is there,
- the cards attached to it (each opening the card zoom),
- and an action row (the enemy details' [`ActionRow`](../../apps/web/src/screens/ActionRow.tsx)) built from a list of what the investigator whose turn it is can do there:
  - investigate as an action or take a clue without a test at their own location,
  - move as an action or free to a connected one (`BoardView.connectedTo`),
  - where a card forbids it (`LocationView.forbidden`) investigate off and no move (Locked Door, the unrevealed Parlor's barrier),
  - plus the location's own card actions (`CardActions`, the Parlor's Resign),

  While adjusting, the corrections (reveal, clue and doom steppers) take its place.

A tap on an enemy token (a press let go where it went down, `isTap`, which a drag is not) opens the enemy's details as from the threat area.

## Location tiles

Location tiles are drawn like the printed location card, with our own SVG frame ([`cardOrnament.tsx`](../../apps/web/src/map/cardOrnament.tsx)) over art cut from the same area of the scan, so the printed frame stays hidden under ours.

A revealed location's text box prints its action abilities, whoever may take them (`LocationView.printedActions`: the action or free symbol and the name, "Resign."), as HTML in a `foreignObject` styled like the enemy card's text; with the whole card picture shown ("faces" look) it gives way to the printed text.

Card pictures are fetched from ArkhamDB on the device and cached by the service worker, never bundled.
