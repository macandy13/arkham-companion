# M3 – Play screen UI: finished tasks

Finished tasks moved out of `docs/tasks/M3-play-screen-ui.md` so sessions working on open tasks read less. Their Done notes stay here for reference.

---

## M3.1 Game store and command dispatch (O)

**Why:** A single path from tap → engine → storage → screen enforces "persist before render" (refresh safety) and gives one place for errors and undo.

**Benefit:** Components stay simple, and the screen can never drift from the saved game.

- [x] Zustand store: current `GameState`, `actions.<verb>` → `PlayTable` → persist events via `GameStore` → re-render
- [x] Opening a saved game rebuilds its `EngineContext` (cards and `scenario`) from the catalog entry for `meta.scenarioId` (`findScenario`), so hooks and the reference card apply to its commands
- [x] Selectors for derived values (doom in play, agenda and act thresholds): `OpenGame.board`, a `BoardView`
- [x] A busy flag while a step runs, so the screen disables its buttons: actions act on the turn in progress and the first open decision, so a second tap would hit whatever is open next
- Moved to M3.2: rejected actions show a toast with the reason; the undo button

M3.1a done: the screen calls `GameActions` (the `PlayTable` verbs with screen defaults: actions are taken by the investigator whose turn it is, answers go to the first open decision, skill tests stay open) on the app store, which play them through a `GameSession` that stores each step as one undo group and reloads the stored game when a write fails (another tab). The refusal is kept on `OpenGame.rejection`; the undo button comes with the header.

M3.1b done: `GameActions` covers the remaining steps the screen needs: move, fight, evade, engage, resign and actions left (on the turn in progress), enemy attacks, act advance, the resource/damage/horror steppers and doom. Fight, evade and engage are not exercised through the app store yet, since The Gathering starts without an enemy in play.

M3.1c done: `OpenGame.board` is the screen's selector object, a `BoardView` built after every step; `AgendaView` gained the doom `threshold` and `BoardView` the `doomInPlay` it is compared with. `OpenGame.busy` is set while an action or undo is queued or running. The toast moved to M3.2, where the header's "Next" is the first button that can be refused.

## M3.2 Header (S)

**Why:** Round, phase, agenda doom and act clues are the scenario's always-on status. They are one important piece among others (map, investigators, encounter cards), so the header keeps them compact and leaves the space to the map.

**Benefit:** The game clock at a glance and one-tap phase progression.

- [x] Round, phase, "Next" button (calls `NextPhase`)
- [x] Agenda: doom x / threshold with +/−; act: clues x / threshold
- Moved to M3.7: tapping agenda or act opens the card (the card zoom comes with the decision dialog)
- [x] Undo button
- [x] Menu (home, settings, export): home and settings are the app header's links on every screen; the game header adds the export
- [x] Refused actions show a toast with the translated reason (`OpenGame.rejection`, `dismissRejection`); buttons disabled while `OpenGame.busy`

M3.2a done: the header shows round and phase, "Next" and undo (off while only the scenario start is left, `OpenGame.canUndo`); both wait while `busy` and stay off for a game that can only be shown. A refusal shows as a toast with the reason (`rejections.<code>` strings for the refusals a tap can cause, a general text otherwise) until dismissed. Flow: `play_header.spec.ts`.

M3.2b done: the header shows the current agenda with all doom in play against its threshold and +/− for the doom on the agenda (`removeDoom`, a new `PlayTable` verb and action, since no rule removes doom yet), and the current act with the clues the investigators hold against the clues it needs.

M3.2c done: the game header exports the open game (the same file as the home screen's export). Home and settings needed nothing new: the app's own header links to both on every screen, the play screen included.

## M3.3 Map rendering (O)

**Why:** The map replaces the physical location layout. SVG stays sharp at any zoom and makes tapping individual pieces easy.

**Benefit:** The whole scenario state is visible at a glance.

Ref: architecture "Game state" (connections) and product.md "Board rendering".

- [x] Each location's cell in the book layout, kept on its map in the game state (`GameMap.layout`)
- [x] SVG board with pan/zoom/pinch (react-zoom-pan-pinch), tiles placed by the layout
- [x] Location tiles: name, revealed/unrevealed, shroud, clues, doom, attachments badge
- [x] Connection lines (arrows for one-way), map tabs when several maps exist
- [x] Investigator pawns and enemy chips at locations

M3.3a1 done: map steps give each location its book layout cell (`MapLocation.at`, on a grid three times finer than a card, `GRID_CELLS_PER_CARD`), which the map keeps (`GameMap.layout`) and `StartScenario`/`AddMap` validate. The unused `Board.slots`, `placement` and `layoutMode` are gone. The Gathering's Study and house have their cells.

M3.3a2 done: the play screen draws each visible map as an SVG (`apps/web/src/map/`) from `BoardView.maps`: location tiles at their cells with name and clues (or "Unrevealed"), connection lines with arrowheads for one-way ones. Locations without a cell go in a row below. Left for M3.3b: pan/zoom, map tabs, shroud, doom, attachments, pawns, enemies, and connections between maps. Map names come from the scenario and are not translated yet.

M3.3b1 done: tiles show shroud (with attachments) and clues once revealed, doom and an attachments count; investigators stand as pawns and enemies as chips on their location (`LocationView.shroud`/`doom`, `MapView.enemies`). Follow-ups for the tablet pass: a chip shows only the enemy's name (engagement, damage and exhaustion are in its accessible name), and chips stack without a limit, so a third enemy on a tile with doom and attachments overlaps the pawns.

M3.3b2 done: several visible maps get a tab each (`role="tablist"` above the map) and show one at a time, the first at the start; a chosen map that leaves play falls back to the first. One map shows without tabs. No scenario shows two maps at once yet (The Gathering's Study leaves as the house opens), so the screenshot spec `map tabs for the Study and the house` adds the house to a fresh game directly (`twoMapsExport`). Follow-up for the tablet pass: tabs have no arrow-key navigation (each is its own tab stop).

M3.3b3 done: each map pans with a drag, zooms with the wheel or a pinch (react-zoom-pan-pinch, up to 4 times the fitted size) and has "Zoom in", "Zoom out" and "Fit map" buttons; it starts fitted to the map area and never zooms out below that. The empty notice stack no longer draws a frame over the map. Follow-ups for the tablet pass are listed under M3.9.

## M3.4 Board interactions (S)

**Why:** Dragging is the fastest interaction on a tablet. Snapping back illegal moves teaches the rules without blocking players (manual adjust still exists).

**Benefit:** Moves feel like moving physical pieces, with fewer rules mistakes.

- [x] Drag pawn to a connected location → `MoveInvestigator`; drag enemy → `MoveEnemy`/`EngageEnemy`
- [x] Location long-press menu: reveal, add/remove clue or doom, discover clue for investigator
- [x] Illegal drops snap back with a hint (the rejection toast gives it)

M3.4a done (#178): the pawn of the investigator whose turn it is drags to another tile, a move action; a refused move snaps back with the rejection toast.

M3.4b done (#179, #185): `MoveEnemy` moves an enemy by a card effect (forced moves disengage it first); on the map an enemy dropped on another tile moves there as a forced move, and dropped on the turn investigator's pawn it engages them.

M3.4c done: a long press (or a right click) on a tile opens its menu: reveal, and clue and doom steppers. Discovering a clue moved to the investigator bar (M3.5: an investigate button on the investigator). Follow-up for the tablet pass: tiles cannot be reached by keyboard yet, so the menu has no keyboard way in.
