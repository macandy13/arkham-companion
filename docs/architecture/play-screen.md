# Play screen

The [game screen](../../apps/web/src/screens/GameScreen.tsx) shows, from top to bottom:

1. a header with the encounter piles, agenda, act and scenario ([encounter piles](play-screen-encounter.md)),
2. a status row,
3. the map ([map and locations](play-screen-map.md)),
4. and the investigator bar ([investigators and enemies](play-screen-investigators.md)).

The first open decision shows as a dialog over the board ([decisions](play-screen-decisions.md)).
Each part has its own page, so changes to different parts touch different files.

The [status row](../../apps/web/src/screens/GameStatus.tsx) has the round, the phase track, Next and round icon buttons for adjust, undo and a ☰ menu (the play screen hides the app's title bar, so its links and the export sit in that menu).

## Symbols

The game's own symbols (skills, wild, action, free, reaction, per investigator, the six classes, and the chaos tokens except the 2026 Core Set's blood, which the sheet lacks) are bundled as one-colour SVGs in [`symbols/`](../../apps/web/src/symbols/):

- one file per symbol named after the engine's name in snake case where it has one (`willpower.svg`, `elder_sign.svg` for `elderSign`),
- each in a 100×100 box with the glyph centred;
- components draw them as a CSS `mask` filled with the text colour, so one file serves both themes.

They were cut from the community sheet "Arkham Horror LCG Symbols – Main Sets – Core Game Set" (an Inkscape SVG that names no author or licence; its other pages hold the campaign and encounter set icons), which traces Fantasy Flight Games' printed icons, so they are © Fantasy Flight Games like the cards, which the settings' copyright notice says.

## Layout

Markup is structure only; the playmat look lives in CSS on [`tokens.css`](../../apps/web/src/styles/tokens.css), with a dark and a light theme.

The investigators stand in a column beside the map in landscape and below it in portrait (`orientation` media queries in [`game.css`](../../apps/web/src/screens/game.css)), as in the prototype.
The board stretches to the foot of the screen, so the map always takes the room the header, status row and investigators leave.

## Phone

