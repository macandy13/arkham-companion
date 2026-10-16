# M3 – Play screen UI

Goal: the in-game screen from architecture §11, wired to the M1 engine, so the sandbox scenario is playable on a tablet.

**Why this milestone**

- **Problem:** This is the screen used for the whole evening – the actual product experience. It has to make the engine's state readable and changeable with a few taps on a shared tablet.
- **What the app gains:** A complete, playable game loop on a tablet: phases, map, investigators, encounter deck, decisions, undo.
- **Why at this point:** It is built against the sandbox scenario so UI problems are separated from real-scenario data problems. M4 then only adds data and scenario-specific rules on top of a proven screen.

Model hint: **S** = Sonnet, **O** = Opus. Each task = one session, delivered as one or more small PRs (`docs/coding-guidelines.md` §7).
Start from the phone: Code tab → repo → `Do task M3.x from docs/tasks/M3-play-screen-ui.md`.

All UI actions dispatch engine commands through the Zustand store; no component mutates state.

---

## M3.1 Game store and command dispatch (O)

**Why:** A single path from tap → engine → storage → screen enforces "persist before render" (refresh safety) and gives one place for errors and undo.

**Benefit:** Components stay simple, and the screen can never drift from the saved game.

- [ ] Zustand store: current `GameState`, `dispatch(command)` → `handle` → persist events via `GameStore` → apply → re-render
- [ ] Rejected commands show a toast with the reason
- [ ] Undo wired to the M1 undo; selectors for derived values (doom total, thresholds)

## M3.2 Header (S)

**Why:** Round, phase, agenda doom and act clues are the scenario's always-on status. They are one important piece among others (map, investigators, encounter cards), so the header keeps them compact and leaves the space to the map.

**Benefit:** The game clock at a glance and one-tap phase progression.

- [ ] Round, phase, "Next" button (calls `NextPhase`)
- [ ] Agenda: doom x / threshold with +/−; act: clues x / threshold; tap opens the card
- [ ] Undo button, menu (home, settings, export)

## M3.3 Map rendering (O)

**Why:** The map replaces the physical location layout. SVG stays sharp at any zoom and makes tapping individual pieces easy.

**Benefit:** The whole scenario state is visible at a glance.

Ref: §5 Map model.

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
