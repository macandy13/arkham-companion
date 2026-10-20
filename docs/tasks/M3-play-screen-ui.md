# M3 – Play screen UI

Goal: the in-game screen from product.md "UI concept", wired to the M1 engine, so the sandbox scenario is playable on a tablet.

**Why this milestone**

- **Problem:** This is the screen used for the whole evening – the actual product experience. It has to make the engine's state readable and changeable with a few taps on a shared tablet.
- **What the app gains:** A complete, playable game loop on a tablet: phases, map, investigators, encounter deck, decisions, undo.
- **Why at this point:** It is built against the sandbox scenario so UI problems are separated from real-scenario data problems. M4 then only adds data and scenario-specific rules on top of a proven screen.

All UI actions go through the Zustand store's `GameActions`, which play `PlayTable` steps and store them via a `GameSession`; no component builds commands, sees the table or mutates state.

**Slices** (one small PR each, in this order)

1. M3.1a: `PlayTable` steps as undo groups and `resume` (engine), then the app store's `GameActions` through a `GameSession`, context rebuilt on open, refusals kept on the open game
2. M3.1b: the remaining `GameActions` (move, fight, evade, engage, resign, actions left, enemy attacks, act advance, steppers, doom)
3. M3.1c: selectors for derived values and the busy flag
4. M3.2a: header with round, phase, "Next" and undo, and the toast for refused actions
5. M3.2b: agenda and act in the header
6. M3.2c: the menu (home, settings, export)
7. M3.3a1: each location's book layout cell in the game state (`GameMap.layout`), The Gathering's cells
8. M3.3a2: static SVG map with location tiles and connections
9. M3.3b: pan/zoom/pinch, pawns, enemy chips, map tabs
10. M3.4: board interactions
11. M3.5: investigator bar
12. M3.6: encounter panel
13. M3.7: decision dialog and card zoom
14. M3.8: event log
15. M3.9: tablet pass and E2E

---

## M3.3 Map rendering (O)

**Why:** The map replaces the physical location layout. SVG stays sharp at any zoom and makes tapping individual pieces easy.

**Benefit:** The whole scenario state is visible at a glance.

Ref: architecture "Game state" (connections) and product.md "Board rendering".

- [x] Each location's cell in the book layout, kept on its map in the game state (`GameMap.layout`)
- [ ] SVG board with pan/zoom/pinch (react-zoom-pan-pinch), tiles placed by the layout
- [ ] Location tiles: name, revealed/unrevealed, shroud, clues, doom, attachments badge
- [ ] Connection lines (arrows for one-way), map tabs when several maps exist
- [ ] Investigator pawns and enemy chips at locations

M3.3a1 done: map steps give each location its book layout cell (`MapLocation.at`), which the map keeps (`GameMap.layout`) and `StartScenario`/`AddMap` validate. The unused `Board.slots`, `placement` and `layoutMode` are gone. The Gathering's Study and house have their cells.

M3.3a2 done: the play screen draws each visible map as an SVG (`apps/web/src/map/`) from `BoardView.maps`: location tiles at their cells with name and clues (or "Unrevealed"), connection lines with arrowheads for one-way ones. Locations without a cell go in a row below. Left for M3.3b: pan/zoom, map tabs, shroud, doom, attachments, pawns, enemies, and connections between maps. Map names come from the scenario and are not translated yet.

## M3.4 Board interactions (S)

**Why:** Dragging is the fastest interaction on a tablet. Snapping back illegal moves teaches the rules without blocking players (manual adjust still exists).

**Benefit:** Moves feel like moving physical pieces, with fewer rules mistakes.

- [ ] Drag pawn to a connected location → `MoveInvestigator`; drag enemy → `MoveEnemy`/`EngageEnemy`
- [ ] Location long-press menu: reveal, add/remove clue or doom, discover clue for investigator
- [ ] Illegal drops snap back with a hint

## M3.5 Investigator bar (S)

**Why:** Replaces each investigator's health/sanity dials and clue/resource piles.

**Benefit:** Everyone's status is visible; each change is one tap.

- [ ] One panel per investigator: portrait, health/horror, clues, resources and doom on player cards with +/− steppers
- [ ] Threat area and engaged enemies as chips; tap → card zoom
- [ ] Turn-taken marker, defeated/resigned state

## M3.6 Encounter panel (S)

**Why:** The encounter deck is what the app takes over from the players, and this panel is where that becomes visible.

**Benefit:** Draw with one tap, see what to resolve, and browse discard/set-aside cards without digging through piles.

- [ ] Deck count, "Draw for <investigator>", revealed card with keyword badges and "resolve" quick actions
- [ ] Discard pile, set-aside cards, victory display (expandable lists)

## M3.7 Decision dialog and card zoom (S)

**Why:** Engine decisions need one consistent prompt, and card text must be readable at arm's length.

**Benefit:** Choices never get lost; any card can be read full size.

- [ ] Modal for pending `Decision`s with the engine's options, one layout per decision kind (M1.9); the skill test prompt shows skill, difficulty and pass/fail buttons plus "skip, adjust manually"
- [ ] Card zoom: front/back image, text fallback from card data
- [ ] Tapping the agenda or act in the header opens its card (moved from M3.2)

## M3.8 Event log (S)

**Why:** Players regularly ask "what just happened?" and need to correct mistakes several steps back.

**Benefit:** Transparency about what the app did, and rewinding to any earlier point.

- [ ] Chronological, human-readable list (event → i18n string)
- [ ] Jump back: confirm, then undo to that command group

## M3.9 Tablet pass and E2E (S)

**Why:** The target device is a tablet in landscape, and a refresh in the middle of a phase is the riskiest recovery case.

**Benefit:** Confidence that it works on the real device, plus regression protection in CI.

- [ ] Landscape tablet layout check (1180×820 and 1024×768), touch sizes, no horizontal scroll
- [ ] Playwright: play two full rounds of the sandbox scenario; refresh mid-mythos restores the exact state

Done when: a full sandbox game is playable and comfortable on a tablet.
