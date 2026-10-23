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
11. M3.12a–c: restyle after the UX prototype (style tokens, location tiles, card art in frames)
12. M3.5: investigator bar, built in the prototype's form (M3.12)
    M3.11: adjust board mode and token drag (after the investigator bar, so it covers every counter)
    M3.12d: header cards in the prototype's form, steppers only in adjust mode
13. M3.6: encounter panel
14. M3.7: decision dialog and card zoom, in the prototype's dialog style (M3.12e); it takes over M3.10c3
15. M3.8: event log
16. M3.9: tablet pass and E2E

---

## M3.5 Investigator bar (S)

**Why:** Replaces each investigator's health/sanity dials and clue/resource piles.

**Benefit:** Everyone's status is visible; each change is one tap.

- [ ] One panel per investigator: portrait, health/horror, clues, resources and doom on player cards with +/− steppers
- [ ] Threat area and engaged enemies as chips; tap → card zoom
- [ ] Turn-taken marker, defeated/resigned state
- [ ] An investigate button on the investigator whose turn it is (clue discovery lives with the investigator, not on the location menu)
- [ ] Built in the UX prototype's form (M3.12): the investigator card with its threat area (treacheries as small cards, engaged enemies as avatar tokens) along the top edge of the whole card or below it, never over the middle of it, and actions as icon buttons next to the action pips and End; the steppers show only in adjust mode once M3.11 lands

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

- [ ] An "Adjust board" mode: while it is on, the location menu's steppers and the investigator bar's steppers change counters, and "Done" plays them all as one step (`PlayTable.step`, one undo group); "Cancel" drops them
- [ ] Drag and drop tokens (clues, doom, damage, horror, resources) from one element onto another, e.g. a clue from a location onto an investigator, as one step each

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
  - The investigator card carries its threat area along the top edge of the whole card or below it, never over its middle: treacheries as small cards, engaged enemies as avatar tokens.
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
  - [ ] M3.12c1: The Gathering's hand-written cards name their ArkhamDB pictures, so the app shows real art before M4.4; the E2E guard turns pictures down, so tests and screenshots keep the pattern
  - [x] M3.12c2: the "Card pictures" setting (frames with card art, or full card faces) and the location tiles' art crop
  - [ ] M3.12c2b: the header's agenda and act in both looks, after M3.12d (art crops: agenda front left 40 %, act front right 40 %, backs show the pattern; check the scan's orientation first)
  - [ ] M3.12c3: avatar crops for investigator pawns and enemy tokens, once their views carry a picture

  Done: M3.12c2 adds `Settings.cardLook` (`frames` by default, or `faces`), set on the document as `data-card-look`. A location tile with a picture cuts the art out into its art window (`ART_WINDOW`, from the name band down to the doom token) with a nested SVG whose `viewBox` is the art's area of the scan (`LOCATION_ART` in `cardArt.ts`), and keeps our name band and tokens on top; with full faces it lays the whole scan over the tile as before.

  Findings from the real scans (2026-10-23): ArkhamDB serves them at about 300 × 419 (some 750 × 1050), JPEG or PNG whatever the extension, with no CORS header, so crops are CSS or SVG (`object-position`, `viewBox`), never canvas. The art sits in the same place on every card of a type across the cycles: a location's on both sides from about 7 % to 52 % of the height, full width; an enemy's in the bottom 40 %; a treachery's in the top half, inside the keyhole; an agenda's front in the left 40 %, an act's front in the right 40 %, and their backs have none; an investigator's front in the left half, the face near (25 %, 33 %). The scenario reference card has no art. About 1 in 50 agenda, act and investigator scans is turned on its side, so a crop checks the picture's orientation and falls back to the pattern when it is wrong.

- [ ] M3.12d: header cards: big doom and clue tokens, playmat labels, steppers only in adjust mode (after M3.11)
- [ ] M3.12e: dialog style (the X close), with the skill-test sum and chaos-token drawings, inside M3.7
- The investigator panel in the prototype's form is part of M3.5.

Done: M3.12a maps the dark theme to the playmat palette (night, brass, bone, see-through panels), lays our own playmat drawing (`styles/playmat.svg`) behind every screen as a fixed layer, sets headings in the display type, and gives every dialog one brass-framed shell over a dimmed table; the header row is shaded over the playmat. The light theme stays, as the same playmat by day (parchment, dark brass, ink, `styles/playmat_light.svg`). Follow-up:

- [x] Self-host IM Fell English SC and Alegreya Sans (`@fontsource`, OFL, Latin subsets) and precache them with the playmat drawings, so the PWA looks the same offline

Done: M3.12b lays the location tile out like the printed card: the shroud (a dark disc with a bone rim) at mid height on the left, the clues on the right (faded at none), doom under the clues, attachments as small cards peeking out at the right edge, each named for screen readers. Enemies became round tokens ringed in the doom colour, standing after the pawns in rows of four along the bottom edge, so they no longer cover the tokens; the map's cards stay dark in both themes.