A phone held upright (`(orientation: portrait) and (max-width: 40rem)`) gets the compact mode (M3.14, designed in the phone prototype of #432, removed once the app showed the same).
The same query opens a block in [`tokens.css`](../../apps/web/src/styles/tokens.css) (smaller header cards, tokens, skills and counters), `game.css` and [`investigators.css`](../../apps/web/src/investigators/investigators.css), written out in each, since a custom property cannot stand in a media query. On a phone:

- the header shows only its four cards in one row:
  - the slot labels are hidden for the eye only,
  - and the piles, the victory display and the card plates are hidden.
  - A tap on a card opens the detail view on it (below);
- the status row names only the current phase, so it stays on one line;
- the investigator bar shows one panel, the focused one (`data-focus`, `useFocus` in [`InvestigatorBar.tsx`](../../apps/web/src/investigators/InvestigatorBar.tsx): the one whose avatar was tapped until the turn changes, else the turn's, else the lead), without its art window, and the other investigators as round avatar buttons above it.
  The avatars are in the markup on every screen and hidden outside the phone, so the switch is CSS only.

### Detail view

On a phone a tap on a header card, the map's expand button or the investigator's name opens the **detail view** on it instead (`usePhone` and `useDetailView` in [`screens/`](../../apps/web/src/screens/), `#board[data-view='detail']`).
It rearranges the same parts and adds no second copy of them:

- the stylesheets turn the header, the map and the investigator bar into three rows a screen tall, snapped vertically,
- and the header's five places (its four cards and the victory display) and every investigator panel snap sideways at full size, with their labels, piles and plates back.

The agenda and act there are their full version (`GameHeader` `full`): their action rows sit under them, and a tap on one opens no second, full-card dialog as it does on the tablet.

[`DetailControls`](../../apps/web/src/screens/DetailControls.tsx) scrolls to the card or panel tapped, draws the × and the row and card dots from the scroll positions, and moves the cards row back to the agenda once the players leave it.

- Opening pushes a history entry, so the back gesture, Escape and the × all close it through `history.back()`.
- While the compact view shows, a tap in a header place is caught in its capture phase (`HeaderSlot` `onOpen`), so the card's own buttons and dialogs wait for the detail view.

In the map row the map takes every touch (`touch-action: none`, besides the zoom library's own handlers), so panning never scrolls the board; a strip above and below the map ([`MapStrip`](../../apps/web/src/screens/MapStrip.tsx)) is where a vertical swipe to the next row starts.

- The upper strip shows the cards row's numbers (doom, act clues, encounter deck, round and phase) as icons with the values,
- the lower one those of the turn's investigator, else the lead (actions left, counters, skills).

The strip's accessible name says them in words.
A tap on a strip moves the view to the agenda or to that investigator's panel (`useDetailView().go`, which changes the target without a new history entry).

### Location mode

On a phone a tap on a location, in the compact map or the map row, shows that location in the map row in place of the map (`{ row: 'map', location }`, [`LocationFocus`](../../apps/web/src/map/LocationFocus.tsx)) instead of the details dialog the tablet opens. The strips stay above and below it.

- Its content is the dialog's ([`LocationContent`](../../apps/web/src/map/LocationDetails.tsx)): the card, shroud and clues, who is there, the attached cards, and the action row or the corrections. The stylesheets share their rules (`:is(dialog[data-dialog='location'], [data-mode='location'])`).
- Its connected locations sit around the card, each on the side where its tile lies on the map (`neighboursOf` in [`mapLayout.ts`](../../apps/web/src/map/mapLayout.ts): above or below where the centres lie further apart down than across, otherwise left or right).
  - Each neighbour is a small tile with its connection symbol, its name and the initials of who is there.
  - A barricaded neighbour (a card forbids moving in) has a dashed red frame, and a one-way connection into the shown location a dotted one; the tile's name says both.
  - A tap on a neighbour shows it instead (`go`, no new history entry), sliding in from that side unless the players prefer reduced motion.
- It stays on the location after a move or an investigation, since it is a row, not a window over it.
- The Map button brings the whole map back, and so does the location leaving play. While the players choose where a spawned enemy goes, the map shows until they place it.
- It takes the focus as it opens, so a keyboard tap on a tile's "i" button lands on it.

### Cards over the whole screen

On a phone an enemy's details (`EnemyDetails`) and a zoomed card (`CardZoom`: a treachery or asset, a card attached to a location) are the same dialogs as on the tablet, laid over the whole screen without their frame (`game.css`).
The back gesture closes them as it closes the detail view ([`useBackCloses`](../../apps/web/src/screens/useBackCloses.ts)): opening pushes a history entry named by a fresh id, and the ×, Escape and their buttons that close them (fight, evade, a card action) step back through it once.
The detail view names its own entry too and ignores a back step that lands on it.
A card that goes while it is open (an enemy leaving play) drops its entry a tick later, unless it mounts again at once (development's double effects), so no back step is left that changes nothing.

### Screen edges and turning

- The page reaches under a notch, rounded corners and the home bar (`viewport-fit=cover` in `index.html`).
  `#app` pads itself by the safe areas (`--safe-*` in `tokens.css`, from `env(safe-area-inset-*)`), and the detail view's floating ×, dots and notices add them to their insets.
- The play screen is `100dvh` tall, the visible height, so a phone's address bar never hides the strips or the turn controls.
- The web app manifest allows any orientation, so an installed app turns with the phone.
  A phone held sideways (`(orientation: landscape) and (max-height: 30rem)`) keeps the tablet's board, with the compact mode's header row and sizes (a second query on the first phone blocks of `tokens.css` and `game.css`), so the map and the investigator panel keep the screen's little height.
- Dialogs fit the phone's width; the encounter dialog shows two cards of a pile at a time.

## Game log

[`gameLog`](../../apps/web/src/log/gameLog.ts) reads the game's stored log as the players would tell it (M3.8):

- one step per undo group (`commandId`), the unit undo takes back, so the log and undo agree on what a step is;
- each event the players care about becomes one translated line (`log.*` strings), named with the cards and investigators of the state; bookkeeping (phase steps, queues, decisions asked, map layout) has none, and a step without lines is left out;
- a clue discovery is one line, without the location and investigator counters it moved.

[`eventLines`](../../apps/web/src/log/gameLog.ts) is the same for one step's events, for notices of what a step just did (M3.13).

## Frames

Screens outside play, dialogs and the play screen's notices (at half the frame width) share one frame in the playmat's line style (brass rules, a quarter of its zodiac ring and a star in each corner, [`panel_frame.svg`](../../apps/web/src/styles/panel_frame.svg) as a `border-image`, with a light-theme copy) and a small ring under each title ([`ornament_rule.svg`](../../apps/web/src/styles/ornament_rule.svg)).
Their panels are the see-through night by night and parchment by day (`--panel-paper`).
The investigator cards are parchment in both themes, like printed cards and the location tiles.

## Extension points

- **A new event:** its line (or `undefined` for bookkeeping) in `eventLine`'s `switch`, which fails to compile until it has one, with en and de strings under `log`.
- **A new game symbol:** cut it from the symbol sheet into `symbols/<name>.svg` (one path, 100×100 box, no colour) and draw it with `mask: url(...)`.
- **A part that changes on a phone:** add its rules to the phone block of its stylesheet (same query as in `tokens.css`), and a size to the phone block of `tokens.css`; hide what the phone leaves out rather than rendering per screen size.
