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
4. M3.2: header, with the toast for refused actions (its "Next" is the first button that can be refused)
5. M3.3a: static SVG map with location tiles and connections
6. M3.3b: pan/zoom/pinch, pawns, enemy chips, map tabs
7. M3.4: board interactions
8. M3.5: investigator bar
9. M3.6: encounter panel
10. M3.7: decision dialog and card zoom
11. M3.8: event log
12. M3.9: tablet pass and E2E

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

- [ ] Round, phase, "Next" button (calls `NextPhase`)
- [ ] Agenda: doom x / threshold with +/−; act: clues x / threshold; tap opens the card
- [ ] Undo button, menu (home, settings, export)
- [ ] Refused actions show a toast with the translated reason (`OpenGame.rejection`, `dismissRejection`); buttons disabled while `OpenGame.busy`

## M3.3 Map rendering (O)

**Why:** The map replaces the physical location layout. SVG stays sharp at any zoom and makes tapping individual pieces easy.

**Benefit:** The whole scenario state is visible at a glance.

Ref: architecture "Game state" (connections) and product.md "Board rendering".

- [ ] SVG board with pan/zoom/pinch (react-zoom-pan-pinch); slots from the scenario layout
- [ ] Location tiles: name, revealed/unrevealed, shroud, clues, doom, attachments badge
- [ ] Connection lines (arrows for one-way), map tabs when several maps exist
- [ ] Investigator pawns and enemy chips at locations

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
