# M3 – Play screen UI

Goal: the in-game screen from architecture §11, wired to the M1 engine, so the sandbox scenario is playable on a tablet.

Model hint: **S** = Sonnet, **O** = Opus. Each task = one session = one PR.
Start from the phone: Code tab → repo → `Do task M3.x from docs/tasks/M3-play-screen-ui.md`.

All UI actions dispatch engine commands through the Zustand store; no component mutates state.

---

## M3.1 Game store and command dispatch (O)

- [ ] Zustand store: current `GameState`, `dispatch(command)` → `handle` → persist events via `GameStore` → apply → re-render
- [ ] Rejected commands show a toast with the reason
- [ ] Undo wired to the M1 undo; selectors for derived values (doom total, thresholds)

## M3.2 Header (S)

- [ ] Round, phase, "Next" button (calls `NextPhase`)
- [ ] Agenda: doom x / threshold with +/−; act: clues x / threshold; tap opens the card
- [ ] Undo button, menu (home, settings, export)

## M3.3 Map rendering (O)

Ref: §5 Map model.

- [ ] SVG board with pan/zoom/pinch (react-zoom-pan-pinch); slots from the scenario layout
- [ ] Location tiles: name, revealed/unrevealed, shroud, clues, doom, attachments badge
- [ ] Connection lines (arrows for one-way), map tabs when several maps exist
- [ ] Investigator pawns and enemy chips at locations

## M3.4 Board interactions (S)

- [ ] Drag pawn to a connected location → `MoveInvestigator`; drag enemy → `MoveEnemy`/`EngageEnemy`
- [ ] Location long-press menu: reveal, add/remove clue or doom, discover clue for investigator
- [ ] Illegal drops snap back with a hint

## M3.5 Investigator bar (S)

- [ ] One panel per investigator: portrait, health/horror, clues, resources with +/− steppers
- [ ] Threat area and engaged enemies as chips; tap → card zoom
- [ ] Turn-taken marker, defeated/resigned state

## M3.6 Encounter panel (S)

- [ ] Deck count, "Draw for <investigator>", revealed card with keyword badges and "resolve" quick actions
- [ ] Discard pile, set-aside cards, victory display (expandable lists)

## M3.7 Decision dialog and card zoom (S)

- [ ] Modal for pending `Decision`s with the engine's options
- [ ] Card zoom: front/back image, text fallback from card data

## M3.8 Event log (S)

- [ ] Chronological, human-readable list (event → i18n string)
- [ ] Jump back: confirm, then undo to that command group

## M3.9 Tablet pass and E2E (S)

- [ ] Landscape tablet layout check (1180×820 and 1024×768), touch sizes, no horizontal scroll
- [ ] Playwright: play two full rounds of the sandbox scenario; refresh mid-mythos restores the exact state

Done when: a full sandbox game is playable and comfortable on a tablet.
