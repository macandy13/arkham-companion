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
9. M3.3b1: tile details (shroud, doom, attachments), investigator pawns and enemy chips
   M3.3b2: map tabs when several maps are visible
   M3.3b3: pan/zoom/pinch
10. M3.4a: drag the pawn of the investigator whose turn it is to move
    M3.4b1: `MoveEnemy`, an enemy moved to a location by a card effect (engine)
    M3.4b2: drag enemies to move or engage them
    M3.4c: location long-press menu
11. M3.5: investigator bar
    M3.11: adjust board mode and token drag (after the investigator bar, so it covers every counter)
12. M3.6: encounter panel
13. M3.7: decision dialog and card zoom
14. M3.8: event log
15. M3.9: tablet pass and E2E

---

## M3.5 Investigator bar (S)

**Why:** Replaces each investigator's health/sanity dials and clue/resource piles.

**Benefit:** Everyone's status is visible; each change is one tap.

- [ ] One panel per investigator: portrait, health/horror, clues, resources and doom on player cards with +/− steppers
- [ ] Threat area and engaged enemies as chips; tap → card zoom
- [ ] Turn-taken marker, defeated/resigned state
- [ ] An investigate button on the investigator whose turn it is (clue discovery lives with the investigator, not on the location menu)

## M3.6 Encounter panel (S)

**Why:** The encounter deck is what the app takes over from the players, and this panel is where that becomes visible.

**Benefit:** Draw with one tap, see what to resolve, and browse discard/set-aside cards without digging through piles.

- [ ] Deck count, "Draw for <investigator>", revealed card with keyword badges and "resolve" quick actions
- [ ] Discard pile, set-aside cards, victory display (expandable lists)

## M3.7 Decision dialog and card zoom (S)

**Why:** Engine decisions need one consistent prompt, and card text must be readable at arm's length.

**Benefit:** Choices never get lost; any card can be read full size.

- [ ] Modal for pending `Decision`s with the engine's options, one layout per decision kind (M1.9); the skill test prompt shows skill, difficulty and pass/fail buttons plus "skip, adjust manually"
- [ ] Counts on an answer (`DecisionOption.amount` and `amounts`): attack damage to confirm, clues found, and how much a per-point test failed by (Grasping Hands, Rotting Remains). Until then the dialog answers with the defaults (a fail by 1)
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
- [ ] Map follow-ups from M3.3: enemy chips show engagement, damage and exhaustion (now only in their accessible name); chips stack without a limit, so a third enemy on a busy tile overlaps the pawns; map tabs get arrow-key navigation

## M3.10 Card art and card-format layout (O)

**Why:** The map tiles and the agenda/act panels are plain boxes. The real cards already exist as images, and showing them makes the board look like the table it mirrors.

**Benefit:** Location tiles and the agenda and act look like their cards, and they still work with no network or no image.

The fan IP policy that covers FFG (Asmodee's community-use guidelines) does not allow FFG art inside apps. So the app never commits or bundles card images or FFG icons. It fetches them at runtime from ArkhamDB on the user's device, the same way the investigator picker already does (`imageSrc`/`backImageSrc`, `DEFAULT_IMAGE_HOST`).

- [x] One shared card size next to `TILE` in `apps/web/src/map/mapLayout.ts`: every card is 63.5 × 88 mm, laid out at 5 : 7 (150 × 210 units). Locations, the scenario reference and encounter cards are portrait; the agenda and act are landscape (210 × 150).
- [ ] Our own layered card template (CSS/SVG, colours from `tokens.css`):
  - a frame;
  - an art area that shows the card image when one loads, and a pattern per card type otherwise;
  - a name band and stat badges (shroud/clues, doom threshold, clue threshold), hidden when the image shows them;
  - a live overlay that always shows clues, doom, connection symbols and the avatars.
- [ ] Location tiles show the unrevealed or revealed face, and the agenda and act show their current side.
- [ ] Enemies and investigators stay round avatar tokens, never cards, because cards would crowd the map.
- [ ] The service worker caches fetched card images (runtime caching for the image host), so a started game keeps its art offline.
- [ ] Tests and E2E use the pattern fallback, because CI and cloud sessions cannot reach arkhamdb.com.
- [ ] Follow-up from M3.10a: a clue-value badge next to the shroud badge, once `LocationView` carries the printed clue value
- [x] Add an "unofficial fan project" notice with an FFG copyright credit (the About/settings screen).

**Slices** (one PR each, in this order)

1. M3.10a: `CARD` size and the location tile as a layered card face (frame, patterned art area, name band, shroud badge, clue/doom/attachment tokens), without images
2. M3.10b: the agenda and act as landscape card faces in the header, sharing the face's parts
3. M3.10c1: `CardStats` carries each side's ArkhamDB picture path, and the location, agenda and act views pass on the one for the side in play (`image`)
   M3.10c2: the card faces load that picture and fall back to the pattern, the name band and badges hide under a picture, and the service worker caches the pictures
   The paths come with the real card data: M4.4 maps carddata's `CardDef`s (which carry `imageSrc`/`backImageSrc`) to `CardStats`; until then the hand-written cards have none and the faces show the pattern.
4. M3.10d: the "unofficial fan project" notice

Done: M3.10a draws each location tile as a card face: frame, a hatched art area (crossed when unrevealed), the name band with the edit button and, on top, the shroud badge and round clue, doom and attachment tokens. The printed clue value is not in `LocationView` yet, so there is no clue badge (follow-up below). Follow-up: long names (Miskatonic University) run under the edit button; wrap or shrink them in the name band.

Done when: a full sandbox game is playable and comfortable on a tablet.

## M3.11 Adjust board mode and token drag (O)

**Why:** Keeping the screen in step with the table takes many small corrections. One tap per undo step makes a correction of several counters slow to make and slow to take back.

**Benefit:** The players fix the board in one go and take the whole fix back with one undo. Later, they move tokens the way they move them on the table.

- [ ] An "Adjust board" mode: while it is on, the location menu's steppers and the investigator bar's steppers change counters, and "Done" plays them all as one step (`PlayTable.step`, one undo group); "Cancel" drops them
- [ ] Drag and drop tokens (clues, doom, damage, horror, resources) from one element onto another, e.g. a clue from a location onto an investigator, as one step each
