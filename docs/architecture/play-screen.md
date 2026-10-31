# Play screen

The [game screen](../../apps/web/src/screens/GameScreen.tsx) shows, from top to bottom:

1. a header with the encounter piles, agenda, act and scenario ([encounter piles](play-screen-encounter.md)),
2. a status row,
3. the map ([map and locations](play-screen-map.md)),
4. and the investigator bar ([investigators and enemies](play-screen-investigators.md)).

The first open decision shows as a dialog over the board ([decisions](play-screen-decisions.md)).
Each part has its own page, so changes to different parts touch different files.

The [status row](../../apps/web/src/screens/GameStatus.tsx) has the round, the phase track, Next and round icon buttons for adjust, undo, the game log and a ☰ menu (the play screen hides the app's title bar, so its links and the export sit in that menu).

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

- one step (`LogStep`) per undo group (`commandId`), the unit undo takes back, so the log and undo agree on what a step is;
- each step carries the round and phase it ended in, whose turn it was (the actor) and when it was stored (`GameSession.stepTimes`, from `StoredEvent.timestamp`);
- each event the players care about becomes one `LogLine`: its event type, its actor (the investigator it names, or the enemy that engaged or attacked) and a translated text (`log.*` strings), named with the cards and investigators of the state; bookkeeping (phase steps, queues, decisions asked, map layout) has none, and a step without lines is left out;
- a clue discovery is one line, without the location and investigator counters it moved.

The log button opens [`GameLogDialog`](../../apps/web/src/log/GameLogDialog.tsx) over the board. `logSections` cuts the steps, in the order played, into sections of one round and phase, and the dialog opens scrolled to the end, so the newest step shows first. Each section's heading sticks to the top while its steps scroll under it, so the round, phase and actor are never repeated on every line. It is wider than the other sheets on a desktop or tablet, and fills the screen on a phone held upright. A step shows its actor and time above its lines, with a rule between steps. It reads `OpenGame.log` (the session's `entries`, `stepTimes` and the rules that name their cards), so it waits for no step.

Every step but the newest has "Go back here": after a confirm that counts the steps taken back, `GameActions.undoTo` takes back each later step, one undo group at a time (`GameSession.undoTo`, the same `GameStore.undoLast` as Undo), so the game is as it was right after that step. It waits like every other step, and the log offers it neither while a step is queued nor while the players adjust the board.

[`eventLines`](../../apps/web/src/log/gameLog.ts) is the same for one step's events, for notices of what a step just did (M3.13).

## Paper and frames

Screens outside play and every dialog are printed on campaign-guide paper ([`base.css`](../../apps/web/src/styles/base.css), MD.1 of the [design language](../product.md#design-language-md)): `--paper` with a darker edge and a shadow, the same in both themes, titles in Federant (`--font-family-print`) with a small ring under a screen's title ([`ornament_rule.svg`](../../apps/web/src/styles/ornament_rule.svg)).
The paper redefines the table's colour tokens (`--color-text`, `--color-border`, `--color-surface`, `--color-accent`, `--color-background`, and the game's clue, doom, health and sanity colours as their deeper day shades) as ink and paper, so text, buttons, fields and menus on it turn to ink without rules of their own; a new dialog needs nothing to look printed.
Buttons on the paper follow the form, not class names (MD.1b): a footer's buttons stand in one row as outlined pills, the button that submits the dialog's `<form>` is the view's one primary (a brass pill) and, in an `alertdialog` asking before something is removed, a red one. So a dialog marks its primary by making its main action the form's submit (`ConfirmDialog`, `CluePaymentDialog`).
Every dialog shares one shell (MD.1c): it is as wide as its content up to `--dialog-width` (a question, `alertdialog`, up to `--dialog-width-narrow`, the encounter piles up to `--dialog-width-wide`), padded by `--dialog-padding` (less on an upright phone), with its × (`button[data-icon='close']` as the dialog's direct child) in the top corner and a centred title kept clear of it. A title may stand under a kicker that says what the dialog belongs to: an `<hgroup>` with a `<p>` before the `<h2>` (the skill test names its investigator so).
In-game dialogs move onto the card dialog shell ([`CardDialog`](../../apps/web/src/screens/CardDialog.tsx), [`card_dialog.css`](../../apps/web/src/screens/card_dialog.css), MD.2a; the decision dialog first). The `<dialog>` is only a frame and its `<article>` is the paper page; `data-shell` lays it out:

- `beside`: the card it is about stands left of the page, turned a little and laid over its edge;
- `above`: a sideways card (agenda, act) stands over the page;
- `portrait`: without a card, the investigator who acts stands round and large over the page;
- `page`: the page alone.

With a card, the investigator who acts sits small in the kicker (their art cut from their card like the clue payment's avatars). The card is a button that opens it whole (`CardZoom`). On an upright phone the page is a sheet along the bottom with a grab handle and a footer of full-width buttons, and the card (or portrait) peeks out over its top edge on the left, beside the title.
A dialog that must be answered but leaves the board in reach (`lowerable`, the decision) gets a grab handle at the top of its page instead: it lowers the dialog to a strip along the bottom with only the handle and the title, shown as a plain dialog (`show()`, not `showModal()`, which would make the board inert), so the players can tap the board and the header, and raises it again.
The app's labels use the guide's fonts (Federant for titles and big numbers, Libre Caslon Text, `--font-family-label`, for labels and kickers); IM Fell English SC (`--font-family-display`) stays on the card faces.
The play screen's notices keep the playmat's frame (brass rules, a quarter of its zodiac ring and a star in each corner, [`panel_frame.svg`](../../apps/web/src/styles/panel_frame.svg) as a `border-image`, with a light-theme copy), the see-through night by night and parchment by day (`--panel-paper`).
The investigator cards are parchment in both themes, like printed cards and the location tiles.

## Extension points

- **A new event:** its line (or `undefined` for bookkeeping) in `eventLine`'s `switch`, which fails to compile until it has one, with en and de strings under `log`.
- **A new game symbol:** cut it from the symbol sheet into `symbols/<name>.svg` (one path, 100×100 box, no colour) and draw it with `mask: url(...)`.
- **A part that changes on a phone:** add its rules to the phone block of its stylesheet (same query as in `tokens.css`), and a size to the phone block of `tokens.css`; hide what the phone leaves out rather than rendering per screen size.
