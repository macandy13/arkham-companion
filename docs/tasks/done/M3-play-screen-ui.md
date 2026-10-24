# M3 – Play screen UI: finished tasks

Finished tasks, moved out of the former `docs/tasks/M3-play-screen-ui.md`. Their Done notes stay here for reference.

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
- [x] Location menu: reveal, add/remove clue or doom (opened by an edit button on the tile; discovering a clue moved to the investigator)
- [x] Illegal drops snap back with a hint (the rejection toast gives it)

M3.4a done (#178): the pawn of the investigator whose turn it is drags to another tile, a move action; a refused move snaps back with the rejection toast.

M3.4b done (#179, #185): `MoveEnemy` moves an enemy by a card effect (forced moves disengage it first); on the map an enemy dropped on another tile moves there as a forced move, and dropped on the turn investigator's pawn it engages them.

M3.4c done: an edit button on each tile opens its menu: reveal, and clue and doom steppers. A visible button replaced the planned long press, so the menu is found without knowing a gesture and is reached by keyboard too. It also fixed panning, which the pawn drag's `panning.excluded` entry had stopped since M3.4a. Discovering a clue moved to the investigator bar (M3.5: an investigate button on the investigator).

---

The sections below were still open on 2026-10-24, when the plan moved to GitHub issues (one parent issue per milestone, tasks and slices as sub-issues; see `docs/tasks/README.md`). They are kept here as the record of the work done so far; the live state is in the issues.

## M3.5 Investigator bar (S)

**Why:** Replaces each investigator's health/sanity dials and clue/resource piles.

**Benefit:** Everyone's status is visible; each change is one tap.

- [ ] One panel per investigator: portrait, health/horror, clues, resources and doom on player cards with +/− steppers
- [ ] Threat area and engaged enemies as chips; tap → card zoom
- [ ] Turn-taken marker, defeated/resigned state
- [ ] An investigate button on the investigator whose turn it is (clue discovery lives with the investigator, not on the location menu)
- [ ] Built in the UX prototype's form (M3.12): the investigator card with its threat area (treacheries as small cards, engaged enemies as small cards) along the top edge of the whole card or below it, never over the middle of it, and actions as icon buttons next to the action pips and End; the steppers show only in adjust mode once M3.11 lands

Slices, one PR each:

- [x] M3.5a: a panel per investigator: the card with the name band, the line on their round (turn, turn taken, defeated, resigned), health and sanity left with take/heal steppers, clues, resources with steppers, doom on player cards when any (`InvestigatorView` gains `health`, `sanity`, `doom`, `turnTaken`)
- [x] M3.5b: "Start turn" on each investigator the players may pick next; on the one whose turn it is, the turn row: action pips, resign as an icon button, End
- [x] M3.5c: the threat area along the top edge of the card: treacheries and engaged enemies as small cards, the enemies with their health left, at most four in view and the rest a swipe or an arrow away, a whole card at a time (fighting and evading them on a tap, and tapping a card to zoom it, come with M3.7)
- [ ] Investigate, fight and evade as icon buttons in the turn row come with M3.7: each leaves a skill test open, and only the decision dialog lets the players report its result
- [ ] Follow-ups: the investigator card's picture once the view has one; clue and doom steppers need an investigator-counter correction in the engine (`ManualAdjust` has none yet), so they come with M3.11's adjust mode

## M3.6 Encounter panel (S)

**Why:** The encounter deck is what the app takes over from the players, and this panel is where that becomes visible.

**Benefit:** Draw with one tap, see what to resolve, and browse discard/set-aside cards without digging through piles.

- [ ] No side panel, as in the prototype: the header's encounter deck and discard cards open these as dialogs (the empty panel was removed in M3.12f2)
- [ ] Deck count, "Draw for <investigator>", revealed card with keyword badges and "resolve" quick actions
- [ ] Discard pile, set-aside cards, victory display (expandable lists)

## M3.7 Decision dialog and card zoom (S)

**Why:** Engine decisions need one consistent prompt, and card text must be readable at arm's length.

**Benefit:** Choices never get lost; any card can be read full size.

- [ ] Modal for pending `Decision`s with the engine's options, one layout per decision kind (M1.9); the skill test prompt shows skill, difficulty and pass/fail buttons plus "skip, adjust manually"
- [ ] Counts on an answer (`DecisionOption.amount` and `amounts`): attack damage to confirm, clues found, and how much a per-point test failed by (Grasping Hands, Rotting Remains). Until then the dialog answers with the defaults (a fail by 1)
- [ ] Card zoom: front/back image, text fallback from card data
- [ ] Tapping the agenda or act in the header opens its card (moved from M3.2): the header cards only fit the name and the doom or clue progress, so the full card shows the picture large (the pattern without one), its stage and its text once the card data has text, plus its actions as buttons (placing and removing doom, advancing). The picture view comes with M3.10c3; the text and the actions follow here

## M3.8 Event log (S)

**Why:** Players regularly ask "what just happened?" and need to correct mistakes several steps back.

**Benefit:** Transparency about what the app did, and rewinding to any earlier point.

- [ ] Chronological, human-readable list (event → i18n string)
- [ ] Jump back: confirm, then undo to that command group

## M3.9 Tablet pass and E2E (S)

**Why:** The target device is a tablet in landscape, and a refresh in the middle of a phase is the riskiest recovery case.

**Benefit:** Confidence that it works on the real device, plus regression protection in CI.

- [ ] Landscape tablet layout check (1180×820 and 1024×768), touch sizes, no horizontal scroll
- [x] Header laid out like the table, without the duplicated app title: the encounter deck (a placeholder card) and a small discard pile symbol on the left, then the agenda, act and the upright scenario card (its name as the screen heading), then round and phase, "Next" and undo; the game's export moved into the title bar next to Settings
- [ ] Encounter deck and discard pile show their counts and the top discard once the encounter phase draws cards
- [x] Act clue steppers for acts with a clue threshold: they correct the clue tokens on the act (investigators untouched), which count towards advancing it
- [ ] Replace the act's clue steppers with a dialog that moves clues onto the act from the investigators the players pick
- [ ] Smaller buttons across the play screen (header, map toolbar, location menu), like the compact buttons on the agenda and act cards (`--button-compact`), still easy to tap on a tablet
- [ ] Playwright: play two full rounds of the sandbox scenario; refresh mid-mythos restores the exact state
- [ ] Map follow-ups from M3.3: enemy tokens show engagement, damage and exhaustion (now only in their accessible name); map tabs get arrow-key navigation

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
- [x] The service worker caches fetched card images (runtime caching for the image host), so a started game keeps its art offline.
- [x] Tests and E2E use the pattern fallback, because CI and cloud sessions cannot reach arkhamdb.com.
- [ ] Follow-up from M3.10a: a clue-value badge next to the shroud badge, once `LocationView` carries the printed clue value
- [x] Add an "unofficial fan project" notice with an FFG copyright credit (the About/settings screen).

**Slices** (one PR each, in this order)

1. M3.10a: `CARD` size and the location tile as a layered card face (frame, patterned art area, name band, shroud badge, clue/doom/attachment tokens), without images
2. M3.10b: the agenda and act as landscape card faces in the header, sharing the face's parts
3. M3.10c1: `CardStats` carries each side's ArkhamDB picture path, and the location, agenda and act views pass on the one for the side in play (`image`)
   M3.10c2: the card faces load that picture and fall back to the pattern, the name band and badges hide under a picture, and the service worker caches the pictures
   M3.10c3: tapping the agenda or act in the header opens its full card, with the picture large (the pattern without one); done with M3.7 in the prototype's dialog style
   The paths come with the real card data: M4.4 maps carddata's `CardDef`s (which carry `imageSrc`/`backImageSrc`) to `CardStats`. Until then the hand-written The Gathering cards name their ArkhamDB pictures themselves (M3.12c).
4. M3.10d: the "unofficial fan project" notice

Done: M3.10a draws each location tile as a card face: frame, a hatched art area (crossed when unrevealed), the name band with the edit button and, on top, the shroud badge and round clue, doom and attachment tokens. The printed clue value is not in `LocationView` yet, so there is no clue badge (follow-up below). Follow-up: long names (Miskatonic University) run under the edit button; wrap or shrink them in the name band.

Done: M3.10c2 loads the side's picture from ArkhamDB on the location tiles and the header's agenda and act (`useCardPicture`) and lays it over the face once it has loaded, with the name band and shroud badge made transparent under it; until then, and when it fails, the face keeps its pattern. The service worker caches the pictures cache-first (`cardImageCaching`). The hand-written cards have no pictures, so nothing changes on screen until M4.4 maps the real card data. Follow-ups: the scenario card and the encounter deck get their pictures once the views carry them; the picture covers the location frame, so check the look with real scans in M4.4; ArkhamDB's CORS headers for images are unverified (no network here), and with them the pictures could load with `crossorigin` and cache as plain rather than padded opaque responses.

Done: M3.10b draws the agenda and act in the header as landscape cards (`data-card`, a frame per card type, the hatched art area as a CSS pattern token, the name band on top and a plate below with the count and small buttons: the doom steppers on the agenda, "Advance" on the act).

Done when: a full sandbox game is playable and comfortable on a tablet.

## M3.11 Adjust board mode and token drag (O)

**Why:** Keeping the screen in step with the table takes many small corrections. One tap per undo step makes a correction of several counters slow to make and slow to take back.

**Benefit:** The players fix the board in one go and take the whole fix back with one undo. Later, they move tokens the way they move them on the table.

- [x] An "Adjust board" mode: while it is on, the location menu's steppers and the investigator bar's steppers change counters, and "Done" plays them all as one step (`PlayTable.step`, one undo group); "Cancel" drops them
- [ ] Drag and drop tokens (clues, doom, damage, horror, resources) from one element onto another, e.g. a clue from a location onto an investigator, as one step each

Slices:

- [x] M3.11a: adjusting in the session: `GameSession` plays the taps of an adjustment on the table in memory only, stores them as one step on "Done" (one undo group) and drops them on "Cancel"; undo while adjusting takes back the last tap. `OpenGame.adjusting` and `GameActions.startAdjusting`/`finishAdjusting`/`cancelAdjusting`
- [x] M3.11b: the "Adjust board" button with "Done" and "Cancel"; the steppers (investigators, header cards) and the location pencil show only while adjusting
- [ ] M3.11c: token drag

Done: M3.11a/b. "Adjust board" in the header starts an adjustment; while it lasts, "Done" and "Cancel" replace "Next", and the investigators', agenda's and act's steppers and the tiles' edit buttons show. Turn controls, the act's advance and piece drags wait meanwhile, since every step joins the adjustment. A dashed brass line round the map marks the mode.

## M3.12 Restyle after the UX prototype (O)

**Why:** The play screen works but looks like a plain form. The clickable UX prototype (draft PR #214, `apps/web/public/prototype/index.html` on branch `claude/project-thread-vs8ujm`, copy at `/mnt/project-files/design/ux_prototype.html`) showed a look the players want: the table's playmat, cards that read like the printed ones, and controls that only show when needed.

**Benefit:** The screen looks like the table it mirrors, and it stays calm during play because corrections hide until the players ask for them.

Decisions from the prototype review:

- **Two looks**, switched in settings:
  - "Frames with card art": our own frame and name band around the card's art, cut out of the ArkhamDB picture. It is also the look without pictures, with the pattern in place of the art.
  - "Full card faces": the whole scanned card.
- **Adjust mode (M3.11):** the −/+ steppers and the location pencil show only in adjust mode. "Done" keeps every change as one undo step, and "Cancel" drops them.
- **Locations:** shroud on the left and clues on the right, at mid height like the printed card. Doom goes under the clues, and attachments peek out at the top right as small cards.
- **Agenda and act:**
  - Doom and clue counts are big round tokens on the card ("2 of 7").
  - The act keeps a compact "Advance" on the card.
  - Header labels follow the playmat: Encounter, Agenda n, Act n, Scenario.
- **Investigators:**
  - The investigator card carries its threat area along the top edge of the whole card or below it, never over its middle: treacheries and engaged enemies as small cards (enemies with their health left, PR #228 review), at most four in view, the rest a swipe or an arrow away.
  - Actions are icon buttons next to the action pips and End.
- **Dialogs:** a small X at the top right closes them, with no Close buttons. A dialog in the middle of a flow has no X.
- **Skill tests:**
  - They show the full sum (skill + committed + token(s) = total vs difficulty), then the result.
  - Chaos tokens look like the printed ones: a dark disc with an ivory rim, showing numbers or our own symbols.
- **Look and feel:**
  - A playmat-style night background (sea-green, a brass zodiac ring, tentacles), drawn by us as a static SVG.
  - Display font IM Fell English SC and UI font Alegreya Sans, both OFL and self-hosted (`@fontsource`) so the PWA works offline.

**Slices** (one small PR each)

- [x] M3.12a: style tokens (night, brass and bone, plus the clue, doom, health and sanity colours), fonts and the playmat background; the base, header, buttons and dialog shell restyled
- [ ] Cards (location tiles, header cards) stay dark in both themes, like printed cards; done with M3.12b–d (the map's tiles and attachments since M3.12b)
- [x] M3.12b: location tiles in the frame look: mid-height shroud and clues, doom under the clues, attachments as peeking cards
- [ ] M3.12c: card art in frames (art crops per card type) and the "Full card faces" setting, on the M3.10c2 pictures. Slices:
  - [x] M3.12c1: The Gathering's hand-written cards name their ArkhamDB pictures, so the app shows real art before M4.4; the E2E guard turns pictures down, so tests and screenshots keep the pattern
  - [x] M3.12c2: the "Card pictures" setting (frames with card art, or full card faces) and the location tiles' art crop
  - [x] M3.12c2c: the location tiles drawn like the printed location cards (our own SVG frame over full-width art), after the prototype's ornament drafts looked too plain; one PR over the size budget, since either half alone looks broken (the frame without the new layout leaves the printed template in the art, the layout without the frame shows it)
  - [ ] M3.12c2b: the header's agenda and act in both looks, after M3.12d (art crops: agenda front left 40 %, act front right 40 %, backs show the pattern; check the scan's orientation first)
  - [ ] M3.12c3: avatar crops for investigator pawns and enemy tokens, once their views carry a picture

  Done: M3.12c2 adds `Settings.cardLook` (`frames` by default, or `faces`), set on the document as `data-card-look`. A location tile with a picture cuts the art out into its art window (`ART_WINDOW`, from the name band down to the doom token) with a nested SVG whose `viewBox` is the art's area of the scan (`LOCATION_ART` in `cardArt.ts`), and keeps our name band and tokens on top; with full faces it lays the whole scan over the tile as before. M3.12c2c redraws the tile after the printed location card (`LocationOrnament` in `map/cardOrnament.tsx`): the art window now spans the card's art area at half a scan's scale (`LOCATION_ART` matches it), so the printed pendant, icon and circles fall under our frame; shroud and clues sit on the edges where the art ends; pieces stand freely on the foot with a ring and a shadow, no slots. A long name shrinks to fit the name plate (`NAME_WIDTH`, `shrinkToFit`), so it never reaches the edit button.

  Findings from the real scans (2026-10-23): ArkhamDB serves them at about 300 × 419 (some 750 × 1050), JPEG or PNG whatever the extension, with no CORS header, so crops are CSS or SVG (`object-position`, `viewBox`), never canvas. The art sits in the same place on every card of a type across the cycles: a location's on both sides from about 7 % to 52 % of the height, full width, of which 12.5 % to 45.5 % and 2 % in from the sides are free of the printed template (name band ornament, location icon, edges); an enemy's in the bottom 40 %, free of the template from 67 % to 95 %, 2 % in from the sides; a treachery's in the top half, inside the keyhole; an agenda's front in the left 40 %, an act's front in the right 40 %, and their backs have none; an investigator's front in the left half, the face near (25 %, 33 %). The scenario reference card has no art. About 1 in 50 agenda, act and investigator scans is turned on its side, so a crop checks the picture's orientation and falls back to the pattern when it is wrong.

- [x] M3.12d: the header and status row in the prototype's form. Slices:
  - [x] M3.12d1: the status row: the round, the phase track, Next (Done and Cancel while adjusting) and round icon buttons for adjust, undo and a ☰ menu; the app's title bar folds into that menu on the play screen (all games, export, settings)
  - [x] M3.12d2: header cards: centred, big doom and clue tokens ("2 of 7"), playmat labels; the encounter deck's count waits for the engine's encounter deck (M3.6)
  - [x] M3.12d3: the investigator panel: the name large beside the card, End in brass, the counters as icons in a full-width row, no "Investigators" heading

  Done: M3.12d1 adds `GameStatus` (`screens/GameStatus.tsx`) below the header cards. Next keeps its label rather than naming the coming phase, since a tap may only run the steps within the current phase. M3.12d2 puts each header place (`HeaderSlot`) under its label and the agenda's doom and the act's clues on a big round `Token` at the card's right, which stays over the card's picture; the plate at the foot keeps only the buttons. M3.12d3 moves the investigator's name out of the card into a large heading beside it, fills Start turn and End in brass, and lays the counters in a full-width row, each name after its icon (`data-stat`; resources shortened to "Res." with the full name as its title); the investigators' area heading is for screen readers only.

- [ ] M3.12e: dialog style (the X close), with the skill-test sum and chaos-token drawings, inside M3.7
- [ ] M3.12f: ornaments and frames across the app (screens, panels, dialogs) in the playmat's line style: brass rules, quarters of its zodiac ring, stars, all our own SVG and CSS, no FFG art (a parchment book look was tried first, but it did not fit the playmat's modern look, #230 review)
  - [x] M3.12f1: the screens outside play (home, new game, settings) and every dialog framed like the playmat: a brass rule with a finer one inside, a quarter of the zodiac ring with its ticks and a star in each corner, a small ring between rules under the title; parchment panels in the light theme, see-through night in the dark one
  - [x] M3.12f2: the play screen's panels in the same style and the prototype's layout: the investigators in a column beside the map in landscape (below it in portrait), the empty encounter panel gone, the investigator panels and the notices framed, while the table stays the playmat (the header cards follow in M3.12d)

  Done: M3.12f1 frames `#app > main` (outside the board) and `dialog` with a `border-image` (`panel_frame.svg`, a light-theme copy in its accent colour, since an image cannot read the tokens) and puts the title's ornament (`ornament_rule.svg`, a mask in the accent colour) under the screen's `h1`. M3.12f2 lays the board out like the prototype (investigators beside the map in landscape, below it in portrait, the counters under the card in the column; the notices float over the foot of the map) and gives the investigator panels and the notices the same frame at half width (`--panel-frame-width-compact`), parchment by day, and marks the investigator whose turn it is with a brass glow (`--turn-glow`) instead of a border; the table stays open, with a brass rule above the investigator bar.

- [x] M3.12g: the map's controls take no room of it: the zoom buttons are small round icons and the map tabs small pills, both floating over its top corners; the area heading and the map's name are for screen readers only, since the map shows what it is and the tabs name several

- The investigator panel in the prototype's form is part of M3.5.

Done: M3.12a maps the dark theme to the playmat palette (night, brass, bone, see-through panels), lays our own playmat drawing (`styles/playmat.svg`) behind every screen as a fixed layer, sets headings in the display type, and gives every dialog one brass-framed shell over a dimmed table; the header row is shaded over the playmat. The light theme stays, as the same playmat by day (parchment, dark brass, ink, `styles/playmat_light.svg`). Follow-up:

- [x] Self-host IM Fell English SC and Alegreya Sans (`@fontsource`, OFL, Latin subsets) and precache them with the playmat drawings, so the PWA looks the same offline

Done: M3.12b lays the location tile out like the printed card: the shroud (a dark disc with a bone rim) at mid height on the left, the clues on the right (faded at none), doom under the clues, attachments as small cards peeking out at the right edge, each named for screen readers. Enemies became round tokens ringed in the doom colour, standing after the pawns in rows of four along the bottom edge, so they no longer cover the tokens; the map's cards stay dark in both themes.
